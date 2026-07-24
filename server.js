const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.VIBECODE_API_KEY;
const VIBECODE_API = 'https://vibecode.bitrix24.tech/v1';

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });

async function getCurrentUser() {
  const response = await fetch(VIBECODE_API + '/users/me', {
    headers: { 'X-Api-Key': API_KEY }
  });
  if (!response.ok) throw new Error('Failed to get user');
  const data = await response.json();
  return data.data;
}

app.get('/api/session', async (req, res) => {
  try {
    const user = await getCurrentUser();
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

app.get('/api/user-context', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const batchData = {
      halt: 0,
      cmd: {
        get_workgroups: `user.get?ID=${user.id}`,
        get_dept: `department.get?ID=${user.department_id || 0}`
      }
    };
    const response = await fetch(VIBECODE_API + '/batch', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData)
    });
    const data = await response.json();
    res.json({
      user,
      workgroups: data.result?.result?.get_workgroups || [],
      department: data.result?.result?.get_dept || {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/companies', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const response = await fetch(VIBECODE_API + '/companies?limit=100&select=id,title,phone,email,address', {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const response = await fetch(VIBECODE_API + `/tasks?limit=50&select=id,title,status,responsibleId&filter[responsibleId]=${user.id}&order[id]=DESC`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ result: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-tasks', async (req, res) => {
  try {
    const user = await getCurrentUser();
    const response = await fetch(VIBECODE_API + `/tasks?limit=50&select=id,title,status,responsibleId,deadline,groupId&filter[responsibleId]=${user.id}&order[id]=DESC`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ success: true, tasks: data.data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const response = await fetch(VIBECODE_API + '/tasks/' + req.params.id, {
      headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    res.json({ task: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const response = await fetch(VIBECODE_API + '/tasks/' + taskId, {
      method: 'PATCH',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '5' })
    });
    const data = await response.json();
    res.json({ success: true, result: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/comment', upload.array('files', 5), async (req, res) => {
  try {
    const taskId = req.params.id;
    const text = req.body.text || '';
    const uploadedFiles = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const base64Content = file.buffer.toString('base64');
        const uploadResponse = await fetch(VIBECODE_API + '/files/upload', {
          method: 'POST',
          headers: {
            'X-Api-Key': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.originalname,
            content: base64Content
          })
        });
        if (!uploadResponse.ok) throw new Error(`Failed to upload file: ${file.originalname}`);
        const uploadData = await uploadResponse.json();
        if (uploadData.data) {
          uploadedFiles.push(uploadData.data);
        }
      }
    }

    let message = text.trim();
    if (uploadedFiles.length > 0) {
      const fileLinks = uploadedFiles.map(file =>
        `[URL=${file.downloadUrl || file.url}]${file.name || file.filename}[/URL]`
      ).join('\n');
      message = message ? `${message}\n${fileLinks}` : fileLinks;
    }

    const response = await fetch(VIBECODE_API + '/tasks/' + taskId + '/comments', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message })
    });

    if (!response.ok) throw new Error('Bitrix error');
    const data = await response.json();
    res.json({ success: true, result: data.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
