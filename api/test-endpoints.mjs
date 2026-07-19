// Hits every mocked endpoint over real HTTP, via `node api/test-endpoints.mjs`.
// By default spins up its own instance of api/server.mjs on an ephemeral port and tears it down after.
// Point at an already-running server instead with: node api/test-endpoints.mjs --base-url=http://localhost:8935
// Volume test: node api/test-endpoints.mjs --requests=50  (or REQUESTS_PER_ENDPOINT=50 env var)
import { parseArgs } from 'node:util';
import { createMockServer, resolveKey, readData } from './server.mjs';

const { values } = parseArgs({
  options: {
    requests: { type: 'string', short: 'n' },
    'base-url': { type: 'string' },
  },
  strict: false,
});

const REQUESTS_PER_ENDPOINT = Number(values.requests) || Number(process.env.REQUESTS_PER_ENDPOINT) || 1;

let server;
let baseUrl = values['base-url'];

if (!baseUrl) {
  server = createMockServer();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
  console.log(`Started mock server at ${baseUrl}`);
}

const rand = () => Math.floor(Math.random() * 1_000_000);

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/1/items' },
  { method: 'GET', path: '/api/v1/2/items' },
  { method: 'GET', path: '/api/v1/3/items' },
  { method: 'POST', path: '/api/v1/login' },
  { method: 'POST', path: '/api/v1/register' },
  { method: 'POST', path: '/api/v2/login' },
  { method: 'POST', path: '/api/v2/register' },
  { method: 'POST', path: '/api/v2/users/user-42/create' },
  { method: 'PUT', path: '/api/v2/users/user-42/update' },
  { method: 'GET', path: '/api/v2/users/user-42/read' },
  { method: 'DELETE', path: '/api/v2/users/user-42/delete' },
];

let failures = 0;
let total = 0;

for (const { method, path } of ENDPOINTS) {
  for (let i = 0; i < REQUESTS_PER_ENDPOINT; i++) {
    total++;
    const url = `${baseUrl}${path}?r=${rand()}`;
    const res = await fetch(url, { method });
    const expected = await readData(resolveKey(path));
    const body = await res.json();

    const ok = res.status === 200 && JSON.stringify(body) === JSON.stringify(expected);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${url} -> ${res.status} ${JSON.stringify(body)}`);
    if (!ok) failures++;
  }
}

if (server) server.close();

if (failures > 0) {
  console.error(`\n${failures}/${total} request(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${total} requests passed (${ENDPOINTS.length} endpoints x ${REQUESTS_PER_ENDPOINT})`);
