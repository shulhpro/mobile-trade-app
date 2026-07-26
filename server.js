const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.VIBECODE_API_KEY;
const APP_KEY = process.env.VIBECODE_APP_KEY; // OAuth app key for multi-user auth
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';
const APP_URL = process.env.APP_URL || 'https://app-116f18205548.vibecode.bitrix24.tech';

app.use(express.json());
app.use(express.static('public'));
 
 // Parse cookies manually
 app.use((req, res, next) => {
   req.cookies = {};
   const cookieHeader = req.headers.cookie;
   if (cookieHeader) {
     cookieHeader.split(';').forEach(cookie => {
       const [name, value] = cookie.trim().split('=');
       if (name && value) {
         req.cookies[name] = decodeURIComponent(value);
       }
     });
   }
   next();
 });

const upload = multer({ storage: multer.memoryStorage() });
 
 // Log all requests
app.use((req, res, next) => {
  console.log('Request:', req.method, req.path, 'Content-Type:', req.headers['content-type']);
  // Log auth headers for debugging
  if (req.headers['x-vibe-authorization']) {
    console.log('X-Vibe-Authorization:', req.headers['x-vibe-authorization'].substring(0, 50) + '...');
  }
  if (req.headers['authorization']) {
    console.log('Authorization:', req.headers['authorization'].substring(0, 50) + '...');
  }
  next();
});

// Health check endpoint for deployment verification
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth Login - redirect to VibeCode authorization
app.get('/api/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const redirectUri = APP_URL + '/api/auth/callback';
  const authUrl = `https://vibecode.bitrix24.tech/v1/oauth/authorize?app_key=${APP_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  // Store state in cookie for verification
  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  res.redirect(authUrl);
});

// OAuth Callback - exchange code for session token
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;
    
    // Verify state to prevent CSRF
    if (!state || state !== storedState) {
      return res.status(400).json({ success: false, error: 'Invalid state parameter' });
    }
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'No authorization code received' });
    }
    
    // Exchange code for session token
    const tokenResponse = await fetch(VIBECODE_API + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key: APP_KEY,
        code: code,
        redirect_uri: APP_URL + '/api/auth/callback'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return res.status(400).json({ success: false, error: 'Failed to exchange code for token' });
    }
    
    const tokenData = await tokenResponse.json();
    const sessionToken = tokenData.access_token;
    
    // Store session token in httpOnly cookie
    res.setHeader('Set-Cookie', [
      `vibe_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    ]);
    
    // Redirect to app
    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout - clear session
app.get('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `vibe_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ success: true, message: 'Logged out' });
});

