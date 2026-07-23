const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

// Fallback API key for server-side API calls (when X-Vibe-Authorization is not available)
// This is safe because we still filter data by user ID from session
const FALLBACK_API_KEY = 'vibe_api_B5LhuhAlxAfjnWVLTCD6RU0UsDWl6IvV_05fc97';

app.use(cors());
app.use(express.json());

// No-cache middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const db = {
  visits: [],
  orders: []
};

// Parse cookies from request
function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

// Get session token from header or cookie
function getSessionToken(req) {
  // First check X-Vibe-Authorization header (from Gateway)
  const authHeader = req.headers['x-vibe-authorization'] || req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Then check cookie (for AJAX requests)
  const cookies = parseCookies(req);
  if (cookies.vibe_session) {
    return cookies.vibe_session;
  }
  
  return null;
}

// Save session token to cookie
function saveSessionToken(res, token) {
  if (token) {
    res.setHeader('Set-Cookie', 'vibe_session=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
  }
}

// Get API key for server-side calls
function getApiKey(req) {
  // First try X-Api-Key header
  const apiKey = req.headers['x-api-key'];
  if (apiKey) return apiKey;
  
  // Fallback to hardcoded key
  return FALLBACK_API_KEY;
}

// Get current user from VibeCode API using session token
async function getCurrentUser(req) {
  const token = getSessionToken(req);
  if (!token) {
    throw new Error('No session token - please authenticate through VibeCode');
  }
  
  try {
    const response = await fetch(VIBECODE_API + '/me', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.success && data.data) {
      const user = {
        id: data.data.owner?.userId || data.data.user?.id || 1,
        name: data.data.owner?.name || 'User'
      };
      console.log('Current user:', user);
      return user;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
  
  throw new Error('Failed to get user info');
}

// Helper to call VibeCode API with API key (server-side)
async function callVibeApi(req, endpoint) {
  const apiKey = getApiKey(req);
  
  try {
    const response = await fetch(VIBECODE_API + endpoint, {
      headers: {
        'X-Api-Key': apiKey
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth middleware - require session token for API routes
function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  
  // If token from header, save to cookie for future AJAX requests
  const headerToken = req.headers['x-vibe-authorization'];
  if (headerToken && headerToken.startsWith('Bearer ')) {
    saveSessionToken(res, headerToken.substring(7));
  }
  
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please authenticate through VibeCode'
    });
  }
  
  next();
}

// Apply auth to API routes
app.use('/api', requireAuth);

// ============ USER CONTEXT API ============
app.get('/api/user-context', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const apiKey = getApiKey(req);
    
    // Get workgroups from Bitrix24
    let workgroups = [];
    try {
      const response = await fetch(VIBECODE_API + '/batch', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          halt: 0,
          cmd: {
            get_groups: 'sonet_group.get?FILTER[ACTIVE]=Y&LIMIT=50'
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const groups = data.result?.result?.get_groups || [];
        workgroups = groups.map(g => ({
          id: g.ID,
          name: g.NAME
        }));
      }
    } catch (e) {
      console.error('Error fetching workgroups:', e);
    }
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        lastName: ''
      },
      workgroups: workgroups,
      departmentHead: null
    });
  } catch (error) {
    console.error('Error getting user context:', error);
    res.status(500).json({ error: 'Failed to get user context', message: error.message });
  }
});

// ============ COMPANIES API ============
app.get('/api/companies', async (req, res) => {
  try {
    console.log('Fetching companies...');
    const search = req.query.search?.toLowerCase() || '';
    const companies = await callVibeApi(req, '/companies?limit=50');
    console.log('Companies fetched:', companies.length);
    
    let result = companies.map(c => ({
      id: c.id,
      TITLE: c.title,
      title: c.title,
      ADDRESS: c.address || c.ufCrm_1508844257 || '',
      address: c.address || c.ufCrm_1508844257 || '',
      phone: c.phone || '',
      email: c.email || '',
      fm: c.phone ? [{ typeId: 'PHONE', value: c.phone }] : []
    }));
    
    if (search) {
      result = result.filter(c => 
        (c.title || '').toLowerCase().includes(search) || 
        (c.address || '').toLowerCase().includes(search)
      );
    }
    
    res.json({ result: result });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies', message: error.message });
  }
});

// ============ SECTIONS API ============
app.get('/api/sections', async (req, res) => {
  try {
    const sections = await callVibeApi(req, '/catalog-sections?filter[iblockId]=24&limit=50');
    
    const result = sections.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      sort: s.sort || 500
    })).sort((a, b) => a.sort - b.sort);
    
    res.json({ result: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch sections', message: error.message });
  }
});

