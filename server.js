const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// API configuration
const API_KEY = process.env.VIBECODE_API_KEY || 'vibe_api_B5LhuhAlxAfjnWVLTCD6RU0UsDWl6IvV_05fc97';
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

app.use(cors());
app.use(express.json());

// No-cache middleware for static files
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

// Cache for current user
let currentUser = null;

// Helper to call VibeCode API
async function callVibeApi(endpoint) {
  try {
    const response = await fetch(VIBECODE_API + endpoint, {
      headers: {
        'X-Api-Key': API_KEY
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

// Get current user from VibeCode API
async function getCurrentUser() {
  if (currentUser) return currentUser;
  
  try {
    const response = await fetch(VIBECODE_API + '/me', {
      headers: {
        'X-Api-Key': API_KEY
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.success && data.data) {
      currentUser = {
        id: data.data.owner?.userId || data.data.user?.id || 1,
        name: data.data.owner?.name || 'User'
      };
      console.log('Current user:', currentUser);
      return currentUser;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }
  
  return { id: 1, name: 'User' };
}



// ============ VISITS API ============
app.post('/api/visits', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const body = req.body || {};
    
    // Calculate order total
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
      order: { 
        items: orderItems, 
        total: orderTotal 
      },
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

app.patch('/api/visits/:id/coords', (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  visit.coords = req.body.coords;
  res.json({ success: true, coords: visit.coords });
});

app.post('/api/visits/:id/photos', upload.single('photo'), (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  if (req.file) {
    const photoUrl = '/uploads/' + req.file.filename;
    visit.photos.push({
      url: photoUrl,
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString()
    });
    res.json({ success: true, photo: visit.photos[visit.photos.length - 1] });
  } else {
    res.status(400).json({ error: 'No photo uploaded' });
  }
});

app.patch('/api/visits/:id/note', (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  visit.note = req.body.note || '';
  res.json({ success: true, note: visit.note });
});

app.patch('/api/visits/:id/order', (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  visit.order = req.body.order || { items: [], total: 0 };
  const existingOrderIndex = db.orders.findIndex(o => o.visitId == visit.id);
  const orderData = {
    visitId: visit.id,
    companyId: visit.companyId,
    companyName: visit.companyName,
    items: visit.order.items,
    total: visit.order.total,
    createdAt: new Date().toISOString()
  };
  if (existingOrderIndex >= 0) {
    db.orders[existingOrderIndex] = orderData;
  } else {
    db.orders.push(orderData);
  }
  res.json({ success: true, order: visit.order });
});

app.post('/api/visits/:id/complete', async (req, res) => {
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  visit.status = 'completed';
  visit.endTime = new Date().toISOString();
  res.json({ success: true, visit, message: 'Visit completed successfully' });
});

app.get('/api/orders', (req, res) => {
  res.json(db.orders);
});

app.get('/api/orders/:visitId', (req, res) => {
  const order = db.orders.find(o => o.visitId == req.params.visitId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/visits/:id/create-task', async (req, res) => {
  try {
    const visit = db.visits.find(v => v.id == req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    
    // Get current user for responsibleId
    let responsibleId = visit.userId;
    if (!responsibleId) {
      try {
        const user = await getCurrentUser();
        responsibleId = user.id;
      } catch (e) {
        responsibleId = 1; // fallback to admin
      }
    }
    
    // Build task description
    let description = visit.notes || 'Visit completed';
    if (visit.coordinates) {
      description += `\n\nLocation: ${visit.coordinates.latitude}, ${visit.coordinates.longitude}`;
    }
    if (visit.photos && visit.photos.length > 0) {
      description += `\n\nPhotos: ${visit.photos.length} photo(s) attached`;
    }
    
    // Create task in Bitrix24 via VibeCode API using batch
    const batchData = {
      halt: 0,
      cmd: {
        create_task: `tasks.task.add?` + new URLSearchParams({
          'fields[TITLE]': `Visit: ${visit.companyName}`,
          'fields[DESCRIPTION]': description,
          'fields[RESPONSIBLE_ID]': responsibleId.toString(),
          'fields[PRIORITY]': '2',
          'fields[STATUS]': '5',
          'fields[GROUP_ID]': '0'
        }).toString()
      }
    };
    
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Check for errors in batch response
    if (result.result?.create_task?.error) {
      throw new Error(result.result.result.create_task.error);
    }
    
    const taskId = result.result?.results?.["0"]?.id || result.result?.results?.[0]?.id;
    
    res.json({
      success: true,
      message: 'Task created in Bitrix24',
      taskId: taskId,
      responsibleId: responsibleId,
      visit: {
        id: visit.id,
        companyName: visit.companyName
      }
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create task',
      message: error.message 
    });
  }
});

app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ============ USER CONTEXT API ============
app.get('/api/user-context', async (req, res) => {
  try {
    const user = await getCurrentUser();
    
    // Get workgroups from Bitrix24
    let workgroups = [];
    try {
      const response = await fetch(VIBECODE_API + '/batch', {
        method: 'POST',
        headers: {
          'X-Api-Key': API_KEY,
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
    res.status(500).json({ error: 'Failed to get user context' });
  }
});

// ============ COMPANIES API (new format) ============
app.get('/api/companies', async (req, res) => {
  try {
    const search = req.query.search?.toLowerCase() || '';
    const companies = await callVibeApi('/companies?limit=50');
    
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
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// ============ TASKS API ============
app.get('/api/tasks/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    
    // Search for open tasks related to this company
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        halt: 0,
        cmd: {
          get_tasks: `tasks.task.list?FILTER[UF_CRM_TASK]=CO_${companyId}&FILTER[STATUS]=2&ORDER[ID]=DESC&LIMIT=1`
        }
      })
    });
    
    if (!response.ok) {
      return res.json({ task: null });
    }
    
    const data = await response.json();
    const tasks = data.result?.result?.get_tasks || [];
    
    if (tasks.length > 0) {
      res.json({ task: tasks[0] });
    } else {
      res.json({ task: null });
    }
  } catch (error) {
    console.error('Error checking tasks:', error);
    res.json({ task: null });
  }
});

// ============ SECTIONS API ============
app.get('/api/sections', async (req, res) => {
  try {
    const sections = await callVibeApi('/catalog-sections?filter[iblockId]=24&limit=50');
    
    const result = sections.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      sort: s.sort || 500
    })).sort((a, b) => a.sort - b.sort);
    
    res.json({ result: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// ============ PRODUCTS API (new format) ============
app.get('/api/products', async (req, res) => {
  try {
    const sectionId = req.query.sectionId;
    let endpoint = '/products?limit=50';
    
    if (sectionId) {
      endpoint = '/products?filter[sectionId]=' + sectionId + '&limit=50';
    }
    
    const products = await callVibeApi(endpoint);
    
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
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============ VISIT API (multipart/form-data) ============
app.post('/api/visit', upload.array('photos', 10), async (req, res) => {
  try {
    const user = await getCurrentUser();
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
    let taskDescription = description;
    if (noteText) {
      taskDescription += '\n\nNotes: ' + noteText;
    }
    if (location) {
      taskDescription += `\n\nLocation: ${location.latitude}, ${location.longitude}`;
    }
    if (orderData && orderData.items && orderData.items.length > 0) {
      taskDescription += '\n\nOrder:\n';
      orderData.items.forEach(item => {
        taskDescription += `- ${item.name}: ${item.quantity} x ${item.price}? = ${(item.quantity * item.price).toFixed(2)}?\n`;
      });
      taskDescription += `\nTotal: ${orderData.total.toFixed(2)}?`;
    }
    
    // Create or update task in Bitrix24
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
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const taskId = result.result?.results?.["0"]?.id || result.result?.results?.[0]?.id;
    
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

// Get current user's tasks
app.get('/api/my-tasks', async (req, res) => {
  try {
    const user = await getCurrentUser();
    
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
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    
    const data = await response.json();
    // Correct path: data.data.results["0"]
    const tasks = data.data?.results?.["0"] || [];
    console.log('Loaded tasks:', tasks.length);
    
    res.json({ success: true, tasks: tasks });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(500).json({ error: 'Failed to load tasks', message: error.message });
  }
});

// Complete task
app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    const batchData = {
      halt: 0,
      calls: [
        {
          entity: "tasks",
          action: "update",
          params: {
            ID: parseInt(taskId),
            STATUS: 5 // Completed
          }
        }
      ]
    };
    
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    
    const data = await response.json();
    
    res.json({ success: true, message: 'Task completed' });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task', message: error.message });
  }
});
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});





