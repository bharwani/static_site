import { matchRoute } from '../api/mock.js';

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

const btn = document.getElementById('runApiTestsBtn');
const countdownEl = document.getElementById('apiTestCountdown');
const outputEl = document.getElementById('apiTestOutput');

function notify(message) {
  if (!('Notification' in window)) {
    alert(message);
    return;
  }
  if (Notification.permission === 'granted') {
    new Notification(message);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(message);
      else alert(message);
    });
  } else {
    alert(message);
  }
}

btn.addEventListener('click', async () => {
  const input = prompt('How many requests per endpoint?', '1');
  if (input === null) return;

  const count = Math.max(1, parseInt(input, 10) || 1);
  const total = ENDPOINTS.length * count;
  let remaining = total;
  let passed = 0;

  btn.disabled = true;
  outputEl.replaceChildren();
  countdownEl.textContent = `Running ${total} requests... ${remaining} remaining`;

  for (const { method, path } of ENDPOINTS) {
    for (let i = 0; i < count; i++) {
      const url = `${path}?r=${Math.floor(Math.random() * 1_000_000)}`;
      const res = await fetch(url, { method });
      const body = await res.json();
      const expected = matchRoute(path);
      const ok = res.status === 200 && JSON.stringify(body) === JSON.stringify(expected);

      if (ok) passed++;
      remaining--;
      countdownEl.textContent = `Running... ${remaining} of ${total} remaining`;

      const row = document.createElement('div');
      row.className = `api-test-row ${ok ? 'pass' : 'fail'}`;
      row.textContent = `${ok ? 'PASS' : 'FAIL'} ${method} ${url}`;
      outputEl.appendChild(row);
    }
  }

  countdownEl.textContent = `Done: ${passed}/${total} passed`;
  btn.disabled = false;
  notify(`API tests complete: ${passed}/${total} passed`);
});