// Get current auth status
app.get('/api/auth/status', async (req, res) => {
  try {
    const sessionToken = req.cookies.vibe_session || getUserSession(req);
    
    if (!sessionToken) {
      return res.json({ 
        authenticated: false,
        loginUrl: '/api/auth/login'
      });
    }
    
    // Verify session by calling /me
    const meResponse = await fetch(VIBECODE_API + '/me', {
      headers: {
        'X-Api-Key': APP_KEY,
        'Authorization': 'Bearer ' + sessionToken
      }
    });
    
    if (!meResponse.ok) {
      return res.json({ 
        authenticated: false,
        loginUrl: '/api/auth/login',
        error: 'Session expired'
      });
    }
    
    const meData = await meResponse.json();
    
    res.json({
      authenticated: true,
      user: {
        id: meData.data.currentUser?.bitrixUserId || meData.data.owner?.userId,
        name: meData.data.owner?.name,
        portal: meData.data.portal
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Explicit root handler to ensure index.html is served
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Get user session from X-Vibe-Authorization header (injected by Black Hole Gateway)
function getUserSession(req) {
  const vibeAuth = req.headers['x-vibe-authorization'];
  if (!vibeAuth) {
    // Fallback to cookie
    return req.cookies.vibe_session || null;
  }
  if (vibeAuth && vibeAuth.startsWith('Bearer ')) {
    return vibeAuth.substring(7); // Remove 'Bearer ' prefix
  }
  return null;
}

// Get current user from OAuth session (for multi-user apps)
async function getCurrentUser(req) {
  const sessionToken = getUserSession(req);
  
  if (sessionToken && APP_KEY) {
    // Multi-user mode: use OAuth session
    const response = await fetch(VIBECODE_API + '/me', {
      headers: { 
        'X-Api-Key': APP_KEY,
        'Authorization': 'Bearer ' + sessionToken
      }
    });
    if (!response.ok) throw new Error('Failed to get user from session');
    const data = await response.json();
    // Return user with bitrixUserId from OAuth session
    return {
      id: data.data.currentUser?.bitrixUserId || data.data.owner?.userId,
      name: data.data.owner?.name || 'User',
      ...data.data.currentUser
    };
  } else if (API_KEY) {
    // Fallback: use personal API key (single-user mode)
    const response = await fetch(VIBECODE_API + '/users/me', {
      headers: { 'X-Api-Key': API_KEY }
    });
    if (!response.ok) throw new Error('Failed to get user');
    const data = await response.json();
    return data.data;
  } else {
    throw new Error('No authentication available');
  }
}

// Get user's "Created Files" folder ID from VibeCode API
async function getUserDiskFolderId(req) {
  try {
    const user = await getCurrentUser(req);
    
    // Get user storage
    const batchBody = {
      calls: [{
        entity: 'storages',
        action: 'list',
        params: {
          filter: {
            entityType: 'user',
            entityId: user.id
          }
        }
      }]
    };
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batchBody)
    });
    const data = await response.json();
    const storages = data.data?.results?.['0'] || [];
    if (storages.length === 0) return null;
    
    const rootFolderId = storages[0].rootFolderId || storages[0].id;
    
    // Find FOR_CREATED_FILES folder inside root folder
    const foldersBatch = {
      calls: [{
        entity: 'folders',
        action: 'list',
        params: {
          filter: {
            parentId: rootFolderId
          }
        }
      }]
    };
    const foldersResponse = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(foldersBatch)
    });
    const foldersData = await foldersResponse.json();
    const folders = foldersData.data?.results?.['0'] || [];
    
    // Find FOR_CREATED_FILES folder
    const createdFilesFolder = folders.find(f => f.code === 'FOR_CREATED_FILES');
    if (createdFilesFolder) {
      return createdFilesFolder.id;
    }
    
    // Fallback to root folder
    return rootFolderId;
  } catch (error) {
    console.error('Error getting user disk folder:', error);
    return null;
  }
}

// Upload file to VibeCode disk
async function uploadFileToDisk(filename, base64Content, folderId) {
  console.log('Uploading file:', filename, 'size:', base64Content.length, 'folderId:', folderId);
  // Add timestamp to filename to avoid duplicates (DISK_OBJ_22000 error)
  const timestamp = Date.now();
  const uniqueFilename = timestamp + '_' + filename;
  const response = await fetch(VIBECODE_API + '/files/upload', {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: uniqueFilename,
      content: base64Content,
      folderId: folderId
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Upload failed:', response.status, errorText);
    throw new Error('Failed to upload file: ' + response.status + ' ' + errorText);
  }
  const data = await response.json();
  console.log('Upload success:', data.data.id);
  return data.data;
}

// Attach files to task via ufTaskWebdavFiles
async function attachFilesToTask(taskId, fileIds) {
  const response = await fetch(VIBECODE_API + '/tasks/' + taskId, {
    method: 'PATCH',
    headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ufTaskWebdavFiles: fileIds.map(id => 'n' + id)
    })
  });
  if (!response.ok) throw new Error('Failed to attach files to task');
  const data = await response.json();
  return data.data;
}

