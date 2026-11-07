const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function routeRelay(request, env) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket upgrade required', { status: 426 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  if (url.pathname !== '/' || [...url.searchParams.keys()].some(key => key !== 'tid') || url.searchParams.getAll('tid').length > 1) return new Response('Invalid relay URL', { status: 400 });
  const target = url.searchParams.get('tid');
  if (target !== null && !UUID.test(target)) return new Response('Invalid pairing ID', { status: 400 });
  if (target === null && request.headers.get('Origin') !== env.DASHBOARD_ORIGIN) return new Response('Controller origin is not allowed', { status: 403 });
  if (!env.RELAY_SESSIONS) return new Response('Relay service unavailable', { status: 503 });
  const session = target || crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-relay-role', target ? 'app' : 'controller');
  headers.set('x-relay-session', session);
  const object = env.RELAY_SESSIONS.get(env.RELAY_SESSIONS.idFromName(session));
  return object.fetch(new Request(request.url, { method: 'GET', headers }));
}
