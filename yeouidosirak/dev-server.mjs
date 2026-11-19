// 로컬 실행용: 정적 파일 + /api/places (Vercel 함수 대체)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import handler from './api/places.js';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/places') {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
    req.query = Object.fromEntries(url.searchParams);
    return handler(req, res);
  }
  const f = url.pathname === '/' ? '/index.html' : url.pathname;
  try { const b = await readFile(join(process.cwd(), f)); res.setHeader('Content-Type', types[extname(f)] || 'application/octet-stream'); res.end(b); }
  catch { res.statusCode = 404; res.end('not found'); }
}).listen(3000, () => console.log('http://localhost:3000'));
