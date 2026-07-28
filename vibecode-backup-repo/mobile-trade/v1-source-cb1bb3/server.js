const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// VibeCode Gateway configuration
const VIBECODE_GATEWAY = process.env.VIBECODE_GATEWAY || '';
const VIBECODE_TOKEN = process.env.VIBECODE_TOKEN || '';
const BITRIX_DOMAIN = process.env.BITRIX_DOMAIN || '';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Helper function for Bitrix24 API calls through VibeCode Gateway
async function bitrixCall(method, params = {}, userId = null) {
  const url = `${VIBECODE_GATEWAY}/api/proxy`;
  
  const body = {
    method: method,
    params: params
  };
  
  if (userId) {
    body.userId = userId;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VIBECODE_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bitrix API error: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

// Get current user info
app.get('/api/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userResponse = await bitrixCall('user.current', {}, token);
    
    res.json(userResponse);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get companies list
app.get('/api/companies', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const search = req.query.search || '';
    
    const params = {
      order: { TITLE: 'ASC' },
      select: ['ID', 'TITLE', 'ADDRESS', 'PHONE', 'EMAIL'],
      filter: { '>ID': 0 }
    };
    
    if (search) {
      params.filter['%TITLE'] = search;
    }
    
    const response = await bitrixCall('crm.company.list', params, token);
    res.json(response);
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get catalog sections
app.get('/api/catalog/sections', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    const response = await bitrixCall('catalog.section.list', {
      select: ['ID', 'NAME', 'DEPTH_LEVEL', 'IBLOCK_SECTION_ID'],
      filter: { ACTIVE: 'Y' }
    }, token);
    
    res.json(response);
  } catch (error) {
    console.error('Error getting sections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get products by section
app.get('/api/catalog/products', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const sectionId = req.query.sectionId;
    
    const params = {
      select: ['ID', 'NAME', 'PRICE', 'CURRENCY_ID', 'SECTION_ID', 'XML_ID'],
      filter: { ACTIVE: 'Y' }
    };
    
    if (sectionId) {
      params.filter.SECTION_ID = sectionId;
    }
    
    const response = await bitrixCall('catalog.product.list', params, token);
    res.json(response);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user projects/workgroups
app.get('/api/projects', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    const response = await bitrixCall('sonet_group.get', {
      FILTER: { ACTIVE: 'Y' },
      ORDER: { NAME: 'ASC' }
    }, token);
    
    res.json(response);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user department and manager
app.get('/api/department', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    const userResponse = await bitrixCall('user.current', {}, token);
    const userId = userResponse.result.ID;
    const departmentId = userResponse.result.UF_DEPARTMENT?.[0];
    
    let manager = null;
    if (departmentId) {
      const deptResponse = await bitrixCall('department.get', {
        ID: departmentId
      }, token);
      if (deptResponse.result?.[0]?.UF_HEAD) {
        const managerResponse = await bitrixCall('user.get', {
          ID: deptResponse.result[0].UF_HEAD
        }, token);
        manager = managerResponse.result?.[0];
      }
    }
    
    res.json({
      user: userResponse.result,
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
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
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
      params.fields.UF_CRM_TASK = [`CO_${companyId}`];
    }
    
    if (files && files.length > 0) {
      params.fields.UF_TASK_WEBDAV_FILES = files;
    }
    
    let response;
    if (taskId) {
      response = await bitrixCall('tasks.task.update', {
        taskId: taskId,
        ...params
      }, token);
    } else {
      response = await bitrixCall('tasks.task.add', params, token);
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
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
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
    
    const response = await bitrixCall('tasks.task.add', params, token);
    res.json(response);
  } catch (error) {
    console.error('Error creating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close task
app.post('/api/tasks/close', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const { taskId } = req.body;
    
    const response = await bitrixCall('tasks.task.update', {
      taskId: taskId,
      fields: {
        STATUS: 5,
        CLOSED_DATE: new Date().toISOString()
      }
    }, token);
    
    res.json(response);
  } catch (error) {
    console.error('Error closing task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file to disk
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    
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
    }, token);
    
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
    
    // Create header data
    const headerData = [
      ['ЗАКАЗ'],
      [`Клиент: ${clientName}`],
      [`Дата: ${date}`],
      []
    ];
    
    // Create items table
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
    
    // Add total row
    tableData.push([]);
    tableData.push(['', '', '', 'ИТОГО:', total]);
    
    // Combine all data
    const allData = [...headerData, ...tableData];
    
    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Заказ');
    
    const fileName = `Zakaz_${clientName}_${Date.now()}.xlsx`;
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
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const { dateFrom, dateTo } = req.query;
    
    // Get all tasks
    const tasksResponse = await bitrixCall('tasks.task.list', {
      select: ['ID', 'TITLE', 'DESCRIPTION', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CLOSED_DATE', 'STATUS'],
      filter: {
        '%TITLE': 'Визит к'
      }
    }, token);
    
    const tasks = tasksResponse.result?.tasks || [];
    
    // Filter by date if provided
    let filteredTasks = tasks;
    if (dateFrom || dateTo) {
      filteredTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdDate);
        if (dateFrom && taskDate < new Date(dateFrom)) return false;
        if (dateTo && taskDate > new Date(dateTo)) return false;
        return true;
      });
    }
    
    // Parse orders from task descriptions
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
      
      // Extract client name from title "Визит к [Company Name]"
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
      
      // Employee stats
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
      
      // Client stats
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
    
    // Convert Sets to arrays for JSON
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
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    
    if (ids.length === 0) {
      return res.json({ result: [] });
    }
    
    const response = await bitrixCall('user.get', {
      ID: ids
    }, token);
    
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
  console.log(`Mobile Trade App server running on port ${PORT}`);
});
