// ponytail: canned-JSON fetch mock for local dev; swap for a real backend when responses need to be realistic.

const ROUTES = [
  {
    pattern: /^\/api\/v1\/(1|2|3|login|register)(\/.*)?$/,
    handler: (m, path) => ({ status: 'ok', version: 'v1', resource: m[1], path }),
  },
  {
    pattern: /^\/api\/v2\/(login|register)(\/.*)?$/,
    handler: (m, path) => ({ status: 'ok', version: 'v2', resource: m[1], path }),
  },
  {
    pattern: /^\/api\/v2\/users\/([^/]+)\/(create|update|read|delete)\/?$/,
    handler: (m) => ({ status: 'ok', version: 'v2', userId: m[1], action: m[2] }),
  },
];

export function matchRoute(path) {
  for (const { pattern, handler } of ROUTES) {
    const m = path.match(pattern);
    if (m) return handler(m, path);
  }
  return null;
}

export function installFetchMock(target = globalThis) {
  const realFetch = target.fetch?.bind(target);

  target.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, target.location?.href ?? 'http://localhost/').pathname;
    const body = matchRoute(path);

    if (body) {
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (!realFetch) throw new Error(`No mock route for ${path} and no real fetch to fall back to`);
    return realFetch(input, init);
  };
}

if (typeof window !== 'undefined') installFetchMock(window);