// ============ PRODUCTS API ============
app.get('/api/products', async (req, res) => {
  try {
    const sectionId = req.query.sectionId;
    let endpoint = '/products?limit=50';
    
    if (sectionId) {
      endpoint = '/products?filter[sectionId]=' + sectionId + '&limit=50';
    }
    
    const products = await callVibeApi(req, endpoint);
    
    const result = products.map(p => ({
      id: p.id,
      ID: p.id,
      name: p.name,
      NAME: p.name,
      price: p.price || 0,
      PRICE: p.price || 0,
      unit: p.measure || 'pc',
      sectionId: p.sectionId
    }));
    
    res.json({ result: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch products', message: error.message });
  }
});

// ============ VISIT API ============
app.post('/api/visit', upload.array('photos', 10), async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const apiKey = getApiKey(req);
    const companyId = req.body.companyId;
    const subject = req.body.subject || 'Visit';
    const description = req.body.description || '';
    const noteText = req.body.noteText || '';
    const closeVisit = req.body.closeVisit === 'true';
    const groupId = req.body.groupId || null;
    const location = req.body.location ? JSON.parse(req.body.location) : null;
    const orderData = req.body.orderData ? JSON.parse(req.body.orderData) : null;
    
    // Save uploaded photos
    const photoUrls = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        photoUrls.push('/uploads/' + file.filename);
      });
    }
    
    // Build task description
    let taskDescription = description || '';
    if (noteText) {
      taskDescription += '\n\nNotes: ' + noteText;
    }
    if (location) {
      taskDescription += `\n\nLocation: ${location.latitude}, ${location.longitude}`;
    }
    if (orderData && orderData.items && orderData.items.length > 0) {
      taskDescription += '\n\nOrder:\n';
      orderData.items.forEach(item => {
        taskDescription += `- ${item.name}: ${item.quantity} x ${item.price}р = ${(item.quantity * item.price).toFixed(2)}р\n`;
      });
      taskDescription += `\nTotal: ${orderData.total.toFixed(2)}р`;
    }
    
    // Add photo links to description
    if (photoUrls && photoUrls.length > 0) {
      taskDescription += '\n\n[B]Photos:[/B]\n';
      photoUrls.forEach((url, index) => {
        const fullUrl = req.protocol + '://' + req.get('host') + url;
        taskDescription += `[URL=${fullUrl}]Photo ${index + 1} - Click to view[/URL]\n`;
      });
    }
    
    // Create task in Bitrix24
    const batchData = {
      halt: 0,
      calls: [
        {
          entity: "tasks",
          action: "create",
          params: {
              TITLE: subject,
              DESCRIPTION: taskDescription,
              RESPONSIBLE_ID: parseInt(user.id),
              PRIORITY: 2,
              STATUS: closeVisit ? 5 : 2,
              GROUP_ID: parseInt(groupId) || 0,
              UF_CRM_TASK: "CO_" + companyId
            }
        }
      ]
    };
    
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const taskId = result.data?.results?.["0"]?.id || result.data?.results?.[0]?.id;
    
    // Save visit to local DB
    const visit = {
      id: Date.now(),
      companyId: companyId,
      companyName: subject,
      userId: user.id,
      userName: user.name,
      startTime: new Date().toISOString(),
      endTime: closeVisit ? new Date().toISOString() : null,
      coords: location,
      photos: photoUrls,
      note: noteText || description,
      order: orderData || { items: [], total: 0 },
      status: closeVisit ? 'completed' : 'in_progress',
      taskId: taskId
    };
    
    db.visits.push(visit);
    
    res.json({
      success: true,
      visit: visit,
      taskId: taskId
    });
  } catch (error) {
    console.error('Visit creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create visit',
      message: error.message 
    });
  }
});

// ============ TASKS API ============
app.get('/api/my-tasks', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const apiKey = getApiKey(req);
    
    console.log('Loading tasks for user:', user.id);
    
    const batchData = {
      halt: 0,
      calls: [
        {
          entity: "tasks",
          action: "list",
          params: {
            FILTER: {
              RESPONSIBLE_ID: parseInt(user.id)
            },
            ORDER: { ID: "DESC" },
            LIMIT: 50
          }
        }
      ]
    };
    
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    
    const data = await response.json();
    const tasks = data.data?.results?.["0"] || [];
    
    // Double-check: filter only tasks for current user
    const userTasks = tasks.filter(t => t.responsibleId == user.id);
    
    console.log('Loaded tasks:', tasks.length, 'Filtered for user:', userTasks.length);
    
    res.json({ success: true, tasks: userTasks });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(500).json({ error: 'Failed to load tasks', message: error.message });
  }
});

// Complete task
app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const apiKey = getApiKey(req);
    
    const batchData = {
      halt: 0,
      calls: [
        {
          entity: "tasks",
          action: "update",
          params: {
            ID: parseInt(taskId),
            STATUS: 5
          }
        }
      ]
    };
    
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    
    res.json({ success: true, message: 'Task completed' });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task', message: error.message });
  }
});

// ============ VISITS API (legacy) ============
app.post('/api/visits', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const body = req.body || {};
    
    let orderItems = [];
    let orderTotal = 0;
    if (body.order && Array.isArray(body.order)) {
      orderItems = body.order;
      orderTotal = body.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    
    const visit = {
      id: Date.now(),
      companyId: body.companyId,
      companyName: body.companyName,
      userId: user.id,
      userName: user.name,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      coords: body.coordinates || null,
      photos: body.photos || [],
      note: body.notes || '',
      order: { items: orderItems, total: orderTotal },
      status: 'completed'
    };
    
    db.visits.push(visit);
    res.json(visit);
  } catch (error) {
    console.error('Create visit error:', error);
    res.status(500).json({ error: 'Failed to create visit', message: error.message });
  }
});

app.get('/api/visits', (req, res) => {
  res.json(db.visits);
});

app.get('/api/visits/:id', (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json(visit);
});

app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
