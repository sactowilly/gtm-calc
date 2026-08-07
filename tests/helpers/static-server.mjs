import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1]);
}

const root = resolve(argumentsByName.get('--root') || '.');
const port = Number(argumentsByName.get('--port') || 4174);
const basePath = `/${String(argumentsByName.get('--base') || 'gtm-calc').replace(/^\/+|\/+$/g, '')}/`;

const contentTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
});

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://127.0.0.1:${port}`);
  if (!url.pathname.startsWith(basePath)) return undefined;
  const relativePath = decodeURIComponent(url.pathname.slice(basePath.length)) || 'index.html';
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return resolve(candidate, 'index.html');
  return candidate;
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || '/');
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream'
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Serving ${root} at http://127.0.0.1:${port}${basePath}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
