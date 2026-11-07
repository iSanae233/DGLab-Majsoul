import { DurableObject } from 'cloudflare:workers';
import { routeRelay } from './router.mjs';

const MAX_BYTES = 65536;
const IDLE_MS = 5 * 60 * 1000;
const send = (socket, data) => { if (socket?.readyState === 1) socket.send(JSON.stringify(data)); };

export class RelaySession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
  }
  peers(role) { return this.ctx.getWebSockets().filter(socket => socket.readyState === 1 && socket.deserializeAttachment()?.role === role); }
  async fetch(request) {
    const role = request.headers.get('x-relay-role');
    if (!['controller', 'app'].includes(role)) return new Response('Invalid role', { status: 400 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    const id = role === 'controller' ? request.headers.get('x-relay-session') : crypto.randomUUID();
    if (role === 'controller' && this.peers('controller').length) return new Response('Controller already connected', { status: 409 });
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role, id, closed: false });
    send(server, { type: 'hello', clientId: id });
    const controller = this.peers('controller')[0];
    if (role === 'app') {
      if (!controller) server.close(4001, 'controller_not_found');
      else if (this.peers('app').length > 8) server.close(1008, 'client_limit');
      else {
        await this.ctx.storage.deleteAlarm();
        send(controller, { type: 'client_attached', clientId: id });
        send(server, { type: 'controller_attached', clientId: controller.deserializeAttachment().id });
      }
    } else await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(socket, message) {
    if (typeof message !== 'string') { socket.close(1003, 'text_only'); return; }
    if (new TextEncoder().encode(message).length > MAX_BYTES) { socket.close(1009, 'message_too_large'); return; }
    let frame;
    try { frame = JSON.parse(message); } catch { socket.close(1007, 'invalid_json'); return; }
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) { socket.close(1008, 'invalid_frame'); return; }
    if (frame.type === 'ping') { send(socket, { type: 'pong', ts: Date.now() }); return; }
    if (frame.type !== 'message' || !frame.data || typeof frame.data !== 'object') {
      send(socket, { type: 'error', code: 'invalid_message' }); return;
    }
    const meta = socket.deserializeAttachment();
    if (!meta || meta.closed) return;
    if (meta.role === 'controller') {
      const app = this.peers('app').find(peer => peer.deserializeAttachment().id === frame.clientId);
      if (!app) { send(socket, { type: 'error', code: 'client_not_found', clientId: frame.clientId }); return; }
      send(app, { type: 'message', data: frame.data });
    } else {
      const controller = this.peers('controller')[0];
      if (!controller) { socket.close(4000, 'controller_disconnected'); return; }
      send(controller, { type: 'message', clientId: meta.id, data: frame.data });
    }
  }
  async closePeer(socket) {
    const meta = socket.deserializeAttachment();
    if (!meta || meta.closed) return;
    socket.serializeAttachment({ ...meta, closed: true });
    if (meta.role === 'controller') {
      for (const app of this.peers('app')) { send(app, { type: 'controller_disconnected' }); app.close(4000, 'controller_disconnected'); }
      await this.ctx.storage.deleteAlarm();
    } else {
      send(this.peers('controller')[0], { type: 'client_disconnected', clientId: meta.id });
      if (!this.peers('controller').length) await this.ctx.storage.deleteAlarm();
      else if (!this.peers('app').some(peer => peer !== socket && !peer.deserializeAttachment()?.closed)) await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    }
  }
  async webSocketClose(socket) { await this.closePeer(socket); if (socket.readyState === 1) socket.close(1000, 'closed'); }
  async webSocketError(socket) { await this.closePeer(socket); if (socket.readyState === 1) socket.close(1011, 'socket_error'); }
  async alarm() {
    if (this.peers('app').length) return;
    for (const socket of this.peers('controller')) { send(socket, { type: 'idle_timeout' }); socket.close(4002, 'idle_timeout'); }
  }
}
export default { fetch: routeRelay };
