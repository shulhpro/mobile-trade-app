const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const db = {
  companies: [
    { id: 1, name: 'OOO "StroyMaterialy"', address: 'Moskva, ul. Lenina, 1', contact: 'Ivanov I.I.', phone: '+7 (999) 123-45-67', email: 'ivanov@stroymat.ru' },
    { id: 2, name: 'OOO "TehnoSfera"', address: 'Moskva, ul. Gagarina, 15', contact: 'Petrov P.P.', phone: '+7 (999) 234-56-78', email: 'petrov@tehnosfera.ru' },
    { id: 3, name: 'IP Sidorov', address: 'Moskva, pr. Mira, 42', contact: 'Sidorov S.S.', phone: '+7 (999) 345-67-89', email: 'sidorov@mail.ru' },
    { id: 4, name: 'AO "PromKomplekt"', address: 'Moskva, ul. Pobedy, 7', contact: 'Kuznetsov K.K.', phone: '+7 (999) 456-78-90', email: 'kuznetsov@prom.ru' },
    { id: 5, name: 'OOO "ElitStroy"', address: 'Moskva, nab. Rechnaya, 3', contact: 'Smirnov S.S.', phone: '+7 (999) 567-89-01', email: 'smirnov@elit.ru' }
  ],
  visits: [],
  orders: [],
  products: [
    { id: 1, name: 'Cement M500', price: 350, unit: 'bag' },
    { id: 2, name: 'Sand', price: 120, unit: 'bag' },
    { id: 3, name: 'Red Brick', price: 15, unit: 'pc' },
    { id: 4, name: 'Drywall 12.5mm', price: 280, unit: 'sheet' },
    { id: 5, name: 'Profile 60x27', price: 45, unit: 'pc' },
    { id: 6, name: 'Putty', price: 180, unit: 'bag' },
    { id: 7, name: 'Paint', price: 420, unit: 'bucket' },
    { id: 8, name: 'Ceramic Tile', price: 650, unit: 'm2' }
  ]
};

app.get('/api/companies', (req, res) => {
  const search = req.query.search?.toLowerCase() || '';
  let result = db.companies;
  if (search) {
    result = result.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.address.toLowerCase().includes(search) ||
      c.contact.toLowerCase().includes(search)
    );
  }
  res.json(result);
});

app.get('/api/companies/:id', (req, res) => {
  const company = db.companies.find(c => c.id == req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

app.get('/api/products', (req, res) => {
  res.json(db.products);
});

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
