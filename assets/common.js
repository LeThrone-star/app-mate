/* =========================================================
   Astral — utilità condivise: header, tema, canvas, slider, tab
   ========================================================= */
(function () {
  'use strict';

  const NAV = [
    ['index.html', 'Home'],
    ['index.html#tutor', 'Tutor IA'],
    ['grafici.html', 'Grafici'],
    ['calcolatrice.html', 'Calcolatrice'],
    ['matematica.html', 'Lab Matematica'],
    ['fisica.html', 'Lab Fisica', 'phys'],
    ['teoria.html', 'Teoria'],
  ];

  /* ---------- Tema ---------- */
  function storedTheme() {
    try { return localStorage.getItem('astral-theme'); } catch (e) { return null; }
  }
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    window.dispatchEvent(new Event('themechange'));
  }
  function isDark() {
    const t = document.documentElement.dataset.theme;
    return t !== 'light'; // il tema predefinito di Astral è quello notturno
  }
  applyTheme(storedTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!document.documentElement.dataset.theme) window.dispatchEvent(new Event('themechange'));
    });
  }

  /* ---------- Header ---------- */
  function buildHeader() {
    const header = document.querySelector('header.site-header');
    if (!header) return;
    const here = (location.pathname.split('/').pop() || 'index.html');
    const links = NAV.map(([href, label, cls]) =>
      `<a href="${href}" class="${cls || ''} ${here === href ? 'active' : ''}">${label}</a>`).join('');
    header.innerHTML = `
      <div class="inner">
        <a class="brand" href="index.html"><img class="logo" src="assets/favicon.svg" alt="" width="32" height="32"><span>Astral</span></a>
        <nav class="nav" id="site-nav">${links}</nav>
        <button class="btn small primary install-btn" id="install-btn" type="button" hidden>⬇ Installa l'app</button>
        <button class="icon-btn menu-btn" aria-label="Menu" id="menu-btn">☰</button>
        <button class="icon-btn" aria-label="Cambia tema" id="theme-btn" title="Tema chiaro/scuro"></button>
      </div>`;
    const themeBtn = header.querySelector('#theme-btn');
    const setIcon = () => { themeBtn.textContent = isDark() ? '☀' : '☾'; };
    setIcon();
    window.addEventListener('themechange', setIcon);
    themeBtn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      try { localStorage.setItem('astral-theme', next); } catch (e) { /* ignora */ }
      applyTheme(next);
    });
    header.querySelector('#menu-btn').addEventListener('click', () => {
      header.querySelector('#site-nav').classList.toggle('open');
    });
  }

  /* ---------- Variabili CSS ---------- */
  const cssCache = {};
  function cssVar(name) {
    if (!(name in cssCache)) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return cssCache[name];
  }
  window.addEventListener('themechange', () => { for (const k in cssCache) delete cssCache[k]; });

  /* ---------- Canvas ad alta risoluzione ---------- */
  function fitCanvas(canvas, onResize) {
    const ctx = canvas.getContext('2d');
    const st = { ctx, w: 0, h: 0, dpr: 1 };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      st.dpr = window.devicePixelRatio || 1;
      st.w = r.width; st.h = r.height;
      canvas.width = Math.round(r.width * st.dpr);
      canvas.height = Math.round(r.height * st.dpr);
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      if (onResize) onResize(st);
    };
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    resize();
    return st;
  }

  /* ---------- Slider con etichetta ---------- */
  function slider(parent, o) {
    const wrap = document.createElement('div');
    wrap.className = 'ctrl';
    const fmt = o.fmt || (v => fmtNum(v, o.decimals != null ? o.decimals : 2) + (o.unit ? ' ' + o.unit : ''));
    wrap.innerHTML = `<label><span>${o.label}</span><output></output></label>
      <input type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}">`;
    const input = wrap.querySelector('input');
    const out = wrap.querySelector('output');
    const update = () => { out.textContent = fmt(+input.value); };
    input.addEventListener('input', () => { update(); if (o.onInput) o.onInput(+input.value); });
    update();
    parent.appendChild(wrap);
    return {
      el: wrap,
      get value() { return +input.value; },
      set value(v) { input.value = v; update(); },
    };
  }

  function fmtNum(v, d = 2) {
    if (!isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
    const s = (+v).toFixed(d);
    const n = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
    return (n === '-0' ? '0' : n).replace('-', '−').replace('.', ',');
  }

  /* ---------- Tab con sincronizzazione hash ---------- */
  function setupTabs(tabsEl, onChange) {
    const buttons = [...tabsEl.querySelectorAll('button[data-tab]')];
    const panels = [...document.querySelectorAll('[data-panel]')];
    const activate = (name, push) => {
      if (!buttons.some(b => b.dataset.tab === name)) name = buttons[0].dataset.tab;
      buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
      if (push) history.replaceState(null, '', '#' + name);
      window.dispatchEvent(new Event('resize'));
      if (onChange) onChange(name);
    };
    buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.tab, true)));
    window.addEventListener('hashchange', () => activate(location.hash.slice(1), false));
    activate(location.hash.slice(1), false);
  }

  /* ---------- KaTeX ---------- */
  /** Divide "$$a \qquad b$$" nelle singole formule (solo fuori dalle graffe). */
  function splitFormulas(src) {
    const parts = [];
    let depth = 0, last = 0;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && src.startsWith('\\qquad', i) && !/[A-Za-z]/.test(src[i + 6] || '')) {
        parts.push(src.slice(last, i));
        i += 5;
        last = i + 1;
      }
    }
    parts.push(src.slice(last));
    return parts.map(p => p.trim()).filter(Boolean);
  }
  function renderMath(root) {
    // sugli schermi stretti le formule affiancate vanno una sotto l'altra
    if (window.innerWidth < 700) {
      (root || document).querySelectorAll('.formula').forEach(el => {
        const m = /^\s*\$\$([\s\S]*)\$\$\s*$/.exec(el.textContent);
        if (!m) return;
        const parts = splitFormulas(m[1]);
        if (parts.length > 1) el.textContent = parts.map(p => '$$' + p + '$$').join('\n');
      });
    }
    if (window.renderMathInElement) {
      window.renderMathInElement(root || document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    }
  }
  function tex(el, src, display) {
    if (window.katex) {
      try { window.katex.render(src, el, { throwOnError: false, displayMode: !!display }); return; } catch (e) { /* fallback */ }
    }
    el.textContent = src;
  }

  /* ---------- Link "apri nel grafico" ---------- */
  function graphHref(list) {
    return 'grafici.html#e=' + encodeURIComponent(JSON.stringify(list));
  }

  /* ---------- Disegno: frecce ---------- */
  function arrow(ctx, x1, y1, x2, y2, color, width = 2.5, label) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len, head = Math.min(12, len * 0.45);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
    ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = '600 13px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x2 + 6 - (ux < -0.5 ? 30 : 0), y2 + (uy > 0.5 ? 10 : -8));
    }
    ctx.restore();
  }


  /* ---------- App installabile (PWA) ---------- */
  const App_ = { prompt: null, listeners: [] };
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inFrame = () => { try { return window.top !== window.self; } catch (e) { return true; } };
  function notifyInstall() { App_.listeners.forEach(f => { try { f(); } catch (e) { /* ignora */ } }); }
  if ('serviceWorker' in navigator && window.isSecureContext && !inFrame()) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* non disponibile qui */ }); });
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    App_.prompt = e;
    const b = document.getElementById('install-btn');
    if (b) b.hidden = false;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    App_.prompt = null;
    const b = document.getElementById('install-btn');
    if (b) b.hidden = true;
    notifyInstall();
  });
  async function installApp() {
    if (!App_.prompt) return false;
    const p = App_.prompt;
    App_.prompt = null;
    p.prompt();
    try { await p.userChoice; } catch (e) { /* ignora */ }
    const b = document.getElementById('install-btn');
    if (b) b.hidden = true;
    notifyInstall();
    return true;
  }
  document.addEventListener('click', ev => { if (ev.target.closest('#install-btn')) installApp(); });
  const pwa = {
    install: installApp,
    canPrompt: () => !!App_.prompt,
    isStandalone, isIOS, inFrame,
    onChange: f => App_.listeners.push(f),
  };

  document.addEventListener('DOMContentLoaded', () => {
    buildHeader();
    document.querySelectorAll('[data-graph]').forEach(a => {
      try { a.href = graphHref(JSON.parse(a.dataset.graph)); } catch (e) { /* ignora */ }
    });
  });
  window.addEventListener('load', () => renderMath());

  window.App = { pwa, cssVar, fitCanvas, slider, fmtNum, setupTabs, renderMath, tex, graphHref, arrow, isDark };
})();
