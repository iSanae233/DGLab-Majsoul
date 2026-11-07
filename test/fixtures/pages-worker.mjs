import { onRequest } from '../../functions/index.js';
export default { fetch(request, env) { return onRequest({ request, env, next: () => new Response('static page') }); } };
