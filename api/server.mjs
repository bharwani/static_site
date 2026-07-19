// Serves the static site + canned JSON for the /api routes (stdlib only).
// Run standalone with `node api/server.mjs` then open http://localhost:8935/,
// or import createMockServer() to spin one up programmatically (see test-endpoints.mjs).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const DATA_DIR = dirname(fileURLToPath(import.meta.url)); // /api response files (api/v1, api/v2)
const ROOT = dirname(DATA_DIR);                           // project root (index.html, css, js, images)

const CONTENT_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Map an /api request path to a data-file key. Trailing path segments and the userId
// are ignored — the response is the static object in api/<key>.
export function resolveKey(path) {
  let m;
  if ((m = path.match(/^\/api\/v1\/(1|2|3|login|register)(\/.*)?$/))) return `v1/${m[1]}`;
  if ((m = path.match(/^\/api\/v2\/(login|register)(\/.*)?$/))) return `v2/${m[1]}`;
  if ((m = path.match(/^\/api\/v2\/users\/[^/]+\/(create|update|read|delete)\/?$/))) return `v2/users/${m[1]}`;
  return null;
}

export async function readData(key) {
  return JSON.parse(await readFile(join(DATA_DIR, key), 'utf8'));
}

export function createMockServer() {
  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;

    // /api routes -> canned JSON
    if (path.startsWith('/api/')) {
      const key = resolveKey(path);
      if (key) {
        try {
          const body = await readFile(join(DATA_DIR, key), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(body);
          return;
        } catch { /* missing data file — fall through to 404 */ }
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not found', path }));
      return;
    }

    // everything else -> static file from the project root
    const rel = path === '/' ? '/index.html' : path;
    const file = normalize(join(ROOT, rel));
    if (file.startsWith(ROOT)) { // ponytail: guards against ../ traversal
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
        return;
      } catch { /* no such file — fall through to 404 */ }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8935;
  createMockServer().listen(port, () => {
    console.log(`Mock API server listening on http://localhost:${port}`);
  });
}
