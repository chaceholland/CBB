import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8073;
const FAVORITES_FILE = path.join(__dirname, 'data', 'favorites.json');
const WATCH_PRIORITY_FILE = path.join(__dirname, 'data', 'watch_priority.json');
const WATCH_HISTORY_FILE = path.join(__dirname, 'data', 'watch_history.json');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Ensure data files exist
function ensureDataFiles(){
  if(!fs.existsSync(FAVORITES_FILE)){
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify({pitchers: [], teams: [], games: []}, null, 2));
  }
  if(!fs.existsSync(WATCH_PRIORITY_FILE)){
    fs.writeFileSync(WATCH_PRIORITY_FILE, JSON.stringify({}, null, 2));
  }
  if(!fs.existsSync(WATCH_HISTORY_FILE)){
    fs.writeFileSync(WATCH_HISTORY_FILE, JSON.stringify([], null, 2));
  }
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // API: Get favorites
  if(req.method === 'GET' && req.url === '/api/favorites'){
    try {
      const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(data);
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // API: Save favorites
  if(req.method === 'POST' && req.url === '/api/favorites'){
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const favorites = JSON.parse(body);
        fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true}));
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // API: Get watch priority
  if(req.method === 'GET' && req.url === '/api/watch-priority'){
    try {
      const data = fs.readFileSync(WATCH_PRIORITY_FILE, 'utf8');
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(data);
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // API: Save watch priority
  if(req.method === 'POST' && req.url === '/api/watch-priority'){
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const priority = JSON.parse(body);
        fs.writeFileSync(WATCH_PRIORITY_FILE, JSON.stringify(priority, null, 2));
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true}));
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // API: Get watch history
  if(req.method === 'GET' && req.url === '/api/watch-history'){
    try {
      const data = fs.readFileSync(WATCH_HISTORY_FILE, 'utf8');
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(data);
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // API: Save watch history
  if(req.method === 'POST' && req.url === '/api/watch-history'){
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const history = JSON.parse(body);
        fs.writeFileSync(WATCH_HISTORY_FILE, JSON.stringify(history, null, 2));
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true}));
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // Serve static files
  // Strip query parameters from URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = '.' + url.pathname;
  if (filePath === './') {
    filePath = './schedule.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n⚾ College Baseball Pitcher Tracker Server`);
  console.log(`=============================`);
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Roster page: http://localhost:${PORT}/roster.html`);
  console.log(`Schedule page: http://localhost:${PORT}/schedule.html`);
  console.log(`Press Ctrl+C to stop\n`);
});
