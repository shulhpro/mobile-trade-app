const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Helper to get auth info from VibeCode Gateway headers
function getAuthInfo(req) {
  return {
    userId: req.headers['x-vibe-user-id'],
    userName: req.headers['x-vibe-user-name'],
    authToken: req.headers['x-vibe-authorization']?.replace('Bearer ', '')
  };
}

// Helper function for Bitrix24 API calls through VibeCode
async function bitrixCall(method, params = {}, req = null) {
  const authInfo = req ? getAuthInfo(req) : {};
  
  // Use VibeCode batch API
  const url = 'https://vibecode.bitrix24.tech/v1/batch';
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (authInfo.authToken) {
    headers['Authorization'] = 'Bearer ' + authInfo.authToken;
  }
  
  // Build batch request
  const body = {
    halt: 0,
    cmd: {}
  };
  
  // Convert params to query string
  const queryParts = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'object') {
      queryParts.push(key + '=' + encodeURIComponent(JSON.stringify(value)));
    } else {
      queryParts.push(key + '=' + encodeURIComponent(value));
    }
  }
  
  const cmdKey = method.replace(/\./g, '_');
  body.cmd[cmdKey] = method + (queryParts.length > 0 ? '?' + queryParts.join('&') : '');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Bitrix API error: ' + response.status + ' - ' + errorText);
  }
  
  const result = await response.json();
  
  // Extract result from batch response
  if (result.result && result.result[cmdKey]) {
    return result.result[cmdKey];
  }
  
  return result;
}

