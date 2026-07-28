const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// VibeCode API configuration
const VIBECODE_API_KEY = process.env.VIBECODE_API_KEY || '';
const VIBECODE_BASE_URL = 'https://vibecode.bitrix24.tech/v1';

// CORS middleware
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

// Middleware
app.use(express.json());

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
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// VibeCode API client
async function callVibeCode(method, endpoint, data = null) {
  const url = `${VIBECODE_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${VIBECODE_API_KEY}`,
    'Content-Type': 'application/json'
  };
  
  try {
    if (method === 'GET') {
      return await axios.get(url, { headers, params: data });
    } else if (method === 'POST') {
      return await axios.post(url, data, { headers });
    }
  } catch (error) {
    console.error(`VibeCode API error (${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

// API: Get companies list
app.get('/api/companies', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/companies', { limit: 100 });
    res.json({ result: response.data.data, total: response.data.meta?.total });
  } catch (error) {
    console.error('Error fetching companies:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Get company details
app.get('/api/companies/:id', async (req, res) => {
  try {
    const response = await callVibeCode('GET', `/companies/${req.params.id}`);
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error fetching company:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Create activity for company
app.post('/api/activities', async (req, res) => {
  try {
    const { companyId, type, subject, description, location, orderData } = req.body;
    
    let activityDescription = description || '';
    
    if (type === 'visit') {
      activityDescription = `📍 Отметка посещения торговой точки\n\n${description || ''}`;
      if (location) {
        activityDescription += `\n\n📍 Координаты: ${location.latitude}, ${location.longitude}`;
      }
    } else if (type === 'photo') {
      activityDescription = `📸 Фотоотчет\n\n${description || ''}`;
    } else if (type === 'note') {
      activityDescription = `📝 Заметка\n\n${description || ''}`;
    } else if (type === 'order') {
      activityDescription = `📦 Заказ\n\n${description || ''}`;
      if (orderData && orderData.items) {
        activityDescription += '\n\n📋 Позиции заказа:';
        orderData.items.forEach((item, idx) => {
          activityDescription += `\n${idx + 1}. ${item.name} — ${item.quantity} шт. × ${item.price} ₽ = ${item.quantity * item.price} ₽`;
        });
        activityDescription += `\n\n💰 Итого: ${orderData.total} ₽`;
      }
    }
    
    // Create timeline log for the company
    const response = await callVibeCode('POST', '/timeline-logs', {
      entityTypeId: 4, // COMPANY
      entityId: parseInt(companyId),
      title: subject,
      text: activityDescription
    });
    
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error creating activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Get products list
app.get('/api/products', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/products', { limit: 100 });
    res.json({ result: response.data.data });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Get current user
app.get('/api/me', async (req, res) => {
  try {
    const response = await callVibeCode('GET', '/users/me');
    res.json({ data: { currentUser: response.data.data } });
  } catch (error) {
    console.error('Error fetching me:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Mobile Trade App running on port ${PORT}`);
  console.log(`VibeCode API Key configured: ${VIBECODE_API_KEY ? 'YES' : 'NO'}`);
});
