/* Servidor de teste igual ao GitHub Pages: entrega os arquivos e, para endereços que não existem, a página 404.html (que é o app). */
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(process.argv[2]), port = +process.argv[3];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(root, p);
  if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f)) {
    const parts = p.split('/').filter(Boolean);
    const nf = parts.length ? path.join(root, parts[0], '404.html') : path.join(root, '404.html');
    if (fs.existsSync(nf)) { res.writeHead(404, { 'content-type': types['.html'] }); fs.createReadStream(nf).pipe(res); return; }
    res.writeHead(404); res.end('não encontrado'); return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('servidor de teste em ' + port));
