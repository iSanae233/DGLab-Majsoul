import { icon } from './icons.mjs';
import { brandMarkup, sceneMarkup, footerMarkup } from './components.mjs';

export const homeMarkup = `<main class="console landing">
<header class="topbar">${brandMarkup}</header>
<section class="hero landing-hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow"><span></span>MAHJONG MEETS DESIRE</p><h1 id="hero-title">入局，<br>由你<span class="hero-accent">掌控</span><span class="hero-period">。</span></h1><p class="hero-description">让雀魂连接 DG-LAB 的刺激。<br>每次触发，都由你定义。</p><div class="hero-actions"><a class="button primary play-link" href="/play/">${icon('play')}开始游玩${icon('arrow')}</a><a class="button secondary install-button" href="/userscripts/dglab-majsoul.user.js">${icon('download')}安装 / 更新脚本</a></div><p class="landing-requirement">雀魂网页版 · Tampermonkey · DG-LAB 4 App</p></div>${sceneMarkup}</section>
<section id="about" class="game-introduction" aria-labelledby="about-title"><div class="intro-heading"><div><p class="eyebrow">THE WAY YOU PLAY</p><h2 id="about-title">牌局是契机，规则是你的。</h2></div><p>在熟悉的麻将里，加入一点期待。</p></div><div class="feature-grid">
<article class="feature-card"><span class="feature-symbol">${icon('tiles')}</span><h3>每个事件，都是开关</h3><p>点炮、打出 Dora、自己的牌被吃、碰、明杠……<br>选择想要触发反馈的瞬间。</p></article>
<article class="feature-card"><span class="feature-symbol">${icon('bolt')}</span><h3>点炮大小，决定反馈</h3><p>可按实际失分缩放强度，也可直接设定变化量、时长与波形，分别配置 A / B 通道。</p></article>
<article class="feature-card"><span class="feature-symbol">${icon('shield')}</span><h3>尽兴，也尽在掌控</h3><p>建议先用模拟模式查看记录，再开启真实输出。</p><p>设定合理强度上限与停止快捷键，随时暂停。</p></article>
</div></section>
<section class="getting-started" aria-labelledby="start-title"><div class="start-copy"><p class="eyebrow">READY WHEN YOU ARE</p><h2 id="start-title">准备好，再入局。</h2><p>安装脚本后，进入游玩配置连接 App、添加规则。<br>从控制台打开雀魂，或在游戏内小窗口关联控制台。</p></div><a class="button secondary" href="/play/">进入游玩配置${icon('arrow')}</a></section>
${footerMarkup}</main>`;
