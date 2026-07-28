const express = require('express');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// VibeCode API configuration
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

// Helper function for VibeCode API calls
async function vibecodeCall(method, path, body = null, token = null) {
  const url = `${VIBECODE_API}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('VibeCode API Error:', error);
    throw error;
  }
}

// Get current user info
app.get('/api/user', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const userData = await vibecodeCall('GET', '/me', null, token);
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get companies list
app.get('/api/companies', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const companies = await vibecodeCall('GET', '/crm/companies', null, token);
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get company by ID
app.get('/api/companies/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const company = await vibecodeCall('GET', `/crm/companies/${req.params.id}`, null, token);
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product sections
app.get('/api/catalog/sections', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const sections = await vibecodeCall('GET', '/catalog/sections', null, token);
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products by section
app.get('/api/catalog/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const sectionId = req.query.sectionId;
    const path = sectionId ? `/catalog/products?sectionId=${sectionId}` : '/catalog/products';
    const products = await vibecodeCall('GET', path, null, token);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user projects
app.get('/api/projects', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const projects = await vibecodeCall('GET', '/projects', null, token);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user department info
app.get('/api/department', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const userData = await vibecodeCall('GET', '/me', null, token);
    const departmentId = userData.department?.[0];
    
    if (!departmentId) {
      return res.json({ department: null, head: null });
    }

    const departments = await vibecodeCall('GET', '/departments', null, token);
    const department = departments.find(d => d.id === departmentId);
    
    res.json({
      department: department || null,
      head: department?.head || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const taskData = req.body;
    const result = await vibecodeCall('POST', '/tasks', taskData, token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const taskData = req.body;
    const result = await vibecodeCall('PATCH', `/tasks/${req.params.id}`, taskData, token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file to disk
app.post('/api/upload', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const { fileName, fileContent, folderId } = req.body;
    
    const uploadResult = await vibecodeCall('POST', '/disk/files', {
      name: fileName,
      content: fileContent,
      folderId: folderId || null
    }, token);

    res.json(uploadResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Excel file
app.post('/api/generate-excel', async (req, res) => {
  try {
    const { clientName, items, total } = req.body;
    
    const wb = XLSX.utils.book_new();
    
    const wsData = [
      ['ЗАКАЗ'],
      ['Клиент:', clientName],
      ['Дата:', new Date().toLocaleString('ru-RU')],
      [],
      ['Артикул', 'Наименование', 'Количество', 'Цена', 'Сумма']
    ];
    
    items.forEach(item => {
      wsData.push([
        item.article || '',
        item.name,
        item.quantity,
        item.price,
        item.quantity * item.price
      ]);
    });
    
    wsData.push([]);
    wsData.push(['', '', '', 'ИТОГО:', total]);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Заказ');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');
    
    res.json({
      success: true,
      base64: base64,
      fileName: `Zakaz_${clientName}_${Date.now()}.xlsx`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard analytics
app.get('/api/dashboard', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const { from, to } = req.query;
    
    const tasks = await vibecodeCall('GET', '/tasks?filter[title]=Визит к', null, token);
    
    const filteredTasks = tasks.filter(task => {
      if (!task.title?.startsWith('Визит к')) return false;
      
      const taskDate = new Date(task.createdDate || task.created);
      if (from && taskDate < new Date(from)) return false;
      if (to && taskDate > new Date(to)) return false;
      
      return true;
    });
    
    const analytics = {
      totalVisits: 0,
      totalOrders: 0,
      totalRevenue: 0,
      byEmployee: {},
      byClient: {}
    };
    
    filteredTasks.forEach(task => {
      const employeeId = task.responsibleId || task.createdBy;
      const employeeName = task.responsible?.name || 'Неизвестно';
      const clientName = task.title.replace('Визит к ', '').trim();
      
      analytics.totalVisits++;
      
      if (!analytics.byEmployee[employeeId]) {
        analytics.byEmployee[employeeId] = {
          name: employeeName,
          visits: 0,
          orders: 0,
          revenue: 0,
          clients: []
        };
      }
      
      analytics.byEmployee[employeeId].visits++;
      if (!analytics.byEmployee[employeeId].clients.includes(clientName)) {
        analytics.byEmployee[employeeId].clients.push(clientName);
      }
      
      if (!analytics.byClient[clientName]) {
        analytics.byClient[clientName] = {
          visits: 0,
          orders: 0,
          revenue: 0
        };
      }
      
      analytics.byClient[clientName].visits++;
      
      const description = task.description || '';
      const hasOrder = description.includes('📦 ЗАКАЗ') || description.includes('💰 Итого:');
      
      if (hasOrder) {
        const totalMatch = description.match(/💰 Итого:\s*([\d\s]+)\s*₽/);
        if (totalMatch) {
          const amount = parseInt(totalMatch[1].replace(/\s/g, ''));
          analytics.totalOrders++;
          analytics.totalRevenue += amount;
          analytics.byEmployee[employeeId].orders++;
          analytics.byEmployee[employeeId].revenue += amount;
          analytics.byClient[clientName].orders++;
          analytics.byClient[clientName].revenue += amount;
        }
      }
    });
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mobile Trade App v45 running on port ${PORT}`);
});
