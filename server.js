const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_TOKEN = '4d90545d3421dcb3c63a4361f931cbf18c3d0747951590c1df2d2e65b260986f';
const API_BASE = 'https://api.bluenext2.online/api/v1/consult/';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API proxy endpoint
  if (req.url.startsWith('/api/cpf/')) {
    const cpf = req.url.replace('/api/cpf/', '').replace(/[.\-]/g, '');
    
    const options = {
      hostname: 'api.bluenext2.online',
      path: `/api/v1/consult/${cpf}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    apiReq.on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro ao consultar API' }));
    });

    apiReq.end();
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query strings
  filePath = filePath.split('?')[0];
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Verificar se o arquivo existe
  fs.stat(filePath, (err, stat) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    // Para arquivos de áudio/vídeo: suportar Range requests (essencial para mobile)
    if (ext === '.mp3' || ext === '.mp4' || ext === '.wav' || ext === '.ogg') {
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');

      if (range) {
        // Range request parcial
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        });
        stream.pipe(res);
      } else {
        // Request completo mas com Content-Length para que o browser saiba o tamanho
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    // Outros arquivos estáticos
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        if (ext !== '.html') {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        res.setHeader('Content-Length', content.length);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
