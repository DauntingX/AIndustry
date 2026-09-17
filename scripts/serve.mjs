/**
 * 本地预览用的静态服务器。零依赖，只做三件事：
 * 把目录当根、目录自动找 index.html、找不到就回 404.html。
 *
 * 它**不是**部署方案——线上托管直接用 dist/ 这个纯静态目录树。
 * 存在的意义是让 `npm run serve` 能立刻看到构建结果，
 * 并且用 http:// 协议打开（file:// 下 fetch 搜索索引会被 CORS 拦掉）。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 3100);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

if (!fs.existsSync(root)) {
  console.error(`✗ 目录不存在：${root}\n  先跑一次 npm run build。`);
  process.exit(1);
}

/** 把 URL 解析成磁盘路径，并挡住 ../ 逃逸。 */
function resolve(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (rel.includes('\0')) return null;
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  let abs = resolve(req.url ?? '/');
  if (!abs) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('403');
    return;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) abs = path.join(abs, 'index.html');

  if (!fs.existsSync(abs)) {
    const fallback = path.join(root, '404.html');
    if (fs.existsSync(fallback)) {
      res.writeHead(404, { 'content-type': MIME['.html'] }).end(fs.readFileSync(fallback));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
    }
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  fs.createReadStream(abs).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`▌ 预览：http://127.0.0.1:${port}/   （根目录 ${root}）`);
});
