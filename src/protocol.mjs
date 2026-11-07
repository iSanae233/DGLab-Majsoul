import protobuf from 'protobufjs/light.js';
import schema from './protocol/liqi.json' with { type: 'json' };
import { isDoraDiscard } from './dora.mjs';

const root = protobuf.Root.fromJSON(schema);
const wrapper = root.lookupType('lq.Wrapper');
const MAX_FRAME = 1024 * 1024;

function decode(name, bytes) {
  const type = root.lookupType(name);
  return type.toObject(type.decode(bytes), { defaults: true, bytes: Array });
}

export function decodeActionData(bytes) {
  const data = Uint8Array.from(bytes);
  const keys = [0x84, 0x5e, 0x4e, 0x42, 0x39, 0xa2, 0x1f, 0x60, 0x1c];
  for (let i = 0; i < data.length; i++) {
    data[i] ^= ((23 ^ data.length) + 5 * i + keys[i % keys.length]) & 255;
  }
  return data;
}

// One decoder per socket: request IDs are local to their connection.
export class ProtocolSession {
  pending = new Map();
  accountId = null;
  gameId = null;
  me = null;
  seen = new Set();
  round = 'unknown';
  sourceSeat = null;
  liveRound = false;
  doraIndicators = [];
  playerCount = 4;

