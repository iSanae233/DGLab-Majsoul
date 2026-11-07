import { icon } from './icons.mjs';

export const brandMarkup = `<a class="brand" href="/" aria-label="DGLab-Majsoul 首页"><img class="brand-mark" src="/assets/brand.svg" width="40" height="44" alt=""><span>DGLab<span class="brand-divider"> / </span>Majsoul<small>PLAY ON YOUR TERMS</small></span></a>`;

export const sceneMarkup = `<div class="hero-art" aria-hidden="true">
  <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span>
  <span class="art-coordinate coordinate-top">MJ / DG</span>
  <div class="tile tile-back"><span class="tile-corner">DG</span>${icon('bolt')}<span class="tile-caption">DESIRE</span></div>
  <div class="tile tile-front"><span class="tile-corner">東</span><span class="tile-character">發</span><span class="tile-caption">YOUR RULES</span></div>
  <span class="art-ring ring-one"></span><span class="art-ring ring-two"></span>
  <span class="art-coordinate coordinate-bottom">THE NEXT MOVE IS YOURS.</span>
</div>`;

export const footerMarkup = `<footer><div class="footer-links"><a class="footer-brand" href="/"><img src="/assets/brand.svg" width="24" height="28" alt="">DGLab-Majsoul <span class="muted">/ v0.9.1</span></a><a class="repository-link" href="https://github.com/iSanae233/DGLab-Majsoul" target="_blank" rel="noopener noreferrer">${icon('github')}<span>GitHub 仓库</span>${icon('arrow')}</a></div><span class="footer-motto">YOUR GAME. YOUR RULES. YOUR LIMITS.</span></footer>`;
