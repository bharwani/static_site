import assert from 'node:assert/strict';
import { matchRoute } from './mock.js';

assert.deepEqual(matchRoute('/api/v1/1/anything'), { status: 'ok', version: 'v1', resource: '1', path: '/api/v1/1/anything' });
assert.deepEqual(matchRoute('/api/v1/login'), { status: 'ok', version: 'v1', resource: 'login', path: '/api/v1/login' });
assert.deepEqual(matchRoute('/api/v1/register/step2'), { status: 'ok', version: 'v1', resource: 'register', path: '/api/v1/register/step2' });

assert.deepEqual(matchRoute('/api/v2/login'), { status: 'ok', version: 'v2', resource: 'login', path: '/api/v2/login' });
assert.deepEqual(matchRoute('/api/v2/register'), { status: 'ok', version: 'v2', resource: 'register', path: '/api/v2/register' });

assert.deepEqual(matchRoute('/api/v2/users/42/create'), { status: 'ok', version: 'v2', userId: '42', action: 'create' });
assert.deepEqual(matchRoute('/api/v2/users/abc-123/delete'), { status: 'ok', version: 'v2', userId: 'abc-123', action: 'delete' });

assert.equal(matchRoute('/api/v3/unknown'), null);
assert.equal(matchRoute('/not-api'), null);

console.log('mock.js routing: all assertions passed');
