export function doraFromIndicator(indicator, playerCount = 4) {
  if (typeof indicator !== 'string' || !/^[0-9][mpsz]$/.test(indicator)) return null;
  const suit = indicator[1]; const rank = indicator[0] === '0' && suit !== 'z' ? 5 : Number(indicator[0]);
  if (suit === 'z') {
    if (rank >= 1 && rank <= 4) return `${rank % 4 + 1}z`;
    if (rank >= 5 && rank <= 7) return `${(rank - 4) % 3 + 5}z`;
    return null;
  }
  if (rank < 1 || rank > 9) return null;
  if (playerCount === 3 && suit === 'm' && (rank === 1 || rank === 9)) return rank === 1 ? '9m' : '1m';
  return `${rank % 9 + 1}${suit}`;
}
export function isDoraDiscard(tile, indicators, playerCount) {
  if (typeof tile !== 'string' || !/^[0-9][mpsz]$/.test(tile)) return false;
  if (/^0[mps]$/.test(tile)) return true;
  return indicators.some(indicator => doraFromIndicator(indicator, playerCount) === tile);
}
