const express = require('express');

const axios = require('axios');

const multer = require('multer');

const fs = require('fs');

const path = require('path');



const app = express();

const PORT = process.env.PORT || 3000;



const VIBECODE_API_KEY = process.env.VIBECODE_API_KEY || '';

const VIBECODE_BASE_URL = 'https://vibecode.bitrix24.tech/v1';



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



// Authentication middleware - extract user from VibeCode Gateway headers

app.use((req, res, next) => {

  // VibeCode Gateway passes user identity in headers

  const userId = req.headers['x-vibe-user-id'] || req.headers['x-b24-user-id'];

  const portalId = req.headers['x-vibe-portal-id'] || req.headers['x-b24-portal-id'];

  

  if (userId) {

    const parsedId = parseInt(userId);

    if (!isNaN(parsedId) && parsedId > 0) {

      req.currentUser = {

        id: parsedId,

        portalId: portalId

      };

      console.log(`Authenticated user: ${req.currentUser.id} portal: ${portalId}`);

    } else {

      req.currentUser = null;

      console.log(`Invalid userId: ${userId}`);

    }

  } else {

    // Fallback for development/testing

    req.currentUser = null;

    console.log('No user in headers, using fallback');

  }

  next();

});



app.use(express.json());



const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    const uploadDir = path.join(__dirname, 'uploads');

    if (!fs.existsSync(uploadDir)) {

      fs.mkdirSync(uploadDir, { recursive: true });

    }

    cb(null, uploadDir);

  },

  filename: (req, file, cb) => {

    cb(null, Date.now() + '-' + file.originalname);

  }

});

const upload = multer({ storage });



