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

const companies = [
  { id: 1, name: 'OOO "StroyMaterialy"', address: 'Moskva, ul. Lenina 1', contact: 'Ivanov I.I.', phone: '+7 (999) 123-45-67' },
  { id: 2, name: 'OOO "TehnoSfera"', address: 'Moskva, ul. Gagarina 15', contact: 'Petrov P.P.', phone: '+7 (999) 234-56-78' },
  { id: 3, name: 'IP Sidorov', address: 'Moskva, pr. Mira 42', contact: 'Sidorov S.S.', phone: '+7 (999) 345-67-89' },
  { id: 4, name: 'AO "PromKomplekt"', address: 'Moskva, ul. Pobedy 7', contact: 'Kuznetsov K.K.', phone: '+7 (999) 456-78-90' },
  { id: 5, name: 'OOO "ElitStroy"', address: 'Moskva, nab. Rechnaya 3', contact: 'Smirnov S.S.', phone: '+7 (999) 567-89-01' }
];

const visits = [];
const orders = [];

app.get('/api/companies', (req, res) => {
  res.json(companies);
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
    order: null,
    status: 'in_progress'
  };
  visits.push(visit);
  res.json(visit);
});

app.post('/api/visits/:id/photos', upload.single('photo'), (req, res) => {
  const visit = visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  
  if (req.file) {
    const photoUrl = `/uploads/${req.file.filename}`;
    visit.photos.push(photoUrl);
    res.json({ success: true, url: photoUrl });
  } else {
    res.status(400).json({ error: 'No photo uploaded' });
  }
});

app.patch('/api/visits/:id/note', (req, res) => {
  const visit = visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  
  visit.note = req.body.note || '';
  res.json({ success: true });
});

app.post('/api/visits/:id/order', (req, res) => {
  const visit = visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  
  visit.order = req.body.order;
  orders.push({
    visitId: visit.id,
    companyId: visit.companyId,
    items: req.body.order.items,
    total: req.body.order.total,
    createdAt: new Date().toISOString()
  });
  res.json({ success: true });
});

app.post('/api/visits/:id/complete', async (req, res) => {
  const visit = visits.find(v => v.id == req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  
  visit.status = 'completed';
  visit.endTime = new Date().toISOString();
  res.json({ success: true, visit });
});

app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
