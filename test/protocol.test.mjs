import test from 'node:test';
import assert from 'node:assert/strict';
import protobuf from 'protobufjs/light.js';
import schema from '../src/protocol/liqi.json' with { type: 'json' };
import { ProtocolSession, decodeActionData } from '../src/protocol.mjs';

const root = protobuf.Root.fromJSON(schema);
const encode = (name, data) => root.lookupType(`lq.${name}`).encode(data).finish();
function frame(kind, name, data, id = 1) {
  const body = encode('Wrapper', { name, data });
  return Uint8Array.from([kind, ...(kind === 1 ? [] : [id & 255, id >> 8]), ...body]);
}
function action(name, data, step = 0) {
  return frame(1, '.lq.ActionPrototype', encode('ActionPrototype', { name, step, data: decodeActionData(encode(name, data)) }));
}
function authenticate(session, account = 42) {
  session.feed('out', frame(2, '.lq.FastTest.authGame', encode('ReqAuthGame', { account_id: account, token: 'DO-NOT-EXPORT' })));
  return session.feed('in', frame(3, '', encode('ResAuthGame', { seat_list: [7, 42, 9, 10] })));
}

test('identity comes from protocol, exports neither credentials nor account IDs', () => {
  const s = new ProtocolSession();
  assert.deepEqual(authenticate(s), [{ type: 'game-start', me: 1, playerCount: 4 }]);
  assert.equal(JSON.stringify(authenticate(s)).includes('DO-NOT-EXPORT'), false);
});
test('same request ID is isolated between sockets; missing identity stays unknown', () => {
  const a = new ProtocolSession(); const b = new ProtocolSession();
  authenticate(a, 42); authenticate(b, 7);
  assert.equal(a.me, 1); assert.equal(b.me, 0);
  assert.equal(authenticate(new ProtocolSession(), 0)[0].me, null);
});
test('discard/riichi, duplicate suppression, and next-round step reuse', () => {
  const s = new ProtocolSession(); authenticate(s);
  const first = action('ActionNewRound', { chang: 0, ju: 0, ben: 0, scores: [25000, 25000, 25000, 25000] });
  assert.equal(s.feed('in', first)[0].type, 'round-start');
  assert.deepEqual(s.feed('in', first), []);
  const discard = action('ActionDiscardTile', { seat: 0, tile: '1m', is_liqi: true }, 1);
  assert.deepEqual(s.feed('in', discard).map(e => e.type), ['discard', 'riichi']);
  assert.deepEqual(s.feed('in', discard), []);
  assert.equal(s.feed('in', action('ActionNewRound', { ju: 1 }))[0].round, '0:1:0');
  assert.equal(s.feed('in', discard).length, 2);
});
test('restore does not emit historical actions or XOR-decode unencrypted restore data', () => {
  const s = new ProtocolSession();
  s.feed('out', frame(2, '.lq.FastTest.syncGame', encode('ReqSyncGame', {}), 27));
  const restored = [{ name: 'ActionNewRound', step: 0, data: encode('ActionNewRound', { ju: 2 }) },
    { name: 'ActionDiscardTile', step: 1, data: encode('ActionDiscardTile', { seat: 0, tile: '2m' }) }];
  assert.deepEqual(s.feed('in', frame(3, '', encode('ResSyncGame', { game_restore: { actions: restored } }), 27)),
    [{ type: 'resync', me: null, historicalActions: 2 }]);
  assert.deepEqual(s.feed('in', action('ActionDiscardTile', { seat: 0, tile: '2m' }, 1)), []);
});
test('win/draw/meld exports summaries rather than private hands', () => {
  const s = new ProtocolSession();
  assert.equal(s.feed('in', action('ActionChiPengGang', { seat: 1, froms: [1, 1, 0] }, 1))[0].type, 'meld');
  const win = s.feed('in', action('ActionHule', { hules: [{ seat: 1, zimo: true, hand: ['1m'] }] }, 2))[0];
  assert.deepEqual(win.winners, [{ seat: 1, selfDraw: true }]);
  assert.equal(JSON.stringify(win).includes('hand'), false);
  assert.deepEqual(s.feed('in', action('ActionNoTile', { players: [{ tingpai: false }, { tingpai: true }] }, 3))[0].readySeats, [1]);
});
test('malformed frames fail explicitly, unknown messages are ignored', () => {
  const s = new ProtocolSession();
  for (const bytes of [[], [3], [9], new Uint8Array(1024 * 1024 + 1)]) assert.throws(() => s.feed('in', bytes));
  assert.deepEqual(s.feed('in', frame(1, '.lq.Unknown', new Uint8Array())), []);
  assert.deepEqual(s.feed('in', frame(3, '', new Uint8Array(), 123)), []);
});

