const express = require('express');
const axios = require('axios');
const multer = require('multer');
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
async function callVibeCode(method, endpoint, data = null, isFormData = false) {
  const url = `${VIBECODE_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${VIBECODE_API_KEY}`
  };
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
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

// API: Create activity (visit with all data)
app.post('/api/activities', upload.array('photos', 10), async (req, res) => {
  try {
    const { companyId, type, subject, description, location, orderData, noteText } = req.body;
    const files = req.files || [];
    
    // Build comprehensive description
    let activityDescription = '';
    
    // Visit section
    if (type === 'visit' || location) {
      activityDescription += `📍 ОТМЕТКА ПОСЕЩЕНИЯ\n`;
      activityDescription += `${description || ''}\n`;
      if (location) {
        activityDescription += `\n📍 Координаты: ${location.latitude}, ${location.longitude}\n`;
      }
      activityDescription += `\n---\n\n`;
    }
    
    // Photo section
    if (type === 'photo' || files.length > 0) {
      activityDescription += `📸 ФОТООТЧЕТ\n`;
      activityDescription += `${description || ''}\n`;
      activityDescription += `\n---\n\n`;
    }
    
    // Note section
    if (type === 'note' || noteText) {
      activityDescription += `📝 ЗАМЕТКА\n`;
      activityDescription += `${noteText || description || ''}\n`;
      activityDescription += `\n---\n\n`;
    }
    
    // Order section
    if (type === 'order' || orderData) {
      activityDescription += `📦 ЗАКАЗ\n`;
      activityDescription += `${description || ''}\n`;
      if (orderData) {
        const orderItems = JSON.parse(orderData);
        if (orderItems.items && orderItems.items.length > 0) {
          activityDescription += '\n📋 Позиции заказа:\n';
          orderItems.items.forEach((item, idx) => {
            activityDescription += `${idx + 1}. ${item.name} — ${item.quantity} шт. × ${item.price} ₽ = ${item.quantity * item.price} ₽\n`;
          });
          activityDescription += `\n💰 Итого: ${orderItems.total} ₽\n`;
        }
      }
      activityDescription += `\n---\n\n`;
    }
    
    // Upload photos to disk
    const uploadedFiles = [];
    for (const file of files) {
      try {
        const fileData = fs.readFileSync(file.path);
        const base64Content = fileData.toString('base64');
        
        const uploadResponse = await callVibeCode('POST', '/files/upload', {
          folderId: 19, // Common disk folder
          filename: file.originalname,
          content: base64Content
        });
        
        uploadedFiles.push({
          name: file.originalname,
          id: uploadResponse.data.data?.id,
          url: uploadResponse.data.data?.url
        });
        
        // Clean up temp file
        fs.unlinkSync(file.path);
      } catch (uploadError) {
        console.error('Error uploading file:', uploadError.message);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    
    // Add file links to description
    if (uploadedFiles.length > 0) {
      activityDescription += `\n📎 Прикрепленные файлы:\n`;
      uploadedFiles.forEach((file, idx) => {
        activityDescription += `${idx + 1}. ${file.name}\n`;
      });
    }
    
    // Create activity with COMPLETED status
    const activityData = {
      ownerTypeId: 4, // COMPANY
      ownerId: parseInt(companyId),
      typeId: 2, // Meeting
      subject: subject || 'Визит торгового представителя',
      description: activityDescription,
      completed: 'Y', // MARK AS COMPLETED
      responsibleId: 10, // Current user
      communications: [{
        type: 'PHONE',
        value: '0'
      }]
    };
    
    const response = await callVibeCode('POST', '/activities', activityData);
    
    res.json({ 
      result: response.data.data,
      uploadedFiles: uploadedFiles.length
    });
  } catch (error) {
    console.error('Error creating activity:', error.message);
    // Clean up temp files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
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
