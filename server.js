const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const VIBECODE_API_KEY = process.env.VIBECODE_API_KEY || '';
const VIBECODE_BASE_URL = 'https://vibecode.bitrix24.tech/v1';

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Auth middleware
app.use((req, res, next) => {
  const userId = req.headers['x-vibe-user-id'] || req.headers['x-b24-user-id'];
  const portalId = req.headers['x-vibe-portal-id'] || req.headers['x-b24-portal-id'];
  
  if (userId && userId !== 'null' && userId !== 'undefined' && userId.length > 0) {
    req.currentUser = { id: userId, portalId: portalId };
    console.log('Authenticated user:', req.currentUser.id, 'portal:', portalId);
  } else {
    req.currentUser = null;
    console.log('No user in headers, using fallback');
  }
  next();
});

// Настройка JSON с правильной кодировкой
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Обработка имени файла с правильной кодировкой
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '-' + originalName);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// VibeCode API helper
async function callVibeCode(method, endpoint, data = null, isFormData = false) {
  const url = VIBECODE_BASE_URL + endpoint;
  const headers = {
    'Authorization': 'Bearer ' + VIBECODE_API_KEY,
    'Accept': 'application/json'
  };
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  
  try {
    if (method === 'GET') {
      return await axios.get(url, { headers, params: data });
    } else if (method === 'POST') {
      return await axios.post(url, data, { headers });
    } else if (method === 'PATCH') {
      return await axios.patch(url, data, { headers });
    }
  } catch (error) {
    console.error('VibeCode API error (' + endpoint + '):', error.response?.data || error.message);
    throw error;
  }
}

// Find existing open task for company
async function findOpenTaskForCompany(companyId) {
  try {
    const response = await callVibeCode('GET', '/tasks', { 
      'filter[ufCrmTask]': 'CO_' + companyId,
      'filter[status]': '2',
      'limit': 1,
      'sort': '-createdDate'
    });
    
    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error finding task:', error.message);
    return null;
  }
}

// Get companies
app.get('/api/companies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const response = await callVibeCode('GET', '/companies', { limit: limit });
    res.json({ result: response.data.data, total: response.data.meta?.total });
  } catch (error) {
    console.log('API unavailable, using local data');
    try {
      const localData = require('./public/companies.json');
      res.json({ result: localData, total: localData.length });
    } catch (localError) {
      console.error('Error loading local companies:', localError.message);
      res.status(500).json({ error: error.message });
    }
  }
});

