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
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

async function callVibeCode(method, endpoint, data = null, isFormData = false) {
  const url = VIBECODE_BASE_URL + endpoint;
  const headers = { 'Authorization': 'Bearer ' + VIBECODE_API_KEY };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  try {
    const config = { headers };
    if (method === 'GET') return axios.get(url, { params: data, headers: config.headers });
    if (method === 'POST') return axios.post(url, data, config);
    if (method === 'PATCH') return axios.patch(url, data, config);
    if (method === 'PUT') return axios.put(url, data, config);
    if (method === 'DELETE') return axios.delete(url, config);
  } catch (error) {
    console.error(`VibeCode Error: ${error.message}`);
    throw error;
  }
}

app.use((req, res, next) => {
  const userId = req.headers['x-vibe-user-id'] || req.headers['x-b24-user-id'];
  const portalId = req.headers['x-vibe-portal-id'] || req.headers['x-b24-portal-id'];
  if (userId) {
    const parsedId = parseInt(userId);
    if (!isNaN(parsedId)) req.currentUser = { id: parsedId, portalId };
  }
  next();
});

app.get('/api/companies', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/companies', { limit: 100 });
    res.json({ success: true, data: response.data.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/tasks/' + req.params.id);
    res.json({ task: response.data.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/visit', upload.array('photos', 10), async (req, res) => {
  try {
    const { companyId, subject, description, location, orderData, noteText, closeVisit } = req.body;
    const files = req.files || [];
    
    let task = null;
    try {
      const resp = await callVibeCode('GET', '/tasks', {
        'filter[ufCrmTask]': ['CO_' + companyId],
        'filter[status]': 2,
        'limit': 1
      });
      if (resp.data.data?.length > 0) task = resp.data.data[0];
    } catch (e) {}

    let companyName = 'Компания ' + companyId;
    try {
      const cp = await callVibeCode('GET', '/companies/' + companyId);
      companyName = cp.data.data?.title || companyName;
    } catch (e) {}

    if (!task) {
      const taskData = {
        title: subject || 'Визит к ' + companyName,
        description: 'Автоматически создано\n',
        responsibleId: req.currentUser?.id || 10,
        ufCrmTask: ['CO_' + companyId],
        status: 2
      };
      const newTask = await callVibeCode('POST', '/tasks', taskData);
      task = newTask.data.data;
    }

    let newLog = '\n=== ' + new Date().toLocaleString('ru-RU') + ' ===\n\n';
    if (subject) newLog += '📝 ' + subject + '\n\n';
    if (description) newLog += description + '\n\n';
    if (location) {
      const loc = JSON.parse(location);
      newLog += '📍 ' + loc.latitude + ', ' + loc.longitude + '\n\n';
    }
    if (noteText) newLog += '📓 ' + noteText + '\n\n';
    if (orderData) {
      const items = JSON.parse(orderData);
      newLog += '💰 Заказ\n' + items.description + '\n\n';
    }

    task.description = (task.description || '') + newLog;
    await callVibeCode('PATCH', '/tasks/' + task.id, { description: task.description });

    if (files.length > 0) {
      const uploadedIds = [];
      for (const f of files) {
        const up = await callVibeCode('POST', '/files/upload', f, true);
        uploadedIds.push(up.data.data.id);
      }
      if (uploadedIds.length > 0) {
        await callVibeCode('POST', '/batch', {
          haltOnFail: false,
          cmd: uploadedIds.map(id => ({
            method: 'tasks.task.update',
            params: { taskId: task.id, fields: { ufTaskWebdavFiles: uploadedIds.map(fid => 'n' + fid) } }
          }))
        });
      }
    }

    if (orderData) {
      const items = JSON.parse(orderData);
      await callVibeCode('POST', '/tasks', {
        title: 'Заказ (' + companyName + ')',
        description: items.description,
        responsibleId: task.responsibleId,
        parentId: parseInt(task.id),
        status: 2
      });
    }

    if (closeVisit) await callVibeCode('PATCH', '/tasks/' + task.id, { status: 5 });
    res.json({ success: true, task });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const resp = await callVibeCode('GET', '/products', { limit: 100 });
    res.json({ result: resp.data.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const resp = await callVibeCode('GET', '/tasks', {
      'limit': 50,
      'sort': '-createdDate',
      ...(from && { 'filter[>=createdDate]': from }),
      ...(to && { 'filter[<=createdDate]': to + 'T23:59:59' })
    });
    const tasks = resp.data.data || [];
    const dash = { totalVisits: 0, totalOrders: 0, totalOrderAmount: 0, employees: {}, clients: {}, tasks };

    for (const t of tasks) {
      const eid = t.responsibleId;
      const ename = t.responsible?.name || 'ID ' + eid;
      if (!dash.employees[eid]) dash.employees[eid] = { id: eid, name: ename, visits: 0, orders: 0, orderAmount: 0, clientsDetails: {} };
      dash.employees[eid].visits++;

      let cname = 'Неизвестная компания';
      if (t.ufCrmTask?.[0]) {
        try {
          const cp = await callVibeCode('GET', '/companies/' + t.ufCrmTask[0].replace('CO_', ''));
          cname = cp.data.data?.title || cname;
        } catch (e) {}
      }

      if (!dash.employees[eid].clientsDetails[cname]) dash.employees[eid].clientsDetails[cname] = { name: cname, visits: 0, orders: 0, orderAmount: 0 };
      dash.employees[eid].clientsDetails[cname].visits++;

      if (!dash.clients[cname]) dash.clients[cname] = { name: cname, visits: 0, orders: 0, orderAmount: 0 };
      dash.clients[cname].visits++;

      const desc = t.description || '';
      const match = desc.match(/Итого:\s*([\d\s.]+)\s*₽/);
      if (match) {
        const amt = parseFloat(match[1].replace(/\s/g, ''));
        dash.employees[eid].orders++;
        dash.employees[eid].orderAmount += amt;
        dash.employees[eid].clientsDetails[cname].orders++;
        dash.employees[eid].clientsDetails[cname].orderAmount += amt;
        dash.totalOrders++;
        dash.totalOrderAmount += amt;
        dash.clients[cname].orders++;
        dash.clients[cname].orderAmount += amt;
      }
      dash.totalVisits++;
    }
    dash.employeesList = Object.values(dash.employees);
    dash.clientsList = Object.values(dash.clients).sort((a,b) => b.orderAmount - a.orderAmount);
    res.json({ success: true, dashboard: dash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static('public'));
app.listen(PORT, () => console.log('Server running on ' + PORT));
