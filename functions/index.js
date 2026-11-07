import { routeRelay } from '../relay/router.mjs';

export async function onRequest(context) {
  if (context.request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return routeRelay(context.request, context.env);
  return context.next();
}
