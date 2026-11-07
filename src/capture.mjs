export function isGameSocket(value) {
  try {
    const url = new URL(value);
    return ['ws:', 'wss:'].includes(url.protocol) &&
      ['maj-soul.com', 'majsoul.com', 'mahjongsoul.com', 'catmjstudio.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

export async function toBytes(data) {
  if (data instanceof Blob) {
    if (data.size > 1024 * 1024) throw new Error('oversized-frame');
    return new Uint8Array(await data.arrayBuffer());
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  throw new Error('non-binary-frame');
}

// Observe native events once; never replace MessageEvent or game listeners.
export function installCapture(scope, createSession, onEvent) {
  const Native = scope.WebSocket;
  let sequence = 0;
  const Wrapped = new Proxy(Native, {
    construct(Target, args, NewTarget) {
      const socket = Reflect.construct(Target, args, NewTarget);
      if (!isGameSocket(socket.url)) return socket;
      const connection = ++sequence;
      const session = createSession();
      let queue = Promise.resolve();
      let pending = 0;
      let closed = false;
      const emit = event => { try { onEvent({ connection, ...event }); } catch { /* observer cannot break game */ } };
      const capture = (direction, data) => {
        if (closed) return;
        if (pending >= 64 || (data?.byteLength ?? data?.size ?? 0) > 1024 * 1024) {
          emit({ type: 'capture-error', reason: 'capture-limit' });
          return;
        }
        pending++;
        // Snapshot synchronously before the game can mutate its send buffer.
        const bytes = toBytes(data).then(value => ({ value }), () => ({ error: true }));
        queue = queue.then(async () => {
          const result = await bytes;
          if (closed) return;
          if (result.error) throw new Error('binary-conversion');
          for (const event of session.feed(direction, result.value)) emit(event);
        }).catch(() => emit({ type: 'capture-error', reason: 'decode-failed' })).finally(() => { pending--; });
      };
      const send = socket.send;
      socket.send = function (data) {
        const result = Reflect.apply(send, this, [data]);
        if (this === socket) capture('out', data);
        return result;
      };
      socket.addEventListener('message', event => capture('in', event.data));
      socket.addEventListener('close', () => { closed = true; emit({ type: 'connection-closed' }); });
      emit({ type: 'connection-observed' });
      return socket;
    },
  });
  scope.WebSocket = Wrapped;
  return () => { if (scope.WebSocket === Wrapped) scope.WebSocket = Native; };
}
