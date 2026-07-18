// Hits every mocked endpoint through fetch() with a random query param, via `node api/test-endpoints.mjs`.
// Volume test: node api/test-endpoints.mjs --requests=50  (or REQUESTS_PER_ENDPOINT=50 env var)
import { parseArgs } from 'node:util';
import { installFetchMock, matchRoute } from './mock.js';

installFetchMock(globalThis);

const { values } = parseArgs({
  options: { requests: { type: 'string', short: 'n' } },
  strict: false,
});

const REQUESTS_PER_ENDPOINT = Number(values.requests) || Number(process.env.REQUESTS_PER_ENDPOINT) || 1;

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
    const url = `${path}?r=${rand()}`;
    const res = await fetch(url, { method });
    const expected = matchRoute(path);
    const body = await res.json();

    const ok = res.status === 200 && JSON.stringify(body) === JSON.stringify(expected);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${url} -> ${res.status} ${JSON.stringify(body)}`);
    if (!ok) failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${total} request(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${total} requests passed (${ENDPOINTS.length} endpoints x ${REQUESTS_PER_ENDPOINT})`);