  feed(direction, input) {
    const bytes = new Uint8Array(input);
    if (!bytes.length || bytes.length > MAX_FRAME) throw new Error('invalid-frame-size');
    const kind = bytes[0];
    if (![1, 2, 3].includes(kind)) throw new Error('invalid-frame-type');
    if (kind !== 1 && bytes.length < 3) throw new Error('truncated-frame');
    if ((direction === 'out' && kind !== 2) || (direction === 'in' && kind === 2)) return [];
    const id = kind === 1 ? null : bytes[1] | (bytes[2] << 8);
    const envelope = wrapper.decode(bytes.subarray(kind === 1 ? 1 : 3));
    let name = envelope.name;
    if (kind === 2) {
      if (!['.lq.FastTest.authGame', '.lq.FastTest.syncGame', '.lq.FastTest.enterGame'].includes(name)) return [];
      const method = root.lookup(name);
      if (!method?.responseType) throw new Error('unknown-method');
      this.pending.set(id, `lq.${method.responseType}`);
      if (this.pending.size > 128) this.pending.delete(this.pending.keys().next().value);
      if (name.endsWith('.authGame')) {
        const request = decode('lq.ReqAuthGame', envelope.data);
        if (request.game_uuid && request.game_uuid !== this.gameId) {
          this.gameId = request.game_uuid; this.seen.clear(); this.liveRound = false;
          this.round = 'unknown'; this.sourceSeat = null; this.doraIndicators = [];
        }
        this.accountId = request.account_id || null;
      }
      return [];
    }
    if (kind === 3) {
      name = this.pending.get(id);
      this.pending.delete(id);
      if (!name) return [];
    }
    const allowed = ['lq.ResAuthGame', 'lq.ResSyncGame', 'lq.ResEnterGame', '.lq.ActionPrototype', '.lq.NotifyGameEndResult'];
    if (!allowed.includes(name)) return [];
    const data = decode(name, envelope.data);
    if (data.error?.code) return [{ type: 'protocol-error', code: data.error.code }];
    if (name === 'lq.ResAuthGame') {
      const seat = this.accountId ? data.seat_list.indexOf(this.accountId) : -1;
      this.me = seat >= 0 ? seat : null;
      return [{ type: 'game-start', me: this.me, playerCount: data.seat_list.length }];
    }
    if (name === 'lq.ResSyncGame' || name === 'lq.ResEnterGame') {
      // Restore actions describe history, not new triggers. Do not replay them.
      this.round = 'restored';
      this.liveRound = false;
      this.sourceSeat = null;
      this.doraIndicators = [];
      this.seen.clear();
      for (const action of data.game_restore?.actions ?? []) {
        if (action.name === 'ActionNewRound') {
          const round = decode('lq.ActionNewRound', Uint8Array.from(action.data));
          this.round = `${round.chang}:${round.ju}:${round.ben}`;
          this.doraIndicators = round.doras.length ? round.doras : round.dora ? [round.dora] : [];
          this.playerCount = round.scores.length === 3 ? 3 : 4;
        }
        this.remember(`${this.round}:${action.step}:${action.name}`);
      }
      return [{ type: 'resync', me: this.me, historicalActions: data.game_restore?.actions?.length ?? 0 }];
    }
    if (name === '.lq.NotifyGameEndResult') {
      this.liveRound = false; this.sourceSeat = null;
      return [{ type: 'game-end', me: this.me, players: (data.result?.players ?? []).map(p => ({ seat: p.seat, score: p.part_point_1 })) }];
    }
    const actionNames = ['ActionNewRound', 'ActionDealTile', 'ActionDiscardTile', 'ActionChiPengGang', 'ActionAnGangAddGang', 'ActionHule', 'ActionNoTile', 'ActionLiuJu', 'ActionBaBei'];
    if (!actionNames.includes(data.name)) return [];
    const action = decode(`lq.${data.name}`, decodeActionData(data.data));
    const nextRound = data.name === 'ActionNewRound' ? `${action.chang}:${action.ju}:${action.ben}` : this.round;
    const key = `${nextRound}:${data.step}:${data.name}`;
    if (this.seen.has(key)) return [];
    this.remember(key);
    if (data.name === 'ActionNewRound') {
      this.round = nextRound;
      this.sourceSeat = null;
      this.liveRound = true;
      this.playerCount = action.scores.length === 3 ? 3 : 4;
      this.doraIndicators = action.doras.length ? action.doras : action.dora ? [action.dora] : [];
    }
    if (action.doras?.length) this.doraIndicators = action.doras.slice();
    const base = { me: this.me, step: data.step, round: this.round, live: this.liveRound };
    switch (data.name) {
      case 'ActionNewRound': return [{ ...base, type: 'round-start', round: this.round, scores: action.scores }];
      case 'ActionDiscardTile':
        this.sourceSeat = action.seat;
        return [{ ...base, type: 'discard', seat: action.seat, tile: action.tile, isDora: isDoraDiscard(action.tile, this.doraIndicators, this.playerCount) }, ...(action.is_liqi || action.is_wliqi ? [{ ...base, type: 'riichi', seat: action.seat }] : [])];
      case 'ActionChiPengGang':
        this.sourceSeat = null;
        return [{ ...base, type: 'meld', seat: action.seat, kind: action.type, fromSeats: action.froms }];
      case 'ActionAnGangAddGang':
        this.sourceSeat = action.seat;
        return [{ ...base, type: 'kan', seat: action.seat, kind: action.type }];
      case 'ActionHule': {
        const events = [{ ...base, type: 'win', winners: action.hules.map(p => ({ seat: p.seat, selfDraw: p.zimo })), scores: action.scores }];
        const losers = action.delta_scores.flatMap((score, seat) => score < 0 ? [seat] : []);
        // Use server settlement, not fan/fu calculations. Ambiguous payments fail closed.
        if (this.liveRound && this.me !== null && this.sourceSeat === this.me &&
            action.hules.length > 0 && action.hules.every(p => !p.zimo && p.seat !== this.me) &&
            losers.length === 1 && losers[0] === this.me) {
          events.push({ ...base, type: 'deal-in', round: this.round, loss: -action.delta_scores[this.me] });
        }
        this.liveRound = false;
        this.sourceSeat = null;
        return events;
      }
      case 'ActionNoTile': return [{ ...base, type: 'exhaustive-draw', readyKnown: action.players.length === this.playerCount,
        readySeats: action.players.flatMap((p, i) => p.tingpai ? [i] : []) }];
      case 'ActionLiuJu': return [{ ...base, type: 'abortive-draw', reason: action.type }];
      case 'ActionBaBei': return [{ ...base, type: 'north-extraction', seat: action.seat }];
      default: return [];
    }
  }

  remember(key) {
    this.seen.add(key);
    if (this.seen.size > 1024) this.seen.delete(this.seen.values().next().value);
  }
}
