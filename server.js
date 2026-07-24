const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.VIBECODE_API_KEY;
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });

async function getCurrentUser() {
  const response = await fetch(VIBECODE_API + '/users/me', {
    headers: { 'X-Api-Key': API_KEY }
  });
  if (!response.ok) throw new Error('Failed to get user');
  const data = await response.json();
  return data.data;
}

// Get user's "Created Files" folder ID from VibeCode API
async function getUserDiskFolderId() {
  try {
    const user = await getCurrentUser();
    
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
    
    const rootFolderId = storages[0].rootFolderId;
    
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
  const response = await fetch(VIBECODE_API + '/files/upload', {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: filename,
      content: base64Content,
      folderId: folderId
    })
  });
  if (!response.ok) throw new Error('Failed to upload file');
  const data = await response.json();
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
    const user = await getCurrentUser();
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

app.get('/api/user-context', async (req, res) => {
  try {
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
    const taskId = req.params.id;
    const text = req.body.text || '';
    const uploadedFiles = [];
    const fileIds = [];

    // Get user's disk folder ID (FOR_CREATED_FILES)
    const folderId = await getUserDiskFolderId();
    if (!folderId) {
      throw new Error('Could not get user disk folder');
    }

    // Upload files to VibeCode disk
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const base64Content = file.buffer.toString('base64');
        const fileData = await uploadFileToDisk(file.originalname, base64Content, folderId);
        uploadedFiles.push(fileData);
        fileIds.push(fileData.id);
      }
    }

    // Attach files to task via ufTaskWebdavFiles
    if (fileIds.length > 0) {
      await attachFilesToTask(taskId, fileIds);
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
    console.log('=== VISIT START ===');
    console.log('closeVisit body:', req.body.closeVisit);
    console.log('Files received:', req.files ? req.files.length : 0);
    const user = await getCurrentUser();
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
    console.log('FolderId result:', folderId);
    if (!folderId) {
      throw new Error('Could not get user disk folder');
    }
    
    // Upload photos to VibeCode disk
    const uploadedFiles = [];
    const fileIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const base64Content = file.buffer.toString('base64');
          console.log('Uploading:', file.originalname);
          const fileData = await uploadFileToDisk(file.originalname, base64Content, folderId);
          console.log('Uploaded OK:', fileData.id);
          uploadedFiles.push(fileData);
          fileIds.push(fileData.id);
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr.message);
        }
      }
    }

    // Attach photos to task via ufTaskWebdavFiles
    if (fileIds.length > 0) {
      try {
        await attachFilesToTask(taskId, fileIds);
        console.log('Files attached OK');
      } catch (attachErr) {
        console.error('Attach failed:', attachErr.message);
      }
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
      console.log('Closing task...');
      await fetch(VIBECODE_API + '/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '5' })
      });
      console.log('Task closed');
    }

    res.json({ success: true, taskId: taskId, closed: closeVisit });
  } catch (error) {
    console.error('Visit error:', error);
    console.error('Visit error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));


