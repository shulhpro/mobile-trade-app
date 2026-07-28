const fs = require('fs');
const https = require('https');

const API_KEY = process.env.VIBE_API_KEY || 'vibe_api_vj1RYuHny8D3zXq9LmP2wK5bN4cV7fT6gH1jE0iO9pA4rS6tU3yW8xQ2lM5nB7kC0dF3hG6jI9oL2pR5sU8vY1wZ4aB7cD0eF2gH5iJ8kL1mN4oP7qR0tU3vX6yZ9aC2dE5fG8hJ1kL4m';
const SERVER_ID = '5aa1d425-1ecf-403e-8d2c-0e900e0ed08f';
const BASE_URL = 'vibecode.bitrix24.tech';

// Read and encode archive
const archivePath = 'C:/bitrix/deploy.tar.gz';
const archiveData = fs.readFileSync(archivePath);
const base64Content = archiveData.toString('base64');

console.log('Archive size:', archiveData.length, 'bytes');
console.log('Base64 length:', base64Content.length, 'chars');

// Deploy payload
const payload = {
  source: {
    content: base64Content,
    filename: 'deploy.tar.gz'
  },
  runtime: 'node20',
  install: 'cd /opt/app && npm install',
  start: 'cd /opt/app && npm start',
  port: 3000,
  env: {
    NODE_ENV: 'production'
  }
};

const postData = JSON.stringify(payload);

const options = {
  hostname: BASE_URL,
  port: 443,
  path: `/v1/infra/servers/${SERVER_ID}/deploy?stream=false`,
  method: 'POST',
  headers: {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json',
    'X-Skip-Source-Snapshot': 'deploy from code agent',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Starting deployment...');
console.log('Server:', SERVER_ID);
console.log('URL:', `https://${BASE_URL}/v1/infra/servers/${SERVER_ID}/deploy`);

const req = https.request(options, (res) => {
  let data = '';
  
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (json.data && json.data.appUrl) {
        console.log('\n✅ Deployment successful!');
        console.log('App URL:', json.data.appUrl);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
