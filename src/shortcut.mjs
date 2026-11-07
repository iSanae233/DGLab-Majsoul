const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const BASE = /^(?:Key[A-Z]|Digit[0-9]|F[2-4]|F[7-9]|F10|Escape|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
export function validShortcut(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  const parts = value.split('+'), base = parts.pop();
  if (!BASE.test(base) || parts.some((part, i) => !MODIFIERS.includes(part) || (i && MODIFIERS.indexOf(parts[i - 1]) >= MODIFIERS.indexOf(part)))) return false;
  if ((parts.includes('Ctrl') || parts.includes('Meta')) && /^(?:Key[RWNTLQ]|Digit[0-9])$/.test(base)) return false;
  return true;
}
export function recordShortcut(event) {
  if (event.isComposing || ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(event.key)) return null;
  const code = event.code || (/^[a-z]$/i.test(event.key || '') ? `Key${event.key.toUpperCase()}` : /^[0-9]$/.test(event.key || '') ? `Digit${event.key}` : event.key);
  const value = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', code].filter(Boolean).join('+');
  if (!validShortcut(value)) throw new Error('此按键可能被浏览器或系统保留，请换一个按键或组合键');
  return value;
}
export function shortcutLabel(value) { return value.replace(/Key(?=[A-Z])/g, '').replace(/Digit(?=[0-9])/g, '').replace('Escape', 'Esc').replace('Space', '空格'); }
export function shortcutMatches(event, value) {
  if (event.repeat || event.isComposing || !validShortcut(value)) return false;
  let recorded; try { recorded = recordShortcut(event); } catch { return false; }
  if (recorded !== value) return false;
  const base = value.split('+').at(-1);
  if (!event.ctrlKey && !event.altKey && !event.metaKey && !/^F\d+$|^Escape$/.test(base)) {
    const path = event.composedPath?.() || [event.target];
    if (path.some(target => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName))) return false;
  }
  return true;
}
