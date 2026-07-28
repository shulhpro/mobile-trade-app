const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Vibe-Authorization, X-Vibe-Portal-Id, X-User-Id, X-Api-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());

// Multer для загрузки файлов
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

// Хранилище токенов (в памяти)
const tokenStore = new Map();

// Получение данных авторизации
function getAuthHeaders(req) {
  const authHeader = req.headers['x-vibe-authorization'] || req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  const portalId = req.headers['x-vibe-portal-id'];
  const userId = req.headers['x-vibe-user-id'];
  const userIdFromHeader = req.headers['x-user-id'];
  
  console.log('=== HEADERS DEBUG ===');
  console.log('x-vibe-authorization:', req.headers['x-vibe-authorization'] ? 'PRESENT' : 'MISSING');
  console.log('authorization:', req.headers['authorization'] ? 'PRESENT' : 'MISSING');
  console.log('x-api-key:', req.headers['x-api-key'] ? 'PRESENT' : 'MISSING');
  console.log('x-vibe-user-id:', userId || 'MISSING');
  console.log('x-user-id:', userIdFromHeader || 'MISSING');
  console.log('=====================');
  
  return {
    authHeader,
    apiKey,
    portalId,
    userId: userId || userIdFromHeader,
    userIdFromHeader
  };
}

// Middleware для извлечения токена
app.use('/api', (req, res, next) => {
  const { authHeader, userId } = getAuthHeaders(req);
  
  if (authHeader && userId) {
    tokenStore.set(userId, authHeader);
    console.log('Token stored for user:', userId);
  }
  
  next();
});

// Прокси для запросов к Bitrix24 REST API
async function callBitrix24(req, method, params = {}) {
  const { authHeader, userId, userIdFromHeader } = getAuthHeaders(req);
  
  // Пробуем получить токен из заголовка или из хранилища
  let token = authHeader;
  
  if (!token && userId) {
    token = tokenStore.get(userId);
  }
  
  if (!token && userIdFromHeader) {
    token = tokenStore.get(userIdFromHeader);
  }
  
  if (!token) {
    throw new Error('Authorization header missing');
  }

  // Получаем portal из /v1/me
  const meResponse = await axios.get('https://vibecode.bitrix24.tech/v1/me', {
    headers: { 'Authorization': token }
  });
  
  const portal = meResponse.data.data.portal;
  const cleanToken = token.replace('Bearer ', '');
  
  const url = `https://${portal}/rest/${method}`;
  
  const response = await axios.post(url, params, {
    headers: {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

// API: Получить список компаний
app.get('/api/companies', async (req, res) => {
  try {
    const data = await callBitrix24(req, 'crm.company.list', {
      select: ['ID', 'TITLE', 'ADDRESS', 'PHONE', 'EMAIL'],
      order: { TITLE: 'ASC' }
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching companies:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Получить детали компании
app.get('/api/companies/:id', async (req, res) => {
  try {
    const data = await callBitrix24(req, 'crm.company.get', {
      id: req.params.id
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching company:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Создать дело (активность) для компании
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
    
    const data = await callBitrix24(req, 'crm.activity.add', {
      fields: {
        OWNER_TYPE_ID: 4,
        OWNER_ID: companyId,
        TYPE_ID: 2,
        PROVIDER_TYPE_ID: 'VISIT',
        SUBJECT: subject,
        DESCRIPTION: activityDescription,
        COMPLETED: 'Y',
        RESPONSIBLE_ID: '$result[RESPONSIBLE_ID]'
      }
    });
    
    res.json(data);
  } catch (error) {
    console.error('Error creating activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Загрузить фото и создать дело
app.post('/api/activities/with-photo', upload.array('photos', 10), async (req, res) => {
  try {
    const { companyId, description } = req.body;
    const files = req.files;
    
    let activityDescription = `📸 Фотоотчет\n\n${description || ''}\n\n📎 Прикрепленные фотографии:`;
    
    const { authHeader, userId } = getAuthHeaders(req);
    let token = authHeader || tokenStore.get(userId);
    
    const meResponse = await axios.get('https://vibecode.bitrix24.tech/v1/me', {
      headers: { 'Authorization': token }
    });
    const portal = meResponse.data.data.portal;
    const cleanToken = token.replace('Bearer ', '');
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      const uploadResponse = await axios.post(
        `https://${portal}/rest/disk.folder.uploadfile`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${cleanToken}`
          }
        }
      );
      
      if (uploadResponse.data.result) {
        activityDescription += `\n- ${uploadResponse.data.result.NAME}`;
      }
      
      fs.unlinkSync(file.path);
    }
    
    const data = await callBitrix24(req, 'crm.activity.add', {
      fields: {
        OWNER_TYPE_ID: 4,
        OWNER_ID: companyId,
        TYPE_ID: 2,
        PROVIDER_TYPE_ID: 'VISIT',
        SUBJECT: 'Фотоотчет по торговой точке',
        DESCRIPTION: activityDescription,
        COMPLETED: 'Y'
      }
    });
    
    res.json(data);
  } catch (error) {
    console.error('Error creating photo activity:', error.message);
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// API: Получить список товаров для заказа
app.get('/api/products', async (req, res) => {
  try {
    const data = await callBitrix24(req, 'crm.product.list', {
      select: ['ID', 'NAME', 'PRICE', 'CURRENCY_ID'],
      order: { NAME: 'ASC' }
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API: Получить текущего пользователя
app.get('/api/me', async (req, res) => {
  try {
    const { authHeader, userId } = getAuthHeaders(req);
    let token = authHeader || tokenStore.get(userId);
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const response = await axios.get('https://vibecode.bitrix24.tech/v1/me', {
      headers: { 'Authorization': token }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching me:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Отладочный endpoint - показывает ВСЕ заголовки запроса
app.get('/api/debug/headers', (req, res) => {
  const { authHeader, portalId, userId, userIdFromHeader } = getAuthHeaders(req);
  res.json({
    hasAuth: !!authHeader,
    hasUserId: !!userId,
    userId: userId || null,
    authHeaderPrefix: authHeader ? authHeader.substring(0, 30) + '...' : null,
    allHeaders: req.headers,
    tokenStoreSize: tokenStore.size,
    tokenStoreKeys: Array.from(tokenStore.keys())
  });
});

// Главная страница - встраиваем userId и токен в HTML
app.get('/', async (req, res) => {
  try {
    const { authHeader, userId } = getAuthHeaders(req);
    
    // Сохраняем токен
    if (authHeader && userId) {
      tokenStore.set(userId, authHeader);
      console.log('Token stored for user on page load:', userId);
    }
    
    // Читаем HTML файл
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Встраиваем конфигурацию с userId и токеном для использования в AJAX
    const safeToken = authHeader ? authHeader.replace(/'/g, "\\'") : '';
    const configScript = `
      <script>
        window.APP_CONFIG = {
          userId: '${userId || ''}',
          token: '${safeToken}'
        };
      </script>
    `;
    
    // Вставляем перед закрывающим </head>
    html = html.replace('</head>', configScript + '</head>');
    
    res.send(html);
  } catch (error) {
    console.error('Error serving index:', error);
    res.status(500).send('Error loading application');
  }
});

// Static files (после всех маршрутов)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Mobile Trade App running on port ${PORT}`);
});
