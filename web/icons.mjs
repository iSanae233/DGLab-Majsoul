// Local SVGs keep controls recognizable without fonts or remote assets.
const paths = {
  github: '<path d="M9 19c-4 1-4-2-6-2m13 5v-4a3.5 3.5 0 0 0-1-2.8c3.3-.4 6.8-1.6 6.8-7.4a5.8 5.8 0 0 0-1.5-4 5.4 5.4 0 0 0-.1-4s-1.2-.4-4.1 1.5a14 14 0 0 0-7.4 0C5.8-.6 4.6-.2 4.6-.2a5.4 5.4 0 0 0-.1 4 5.8 5.8 0 0 0-1.5 4c0 5.8 3.5 7 6.8 7.4A3.5 3.5 0 0 0 9 18v4" transform="translate(0 2) scale(.9)"/>',
  link: '<path d="m10 13 4-4m-6 6-1.5 1.5a4.2 4.2 0 0 1-6-6L4 8m12 8 1.5-1.5a4.2 4.2 0 0 0-6-6L10 10" transform="translate(2 0)"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  tiles: '<rect x="9" y="5" width="11" height="16" rx="2"/><path d="M6 18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9M12 10h5m-5 4h5m-5 3h3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  qr: '<path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h2v2h-2zm4 0h2v6h-4v-2h-2v2m-3-9h3m4 0h2M3 12h6m3-9v5m0 10v3"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  sliders: '<path d="M4 6h4m4 0h8M4 18h8m4 0h4M8 3v6m8 6v6M4 12h10m4 0h2m-6-3v6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
  ring: '<ellipse cx="12" cy="13" rx="7" ry="8"/><path d="M9 5V2h6v3"/>',
};
export function icon(name, className = '') {
  if (!Object.hasOwn(paths, name)) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