async function callVibeCode(method, endpoint, data = null, isFormData = false) {

  const url = VIBECODE_BASE_URL + endpoint;

  const headers = {

    'Authorization': 'Bearer ' + VIBECODE_API_KEY

  };

  

  if (!isFormData) {

    headers['Content-Type'] = 'application/json';

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



app.get('/api/companies', async (req, res) => {

  try {

    const response = await callVibeCode('GET', '/companies', { limit: 100 });

    res.json({ result: response.data.data, total: response.data.meta?.total });

  } catch (error) {

    console.error('Error fetching companies:', error.message);

    res.status(500).json({ error: error.message });

  }

});



app.get('/api/companies/:id', async (req, res) => {

  try {

    const response = await callVibeCode('GET', '/companies/' + req.params.id);

    res.json({ result: response.data.data });

  } catch (error) {

    console.error('Error fetching company:', error.message);

    res.status(500).json({ error: error.message });

  }

});



app.post('/api/visit', upload.array('photos', 10), async (req, res) => {

  try {

    console.log('Processing visit, body:', req.body);

    console.log('Files received:', req.files ? req.files.length : 0);

    

    const { companyId, type, subject, description, location, orderData, noteText, closeVisit } = req.body;

    const files = req.files || [];

    

    // Find existing open task or create new one

    let task = await findOpenTaskForCompany(companyId);

    let isNewTask = false;

    let companyResponse = null;

    let auditors = [];

    

    if (!task) {

      // Create new task

      companyResponse = await callVibeCode('GET', '/companies/' + companyId);

      const companyName = companyResponse.data.data?.title || 'ЗАМЕТКА';

      

      // Get current user and department head

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

        title: subject || 'ЗАКАЗ ? ' + companyName,

        description: 'ЗАМЕТКА ЗАМЕТКА\n',

        responsibleId: req.currentUser ? req.currentUser.id : 10,

        ufCrmTask: ['CO_' + companyId],

        status: 2

      };

      

      // Add groupId if provided

      if (req.body.groupId) {

        taskData.groupId = parseInt(req.body.groupId);

      }

      

      // Add auditors if found

      if (auditors.length > 0) {

        taskData.auditors = auditors;

      }

      

      const newTaskResponse = await callVibeCode('POST', '/tasks', taskData);

      task = newTaskResponse.data.data;

      isNewTask = true;

      console.log('Created new task:', task.id, 'groupId:', taskData.groupId, 'auditors:', auditors);

    } else {

      console.log('Found existing task:', task.id);

      // Fetch company info for subtask title

      try {

        companyResponse = await callVibeCode('GET', '/companies/' + companyId);

      } catch (e) {

        console.log('Could not fetch company for subtask:', e.message);

      }

    }

    

    // Build new content block

    let newContent = '\n';

    const now = new Date().toLocaleString('ru-RU');

    newContent += '=== ' + now + ' ===\n\n';

    

    if (type === 'visit' || location) {

      newContent += '\uD83D\uDCCD ОТМЕТКА ПОСЕЩЕНИЯ ФОТООТЧЕТ\n';

      newContent += (description || '') + '\n';

      if (location) {

        const loc = JSON.parse(location);

        newContent += '\n\uD83D\uDCCD Неизвестно: ' + loc.latitude + ', ' + loc.longitude + '\n';

      }

      newContent += '\n---\n\n';

    }

    

    if (type === 'photo' || files.length > 0) {

      newContent += '\uD83D\uDCF8 ФОТООТЧЕТ\n';

      newContent += (description || '') + '\n';

      newContent += '\n---\n\n';

    }

    

    if (type === 'note' || noteText) {

      newContent += '\uD83D\uDCDD ОТМЕТКА ПОСЕЩЕНИЯ\n';

      newContent += (noteText || description || '') + '\n';

      newContent += '\n---\n\n';

    }

    

    if (type === 'order' || orderData) {

      newContent += '\uD83D\uDCE6 ЗАКАЗ\n';

      newContent += (description || '') + '\n';

      if (orderData) {

        const orderItems = JSON.parse(orderData);

        if (orderItems.items && orderItems.items.length > 0) {

          newContent += '\n\uD83D\uDCCB Состав заказа:\n';

          orderItems.items.forEach((item, idx) => {

            newContent += (idx + 1) + '. ' + item.name + ' ? ' + item.quantity + ' ??. ? ' + item.price + ' ? = ' + (item.quantity * item.price) + ' ?\n';

          });

          newContent += '\n\uD83D\uDCB0 ЗАКАЗ: ' + orderItems.total + ' ?\n';

        }

      }

      newContent += '\n---\n\n';

    }

    

    // Upload files

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

      newContent += '\uD83D\uDCCE Наименование? ЗАКАЗ:\n';

      uploadedFiles.forEach((file, idx) => {

        newContent += (idx + 1) + '. ' + file.name + '\n';

      });

      newContent += '\n---\n\n';

    }

    

    // Update task description

    const currentDescription = task.description || '';

    const updatedDescription = currentDescription + newContent;

    

    // Attach files to task using batch API

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

          'Content-Type': 'application/json'

        }

      });

    } else {

      await callVibeCode('PATCH', '/tasks/' + task.id, {

        description: updatedDescription

      });

    }

    

    // Create subtask for order if orderData exists

    let orderSubtaskId = null;

    if (orderData) {

      try {

        const orderItems = JSON.parse(orderData);

        if (orderItems.items && orderItems.items.length > 0) {

          // Build order table for subtask description

          let orderDescription = '?? ЗАКАЗ ОТМЕТКА ПОСЕЩЕНИЯ\n\n';

          orderDescription += '| ? | Наименование | Кол-во | Итого | ЗАКАЗ |\n';

          orderDescription += '|---|-------------|--------|------|-------|\n';

          

          orderItems.items.forEach((item, idx) => {

            const itemTotal = item.quantity * item.price;

            orderDescription += '| ' + (idx + 1) + ' | ' + item.name + ' | ' + item.quantity + ' | ' + item.price.toFixed(2) + ' ? | ' + itemTotal.toFixed(2) + ' ? |\n';

          });

          

          orderDescription += '| | | | **ЗАКАЗ:** | **' + orderItems.total.toFixed(2) + ' ?** |\n';

          

          const subtaskData = {

            title: 'ЗАКАЗ (' + (companyResponse.data.data?.title || 'ЗАМЕТКА') + ')',

            description: orderDescription,

            responsibleId: task.responsibleId || (req.currentUser ? req.currentUser.id : 10),

            parentId: parseInt(task.id),

            status: 2

          };

          

          // Add groupId if provided

          if (req.body.groupId) {

            subtaskData.groupId = parseInt(req.body.groupId);

          }

          

          // Add auditors if found

          if (auditors.length > 0) {

            subtaskData.auditors = auditors;

          }

          

          const subtaskResponse = await callVibeCode('POST', '/tasks', subtaskData);

          orderSubtaskId = subtaskResponse.data.data.id;

          console.log('Created order subtask:', orderSubtaskId);

          

          // Generate Excel file with order table

          const XLSX = require('xlsx');

          const companyName = companyResponse && companyResponse.data && companyResponse.data.data ? companyResponse.data.data.title : 'ЗАМЕТКА';

          const now = new Date().toLocaleString('ru-RU');

          

          // Create workbook

          const wb = XLSX.utils.book_new();

          

          // Prepare data

          const data = [

            ['ЗАКАЗ ОТМЕТКА ПОСЕЩЕНИЯ'],

            [''],

            ['Дата:', companyName],

            ['Итого:', now],

            [''],

            ['?', 'Наименование', 'Кол-во', 'Итого', 'ЗАКАЗ']

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

          

          data.push(['', '', '', 'ЗАКАЗ:', orderItems.total]);

          

          // Create worksheet

          const ws = XLSX.utils.aoa_to_sheet(data);

          

          // Set column widths

          ws['!cols'] = [

            { wch: 5 },   // ?

            { wch: 40 },  // Наименование

            { wch: 10 },  // Кол-во

            { wch: 15 },  // Итого

            { wch: 15 }   // ЗАКАЗ

          ];

          

          // Add worksheet to workbook

          XLSX.utils.book_append_sheet(wb, ws, 'ЗАКАЗ');

          

          // Generate buffer

          const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

          const excelBase64 = excelBuffer.toString('base64');

          

          // Upload Excel file to disk

          const excelUploadResponse = await callVibeCode('POST', '/files/upload', {

            folderId: 19,

            filename: 'Zakaz_' + companyName.replace(/[^a-zA-Z0-9?-??-?]/g, '_') + '_' + Date.now() + '.xlsx',

            content: excelBase64

          });

          

          const excelFileId = excelUploadResponse.data.data?.id;

          console.log('Uploaded Excel file:', excelFileId);

          

          // Attach Excel file to subtask using batch API

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

                'Content-Type': 'application/json'

              }

            });

            console.log('Attached Excel file to subtask:', orderSubtaskId);

          }

        }

      } catch (orderError) {

        console.error('Error creating order subtask:', orderError.message);

      }

    }

    

    // If closing visit, complete the task

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



