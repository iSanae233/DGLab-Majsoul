const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const BASE = /^(?:Key[A-Z]|Digit[0-9]|F[2-4]|F[7-9]|F10|Escape|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
const modifierKey = key => ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(key);
const eventCode = event => event.code || (/^[a-z]$/i.test(event.key || '') ? `Key${event.key.toUpperCase()}` : /^[0-9]$/.test(event.key || '') ? `Digit${event.key}` : event.key);
const eventModifiers = event => [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean);
function partsOf(value) {
  if (typeof value !== 'string' || value.length > 96) return null;
  const parts = value.split('+');
  const firstKey = parts.findIndex(part => !MODIFIERS.includes(part));
  if (firstKey < 0) return null;
  const modifiers = parts.slice(0, firstKey), keys = parts.slice(firstKey);
  if (modifiers.some((part, i) => i && MODIFIERS.indexOf(modifiers[i - 1]) >= MODIFIERS.indexOf(part))) return null;
  if (!keys.length || keys.length > 4 || keys.some((key, i) => !BASE.test(key) || (i && keys[i - 1] >= key))) return null;
  if ((modifiers.includes('Ctrl') || modifiers.includes('Meta')) && keys.some(key => /^(?:Key[RWNTLQ]|Digit[0-9])$/.test(key))) return null;
  return { modifiers, keys };
}
export const validShortcut = value => !!partsOf(value);
function canonical(keys, modifiers) {
  const value = [...modifiers, ...[...keys].sort()].join('+');
  if (!validShortcut(value)) throw new Error('此组合可能被浏览器保留或按键过多，请更换组合');
  return value;
}
export function recordShortcut(event) {
  if (event.isComposing || modifierKey(event.key)) return null;
  return canonical([eventCode(event)], eventModifiers(event));
}
export function shortcutLabel(value) {
  return value.split('+').map(part => part.replace(/^Key|^Digit/g, '').replace('Escape', 'Esc').replace('Space', '空格')).join(' + ');
}
function typing(event, parts) {
  if (event.ctrlKey || event.altKey || event.metaKey || parts.keys.every(key => /^F\d+$|^Escape$/.test(key))) return false;
  return (event.composedPath?.() || [event.target]).some(target => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName));
}
export function shortcutMatches(event, value, pressed) {
  const parts = partsOf(value);
  if (!parts || event.repeat || event.isComposing || typing(event, parts)) return false;
  if (eventModifiers(event).join('+') !== parts.modifiers.join('+')) return false;
  const keys = pressed || new Set([eventCode(event)]);
  return parts.keys.every(key => keys.has(key));
}
export class ShortcutMatcher {
  pressed = new Set();
  fired = null;
  keydown(event, value) {
    const parts = partsOf(value);
    if (!parts || event.isComposing || typing(event, parts)) { this.reset(); return false; }
    const code = eventCode(event);
    if (BASE.test(code)) this.pressed.add(code);
    if (!shortcutMatches(event, value, this.pressed) || this.fired === value) return false;
    this.fired = value; return true;
  }
  keyup(event) {
    const code = eventCode(event); this.pressed.delete(code);
    if (modifierKey(event.key) || partsOf(this.fired)?.keys.includes(code)) this.fired = null;
  }
  reset() { this.pressed.clear(); this.fired = null; }
}
export class ShortcutRecorder {
  held = new Set();
  keys = new Set();
  candidate = null;
  keydown(event) {
    if (event.repeat || event.isComposing) return null;
    const code = eventCode(event); this.held.add(code);
    if (!modifierKey(event.key)) this.keys.add(code);
    if (!this.keys.size) return null;
    try { this.candidate = canonical(this.keys, eventModifiers(event)); }
    catch (error) { this.candidate = null; throw error; }
    return this.candidate;
  }
  keyup(event) {
    const code = eventCode(event); this.held.delete(code); this.keys.delete(code);
    if (this.held.size) return null;
    const value = this.candidate; this.reset(); return value;
  }
  reset() { this.held.clear(); this.keys.clear(); this.candidate = null; }
}
