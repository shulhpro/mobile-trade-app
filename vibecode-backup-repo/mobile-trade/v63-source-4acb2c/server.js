const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const APP_KEY = process.env.VIBECODE_APP_KEY;
const API_KEY = process.env.VIBECODE_API_KEY;
const API_BASE = 'https://vibecode.bitrix24.tech/v1';

if (!APP_KEY && !API_KEY) {
  console.error('Neither VIBECODE_APP_KEY nor VIBECODE_API_KEY is set');
  process.exit(1);
}

app.use(express.json());
app.use(express.static('public'));

app.use(function(req, res, next) {
  req.cookies = {};
  var cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    var parts = cookieHeader.split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      var eq = part.indexOf('=');
      if (eq !== -1) {
        var key = part.substring(0, eq).trim();
        var value = part.substring(eq + 1).trim();
        req.cookies[key] = value;
      }
    }
  }
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

function getUserToken(req) {
  var token = req.headers['x-vibe-authorization'];
  if (token && token.indexOf('Bearer ') === 0) {
    token = token.substring(7);
  }
  if (!token) {
    token = req.headers.authorization;
    if (token && token.indexOf('Bearer ') === 0) {
      token = token.substring(7);
    }
  }
  if (!token) {
    token = req.cookies.vibe_session;
  }
  return token;
}

function getApiHeaders(req) {
  var token = getUserToken(req);
  if (token) {
    return {
      'X-Api-Key': APP_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  }
  return {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
  };
}

async function apiRequest(req, endpoint, options) {
  var url = API_BASE + endpoint;
  var opts = options || {};
  opts.headers = Object.assign({}, getApiHeaders(req), opts.headers || {});
  var response = await fetch(url, opts);
  return response;
}

async function getCurrentUser(req) {
  var token = getUserToken(req);
  if (token) {
    var response = await apiRequest(req, '/me');
    var data = await response.json();
    return data;
  }
  var response = await apiRequest(req, '/users/me');
  var data = await response.json();
  return data;
}

function requireAuth(req, res, next) {
  var token = getUserToken(req);
  if (token) {
    getCurrentUser(req).then(function(user) {
      req.user = user;
      next();
    }).catch(function(err) {
      res.status(401).json({ error: 'Invalid token' });
    });
  } else if (API_KEY) {
    getCurrentUser(req).then(function(user) {
      req.user = user;
      next();
    }).catch(function(err) {
      req.user = null;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

async function getUserDiskFolderId(req) {
  var user = await getCurrentUser(req);
  var folderName = 'User_' + user.id;
  try {
    var response = await apiRequest(req, '/disk.folder.getchildren?filter[NAME]=' + encodeURIComponent(folderName));
    var result = await response.json();
    if (result && result.length > 0) {
      return result[0].ID;
    }
  } catch (e) {
    // ignore
  }
  var createResponse = await apiRequest(req, '/disk.folder.addfolder?NAME=' + encodeURIComponent(folderName));
  var createResult = await createResponse.json();
  return createResult.ID;
}

async function uploadFileToDisk(req, file) {
  var folderId = await getUserDiskFolderId(req);
  var boundary = '----FormBoundary' + Date.now();
  var header = '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="file"; filename="' + file.originalname + '"\r\n' +
    'Content-Type: application/octet-stream\r\n\r\n';
  var footer = '\r\n--' + boundary + '--\r\n';
  var body = Buffer.concat([
    Buffer.from(header),
    file.buffer,
    Buffer.from(footer)
  ]);
  var response = await apiRequest(req, '/disk.folder.uploadfile?ID=' + folderId, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    },
    body: body
  });
  if (!response.ok) {
    var error = new Error('Upload failed: ' + response.status);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function attachFilesToTask(req, taskId, fileIds) {
  for (var i = 0; i < fileIds.length; i++) {
    await apiRequest(req, '/tasks.task.update?taskId=' + taskId + '&fields[UF_TASK_WEBDAV_FILES][]=' + fileIds[i]);
  }
}

app.get('/health', function(req, res) {
  res.json({ status: 'ok' });
});

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/api/auth/status', function(req, res) {
  var token = getUserToken(req);
  res.json({ authenticated: !!token });
});

app.get('/api/auth/login', function(req, res) {
  var redirectUri = req.query.redirect_uri || 'http://localhost:' + PORT + '/api/auth/callback';
  var stateObj = { redirect_uri: redirectUri };
  var state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  var authUrl = 'https://vibecode.bitrix24.tech/v1/oauth/authorize?app_key=' + APP_KEY + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=' + state;
  res.redirect(authUrl);
});

app.get('/api/auth/callback', async function(req, res) {
  try {
    var code = req.query.code;
    var stateStr = req.query.state;
    if (!code || !stateStr) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    var state = JSON.parse(Buffer.from(stateStr, 'base64').toString());
    var redirectUri = state.redirect_uri;
    var tokenUrl = 'https://vibecode.bitrix24.tech/v1/oauth/token';
    var response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key: APP_KEY,
        code: code,
        redirect_uri: redirectUri
      })
    });
    if (!response.ok) {
      return res.status(400).json({ error: 'Token exchange failed' });
    }
    var data = await response.json();
    res.setHeader('Set-Cookie', 'vibe_session=' + data.access_token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400');
    res.redirect(state.redirect_uri || '/');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/logout', function(req, res) {
  res.setHeader('Set-Cookie', 'vibe_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/session', requireAuth, function(req, res) {
  res.json({ user: req.user });
});

app.get('/api/user-context', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/me');
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/companies', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/companies');
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/sections', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/sections');
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/products', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/products');
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/tasks', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/tasks');
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/my-tasks', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/tasks?filter[RESPONSIBLE_ID]=' + req.user.id);
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/tasks/' + req.params.id);
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/complete', requireAuth, async function(req, res) {
  try {
    var response = await apiRequest(req, '/tasks/' + req.params.id + '/complete', {
      method: 'POST'
    });
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/comment', requireAuth, upload.array('files', 5), async function(req, res) {
  try {
    var taskId = req.params.id;
    var commentResponse = await apiRequest(req, '/tasks.task.addcomment?taskId=' + taskId, {
      method: 'POST',
      body: JSON.stringify({ POST_MESSAGE: req.body.message })
    });
    var commentResult = await commentResponse.json();
    if (req.files && req.files.length > 0) {
      var fileIds = [];
      for (var i = 0; i < req.files.length; i++) {
        var uploadResult = await uploadFileToDisk(req, req.files[i]);
        fileIds.push(uploadResult.ID || uploadResult.result.ID);
      }
      await attachFilesToTask(req, taskId, fileIds);
    }
    res.json(commentResult);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/visit', requireAuth, upload.array('photos', 10), async function(req, res) {
  try {
    var response = await apiRequest(req, '/tasks', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    var result = await response.json();
    var fileData = [];
    if (req.files && req.files.length > 0) {
      for (var i = 0; i < req.files.length; i++) {
        var uploadResult = await uploadFileToDisk(req, req.files[i]);
        fileData.push(uploadResult);
      }
    }
    res.json({ visit: result, files: fileData });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
