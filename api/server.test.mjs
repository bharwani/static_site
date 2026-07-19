import assert from 'node:assert/strict';
import { resolveKey, readData } from './server.mjs';

// path -> data-file key (trailing segments and userId collapse away)
assert.equal(resolveKey('/api/v1/1/anything'), 'v1/1');
assert.equal(resolveKey('/api/v1/login'), 'v1/login');
assert.equal(resolveKey('/api/v1/register/step2'), 'v1/register');
assert.equal(resolveKey('/api/v2/login'), 'v2/login');
assert.equal(resolveKey('/api/v2/register'), 'v2/register');
assert.equal(resolveKey('/api/v2/users/42/create'), 'v2/users/create');
assert.equal(resolveKey('/api/v2/users/abc-123/delete'), 'v2/users/delete');

assert.equal(resolveKey('/api/v3/unknown'), null);
assert.equal(resolveKey('/not-api'), null);

// every resolvable route has a loadable data file
for (const key of [
  'v1/1', 'v1/2', 'v1/3', 'v1/login', 'v1/register',
  'v2/login', 'v2/register',
  'v2/users/create', 'v2/users/update', 'v2/users/read', 'v2/users/delete',
]) {
  const body = await readData(key);
  assert.equal(body.status, 'ok');
}

console.log('server.mjs routing + data files: all assertions passed');