test('deal-in uses server loss including honba and multiple winners', () => {
  const s = new ProtocolSession(); authenticate(s);
  s.feed('in', action('ActionNewRound', {}));
  s.feed('in', action('ActionDiscardTile', { seat: 1, tile: '1m' }, 2));
  const events = s.feed('in', action('ActionHule', {
    hules: [{ seat: 0, zimo: false }, { seat: 2, zimo: false }],
    delta_scores: [8300, -12600, 4300, 0],
  }, 3));
  assert.equal(events.find(e => e.type === 'deal-in').loss, 12600);
  assert.equal(s.feed('in', action('ActionHule', { hules: [{ seat: 0 }], delta_scores: [8300, -8300] }, 3)).length, 0);
});
test('self draw, ambiguous payments, other discarder and restored rounds never punish', () => {
  for (const mode of ['self-draw', 'multiple-losers', 'other-discarder', 'restored']) {
    const s = new ProtocolSession(); authenticate(s);
    if (mode !== 'restored') s.feed('in', action('ActionNewRound', {}));
    s.feed('in', action('ActionDiscardTile', { seat: mode === 'other-discarder' ? 2 : 1 }, 2));
    const result = s.feed('in', action('ActionHule', {
      hules: [{ seat: 0, zimo: mode === 'self-draw' }],
      delta_scores: mode === 'multiple-losers' ? [8000, -4000, -4000] : [8000, -8000, 0],
    }, 3));
    assert.equal(result.some(e => e.type === 'deal-in'), false, mode);
  }
});

test('live public discard metadata identifies Dora without exporting drawn tiles', () => {
  const s = new ProtocolSession(); authenticate(s);
  s.feed('in', action('ActionNewRound', { scores: [25000,25000,25000,25000], doras: ['4p'] }));
  const dora = s.feed('in', action('ActionDiscardTile', { seat: 1, tile: '5p' }, 1))[0];
  assert.equal(dora.isDora, true); assert.equal(dora.live, true); assert.equal(dora.round, '0:0:0');
  assert.deepEqual(s.feed('in', action('ActionDealTile', { seat: 1, tile: '3s', doras: ['4p','9s'] }, 2)), []);
  assert.equal(s.feed('in', action('ActionDiscardTile', { seat: 1, tile: '1s' }, 3))[0].isDora, true);
  assert.equal(s.feed('in', action('ActionDiscardTile', { seat: 1, tile: '0s' }, 4))[0].isDora, true);
});
test('replayed restored round does not re-enable live triggers', () => {
  const s = new ProtocolSession(); authenticate(s);
  s.feed('out', frame(2, '.lq.FastTest.syncGame', encode('ReqSyncGame', {}), 27));
  s.feed('in', frame(3, '', encode('ResSyncGame', { game_restore: { actions: [{ name: 'ActionNewRound', step: 0, data: encode('ActionNewRound', {}) }] } }), 27));
  assert.deepEqual(s.feed('in', action('ActionNewRound', {})), []);
  assert.equal(s.feed('in', action('ActionDiscardTile', { seat: 1, tile: '0p' }, 1))[0].live, false);
});