app.get('/api/sections', async (req, res) => {

  try {

    const response = await callVibeCode('GET', '/product-sections', { limit: 100 });

    res.json({ result: response.data.data });

  } catch (error) {

    console.error('Error fetching sections:', error.message);

    res.status(500).json({ error: error.message });

  }

});



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



// Get user context: workgroups and department head

app.get('/api/user-context', async (req, res) => {

  try {

    // Get current user from auth middleware or fallback to /users/me

    let user;

    if (req.currentUser) {

      const userResponse = await callVibeCode('GET', '/users/' + req.currentUser.id);

      user = userResponse.data.data;

    } else {

      const userResponse = await callVibeCode('GET', '/users/me');

      user = userResponse.data.data;

    }

    

    // Get user's workgroups

    const workgroupsResponse = await callVibeCode('GET', '/workgroups', { userId: user.id, limit: 50 });

    const workgroups = workgroupsResponse.data.data || [];

    

    // Get department head

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





// Dashboard endpoint - analytics for visits and orders

app.get('/api/dashboard', async (req, res) => {

  try {

    const { from, to, responsibleId } = req.query;

    

    // Build filter for tasks with CRM binding

    const filter = {

      'limit': 50,

      'sort': '-createdDate'

    };

    

    if (from) filter['filter[>=createdDate]'] = from;

    if (to) {

      // If to is just a date (no time), add T23:59:59 to include the whole day

      const toDate = to.includes('T') ? to : to + 'T23:59:59';

      filter['filter[<=createdDate]'] = toDate;

    }

    if (responsibleId) filter['filter[responsibleId]'] = responsibleId;

    

    // Get all tasks with CRM binding

    const tasksResponse = await callVibeCode('GET', '/tasks', filter);

    const allTasks = tasksResponse.data.data || [];

    

    // Filter app tasks: has ufCrmTask AND title contains "Визит"

    const VISIT_MARKER = '\u0412\u0438\u0437\u0438\u0442'; // "Визит"

    const tasks = allTasks.filter(t => {

      const hasCrm = t.ufCrmTask && t.ufCrmTask.length > 0;

      const isVisit = t.title && t.title.indexOf(VISIT_MARKER) >= 0;

      return hasCrm && isVisit;

    });

    

    // Build dashboard data

    const dashboard = {

      totalVisits: tasks.length,

      totalOrders: 0,

      totalOrderAmount: 0,

      employees: {},

      clients: {},

      period: { from: from || 'all', to: to || 'all' }

    };

    

    // Helper function to parse order amount from description

    function parseOrderAmount(description) {

      if (!description) return 0;

      // Match "Итого: 10000 ?" or "**ИТОГО:** | **10000 ?**"

      const ITogo = '\u0418\u0442\u043E\u0433\u043E'; // "Итого"

      const Ruble = '\u20BD'; // "?"

      const match = description.match(new RegExp(ITogo + '[:\\s]*\\*?(\\d[\\d\\s]*)\\*?\\s*' + Ruble));

      if (match) {

        return parseFloat(match[1].replace(/\s/g, ''));

      }

      return 0;

    }

    

    // Helper function to check if description contains order

    function hasOrder(description) {

      if (!description) return false;

      const OrderMarker = '\u0417\u0410\u041A\u0410\u0417'; // "ЗАКАЗ"

      return description.indexOf(OrderMarker) >= 0;

    }

    

    // Process visit tasks

    for (const task of tasks) {

      const empId = task.responsibleId;

      const empName = task.responsible ? task.responsible.name : ('ID ' + empId);

      

      if (!dashboard.employees[empId]) {

        dashboard.employees[empId] = {

          id: empId,

          name: empName,

          visits: 0,

          orders: 0,

          orderAmount: 0,

          clients: [],

          clientsDetails: {}

        };

      }

      

      dashboard.employees[empId].visits++;

      

      // Get company name from ufCrmTask

      let companyName = 'Неизвестно';

      if (task.ufCrmTask && task.ufCrmTask.length > 0) {

        const companyId = task.ufCrmTask[0].replace('CO_', '');

        try {

          const companyResponse = await callVibeCode('GET', '/companies/' + companyId);

          companyName = companyResponse.data.data?.title || 'ЗАМЕТКА ' + companyId;

        } catch (e) {

          companyName = 'ЗАМЕТКА ' + companyId;

        }

      }

      

      if (!dashboard.employees[empId].clients.includes(companyName)) {
        dashboard.employees[empId].clients.push(companyName);
      }

      // Accumulate client details per employee
      if (!dashboard.employees[empId].clientsDetails[companyName]) {
        dashboard.employees[empId].clientsDetails[companyName] = {
          name: companyName,
          visits: 0,
          orders: 0,
          orderAmount: 0
        };
      }
      dashboard.employees[empId].clientsDetails[companyName].visits++;

      if (!dashboard.clients[companyName]) {
        dashboard.clients[companyName] = {
          name: companyName,
          visits: 0,
          orders: 0,
          orderAmount: 0
        };
      }
      dashboard.clients[companyName].visits++;

      if (hasOrder(task.description)) {

        const orderAmount = parseOrderAmount(task.description);

        if (orderAmount > 0) {

          dashboard.employees[empId].orders++;

          dashboard.employees[empId].orderAmount += orderAmount;

          dashboard.employees[empId].clientsDetails[companyName].orders++;

          dashboard.employees[empId].clientsDetails[companyName].orderAmount += orderAmount;

          dashboard.clients[companyName].orders++;

          dashboard.clients[companyName].orderAmount += orderAmount;

          dashboard.totalOrders++;

          dashboard.totalOrderAmount += orderAmount;

        }

      }

    }

    

    // Convert to arrays for easier frontend consumption

    dashboard.employeesList = Object.values(dashboard.employees);

    dashboard.clientsList = Object.values(dashboard.clients).sort((a, b) => b.orderAmount - a.orderAmount);

    

    res.json({ success: true, dashboard });

  } catch (error) {

    console.error('Error fetching dashboard:', error.message);

    res.status(500).json({ error: error.message });

  }

});

app.get('/', (req, res) => {

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  res.setHeader('Pragma', 'no-cache');

  res.setHeader('Expires', '0');

  res.sendFile(path.join(__dirname, 'public', 'index.html'));

});



app.use(express.static('public', {

  maxAge: '1m',

  setHeaders: (res, path) => {

    if (path.endsWith('.html')) {

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      res.setHeader('Pragma', 'no-cache');

      res.setHeader('Expires', '0');

    }

  }

}));





// Dashboard page route

app.get('/dashboard', (req, res) => {

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  res.setHeader('Pragma', 'no-cache');

  res.setHeader('Expires', '0');

  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));

});



// Root route - serve index.html

app.get("/", (req, res) => {

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  res.setHeader("Pragma", "no-cache");

  res.setHeader("Expires", "0");

  res.sendFile(path.join(__dirname, "public", "index.html"));

});



app.listen(PORT, () => {

  console.log('Mobile Trade App running on port ' + PORT);

  console.log('VibeCode API Key configured: ' + (VIBECODE_API_KEY ? 'YES' : 'NO'));

});









