// Get current user info
app.get('/api/user', async (req, res) => {
  try {
    const authInfo = getAuthInfo(req);
    
    if (!authInfo.userId) {
      return res.status(401).json({ error: 'Not authenticated via VibeCode Gateway' });
    }
    
    res.json({
      result: {
        ID: authInfo.userId,
        NAME: authInfo.userName || 'User',
        UF_DEPARTMENT: []
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get companies list
app.get('/api/companies', async (req, res) => {
  try {
    const search = req.query.search || '';
    
    const params = {
      order: { TITLE: 'ASC' },
      select: ['ID', 'TITLE', 'ADDRESS', 'PHONE', 'EMAIL'],
      filter: { '>ID': 0 }
    };
    
    if (search) {
      params.filter['%TITLE'] = search;
    }
    
    const response = await bitrixCall('crm.company.list', params, req);
    res.json(response);
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get catalog sections
app.get('/api/catalog/sections', async (req, res) => {
  try {
    const response = await bitrixCall('catalog.section.list', {
      select: ['ID', 'NAME', 'DEPTH_LEVEL', 'IBLOCK_SECTION_ID'],
      filter: { ACTIVE: 'Y' }
    }, req);
    
    res.json(response);
  } catch (error) {
    console.error('Error getting sections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get products by section
app.get('/api/catalog/products', async (req, res) => {
  try {
    const sectionId = req.query.sectionId;
    
    const params = {
      select: ['ID', 'NAME', 'PRICE', 'CURRENCY_ID', 'SECTION_ID', 'XML_ID'],
      filter: { ACTIVE: 'Y' }
    };
    
    if (sectionId) {
      params.filter.SECTION_ID = sectionId;
    }
    
    const response = await bitrixCall('catalog.product.list', params, req);
    res.json(response);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user projects/workgroups
app.get('/api/projects', async (req, res) => {
  try {
    const response = await bitrixCall('sonet_group.get', {
      FILTER: { ACTIVE: 'Y' },
      ORDER: { NAME: 'ASC' }
    }, req);
    
    res.json(response);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user department and manager
app.get('/api/department', async (req, res) => {
  try {
    const authInfo = getAuthInfo(req);
    
    const userResponse = await bitrixCall('user.current', {}, req);
    const userId = userResponse.result?.ID || authInfo.userId;
    const departmentId = userResponse.result?.UF_DEPARTMENT?.[0];
    
    let manager = null;
    if (departmentId) {
      const deptResponse = await bitrixCall('department.get', {
        ID: departmentId
      }, req);
      if (deptResponse.result?.[0]?.UF_HEAD) {
        const managerResponse = await bitrixCall('user.get', {
          ID: deptResponse.result[0].UF_HEAD
        }, req);
        manager = managerResponse.result?.[0];
      }
    }
    
    res.json({
      user: userResponse.result || { ID: userId, NAME: authInfo.userName },
      department: departmentId,
      manager: manager
    });
  } catch (error) {
    console.error('Error getting department:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or update task
app.post('/api/tasks', async (req, res) => {
  try {
    const { taskId, title, description, companyId, projectId, auditors, files } = req.body;
    
    const params = {
      fields: {
        TITLE: title,
        DESCRIPTION: description,
        RESPONSIBLE_ID: req.body.responsibleId,
        CREATED_BY: req.body.responsibleId,
        GROUP_ID: projectId || 0,
        AUDITORS: auditors || []
      }
    };
    
    if (companyId) {
      params.fields.UF_CRM_TASK = ['CO_' + companyId];
    }
    
    if (files && files.length > 0) {
      params.fields.UF_TASK_WEBDAV_FILES = files;
    }
    
    let response;
    if (taskId) {
      response = await bitrixCall('tasks.task.update', {
        taskId: taskId,
        ...params
      }, req);
    } else {
      response = await bitrixCall('tasks.task.add', params, req);
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error creating/updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subtask
app.post('/api/tasks/subtask', async (req, res) => {
  try {
    const { parentId, title, description, responsibleId, projectId, auditors } = req.body;
    
    const params = {
      fields: {
        TITLE: title,
        DESCRIPTION: description,
        RESPONSIBLE_ID: responsibleId,
        CREATED_BY: responsibleId,
        PARENT_ID: parentId,
        GROUP_ID: projectId || 0,
        AUDITORS: auditors || []
      }
    };
    
    const response = await bitrixCall('tasks.task.add', params, req);
    res.json(response);
  } catch (error) {
    console.error('Error creating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close task
app.post('/api/tasks/close', async (req, res) => {
  try {
    const { taskId } = req.body;
    
    const response = await bitrixCall('tasks.task.update', {
      taskId: taskId,
      fields: {
        STATUS: 5,
        CLOSED_DATE: new Date().toISOString()
      }
    }, req);
    
    res.json(response);
  } catch (error) {
    console.error('Error closing task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file to disk
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileData = fs.readFileSync(req.file.path);
    const base64Data = fileData.toString('base64');
    
    const response = await bitrixCall('disk.storage.uploadfile', {
      id: req.body.storageId || 3,
      data: {
        NAME: req.file.originalname
      },
      fileContent: [req.file.originalname, base64Data]
    }, req);
    
    fs.unlinkSync(req.file.path);
    
    res.json(response);
  } catch (error) {
    console.error('Error uploading file:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Generate Excel file
app.post('/api/excel/order', async (req, res) => {
  try {
    const { clientName, date, items, total } = req.body;
    
    const wb = XLSX.utils.book_new();
    
    const headerData = [
      ['ЗАКАЗ'],
      ['Клиент: ' + clientName],
      ['Дата: ' + date],
      []
    ];
    
    const tableData = [
      ['Артикул', 'Наименование', 'Количество', 'Цена', 'Сумма']
    ];
    
    items.forEach(item => {
      tableData.push([
        item.article || '',
        item.name,
        item.quantity,
        item.price,
        item.total
      ]);
    });
    
    tableData.push([]);
    tableData.push(['', '', '', 'ИТОГО:', total]);
    
    const allData = [...headerData, ...tableData];
    
    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    ws['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Заказ');
    
    const fileName = 'Zakaz_' + clientName + '_' + Date.now() + '.xlsx';
    const filePath = path.join(__dirname, 'uploads', fileName);
    
    XLSX.writeFile(wb, filePath);
    
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');
    
    fs.unlinkSync(filePath);
    
    res.json({
      fileName: fileName,
      fileData: base64Data
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const tasksResponse = await bitrixCall('tasks.task.list', {
      select: ['ID', 'TITLE', 'DESCRIPTION', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CLOSED_DATE', 'STATUS'],
      filter: {
        '%TITLE': 'Визит к'
      }
    }, req);
    
    const tasks = tasksResponse.result?.tasks || [];
    
    let filteredTasks = tasks;
    if (dateFrom || dateTo) {
      filteredTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdDate);
        if (dateFrom && taskDate < new Date(dateFrom)) return false;
        if (dateTo && taskDate > new Date(dateTo)) return false;
        return true;
      });
    }
    
    const visits = [];
    const employeeStats = {};
    const clientStats = {};
    
    filteredTasks.forEach(task => {
      const hasOrder = task.description && (
        task.description.includes('📦 ЗАКАЗ') || 
        task.description.includes('💰 Итого:')
      );
      
      let orderTotal = 0;
      if (hasOrder && task.description) {
        const match = task.description.match(/💰 Итого:\s*([\d\s]+)\s*₽/);
        if (match) {
          orderTotal = parseInt(match[1].replace(/\s/g, ''));
        }
      }
      
      const clientMatch = task.title.match(/Визит к\s+(.+)/);
      const clientName = clientMatch ? clientMatch[1] : 'Неизвестно';
      
      const visit = {
        id: task.id,
        title: task.title,
        client: clientName,
        responsibleId: task.responsibleId,
        date: task.createdDate,
        hasOrder: hasOrder,
        orderTotal: orderTotal,
        status: task.status
      };
      
      visits.push(visit);
      
      if (!employeeStats[task.responsibleId]) {
        employeeStats[task.responsibleId] = {
          visits: 0,
          orders: 0,
          total: 0,
          clients: new Set()
        };
      }
      employeeStats[task.responsibleId].visits++;
      if (hasOrder) {
        employeeStats[task.responsibleId].orders++;
        employeeStats[task.responsibleId].total += orderTotal;
      }
      employeeStats[task.responsibleId].clients.add(clientName);
      
      if (!clientStats[clientName]) {
        clientStats[clientName] = {
          visits: 0,
          orders: 0,
          total: 0
        };
      }
      clientStats[clientName].visits++;
      if (hasOrder) {
        clientStats[clientName].orders++;
        clientStats[clientName].total += orderTotal;
      }
    });
    
    Object.keys(employeeStats).forEach(key => {
      employeeStats[key].clients = Array.from(employeeStats[key].clients);
    });
    
    res.json({
      summary: {
        totalVisits: visits.length,
        totalOrders: visits.filter(v => v.hasOrder).length,
        totalAmount: visits.reduce((sum, v) => sum + v.orderTotal, 0)
      },
      visits: visits,
      byEmployee: employeeStats,
      byClient: clientStats
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user names for dashboard
app.get('/api/users', async (req, res) => {
  try {
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    
    if (ids.length === 0) {
      return res.json({ result: [] });
    }
    
    const response = await bitrixCall('user.get', {
      ID: ids
    }, req);
    
    res.json(response);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('Mobile Trade App server running on port ' + PORT);
});

