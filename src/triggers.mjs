export const TRIGGERS = [
  { value: 'deal-in', label: '自己点炮' },
  { value: 'discard-dora', label: '自己打出 Dora / 赤宝牌' },
  { value: 'tile-chi', label: '自己的牌被吃' },
  { value: 'tile-pon', label: '自己的牌被碰' },
  { value: 'tile-kan', label: '自己的牌被明杠' },
  { value: 'opponent-riichi', label: '其他玩家立直' },
  { value: 'opponent-tsumo', label: '其他玩家自摸' },
  { value: 'own-win', label: '自己和牌（荣和 / 自摸）' },
  { value: 'own-riichi', label: '自己立直' },
  { value: 'noten-draw', label: '流局时自己未听牌' },
  { value: 'tenpai-draw', label: '流局时自己已听牌' },
];
export const triggerLabel = key => TRIGGERS.find(trigger => trigger.value === key)?.label || key;
const validSeat = seat => Number.isInteger(seat) && seat >= 0 && seat <= 3;
export function matchesTrigger(key, event) {
  if (key === 'deal-in') return event.type === 'deal-in' && event.live !== false && Number.isSafeInteger(event.loss) && event.loss > 0 && event.loss <= 10000000;
  if (event.live !== true || !Number.isInteger(event.me) || event.me < 0 || event.me > 3) return false;
  switch (key) {
    case 'discard-dora': return event.type === 'discard' && event.seat === event.me && event.isDora === true;
    case 'tile-chi':
    case 'tile-pon':
    case 'tile-kan': return event.type === 'meld' && event.kind === { 'tile-chi': 0, 'tile-pon': 1, 'tile-kan': 2 }[key] && validSeat(event.seat) && event.seat !== event.me && Array.isArray(event.fromSeats) && event.fromSeats.includes(event.me);
    case 'opponent-riichi': return event.type === 'riichi' && validSeat(event.seat) && event.seat !== event.me;
    case 'own-riichi': return event.type === 'riichi' && event.seat === event.me;
    case 'opponent-tsumo': return event.type === 'win' && Array.isArray(event.winners) && event.winners.some(winner => winner?.selfDraw === true && validSeat(winner.seat) && winner.seat !== event.me);
    case 'own-win': return event.type === 'win' && Array.isArray(event.winners) && event.winners.some(winner => winner?.seat === event.me);
    case 'noten-draw': return event.type === 'exhaustive-draw' && event.readyKnown === true && Array.isArray(event.readySeats) && !event.readySeats.includes(event.me);
    case 'tenpai-draw': return event.type === 'exhaustive-draw' && event.readyKnown === true && Array.isArray(event.readySeats) && event.readySeats.includes(event.me);
    default: return false;
  }
}