app.get('/api/session', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

app.get('/api/user-context', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const batchData = {
      halt: 0,
      cmd: {
        get_workgroups: `user.get?ID=${user.id}`,
        get_dept: `department.get?ID=${user.department_id || 0}`
      }
    };
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData)
    });
    const data = await response.json();
    res.json({
      user,
      workgroups: data.result?.result?.get_workgroups || [],
      department: data.result?.result?.get_dept || {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/companies', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const response = await fetch(VIBECODE_API + '/companies?limit=100&select=id,title,phone,email,address', {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get catalog sections
app.get('/api/sections', async (req, res) => {
  try {
    const response = await fetch(VIBECODE_API + '/catalog-sections?filter[iblockId]=24&limit=50', {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products by section
app.get('/api/products', async (req, res) => {
  try {
    const sectionId = req.query.sectionId;
    let url = VIBECODE_API + '/products?limit=100&filter[active]=Y';
    if (sectionId) {
      url += '&filter[sectionId]=' + sectionId;
    }
    const response = await fetch(url, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const response = await fetch(VIBECODE_API + `/tasks?limit=50&select=id,title,status,responsibleId&filter[responsibleId]=${user.id}&order[id]=DESC`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-tasks', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const response = await fetch(VIBECODE_API + `/tasks?limit=50&select=id,title,status,responsibleId,deadline,groupId&filter[responsibleId]=${user.id}&order[id]=DESC`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ success: true, tasks: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const response = await fetch(VIBECODE_API + '/tasks/' + req.params.id, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ task: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const response = await fetch(VIBECODE_API + '/tasks/' + taskId, {
      method: 'PATCH',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '5' })
    });
    const data = await response.json();
    res.json({ success: true, result: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/comment', upload.array('files', 5), async (req, res) => {
  try {
    console.log('=== TASK COMMENT ===');
    console.log('Files count:', req.files ? req.files.length : 0);
    console.log('Body keys:', Object.keys(req.body));
    const taskId = req.params.id;
    const text = req.body.text || '';
    const uploadedFiles = [];
    const fileIds = [];

    // Get user's disk folder ID (FOR_CREATED_FILES)
    const folderId = await getUserDiskFolderId();
    console.log('FolderId:', folderId);
    if (!folderId) {
      throw new Error('Could not get user disk folder');
    }

    // Upload files to VibeCode disk
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        console.log('Uploading file:', file.originalname, file.size);
        const base64Content = file.buffer.toString('base64');
        const fileData = await uploadFileToDisk(file.originalname, base64Content, folderId);
        console.log('File uploaded:', fileData.id);
        uploadedFiles.push(fileData);
        fileIds.push(fileData.id);
      }
    }

    // Attach files to task via ufTaskWebdavFiles
    if (fileIds.length > 0) {
      console.log('Attaching files:', fileIds);
      await attachFilesToTask(taskId, fileIds);
      console.log('Files attached');
    }

    let message = text.trim();
    if (uploadedFiles.length > 0) {
      const fileLinks = uploadedFiles.map(file =>
        `[URL=${file.downloadUrl || file.url}]${file.name || file.filename}[/URL]`
      ).join('\n');
      message = message ? `${message}\n${fileLinks}` : fileLinks;
    }

    const response = await fetch(VIBECODE_API + '/tasks/' + taskId + '/comments', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message })
    });

    if (!response.ok) throw new Error('Bitrix error');
    const data = await response.json();
    res.json({ success: true, result: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit visit - creates task, optionally closes it, adds comment with photos
app.post('/api/visit', upload.array('photos', 10), async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const companyId = req.body.companyId;
    const subject = req.body.subject || 'Визит';
    const description = req.body.description || '';
    const noteText = req.body.noteText || '';
    const closeVisit = req.body.closeVisit === 'true';
    const groupId = req.body.groupId || '0';
    const location = req.body.location ? JSON.parse(req.body.location) : null;
    const orderData = req.body.orderData ? JSON.parse(req.body.orderData) : null;

    // Build task description
    let taskDesc = description;
    if (noteText) {
      taskDesc += '\n\nЗаметки: ' + noteText;
    }
    if (location) {
      taskDesc += '\n\nМестоположение: ' + (location.address || JSON.stringify(location));
    }
    if (orderData && orderData.items && orderData.items.length > 0) {
      taskDesc += '\n\nЗаказ:\n' + orderData.items.map(i => `- ${i.name}: ${i.quantity} x ${i.price} = ${i.quantity * i.price}`).join('\n');
      taskDesc += '\n\nИтого: ' + orderData.total;
    }

    // Create task
    const createBody = {
      title: subject,
      description: taskDesc,
      responsibleId: user.id,
      groupId: groupId
    };

    const createResponse = await fetch(VIBECODE_API + '/tasks', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody)
    });

    if (!createResponse.ok) throw new Error('Failed to create task');
    const createData = await createResponse.json();
    const taskId = createData.data.id;

    // Get user's disk folder ID (FOR_CREATED_FILES)
    const folderId = await getUserDiskFolderId();
    if (!folderId) {
      throw new Error('Could not get user disk folder');
    }
    
    // Upload photos to VibeCode disk
    const uploadedFiles = [];
    const fileIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const base64Content = file.buffer.toString('base64');
        const fileData = await uploadFileToDisk(file.originalname, base64Content, folderId);
        uploadedFiles.push(fileData);
        fileIds.push(fileData.id);
      }
    }

    // Attach photos to task via ufTaskWebdavFiles
    if (fileIds.length > 0) {
      await attachFilesToTask(taskId, fileIds);
    }

    // Add comment with photos
    let commentMessage = 'Визит к компании ' + companyId;
    if (uploadedFiles.length > 0) {
      const fileLinks = uploadedFiles.map(file =>
        `[URL=${file.downloadUrl || file.url}]${file.name || file.filename}[/URL]`
      ).join('\n');
      commentMessage += '\n\nФото:\n' + fileLinks;
    }

    await fetch(VIBECODE_API + '/tasks/' + taskId + '/comments', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commentMessage })
    });

    // Close task if requested
    if (closeVisit) {
      await fetch(VIBECODE_API + '/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '5' })
      });
    }

    res.json({ success: true, taskId: taskId, closed: closeVisit });
  } catch (error) {
    console.error('Visit error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