// Get company by ID
app.get('/api/companies/:id', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/companies/' + req.params.id);
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error fetching company:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Search companies
app.get('/api/companies/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 2) {
      return res.json({ result: [], total: 0 });
    }
    
    const response = await callVibeCode('GET', '/companies', { 
      limit: 100,
      'filter[search]': query
    });
    res.json({ result: response.data.data || [], total: response.data.meta?.total || 0 });
  } catch (error) {
    console.error('Error searching companies:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Process visit
app.post('/api/visit', upload.array('photos', 10), async (req, res) => {
  try {
    console.log('Processing visit, body:', req.body);
    console.log('Files received:', req.files ? req.files.length : 0);
    
    const { companyId, type, subject, description, location, orderData, noteText, closeVisit } = req.body;
    const files = req.files || [];
    
    let task = await findOpenTaskForCompany(companyId);
    let isNewTask = false;
    let companyResponse = null;
    let auditors = [];
    
    if (!task) {
      companyResponse = await callVibeCode('GET', '/companies/' + companyId);
      const companyName = companyResponse.data.data?.title || 'Клиент';
      
      try {
        const userResponse = await callVibeCode('GET', '/users/me');
        const user = userResponse.data.data;
        if (user.departmentId && user.departmentId.length > 0) {
          const deptResponse = await callVibeCode('GET', '/departments/' + user.departmentId[0]);
          const dept = deptResponse.data.data;
          if (dept && dept.headId && dept.headId !== user.id) {
            auditors.push(dept.headId);
          }
        }
      } catch (e) {
        console.log('Could not get department head:', e.message);
      }
      
      const taskData = {
        title: subject || 'Визит к ' + companyName,
        description: 'Начало визита\n',
        responsibleId: req.currentUser ? req.currentUser.id : 10,
        ufCrmTask: ['CO_' + companyId],
        status: 2
      };
      
      if (req.body.groupId) {
        taskData.groupId = parseInt(req.body.groupId);
      }
      
      if (auditors.length > 0) {
        taskData.auditors = auditors;
      }
      
      const newTaskResponse = await callVibeCode('POST', '/tasks', taskData);
      task = newTaskResponse.data.data;
      isNewTask = true;
      console.log('Created new task:', task.id, 'groupId:', taskData.groupId, 'auditors:', auditors);
    } else {
      console.log('Found existing task:', task.id);
      try {
        companyResponse = await callVibeCode('GET', '/companies/' + companyId);
      } catch (e) {
        console.log('Could not fetch company for subtask:', e.message);
      }
    }
    
    let newContent = '\n';
    const now = new Date().toLocaleString('ru-RU');
    newContent += '=== ' + now + ' ===\n\n';
    
    if (type === 'visit' || location) {
      newContent += '📍 Посещение клиента\n';
      newContent += (description || '') + '\n';
      if (location) {
        const loc = JSON.parse(location);
        newContent += '\n📍 Координаты: ' + loc.latitude + ', ' + loc.longitude + '\n';
      }
      newContent += '\n---\n\n';
    }
    
    if (type === 'photo' || files.length > 0) {
      newContent += '📸 Фотоотчет\n';
      newContent += (description || '') + '\n';
      newContent += '\n---\n\n';
    }
    
    if (type === 'note' || noteText) {
      newContent += '📝 Заметка\n';
      newContent += (noteText || description || '') + '\n';
      newContent += '\n---\n\n';
    }
    
    if (type === 'order' || orderData) {
      newContent += '📦 ЗАКАЗ\n';
      newContent += (description || '') + '\n';
      if (orderData) {
        const orderItems = JSON.parse(orderData);
        if (orderItems.items && orderItems.items.length > 0) {
          newContent += '\n📋 Список товаров:\n';
          orderItems.items.forEach((item, idx) => {
            newContent += (idx + 1) + '. ' + item.name + ' — ' + item.quantity + ' шт. × ' + item.price + ' ₽ = ' + (item.quantity * item.price) + ' ₽\n';
          });
          newContent += '\n💰 Итого: ' + orderItems.total + ' ₽\n';
        }
      }
      newContent += '\n---\n\n';
    }
    
    const uploadedFiles = [];
    const uploadedFileIds = [];
    for (const file of files) {
      try {
        const fileData = fs.readFileSync(file.path);
        const base64Content = fileData.toString('base64');
        
        const uploadResponse = await callVibeCode('POST', '/files/upload', {
          folderId: 19,
          filename: 'visit_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + file.originalname,
          content: base64Content
        });
        
        uploadedFiles.push({
          diskId: uploadResponse.data.data?.id,
          name: 'visit_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + file.originalname,
          id: uploadResponse.data.data?.id,
          url: uploadResponse.data.data?.url
        });
        
        uploadedFileIds.push(uploadResponse.data.data?.id);
        fs.unlinkSync(file.path);
      } catch (uploadError) {
        console.error('Error uploading file:', uploadError.message);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    
    if (uploadedFiles.length > 0) {
      newContent += '📎 Прикрепленные файлы:\n';
      uploadedFiles.forEach((file, idx) => {
        newContent += (idx + 1) + '. ' + file.name + '\n';
      });
      newContent += '\n---\n\n';
    }
    
    const currentDescription = task.description || '';
    const updatedDescription = currentDescription + newContent;
    
    if (uploadedFileIds.length > 0) {
      const batchBody = {
        calls: [
          {
            entity: 'tasks',
            action: 'update',
            entityId: parseInt(task.id),
            params: {
              description: updatedDescription,
              ufTaskWebdavFiles: uploadedFileIds.map(id => 'n' + id)
            }
          }
        ]
      };
      
      await axios.post(VIBECODE_BASE_URL + '/batch', batchBody, {
        headers: {
          'Authorization': 'Bearer ' + VIBECODE_API_KEY,
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        }
      });
    } else {
      await callVibeCode('PATCH', '/tasks/' + task.id, {
        description: updatedDescription
      });
    }
    
    let orderSubtaskId = null;
    if (orderData) {
      try {
        const orderItems = JSON.parse(orderData);
        if (orderItems.items && orderItems.items.length > 0) {
          let orderDescription = '📦 Заказ клиента\n\n';
          orderDescription += '| № | Наименование | Кол-во | Цена | Сумма |\n';
          orderDescription += '|---|-------------|--------|------|-------|\n';
          
          orderItems.items.forEach((item, idx) => {
            const itemTotal = item.quantity * item.price;
            orderDescription += '| ' + (idx + 1) + ' | ' + item.name + ' | ' + item.quantity + ' | ' + item.price.toFixed(2) + ' ₽ | ' + itemTotal.toFixed(2) + ' ₽ |\n';
          });
          
          orderDescription += '| | | | **ИТОГО:** | **' + orderItems.total.toFixed(2) + ' ₽** |\n';
          
          const subtaskData = {
            title: 'Заказ (' + (companyResponse.data.data?.title || 'Клиент') + ')',
            description: orderDescription,
            responsibleId: task.responsibleId || (req.currentUser ? req.currentUser.id : 10),
            parentId: parseInt(task.id),
            status: 2
          };
          
          if (req.body.groupId) {
            subtaskData.groupId = parseInt(req.body.groupId);
          }
          
          if (auditors.length > 0) {
            subtaskData.auditors = auditors;
          }
          
          const subtaskResponse = await callVibeCode('POST', '/tasks', subtaskData);
          orderSubtaskId = subtaskResponse.data.data.id;
          console.log('Created order subtask:', orderSubtaskId);
          
          const XLSX = require('xlsx');
          const companyName = companyResponse && companyResponse.data && companyResponse.data.data ? companyResponse.data.data.title : 'Клиент';
          const now = new Date().toLocaleString('ru-RU');
          
          const wb = XLSX.utils.book_new();
          
          const data = [
            ['Заказ клиента'],
            [''],
            ['Клиент:', companyName],
            ['Дата:', now],
            [''],
            ['№', 'Наименование', 'Кол-во', 'Цена', 'Сумма']
          ];
          
          orderItems.items.forEach((item, idx) => {
            const itemTotal = item.quantity * item.price;
            data.push([
              idx + 1,
              item.name,
              item.quantity,
              item.price,
              itemTotal
            ]);
          });
          
          data.push(['', '', '', 'ИТОГО:', orderItems.total]);
          
          const ws = XLSX.utils.aoa_to_sheet(data);
          
          ws['!cols'] = [
            { wch: 5 },
            { wch: 40 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 }
          ];
          
          XLSX.utils.book_append_sheet(wb, ws, 'Заказ');
          
          const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          const excelBase64 = excelBuffer.toString('base64');
          
          const excelUploadResponse = await callVibeCode('POST', '/files/upload', {
            folderId: 19,
            filename: 'Zakaz_' + companyName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '.xlsx',
            content: excelBase64
          });
          
          const excelFileId = excelUploadResponse.data.data?.id;
          console.log('Uploaded Excel file:', excelFileId);
          
          if (excelFileId) {
            const attachBatchBody = {
              calls: [
                {
                  entity: 'tasks',
                  action: 'update',
                  entityId: parseInt(orderSubtaskId),
                  params: {
                    ufTaskWebdavFiles: ['n' + excelFileId]
                  }
                }
              ]
            };
            
            await axios.post(VIBECODE_BASE_URL + '/batch', attachBatchBody, {
              headers: {
                'Authorization': 'Bearer ' + VIBECODE_API_KEY,
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
              }
            });
            console.log('Attached Excel file to subtask:', orderSubtaskId);
          }
        }
      } catch (orderError) {
        console.error('Error creating order subtask:', orderError.message);
      }
    }
    
    if (closeVisit === 'true' || closeVisit === true) {
      await callVibeCode('PATCH', '/tasks/' + task.id, {
        status: 5
      });
      console.log('Task completed:', task.id);
    }
    
    res.json({ 
      success: true,
      taskId: task.id,
      isNewTask: isNewTask,
      uploadedFiles: uploadedFiles.length,
      closed: closeVisit === 'true' || closeVisit === true,
      orderSubtaskId: orderSubtaskId
    });
  } catch (error) {
    console.error('Error processing visit:', error.message);
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get task for company
app.get('/api/tasks/:companyId', async (req, res) => {
  try {
    const task = await findOpenTaskForCompany(req.params.companyId);
    if (task) {
      res.json({ task: task });
    } else {
      res.json({ task: null });
    }
  } catch (error) {
    console.error('Error fetching task:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/tasks', { limit: 50 });
    res.json({ result: response.data.data || [] });
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get my tasks
app.get('/api/my-tasks', async (req, res) => {
  try {
    let userId;
    if (req.currentUser) {
      userId = req.currentUser.id;
    } else {
      const meResponse = await callVibeCode('GET', '/users/me');
      userId = meResponse.data.data.id;
    }
    const response = await callVibeCode('GET', '/tasks', { 
      limit: 50,
      'filter[responsibleId]': userId,
      'sort': '-createdDate'
    });
    res.json({ success: true, tasks: response.data.data || [] });
  } catch (error) {
    console.error('Error fetching my tasks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/tasks/' + req.params.id);
    res.json({ task: response.data.data });
  } catch (error) {
    console.error('Error fetching task:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get task comments
app.get('/api/tasks/:id/comments', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/tasks/' + req.params.id + '/comments');
    res.json({ success: true, comments: response.data.data || [] });
  } catch (error) {
    console.error('Error fetching comments:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Complete task
app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const response = await callVibeCode('PATCH', '/tasks/' + req.params.id, { status: 5 });
    res.json({ success: true, result: response.data.data });
  } catch (error) {
    console.error('Error completing task:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add comment to task with files
app.post('/api/tasks/:id/comment', upload.array('files', 5), async (req, res) => {
  try {
    const taskId = req.params.id;
    const text = req.body.text || '';
    const uploadedFiles = [];
    const fileIds = [];

    // Upload files to disk
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileData = fs.readFileSync(file.path);
        const base64Content = fileData.toString('base64');
        
        const uploadResponse = await callVibeCode('POST', '/files/upload', {
          folderId: 19,
          filename: 'comment_' + Date.now() + '_' + file.originalname,
          content: base64Content
        });
        
        uploadedFiles.push(uploadResponse.data.data);
        fileIds.push(uploadResponse.data.data.id);
        fs.unlinkSync(file.path);
      }
    }

    // Add comment
    let message = text;
    if (uploadedFiles.length > 0) {
      const fileLinks = uploadedFiles.map(file => 
        '[URL=' + (file.url || '') + ']' + file.name + '[/URL]'
      ).join('\\n');
      message = message ? message + '\\n' + fileLinks : fileLinks;
    }

    const commentResponse = await callVibeCode('POST', '/tasks/' + taskId + '/comments', { message: message });
    
    // Attach files to task
    if (fileIds.length > 0) {
      await callVibeCode('PATCH', '/tasks/' + taskId, {
        ufTaskWebdavFiles: fileIds.map(id => 'n' + id)
      });
    }

    res.json({ success: true, result: commentResponse.data.data });
  } catch (error) {
    console.error('Error adding comment:', error.message);
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get product sections
app.get('/api/sections', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/product-sections', { limit: 100 });
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error fetching sections:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get products
app.get('/api/products', async (req, res) => {
  try {
    const params = { limit: 100 };
    if (req.query.sectionId) {
      params.sectionId = req.query.sectionId;
    }
    const response = await callVibeCode('GET', '/products', params);
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/me', async (req, res) => {
  try {
    let response;
    if (req.currentUser) {
      response = await callVibeCode('GET', '/users/' + req.currentUser.id);
    } else {
      response = await callVibeCode('GET', '/users/me');
    }
    res.json({ data: { currentUser: response.data.data } });
  } catch (error) {
    console.error('Error fetching me:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get user context
app.get('/api/user-context', async (req, res) => {
  try {
    let user;
    if (req.currentUser) {
      const userResponse = await callVibeCode('GET', '/users/' + req.currentUser.id);
      user = userResponse.data.data;
    } else {
      const userResponse = await callVibeCode('GET', '/users/me');
      user = userResponse.data.data;
    }
    
    const workgroupsResponse = await callVibeCode('GET', '/workgroups', { userId: user.id, limit: 50 });
    const workgroups = workgroupsResponse.data.data || [];
    
    let departmentHead = null;
    if (user.departmentId && user.departmentId.length > 0) {
      const deptResponse = await callVibeCode('GET', '/departments/' + user.departmentId[0]);
      const dept = deptResponse.data.data;
      if (dept && dept.headId) {
        const headResponse = await callVibeCode('GET', '/users/' + dept.headId);
        departmentHead = headResponse.data.data;
      }
    }
    
    res.json({
      user: user,
      workgroups: workgroups,
      departmentHead: departmentHead
    });
  } catch (error) {
    console.error('Error fetching user context:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Logout - clear session
app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// Get visit statistics for a period
app.get('/api/reports/stats', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const now = new Date();
    let startDate, endDate;
    
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (period === 'week') {
      const dayOfWeek = now.getDay() || 7;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    let userId;
    if (req.currentUser) {
      userId = req.currentUser.id;
    } else {
      const meResponse = await callVibeCode('GET', '/users/me');
      userId = meResponse.data.data.id;
    }
    
    const response = await callVibeCode('GET', '/tasks', {
      'filter[createdDate][>=]': startDate.toISOString(),
      'filter[createdDate][<]': endDate.toISOString(),
      'filter[responsibleId]': userId,
      'limit': 100
    });
    
    const tasks = response.data.data || [];
    const visitTasks = tasks.filter(t => t.ufCrmTask && t.ufCrmTask.length > 0);
    
    res.json({ success: true, totalVisits: visitTasks.length, period: period });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generate route from visit tasks and create report task
app.post('/api/reports/route', async (req, res) => {
  try {
    const date = req.body.date || new Date().toLocaleDateString('ru-RU');
    const groupId = req.body.groupId;
    
    const [day, month, year] = date.split('.');
    const startDate = new Date(year, month - 1, day);
    const endDate = new Date(year, month - 1, parseInt(day) + 1);
    
    let userId;
    if (req.currentUser) {
      userId = req.currentUser.id;
    } else {
      const meResponse = await callVibeCode('GET', '/users/me');
      userId = meResponse.data.data.id;
    }
    
    const response = await callVibeCode('GET', '/tasks', {
      'filter[createdDate][>=]': startDate.toISOString(),
      'filter[createdDate][<]': endDate.toISOString(),
      'filter[responsibleId]': userId,
      'filter[status]': '5',   // только завершённые
      'limit': 100
    });
    
    const tasks = response.data.data || [];
    const visitTasks = tasks.filter(t => t.ufCrmTask && t.ufCrmTask.length > 0);
    
    if (visitTasks.length === 0) {
      return res.status(400).json({ error: 'Нет визитов за ' + date });
    }
    
    // СОРТИРУЕМ задачи по времени создания (по возрастанию)
    visitTasks.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));
    
    const routePoints = [];
    for (const task of visitTasks) {
      const desc = task.description || '';
      // Ищем координаты в формате "📍 Координаты: 55.7558, 37.6173"
      const coordMatch = desc.match(/📍 Координаты:\s*([\d.]+),\s*([\d.]+)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        let companyName = 'Компания';
        let companyId = null;
        if (task.ufCrmTask && task.ufCrmTask.length > 0) {
          const crmRef = task.ufCrmTask[0];
          if (crmRef.startsWith('CO_')) {
            companyId = crmRef.replace('CO_', '');
            try {
              const companyResp = await callVibeCode('GET', '/companies/' + companyId);
              companyName = companyResp.data.data?.title || 'Компания';
            } catch (e) {
              console.log('Could not fetch company:', companyId);
            }
          }
        }
        
        routePoints.push({
          lat: lat,
          lng: lng,
          title: companyName,
          taskId: task.id,
          time: task.createdDate ? new Date(task.createdDate).toLocaleTimeString('ru-RU') : ''
        });
      }
    }
    
    if (routePoints.length === 0) {
      return res.status(400).json({ error: 'В визитах не найдены координаты за ' + date });
    }
    
    // Генерируем HTML с картой
    const htmlContent = generateRouteHTML(routePoints, date);
    
    // Save HTML locally to public/routes/
    const routesDir = path.join(__dirname, 'public', 'routes');
    if (!fs.existsSync(routesDir)) {
      fs.mkdirSync(routesDir, { recursive: true });
    }
    
    const filename = 'Route_' + date.replace(/\./g, '_') + '_' + Date.now() + '.html';
    const filePath = path.join(routesDir, filename);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    
    // Формируем правильный публичный URL для задачи
    const publicUrl = 'https://app-116f18205548.vibecode.bitrix24.tech/routes/' + filename;
    console.log('Route saved, public URL:', publicUrl);
    
    const reportTitle = 'Маршрут визитов на ' + date;
    let reportDescription = 'Маршрут на ' + date + '\n\nТочек маршрута: ' + routePoints.length + '\n\nВизиты (в хронологическом порядке):\n' + 
      routePoints.map((p, i) => (i + 1) + '. ' + p.title + ' (' + p.time + ')').join('\n');
    
    if (publicUrl) {
      reportDescription += '\n\n[URL=' + publicUrl + ']Открыть карту маршрута[/URL]';
    }
    
    const taskData = {
      title: reportTitle,
      description: reportDescription,
      responsibleId: userId,
      status: 2
    };
    
    if (groupId) {
      taskData.groupId = parseInt(groupId);
    }
    
    const taskResponse = await callVibeCode('POST', '/tasks', taskData);
    const taskId = taskResponse.data.data.id;
    
    res.json({
      success: true,
      taskId: taskId,
      publicUrl: publicUrl,
      pointsCount: routePoints.length,
      date: date
    });
  } catch (error) {
    console.error('Error generating route:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Функция генерации HTML-страницы с картой (с экранированием)
function generateRouteHTML(routePoints, date) {
  // Экранирование для использования в JavaScript строке (внутри одинарных/двойных кавычек)
  const escapeForJS = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  };
  // Экранирование для HTML (чтобы не ломало разметку)
  const escapeForHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const markersJS = routePoints.map((p, i) => {
    const escapedTitle = escapeForJS(p.title);
    return 'L.marker([' + p.lat + ', ' + p.lng + '], {\n      icon: L.divIcon({\n        className: "visit-label",\n        html: "' + (i + 1) + '",\n        iconSize: [28, 28],\n        iconAnchor: [14, 14]\n      })\n    }).addTo(map).bindPopup("<b>' + (i + 1) + '. ' + escapedTitle + '</b><br>Координаты: ' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) + '<br>Время: ' + p.time + '");';
  }).join('\n    ');
  
  const routePointsStr = routePoints.map(p => '[' + p.lat + ', ' + p.lng + ']').join(', ');
  
  const pointsList = routePoints.map((p, i) => {
    const escapedTitle = escapeForHTML(p.title);
    return '<li><b>' + (i + 1) + '.</b> ' + escapedTitle + ' (' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) + ')</li>';
  }).join('\n            ');
  
  return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Маршрут визитов на ' + date + '</title>\n  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />\n  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>\n  <style>\n    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }\n    #map { height: 100vh; width: 100%; }\n    .visit-label { \n      background: #2563eb; \n      color: white; \n      border-radius: 50%; \n      width: 28px; \n      height: 28px; \n      display: flex; \n      align-items: center; \n      justify-content: center; \n      font-weight: bold; \n      font-size: 14px; \n      border: 2px solid white; \n      box-shadow: 0 2px 6px rgba(0,0,0,0.3); \n    }\n    .info-panel { \n      position: absolute; \n      top: 10px; \n      right: 10px; \n      background: white; \n      padding: 15px; \n      border-radius: 8px; \n      box-shadow: 0 2px 10px rgba(0,0,0,0.2); \n      z-index: 1000; \n      max-width: 300px; \n    }\n    .info-panel h2 { margin: 0 0 10px 0; font-size: 16px; }\n    .info-panel ul { margin: 0; padding-left: 18px; font-size: 13px; }\n    .info-panel li { margin-bottom: 5px; }\n  </style>\n</head>\n<body>\n  <div id="map"></div>\n  <div class="info-panel">\n    <h2>📍 Маршрут визитов</h2>\n    <ul>\n            ' + pointsList + '\n    </ul>\n    <p style="font-size:12px; color:#666; margin-top:10px;">\n      Всего точек: ' + routePoints.length + '<br>\n      Линия показывает порядок визитов (по времени создания задач)\n    </p>\n  </div>\n  <script>\n    const map = L.map("map").setView([' + routePoints[0].lat + ', ' + routePoints[0].lng + '], 10);\n    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {\n      attribution: "© OpenStreetMap contributors"\n    }).addTo(map);\n    ' + markersJS + '\n    const latlngs = [' + routePointsStr + '];\n    const routeLine = L.polyline(latlngs, {color: "#2563eb", weight: 4, opacity: 0.7, dashArray: "10, 10"}).addTo(map);\n    map.fitBounds(routeLine.getBounds(), {padding: [50, 50]});\n  </script>\n</body>\n</html>';
}

// Serve static files
app.use(express.static('public', {
  maxAge: '1m',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Root route
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Mobile Trade App running on port ' + PORT);
  console.log('VibeCode API Key configured: ' + (VIBECODE_API_KEY ? 'YES' : 'NO'));
});