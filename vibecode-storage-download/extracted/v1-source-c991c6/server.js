const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// In-memory storage
let visits = [];
let orders = [];

// Parse request body
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      callback({});
    }
  });
}

// Send JSON response
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Handle API routes
function handleAPI(req, res, pathname) {
  // GET /api/visits
  if (pathname === '/api/visits' && req.method === 'GET') {
    sendJSON(res, visits);
    return true;
  }
  
  // POST /api/visits
  if (pathname === '/api/visits' && req.method === 'POST') {
    parseBody(req, (body) => {
      const visit = {
        id: Date.now().toString(),
        companyName: body.companyName,
        contactPerson: body.contactPerson,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        photos: [],
        notes: body.notes || '',
        status: 'active',
        orderId: null
      };
      visits.push(visit);
      sendJSON(res, visit, 201);
    });
    return true;
  }
  
  // PATCH /api/visits/:id
  if (pathname.startsWith('/api/visits/') && req.method === 'PATCH') {
    const id = pathname.split('/')[3];
    const visit = visits.find(v => v.id === id);
    if (!visit) {
      sendJSON(res, { error: 'Visit not found' }, 404);
      return true;
    }
    
    parseBody(req, (body) => {
      if (body.checkOutTime) {
        visit.checkOutTime = body.checkOutTime;
        visit.status = 'completed';
      }
      if (body.notes !== undefined) visit.notes = body.notes;
      if (body.orderId !== undefined) visit.orderId = body.orderId;
      sendJSON(res, visit);
    });
    return true;
  }
  
  // POST /api/visits/:id/photos
  if (pathname.startsWith('/api/visits/') && pathname.endsWith('/photos') && req.method === 'POST') {
    const id = pathname.split('/')[3];
    const visit = visits.find(v => v.id === id);
    if (!visit) {
      sendJSON(res, { error: 'Visit not found' }, 404);
      return true;
    }
    
    // For simplicity, return success (in production, handle multipart upload)
    sendJSON(res, { success: true, photo: { url: '/uploads/placeholder.jpg' } });
    return true;
  }
  
  // POST /api/orders
  if (pathname === '/api/orders' && req.method === 'POST') {
    parseBody(req, (body) => {
      const order = {
        id: Date.now().toString(),
        visitId: body.visitId,
        items: body.items || [],
        totalAmount: body.totalAmount || 0,
        createdAt: new Date().toISOString(),
        status: 'draft'
      };
      orders.push(order);
      sendJSON(res, order, 201);
    });
    return true;
  }
  
  // GET /api/orders/:id
  if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    const order = orders.find(o => o.id === id);
    if (!order) {
      sendJSON(res, { error: 'Order not found' }, 404);
      return true;
    }
    sendJSON(res, order);
    return true;
  }
  
  // PATCH /api/orders/:id
  if (pathname.startsWith('/api/orders/') && req.method === 'PATCH') {
    const id = pathname.split('/')[3];
    const order = orders.find(o => o.id === id);
    if (!order) {
      sendJSON(res, { error: 'Order not found' }, 404);
      return true;
    }
    
    parseBody(req, (body) => {
      if (body.items) order.items = body.items;
      if (body.totalAmount !== undefined) order.totalAmount = body.totalAmount;
      if (body.status) order.status = body.status;
      sendJSON(res, order);
    });
    return true;
  }
  
  // POST /api/bitrix/tasks
  if (pathname === '/api/bitrix/tasks' && req.method === 'POST') {
    parseBody(req, (body) => {
      const task = {
        id: Date.now().toString(),
        title: body.title,
        description: body.description,
        responsibleId: body.responsibleId,
        createdAt: new Date().toISOString(),
        status: 'new'
      };
      
      // TODO: Integrate with actual Bitrix24 API
      sendJSON(res, {
        success: true,
        message: 'Task created successfully',
        task: task
      }, 201);
    });
    return true;
  }
  
  return false;
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.pathname || req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // Handle API routes
  if (pathname.startsWith('/api/')) {
    if (handleAPI(req, res, pathname)) return;
  }
  
  // Serve static files
  if (pathname === '/') pathname = '/index.html';
  
  const filePath = path.join(__dirname, 'public', pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Мобильная торговля сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});
