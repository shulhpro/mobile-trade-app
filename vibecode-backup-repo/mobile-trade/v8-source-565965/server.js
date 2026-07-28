const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// API configuration
const API_KEY = 'vibe_api_B5LhuhAlxAfjnWVLTCD6RU0UsDWl6IvV_05fc97';
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const db = {
  visits: [],
  orders: []
};

// Helper to call VibeCode API
async function callVibeApi(endpoint) {
  try {
    const response = await fetch(`${VIBECODE_API}${endpoint}`, {
      headers: {
        'X-Api-Key': API_KEY
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

// ============ COMPANIES API ============
app.get('/api/companies', async (req, res) => {
  try {
    const search = req.query.search?.toLowerCase() || '';
    const companies = await callVibeApi('/companies?limit=50');
    
    let result = companies.map(c => ({
      id: c.id,
      name: c.title,
      address: c.address || c.ufCrm_1508844257 || '',
      contact: c.assignedById ? `User ${c.assignedById}` : 'No contact',
      phone: c.phone || '',
      email: c.email || ''
    }));
    
    if (search) {
      result = result.filter(c => 
        c.name.toLowerCase().includes(search) || 
        c.address.toLowerCase().includes(search)
      );
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const companies = await callVibeApi('/companies?limit=50');
    const company = companies.find(c => c.id == req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    
    res.json({
      id: company.id,
      name: company.title,
      address: company.address || company.ufCrm_1508844257 || '',
      contact: company.assignedById ? `User ${company.assignedById}` : 'No contact',
      phone: company.phone || '',
      email: company.email || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// ============ PRODUCTS API ============
app.get('/api/products', async (req, res) => {
  try {
    const products = await callVibeApi('/products?limit=50');
    
    const result = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price || 0,
      unit: p.measure || 'pc'
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============ VISITS API ============
app.post('/api/visits', (req, res) => {
  const visit = {
    id: Date.now(),
    companyId: req.body.companyId,
    companyName: req.body.companyName,
    startTime: new Date().toISOString(),
    coords: null,
    photos: [],
    note: '',
    order: { items: [], total: 0 },
    status: 'in_progress'
  };
  db.visits.push(visit);
  res.json(visit);
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
    const photoUrl = `/uploads/${req.file.filename}`;
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
  const visit = db.visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  res.json({
    success: true,
    message: 'Task creation endpoint ready',
    visit: {
      id: visit.id,
      companyName: visit.companyName,
      note: visit.note,
      orderTotal: visit.order?.total || 0,
      photosCount: visit.photos?.length || 0
    }
  });
});

app.use('/uploads', express.static('uploads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});