/* =========================================================
   Laboratorio di Fisica — simulazioni
   ========================================================= */
(function () {
  'use strict';
  const { cssVar, fitCanvas, slider, fmtNum, arrow } = window.App;
  const DEG = Math.PI / 180;
  const FONT = () => getComputedStyle(document.body).fontFamily;
  const COL = {
    red: '#e03131', blue: '#1c7ed6', green: '#2f9e44', purple: '#7048e8', orange: '#f08c00', teal: '#0c8599',
  };

  const sims = {};
  let active = null;

  function readout(el, rows) {
    el.innerHTML = rows.map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ''}">${v}</dd>`).join('');
  }
  function clear(st) {
    const ctx = st.ctx;
    ctx.clearRect(0, 0, st.w, st.h);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, st.w, st.h);
    return ctx;
  }
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = `${o.weight || 600} ${o.size || 13}px ${FONT()}`;
    ctx.fillStyle = o.color || cssVar('--text');
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'middle';
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function ground(ctx, x0, x1, y) {
    ctx.save();
    ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.strokeStyle = cssVar('--grid-major'); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x < x1; x += 12) { ctx.moveTo(x, y + 2); ctx.lineTo(x - 8, y + 10); }
    ctx.stroke();
    ctx.restore();
  }
  function segButtons(id, onPick) {
    const el = document.getElementById(id);
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      onPick(b);
    });
  }
  function canvasPos(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  /** Grafico a scorrimento nel tempo. */
  function stripChart(ctx, x, y, w, h, data, key, color, label, unit) {
    ctx.save();
    ctx.fillStyle = cssVar('--surface-2');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = cssVar('--grid-major'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + h / 2 + 0.5); ctx.lineTo(x + w, y + h / 2 + 0.5); ctx.stroke();
    const span = 10;
    if (data.length > 1) {
      const tEnd = data[data.length - 1].t, tStart = Math.max(0, tEnd - span);
      let m = 1e-9;
      for (const d of data) m = Math.max(m, Math.abs(d[key]));
      m *= 1.15;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      let first = true;
      for (const d of data) {
        if (d.t < tStart) continue;
        const px = x + (d.t - tStart) / span * w;
        const py = y + h / 2 - d[key] / m * (h / 2 - 6);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      text(ctx, `±${fmtNum(m / 1.15, 2)} ${unit}`, x + w - 6, y + 12, { align: 'right', size: 11, color: cssVar('--muted'), weight: 500 });
    }
    text(ctx, label, x + 8, y + 12, { size: 12, color });
    text(ctx, 'ultimi 10 s →', x + 8, y + h - 10, { size: 11, color: cssVar('--muted'), weight: 500 });
    ctx.restore();
  }
  function energyBars(ctx, x, y, w, h, bars, max) {
    const bw = Math.min(26, (w - 10) / bars.length - 8);
    bars.forEach((b, i) => {
      const bx = x + i * (bw + 10);
      const bh = max > 0 ? Math.max(0, Math.min(1, b.value / max)) * (h - 22) : 0;
      ctx.fillStyle = cssVar('--surface-2');
      ctx.fillRect(bx, y, bw, h - 22);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, y + h - 22 - bh, bw, bh);
      text(ctx, b.label, bx + bw / 2, y + h - 10, { align: 'center', size: 11, color: cssVar('--muted') });
    });
  }


  /* ---------- Massa in kg oppure peso in N ---------- */
  const G0 = 9.81;
  let massUnit = 'kg';
  try { if (localStorage.getItem('astral-massunit') === 'N') massUnit = 'N'; } catch (e) { /* ignora */ }
  const massCtls = [];
  function massLabel(m) {
    if (massUnit === 'kg') return fmtNum(m, m < 10 && !Number.isInteger(m) ? 1 : 0) + ' kg';
    const P = m * G0;
    return fmtNum(P, P < 10 ? 1 : 0) + ' N';
  }
  /** Slider che lavora in kg, ma può mostrare e chiedere il peso in newton. */
  function massSlider(parent, o) {
    const box = document.createElement('div');
    parent.appendChild(box);
    let m = o.value, sl = null;
    const snap = (v, st) => Math.round(v / st) * st;
    function build() {
      box.innerHTML = '';
      if (massUnit === 'kg') {
        m = Math.min(o.max, Math.max(o.min, snap(m, o.step)));
        sl = slider(box, { label: o.label, min: o.min, max: o.max, step: o.step, value: m, unit: 'kg', decimals: o.step < 1 ? 1 : 0, onInput: v => { m = v; o.onInput(m); } });
      } else {
        const st = o.stepN, mn = Math.max(st, snap(o.min * G0, st)), mx = snap(o.max * G0, st);
        const P = Math.min(mx, Math.max(mn, snap(m * G0, st)));
        m = P / G0;
        sl = slider(box, { label: o.wLabel, min: mn, max: mx, step: st, value: P, unit: 'N', decimals: st < 1 ? 1 : 0, onInput: v => { m = v / G0; o.onInput(m); } });
      }
      o.onInput(m);
    }
    build();
    const ctl = {
      rebuild: build,
      get value() { return m; },
      set value(v) { m = v; build(); },
    };
    massCtls.push(ctl);
    return ctl;
  }
  (function unitSwitch() {
    const el = document.getElementById('mass-unit');
    if (!el) return;
    const paint = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.u === massUnit));
    paint();
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b || b.dataset.u === massUnit) return;
      massUnit = b.dataset.u;
      try { localStorage.setItem('astral-massunit', massUnit); } catch (e) { /* ignora */ }
      paint();
      massCtls.forEach(c => c.rebuild());
    });
  })();

  /* =====================================================
     1. LEVE
     ===================================================== */
  (function leve() {
    const canvas = document.getElementById('c-leve');
    const st = fitCanvas(canvas);
    const out = document.getElementById('out-leve');
    const statusEl = document.getElementById('leve-status');
    const ctl = document.getElementById('ctl-leve');
    const L = 10, g = 9.81, Hf = 1;
    const s = { f: 5, xR: 2, mR: 20, xP: 8, F: 196, th: 0, om: 0 };
    const sl = {};
    const set = (k, v) => { s[k] = v; };
    sl.f = slider(ctl, { label: 'Posizione del fulcro', min: 0, max: 10, step: 0.1, value: s.f, unit: 'm', decimals: 1, onInput: v => set('f', v) });
    sl.xR = slider(ctl, { label: 'Posizione della resistenza', min: 0, max: 10, step: 0.1, value: s.xR, unit: 'm', decimals: 1, onInput: v => set('xR', v) });
    sl.mR = massSlider(ctl, { label: 'Massa della resistenza', wLabel: 'Peso della resistenza R', min: 1, max: 100, step: 1, stepN: 1, value: s.mR, onInput: v => set('mR', v) });
    sl.xP = slider(ctl, { label: 'Posizione della forza motrice', min: 0, max: 10, step: 0.1, value: s.xP, unit: 'm', decimals: 1, onInput: v => set('xP', v) });
    sl.F = slider(ctl, { label: 'Forza motrice F', min: 0, max: 2000, step: 1, value: s.F, unit: 'N', decimals: 0, onInput: v => set('F', v) });
    const sync = () => { for (const k in sl) sl[k].value = s[k]; };

    function calc() {
      const dR = s.xR - s.f, dP = s.xP - s.f;
      const bR = Math.abs(dR), bP = Math.abs(dP);
      const R = s.mR * g;
      const same = Math.sign(dR) === Math.sign(dP) && dR !== 0 && dP !== 0;
      const up = same; // nel 2° e 3° genere la forza motrice spinge verso l'alto
      const tR = -R * dR;
      const tP = (up ? 1 : -1) * s.F * dP;
      let genere = '—';
      if (bR > 1e-9 && bP > 1e-9) {
        if (!same) genere = '1° genere';
        else genere = bR < bP ? '2° genere' : bR > bP ? '3° genere' : '—';
      }
      const Feq = bP > 1e-9 ? R * bR / bP : Infinity;
      const V = bR > 1e-9 ? bP / bR : Infinity;
      const net = tR + tP;
      const tol = 0.005 * Math.max(Math.abs(tR), Math.abs(tP)) + 0.5;
      return { dR, dP, bR, bP, R, up, tR, tP, genere, Feq, V, net, balanced: Math.abs(net) <= tol };
    }

    document.getElementById('leve-eq').addEventListener('click', () => {
      const c = calc();
      if (isFinite(c.Feq)) { s.F = Math.round(c.Feq); sl.F.value = s.F; }
    });
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const p = { 1: { f: 4, xR: 1, xP: 9, mR: 40 }, 2: { f: 0.5, xR: 3, xP: 9.5, mR: 60 }, 3: { f: 0.5, xR: 9.5, xP: 3, mR: 5 } }[b.dataset.preset];
      Object.assign(s, p);
      const c = calc(); s.F = Math.round(c.Feq * 0.8);
      sync();
    }));

    // geometria del disegno
    function geo() {
      const pad = 40;
      const scale = (st.w - 2 * pad) / L;
      const groundY = st.h - 70;
      const pivot = { x: pad + s.f * scale, y: groundY - Math.max(55, Math.min(Hf * scale, st.h * 0.28)) };
      return { pad, scale, groundY, pivot };
    }
    function beamPt(G, x, off) {
      const d = (x - s.f) * G.scale, c = Math.cos(s.th), sn = Math.sin(s.th);
      off = off || 0; // spostamento perpendicolare (verso l'alto)
      return { x: G.pivot.x + d * c - off * sn, y: G.pivot.y - d * sn - off * c };
    }

    // trascinamento
    let drag = null;
    canvas.addEventListener('pointerdown', ev => {
      const p = canvasPos(canvas, ev), G = geo();
      const cand = [
        ['f', G.pivot.x, (G.pivot.y + G.groundY) / 2, 30],
        ['xR', beamPt(G, s.xR, 24).x, beamPt(G, s.xR, 24).y, 30],
        ['xP', beamPt(G, s.xP, 0).x, beamPt(G, s.xP, 0).y + (calc().up ? 40 : -40), 40],
      ];
      let best = null;
      for (const [k, x, y, r] of cand) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < r && (!best || d < best.d)) best = { k, d };
      }
      if (best) { drag = best.k; canvas.setPointerCapture(ev.pointerId); ev.preventDefault(); }
    });
    canvas.addEventListener('pointermove', ev => {
      if (!drag) return;
      const p = canvasPos(canvas, ev), G = geo();
      const x = Math.round(Math.max(0, Math.min(L, (p.x - G.pad) / G.scale)) * 10) / 10;
      s[drag] = x; sl[drag].value = x;
    });
    canvas.addEventListener('pointerup', () => { drag = null; });

    function step(dt) {
      const c = calc();
      // angolo massimo: l'estremità dell'asta tocca terra
      const G = geo();
      const hpx = G.groundY - G.pivot.y;
      const left = Math.max(0.01, s.f * G.scale), right = Math.max(0.01, (L - s.f) * G.scale);
      const maxL = Math.min(20 * DEG, Math.asin(Math.min(1, hpx / left)));
      const maxR = Math.min(20 * DEG, Math.asin(Math.min(1, hpx / right)));
      const target = c.balanced ? 0 : (c.net > 0 ? maxL : -maxR);
      s.om += ((target - s.th) * 40 - s.om * 9) * dt;
      s.th += s.om * dt;
      if (s.th > maxL) { s.th = maxL; s.om = 0; }
      if (s.th < -maxR) { s.th = -maxR; s.om = 0; }
      draw(c);
      // misure
      const status = c.balanced ? ['good', '⚖ La leva è in equilibrio'] :
        (Math.abs(c.tR) > Math.abs(c.tP) ? ['bad', 'Prevale la resistenza'] : ['bad', 'Prevale la forza motrice']);
      statusEl.className = 'status ' + status[0];
      statusEl.textContent = status[1];
      let tipo = '—', cls = '';
      if (isFinite(c.V) && c.genere !== '—') {
        if (Math.abs(c.V - 1) < 1e-9) tipo = 'indifferente';
        else if (c.V > 1) { tipo = 'vantaggiosa'; cls = 'good'; } else { tipo = 'svantaggiosa'; cls = 'bad'; }
      }
      readout(out, [
        ['Tipo di leva', c.genere],
        ['Resistenza R = m·g', fmtNum(c.R, 1) + ' N'],
        ['Braccio resistenza b<sub>R</sub>', fmtNum(c.bR, 1) + ' m'],
        ['Braccio motrice b<sub>F</sub>', fmtNum(c.bP, 1) + ' m'],
        ['Momento resistente R·b<sub>R</sub>', fmtNum(c.R * c.bR, 1) + ' N·m'],
        ['Momento motore F·b<sub>F</sub>', fmtNum(s.F * c.bP, 1) + ' N·m'],
        ['Forza per l\'equilibrio', isFinite(c.Feq) ? fmtNum(c.Feq, 1) + ' N' : '—'],
        ['Vantaggio V = b<sub>F</sub>/b<sub>R</sub>', isFinite(c.V) ? fmtNum(c.V, 2) : '∞'],
        ['La leva è', tipo, cls],
      ]);
    }

    function draw(c) {
      const ctx = clear(st), G = geo();
      ground(ctx, 0, st.w, G.groundY);
      // fulcro
      ctx.save();
      ctx.fillStyle = cssVar('--axis');
      ctx.beginPath();
      const tw = 22;
      ctx.moveTo(G.pivot.x, G.pivot.y);
      ctx.lineTo(G.pivot.x - tw, G.groundY);
      ctx.lineTo(G.pivot.x + tw, G.groundY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // asta
      ctx.save();
      ctx.translate(G.pivot.x, G.pivot.y);
      ctx.rotate(-s.th);
      const x0 = -s.f * G.scale, x1 = (L - s.f) * G.scale;
      ctx.fillStyle = '#b07a43';
      ctx.strokeStyle = '#7a5129';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, -6, x1 - x0, 12, 4); else ctx.rect(x0, -6, x1 - x0, 12);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i <= L; i++) {
        const tx = (i - s.f) * G.scale;
        ctx.fillRect(tx - 0.5, -6, 1, 5);
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(G.pivot.x, G.pivot.y, 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();

      // resistenza (blocco)
      const bs = Math.max(26, Math.min(56, 18 + Math.sqrt(s.mR) * 4));
      const pR = beamPt(G, s.xR, 6);
      ctx.save();
      ctx.translate(pR.x, pR.y); ctx.rotate(-s.th);
      ctx.fillStyle = '#868e96';
      ctx.strokeStyle = '#495057'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-bs / 2, -bs, bs, bs, 4); else ctx.rect(-bs / 2, -bs, bs, bs);
      ctx.fill(); ctx.stroke();
      text(ctx, massLabel(s.mR), 0, -bs / 2, { align: 'center', color: '#fff', size: 12 });
      ctx.restore();
      const cR = beamPt(G, s.xR, -8);
      const lenR = 25 + Math.min(60, c.R / 15);
      arrow(ctx, cR.x, cR.y, cR.x, cR.y + lenR, COL.red, 3);
      text(ctx, 'R', cR.x + 10, cR.y + lenR - 4, { color: COL.red, weight: 700 });

      // forza motrice
      const pP = beamPt(G, s.xP, c.up ? -6 : 6);
      const lenP = s.F > 0 ? 30 + Math.min(70, s.F / 15) : 0;
      if (lenP) {
        if (c.up) arrow(ctx, pP.x, pP.y + lenP, pP.x, pP.y, COL.blue, 3);
        else arrow(ctx, pP.x, pP.y - lenP, pP.x, pP.y, COL.blue, 3);
        text(ctx, 'F', pP.x + 10, c.up ? pP.y + lenP - 6 : pP.y - lenP + 6, { color: COL.blue, weight: 700 });
      }

      // bracci (quote)
      const qy = G.groundY + 26;
      const quote = (xa, xb, color, lab, dy) => {
        if (Math.abs(xb - xa) < 1e-9) return;
        const a = G.pad + xa * G.scale, b = G.pad + xb * G.scale, y = qy + dy;
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y);
        ctx.moveTo(a, y - 5); ctx.lineTo(a, y + 5); ctx.moveTo(b, y - 5); ctx.lineTo(b, y + 5); ctx.stroke();
        ctx.restore();
        text(ctx, lab, (a + b) / 2, y - 9, { align: 'center', color, size: 12 });
      };
      quote(s.f, s.xR, COL.red, `bR = ${fmtNum(c.bR, 1)} m`, 0);
      quote(s.f, s.xP, COL.blue, `bF = ${fmtNum(c.bP, 1)} m`, 28);

      text(ctx, c.genere, 14, 20, { size: 14, weight: 700, color: cssVar('--phys') });
    }
    sims.leve = { step, st };
  })();

  /* =====================================================
     2. PIANO INCLINATO
     ===================================================== */
  (function piano() {
    const canvas = document.getElementById('c-piano');
    const st = fitCanvas(canvas);
    const out = document.getElementById('out-piano');
    const statusEl = document.getElementById('piano-status');
    const ctl = document.getElementById('ctl-piano');
    const g = 9.81, L = 5, blk = 0.7;
    const s = { a: 30, m: 5, mus: 0.3, mud: 0.2, pos: 0, v: 0, t: 0, running: false, done: false };
    const sl = {};
    const reset = () => { s.pos = 0; s.v = 0; s.t = 0; s.running = false; s.done = false; goBtn.textContent = '▶ Avvia'; };
    sl.a = slider(ctl, { label: 'Inclinazione α', min: 0, max: 60, step: 1, value: s.a, unit: '°', decimals: 0, onInput: v => { s.a = v; reset(); } });
    sl.m = massSlider(ctl, { label: 'Massa m', wLabel: 'Peso P', min: 1, max: 50, step: 1, stepN: 1, value: s.m, onInput: v => { s.m = v; } });
    sl.mus = slider(ctl, { label: 'Attrito statico μs', min: 0, max: 1, step: 0.01, value: s.mus, decimals: 2, onInput: v => { s.mus = v; if (s.mud > v) { s.mud = v; sl.mud.value = v; } } });
    sl.mud = slider(ctl, { label: 'Attrito dinamico μd', min: 0, max: 1, step: 0.01, value: s.mud, decimals: 2, onInput: v => { s.mud = v; if (v > s.mus) { s.mus = v; sl.mus.value = v; } } });
    const goBtn = document.getElementById('piano-go');
    goBtn.addEventListener('click', () => {
      if (s.done) reset();
      s.running = !s.running;
      goBtn.textContent = s.running ? '❚❚ Pausa' : '▶ Avvia';
    });
    document.getElementById('piano-reset').addEventListener('click', reset);

    function forces() {
      const a = s.a * DEG, P = s.m * g;
      const Ppar = P * Math.sin(a), Pperp = P * Math.cos(a);
      const moving = s.v > 1e-9;
      const slips = moving || Ppar > s.mus * Pperp + 1e-9;
      const Fa = slips ? s.mud * Pperp : Ppar;
      const acc = slips ? g * (Math.sin(a) - s.mud * Math.cos(a)) : 0;
      return { a, P, Ppar, Pperp, N: Pperp, Fa, acc, slips };
    }

    function step(dt) {
      const F = forces();
      if (s.running && !s.done) {
        if (F.slips) {
          s.v = Math.max(0, s.v + F.acc * dt);
          s.pos += s.v * dt;
          s.t += dt;
          if (s.pos >= L - blk) { s.pos = L - blk; s.done = true; s.running = false; goBtn.textContent = '↺ Di nuovo'; }
        }
      }
      draw(F);
      const lim = Math.atan(s.mus) / DEG;
      statusEl.className = 'status ' + (F.slips ? 'bad' : 'good');
      statusEl.textContent = F.slips ? '↘ Il corpo scivola' : '■ Il corpo resta fermo (attrito statico)';
      readout(out, [
        ['Peso P = mg', fmtNum(F.P, 1) + ' N'],
        ['P∥ = mg sin α', fmtNum(F.Ppar, 1) + ' N'],
        ['P⊥ = N = mg cos α', fmtNum(F.Pperp, 1) + ' N'],
        [F.slips ? 'Attrito dinamico μd·N' : 'Attrito statico', fmtNum(F.Fa, 1) + ' N'],
        ['Attrito statico massimo μs·N', fmtNum(s.mus * F.N, 1) + ' N'],
        ['Angolo limite arctan μs', fmtNum(lim, 1) + '°'],
        ['Accelerazione a', fmtNum(F.slips ? F.acc : 0, 2) + ' m/s²'],
        ['Velocità v', fmtNum(s.v, 2) + ' m/s'],
        ['Spazio percorso', fmtNum(s.pos, 2) + ' m'],
        ['Tempo', fmtNum(s.t, 2) + ' s'],
      ]);
    }

    function draw(F) {
      const ctx = clear(st);
      const a = F.a;
      const pad = 40;
      const scale = Math.min((st.w - 2 * pad - 60) / (L * Math.cos(a)), (st.h - 230) / (L * Math.max(0.01, Math.sin(a))), (st.w - 2 * pad) / 3.2);
      const gy = st.h - 40;
      const Bx = pad + 20 + L * Math.cos(a) * scale;
      const A = { x: pad + 20, y: gy - L * Math.sin(a) * scale };
      const B = { x: Bx, y: gy };
      ground(ctx, 0, st.w, gy);
      // piano
      ctx.save();
      ctx.fillStyle = cssVar('--surface-3');
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(A.x, gy); ctx.lineTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // arco angolo
      ctx.strokeStyle = cssVar('--phys'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(B.x, B.y, 46, Math.PI, Math.PI + a, false); ctx.stroke();
      ctx.restore();
      text(ctx, `α = ${s.a}°`, B.x - 62, B.y - 14, { align: 'right', color: cssVar('--phys'), weight: 700 });

      // blocco
      const u = { x: Math.cos(a), y: Math.sin(a) };      // lungo il piano, verso il basso
      const n = { x: Math.sin(a), y: -Math.cos(a) };     // normale uscente
      const size = blk * scale;
      const base = { x: A.x + u.x * (s.pos + blk / 2) * scale, y: A.y + u.y * (s.pos + blk / 2) * scale };
      const C = { x: base.x + n.x * size / 2, y: base.y + n.y * size / 2 };
      ctx.save();
      ctx.translate(C.x, C.y); ctx.rotate(a);
      ctx.fillStyle = COL.blue; ctx.globalAlpha = 0.85;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0b4f91'; ctx.lineWidth = 1.5; ctx.strokeRect(-size / 2, -size / 2, size, size);
      text(ctx, massLabel(s.m), 0, 0, { align: 'center', color: '#fff', size: 12 });
      ctx.restore();

      // vettori forza
      const k = 90 / F.P;
      const vec = (dx, dy, mag, color, lab, dash) => {
        if (mag < 1e-6) return;
        if (dash) {
          ctx.save(); ctx.setLineDash([5, 4]);
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.lineTo(C.x + dx * mag * k, C.y + dy * mag * k); ctx.stroke();
          ctx.restore();
          ctx.beginPath(); ctx.arc(C.x + dx * mag * k, C.y + dy * mag * k, 3, 0, 7); ctx.fillStyle = color; ctx.fill();
          text(ctx, lab, C.x + dx * mag * k + 6, C.y + dy * mag * k + 10, { color, size: 12 });
        } else arrow(ctx, C.x, C.y, C.x + dx * mag * k, C.y + dy * mag * k, color, 3, lab);
      };
      vec(u.x, u.y, F.Ppar, COL.red, 'P∥', true);
      vec(-n.x, -n.y, F.Pperp, COL.red, 'P⊥', true);
      vec(0, 1, F.P, COL.red, 'P');
      vec(n.x, n.y, F.N, COL.green, 'N');
      vec(-u.x, -u.y, F.Fa, COL.orange, 'Fa');
      text(ctx, 'Forze sul corpo', 14, 20, { size: 13, color: cssVar('--muted') });
    }
    sims.piano = { step, st };
  })();

  /* =====================================================
     3. MOTO PARABOLICO
     ===================================================== */
  (function proiettile() {
    const canvas = document.getElementById('c-proiettile');
    const st = fitCanvas(canvas);
    const out = document.getElementById('out-proiettile');
    const ctl = document.getElementById('ctl-proiettile');
    const vecBox = document.getElementById('proj-vec');
    const s = { v0: 20, ang: 45, h0: 0, g: 9.81, fly: null, trails: [] };
    const TRAIL_COLORS = [COL.blue, COL.green, COL.purple, COL.orange, COL.teal, COL.red];
    slider(ctl, { label: 'Velocità iniziale v₀', min: 1, max: 50, step: 0.5, value: s.v0, unit: 'm/s', decimals: 1, onInput: v => { s.v0 = v; } });
    slider(ctl, { label: 'Angolo di lancio θ', min: 0, max: 90, step: 1, value: s.ang, unit: '°', decimals: 0, onInput: v => { s.ang = v; } });
    slider(ctl, { label: 'Altezza iniziale h₀', min: 0, max: 50, step: 1, value: s.h0, unit: 'm', decimals: 0, onInput: v => { s.h0 = v; } });
    segButtons('proj-g', b => { s.g = +b.dataset.g; });
    let view = null;

    function analytic(v0, ang, h0, g) {
      const vx = v0 * Math.cos(ang * DEG), vy = v0 * Math.sin(ang * DEG);
      const T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
      return { vx, vy, T, R: vx * T, H: h0 + vy * vy / (2 * g), tH: vy / g, v0, ang, h0, g };
    }
    document.getElementById('proj-fire').addEventListener('click', () => {
      const a = analytic(s.v0, s.ang, s.h0, s.g);
      if (!(a.T > 0)) return;
      s.fly = { a, t: 0, color: TRAIL_COLORS[s.trails.length % TRAIL_COLORS.length], pts: [] };
      s.fly.speed = Math.max(1, a.T / 3.5);
    });
    document.getElementById('proj-clear').addEventListener('click', () => { s.trails = []; });

    function computeView(cur) {
      let xm = Math.max(10, cur.R), ym = Math.max(5, cur.H);
      for (const t of s.trails) { xm = Math.max(xm, t.a.R); ym = Math.max(ym, t.a.H); }
      if (s.fly) { xm = Math.max(xm, s.fly.a.R); ym = Math.max(ym, s.fly.a.H); }
      const padL = 56, padB = 36, padT = 30, padR = 30;
      const scale = Math.min((st.w - padL - padR) / (xm * 1.08), (st.h - padB - padT) / (ym * 1.15));
      return { padL, padB, scale, ox: padL, oy: st.h - padB };
    }

    function step(dt) {
      const cur = analytic(s.v0, s.ang, s.h0, s.g);
      const target = computeView(cur);
      if (!view) view = target;
      view.scale += (target.scale - view.scale) * Math.min(1, dt * 6);
      view.ox = target.ox; view.oy = target.oy;
      let live = null;
      if (s.fly) {
        const f = s.fly;
        f.t = Math.min(f.a.T, f.t + dt * f.speed);
        const x = f.a.vx * f.t, y = f.a.h0 + f.a.vy * f.t - 0.5 * f.a.g * f.t * f.t;
        f.pts.push([x, Math.max(0, y)]);
        live = { t: f.t, x, y: Math.max(0, y), vx: f.a.vx, vy: f.a.vy - f.a.g * f.t };
        if (f.t >= f.a.T) {
          s.trails.push({ a: f.a, color: f.color, pts: f.pts });
          if (s.trails.length > 6) s.trails.shift();
          s.fly = null;
        }
      }
      draw(cur, live);
      const r = [
        ['Componente v₀x', fmtNum(cur.vx, 2) + ' m/s'],
        ['Componente v₀y', fmtNum(cur.vy, 2) + ' m/s'],
        ['Tempo di volo', fmtNum(cur.T, 2) + ' s'],
        ['Gittata', fmtNum(cur.R, 2) + ' m'],
        ['Altezza massima', fmtNum(cur.H, 2) + ' m'],
      ];
      if (live) {
        r.push(['— in volo: t', fmtNum(live.t, 2) + ' s'], ['x', fmtNum(live.x, 2) + ' m'], ['y', fmtNum(live.y, 2) + ' m'],
          ['|v|', fmtNum(Math.hypot(live.vx, live.vy), 2) + ' m/s']);
        if (s.fly && s.fly.speed > 1.05) r.push(['Velocità animazione', '×' + fmtNum(s.fly.speed, 1)]);
      }
      readout(out, r);
    }

    function draw(cur, live) {
      const ctx = clear(st), V = view;
      const X = x => V.ox + x * V.scale, Y = y => V.oy - y * V.scale;
      // griglia in metri
      const stp = window.Plot ? window.Plot.niceStep(V.scale, 70).major : niceStepLocal(V.scale);
      ctx.save();
      ctx.strokeStyle = cssVar('--grid-minor'); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; X(x) < st.w; x += stp) { ctx.moveTo(X(x) + 0.5, 0); ctx.lineTo(X(x) + 0.5, V.oy); }
      for (let y = 0; Y(y) > 0; y += stp) { ctx.moveTo(V.ox, Y(y) + 0.5); ctx.lineTo(st.w, Y(y) + 0.5); }
      ctx.stroke();
      ctx.restore();
      for (let x = 0; X(x) < st.w - 10; x += stp) text(ctx, fmtNum(x, 1), X(x), V.oy + 16, { align: 'center', size: 11, weight: 500, color: cssVar('--muted') });
      for (let y = stp; Y(y) > 10; y += stp) text(ctx, fmtNum(y, 1), V.ox - 8, Y(y), { align: 'right', size: 11, weight: 500, color: cssVar('--muted') });
      text(ctx, 'm', st.w - 14, V.oy + 16, { size: 11, color: cssVar('--muted') });
      ground(ctx, 0, st.w, V.oy);
      // piattaforma
      if (cur.h0 > 0) {
        ctx.fillStyle = cssVar('--surface-3');
        ctx.fillRect(X(0) - 18, Y(cur.h0), 18, V.oy - Y(cur.h0));
      }
      // traiettoria prevista
      ctx.save();
      ctx.setLineDash([6, 6]); ctx.strokeStyle = cssVar('--muted'); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = cur.T * i / 80;
        const x = cur.vx * t, y = cur.h0 + cur.vy * t - 0.5 * cur.g * t * t;
        if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(Math.max(0, y)));
      }
      ctx.stroke();
      ctx.restore();
      // tracce
      const drawTrail = (tr) => {
        ctx.save(); ctx.strokeStyle = tr.color; ctx.lineWidth = 2.5; ctx.beginPath();
        tr.pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); });
        ctx.stroke(); ctx.restore();
      };
      for (const tr of s.trails) {
        drawTrail(tr);
        const a = tr.a;
        ctx.beginPath(); ctx.arc(X(a.vx * a.tH), Y(a.H), 4, 0, 7); ctx.fillStyle = tr.color; ctx.fill();
        text(ctx, `${fmtNum(a.R, 1)} m`, X(a.R), V.oy - 12, { align: 'center', size: 11, color: tr.color });
      }
      if (s.fly) drawTrail(s.fly);
      // cannone
      ctx.save();
      ctx.translate(X(0), Y(cur.h0));
      ctx.rotate(-cur.ang * DEG);
      ctx.fillStyle = cssVar('--axis');
      ctx.fillRect(-6, -7, 42, 14);
      ctx.restore();
      ctx.beginPath(); ctx.arc(X(0), Y(cur.h0), 12, 0, 7); ctx.fillStyle = cssVar('--phys'); ctx.fill();
      // proiettile
      if (live) {
        const px = X(live.x), py = Y(live.y);
        if (vecBox.checked) {
          const k = 2.2;
          arrow(ctx, px, py, px + live.vx * k, py, COL.blue, 2, 'vx');
          arrow(ctx, px, py, px, py - live.vy * k, COL.green, 2, 'vy');
          arrow(ctx, px, py, px + live.vx * k, py - live.vy * k, COL.red, 2.5, 'v');
        }
        ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fillStyle = s.fly.color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    function niceStepLocal(scale) { const raw = 70 / scale, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
    sims.proiettile = { step, st };
  })();

  /* =====================================================
     4. PENDOLO
     ===================================================== */
  (function pendolo() {
    const canvas = document.getElementById('c-pendolo');
    const st = fitCanvas(canvas);
    const out = document.getElementById('out-pendolo');
    const ctl = document.getElementById('ctl-pendolo');
    const s = { L: 1.5, th0: 30, b: 0, m: 1, g: 9.81, th: 30 * DEG, om: 0, t: 0, running: true, data: [], lastCross: null, Tmeas: null };
    const playBtn = document.getElementById('pend-play');
    const reset = () => { s.th = s.th0 * DEG; s.om = 0; s.t = 0; s.data = []; s.lastCross = null; s.Tmeas = null; };
    slider(ctl, { label: 'Lunghezza L', min: 0.2, max: 3, step: 0.05, value: s.L, unit: 'm', decimals: 2, onInput: v => { s.L = v; s.Tmeas = null; s.lastCross = null; } });
    const thSl = slider(ctl, { label: 'Angolo iniziale θ₀', min: 5, max: 170, step: 1, value: s.th0, unit: '°', decimals: 0, onInput: v => { s.th0 = v; reset(); } });
    massSlider(ctl, { label: 'Massa m', wLabel: 'Peso P (sulla Terra)', min: 0.1, max: 5, step: 0.1, stepN: 0.1, value: s.m, onInput: v => { s.m = v; } });
    slider(ctl, { label: 'Smorzamento (attrito dell\'aria)', min: 0, max: 0.5, step: 0.01, value: s.b, unit: '1/s', decimals: 2, onInput: v => { s.b = v; } });
    segButtons('pend-g', b => { s.g = +b.dataset.g; s.Tmeas = null; s.lastCross = null; });
    playBtn.addEventListener('click', () => { s.running = !s.running; playBtn.textContent = s.running ? '❚❚ Pausa' : '▶ Avvia'; });
    document.getElementById('pend-reset').addEventListener('click', reset);

    const acc = (th, om) => -(s.g / s.L) * Math.sin(th) - s.b * om;
    function integrate(dt) {
      const n = 8, h = dt / n;
      for (let i = 0; i < n; i++) {
        const th = s.th, om = s.om;
        const k1t = om, k1o = acc(th, om);
        const k2t = om + k1o * h / 2, k2o = acc(th + k1t * h / 2, om + k1o * h / 2);
        const k3t = om + k2o * h / 2, k3o = acc(th + k2t * h / 2, om + k2o * h / 2);
        const k4t = om + k3o * h, k4o = acc(th + k3t * h, om + k3o * h);
        s.th += (k1t + 2 * k2t + 2 * k3t + k4t) * h / 6;
        s.om += (k1o + 2 * k2o + 2 * k3o + k4o) * h / 6;
        const prevT = s.t;
        s.t += h;
        // misura del periodo: passaggio per lo zero con velocità positiva
        if (th < 0 && s.th >= 0) {
          const tc = prevT + h * (-th) / (s.th - th);
          if (s.lastCross !== null) s.Tmeas = tc - s.lastCross;
          s.lastCross = tc;
        }
      }
    }

    function geo() {
      const chartH = Math.max(90, st.h * 0.28);
      const topH = st.h - chartH - 10;
      const pivot = { x: st.w * 0.42, y: topH * 0.36 };
      const scale = Math.min(topH * 0.58, st.w * 0.36) / Math.max(1.5, s.L);
      return { chartH, topH, pivot, scale };
    }
    let dragging = false;
    canvas.addEventListener('pointerdown', ev => {
      const p = canvasPos(canvas, ev), G = geo();
      const bx = G.pivot.x + Math.sin(s.th) * s.L * G.scale, by = G.pivot.y + Math.cos(s.th) * s.L * G.scale;
      if (Math.hypot(p.x - bx, p.y - by) < 30) { dragging = true; canvas.setPointerCapture(ev.pointerId); }
    });
    canvas.addEventListener('pointermove', ev => {
      if (!dragging) return;
      const p = canvasPos(canvas, ev), G = geo();
      let th = Math.atan2(p.x - G.pivot.x, p.y - G.pivot.y);
      th = Math.max(-170 * DEG, Math.min(170 * DEG, th));
      s.th = th; s.om = 0; s.th0 = Math.round(Math.abs(th) / DEG); thSl.value = s.th0;
      s.data = []; s.lastCross = null; s.Tmeas = null; s.t = 0;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });

    function step(dt) {
      if (s.running && !dragging) {
        integrate(dt);
        s.data.push({ t: s.t, th: s.th / DEG });
        while (s.data.length && s.data[0].t < s.t - 10.5) s.data.shift();
      }
      const G = geo();
      const ctx = clear(st);
      const bx = G.pivot.x + Math.sin(s.th) * s.L * G.scale, by = G.pivot.y + Math.cos(s.th) * s.L * G.scale;
      // supporto
      ctx.fillStyle = cssVar('--axis');
      ctx.fillRect(G.pivot.x - 50, G.pivot.y - 8, 100, 6);
      // verticale
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = cssVar('--grid-major'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(G.pivot.x, G.pivot.y); ctx.lineTo(G.pivot.x, G.pivot.y + s.L * G.scale + 30); ctx.stroke(); ctx.restore();
      // arco dell'angolo
      ctx.save(); ctx.strokeStyle = cssVar('--phys'); ctx.lineWidth = 2;
      ctx.beginPath();
      const r = Math.max(4, Math.min(50, s.L * G.scale * 0.5));
      ctx.arc(G.pivot.x, G.pivot.y, r, Math.PI / 2, Math.PI / 2 - s.th, s.th > 0);
      ctx.stroke(); ctx.restore();
      text(ctx, `θ = ${fmtNum(s.th / DEG, 1)}°`, G.pivot.x + (s.th > 0 ? 12 : -12), G.pivot.y + r + 16, { align: s.th > 0 ? 'left' : 'right', color: cssVar('--phys'), size: 12 });
      text(ctx, `L = ${fmtNum(s.L, 2)} m`, G.pivot.x + 58, G.pivot.y - 18, { size: 12, color: cssVar('--muted') });
      // filo e massa
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(G.pivot.x, G.pivot.y); ctx.lineTo(bx, by); ctx.stroke();
      const br = 9 + Math.cbrt(s.m) * 7;
      const grad = ctx.createRadialGradient(bx - br / 3, by - br / 3, 2, bx, by, br);
      grad.addColorStop(0, '#ffb37a'); grad.addColorStop(1, '#d9480f');
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.arc(G.pivot.x, G.pivot.y, 4, 0, 7); ctx.fillStyle = cssVar('--axis'); ctx.fill();
      // energia
      const v = s.om * s.L;
      const Ek = 0.5 * s.m * v * v, Ep = s.m * s.g * s.L * (1 - Math.cos(s.th));
      const Emax = s.m * s.g * s.L * (1 - Math.cos(s.th0 * DEG)) * 1.02 + 1e-9;
      const ex = st.w - 120;
      text(ctx, 'Energia', ex, 18, { size: 12, color: cssVar('--muted') });
      energyBars(ctx, ex, 30, 110, Math.min(170, G.topH - 40), [
        { label: 'Ec', value: Ek, color: COL.red }, { label: 'Ep', value: Ep, color: COL.blue }, { label: 'Tot', value: Ek + Ep, color: COL.green },
      ], Emax);
      // grafico
      stripChart(ctx, 10, st.h - G.chartH - 6, st.w - 20, G.chartH, s.data, 'th', COL.purple, 'θ(t)', '°');

      const T0 = 2 * Math.PI * Math.sqrt(s.L / s.g);
      readout(out, [
        ['Periodo (piccole osc.) 2π√(L/g)', fmtNum(T0, 3) + ' s'],
        ['Periodo misurato', s.Tmeas ? fmtNum(s.Tmeas, 3) + ' s' : 'in misura…'],
        ['Frequenza misurata', s.Tmeas ? fmtNum(1 / s.Tmeas, 3) + ' Hz' : '—'],
        ['Angolo θ', fmtNum(s.th / DEG, 1) + '°'],
        ['Velocità della massa', fmtNum(Math.abs(v), 2) + ' m/s'],
        ['Energia cinetica', fmtNum(Ek, 3) + ' J'],
        ['Energia potenziale', fmtNum(Ep, 3) + ' J'],
        ['Energia totale', fmtNum(Ek + Ep, 3) + ' J'],
        ['Tempo', fmtNum(s.t, 1) + ' s'],
      ]);
    }
    sims.pendolo = { step, st };
  })();

  /* =====================================================
     5. MOLLA
     ===================================================== */
  (function molla() {
    const canvas = document.getElementById('c-molla');
    const st = fitCanvas(canvas);
    const out = document.getElementById('out-molla');
    const ctl = document.getElementById('ctl-molla');
    const s = { k: 40, m: 1, A: 0.3, b: 0, x: 0.3, v: 0, t: 0, running: true, data: [] };
    const playBtn = document.getElementById('molla-play');
    const reset = () => { s.x = s.A; s.v = 0; s.t = 0; s.data = []; };
    slider(ctl, { label: 'Costante elastica k', min: 5, max: 200, step: 1, value: s.k, unit: 'N/m', decimals: 0, onInput: v => { s.k = v; } });
    massSlider(ctl, { label: 'Massa m', wLabel: 'Peso P (sulla Terra)', min: 0.2, max: 5, step: 0.1, stepN: 0.1, value: s.m, onInput: v => { s.m = v; } });
    const aSl = slider(ctl, { label: 'Allungamento iniziale', min: -0.5, max: 0.5, step: 0.01, value: s.A, unit: 'm', decimals: 2, onInput: v => { s.A = v; reset(); } });
    slider(ctl, { label: 'Smorzamento b', min: 0, max: 3, step: 0.05, value: s.b, unit: 'kg/s', decimals: 2, onInput: v => { s.b = v; } });
    playBtn.addEventListener('click', () => { s.running = !s.running; playBtn.textContent = s.running ? '❚❚ Pausa' : '▶ Avvia'; });
    document.getElementById('molla-reset').addEventListener('click', reset);

    function geo() {
      const chartH = Math.max(90, st.h * 0.3);
      const topH = st.h - chartH - 10;
      const wallX = 30;
      const scale = (st.w - wallX - 60) / 1.6;      // px per metro
      const eqX = wallX + 0.8 * scale;
      const floorY = topH * 0.72;
      return { chartH, topH, wallX, scale, eqX, floorY };
    }
    let dragging = false;
    canvas.addEventListener('pointerdown', ev => {
      const p = canvasPos(canvas, ev), G = geo();
      const bx = G.eqX + s.x * G.scale;
      if (Math.abs(p.x - bx) < 40 && Math.abs(p.y - (G.floorY - 25)) < 45) { dragging = true; canvas.setPointerCapture(ev.pointerId); }
    });
    canvas.addEventListener('pointermove', ev => {
      if (!dragging) return;
      const p = canvasPos(canvas, ev), G = geo();
      s.x = Math.max(-0.5, Math.min(0.5, (p.x - G.eqX) / G.scale));
      s.A = Math.round(s.x * 100) / 100; aSl.value = s.A;
      s.v = 0; s.t = 0; s.data = [];
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });

    function step(dt) {
      if (s.running && !dragging) {
        const n = 10, h = dt / n;
        for (let i = 0; i < n; i++) {
          const a = (-s.k * s.x - s.b * s.v) / s.m;
          s.v += a * h;           // Eulero simplettico: conserva bene l'energia
          s.x += s.v * h;
          s.t += h;
        }
        s.data.push({ t: s.t, x: s.x });
        while (s.data.length && s.data[0].t < s.t - 10.5) s.data.shift();
      }
      const G = geo(), ctx = clear(st);
      const bw = 56, bh = 50;
      const bx = G.eqX + s.x * G.scale;
      // muro e pavimento
      ctx.fillStyle = cssVar('--surface-3');
      ctx.fillRect(0, G.floorY - 120, G.wallX, 120);
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(G.wallX, G.floorY - 120); ctx.lineTo(G.wallX, G.floorY); ctx.stroke();
      ground(ctx, 0, st.w, G.floorY);
      // equilibrio
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = cssVar('--muted'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(G.eqX, G.floorY - 110); ctx.lineTo(G.eqX, G.floorY + 6); ctx.stroke(); ctx.restore();
      text(ctx, 'x = 0', G.eqX, G.floorY + 20, { align: 'center', size: 11, color: cssVar('--muted') });
      // scala in cm
      for (let c = -50; c <= 50; c += 10) {
        const px = G.eqX + c / 100 * G.scale;
        ctx.fillStyle = cssVar('--muted'); ctx.fillRect(px, G.floorY + 2, 1, c % 50 === 0 ? 8 : 4);
        if (c % 50 === 0 && c !== 0) text(ctx, `${c} cm`, px, G.floorY + 20, { align: 'center', size: 11, weight: 500, color: cssVar('--muted') });
      }
      // molla a zig-zag
      const sy = G.floorY - bh / 2;
      const x0 = G.wallX, x1 = bx - bw / 2;
      const coils = 14, amp = 12;
      ctx.strokeStyle = cssVar('--phys'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x0, sy);
      const lead = 12;
      ctx.lineTo(x0 + lead, sy);
      const seg = (x1 - x0 - 2 * lead) / (coils * 2);
      for (let i = 0; i < coils * 2; i++) ctx.lineTo(x0 + lead + seg * (i + 0.5), sy + (i % 2 ? amp : -amp));
      ctx.lineTo(x1 - lead, sy); ctx.lineTo(x1, sy);
      ctx.stroke();
      // blocco
      ctx.fillStyle = COL.blue;
      ctx.fillRect(bx - bw / 2, G.floorY - bh, bw, bh);
      text(ctx, massLabel(s.m), bx, G.floorY - bh / 2, { align: 'center', color: '#fff', size: 12 });
      // forza elastica
      const F = -s.k * s.x;
      if (Math.abs(F) > 0.05) {
        const len = Math.max(-120, Math.min(120, F * 2.5));
        arrow(ctx, bx, G.floorY - bh - 18, bx + len, G.floorY - bh - 18, COL.red, 3);
        text(ctx, `F = ${fmtNum(F, 1)} N`, bx + len / 2, G.floorY - bh - 34, { align: 'center', color: COL.red, size: 12 });
      }
      // energia
      const Ek = 0.5 * s.m * s.v * s.v, Ep = 0.5 * s.k * s.x * s.x;
      const Emax = 0.5 * s.k * s.A * s.A * 1.02 + 1e-9;
      text(ctx, 'Energia', st.w - 120, 18, { size: 12, color: cssVar('--muted') });
      energyBars(ctx, st.w - 120, 30, 110, Math.min(110, G.floorY - 160 > 60 ? G.floorY - 160 : 100), [
        { label: 'Ec', value: Ek, color: COL.red }, { label: 'Ep', value: Ep, color: COL.blue }, { label: 'Tot', value: Ek + Ep, color: COL.green },
      ], Emax);
      stripChart(ctx, 10, st.h - G.chartH - 6, st.w - 20, G.chartH, s.data, 'x', COL.blue, 'x(t)', 'm');

      const w = Math.sqrt(s.k / s.m);
      readout(out, [
        ['Periodo T = 2π√(m/k)', fmtNum(2 * Math.PI / w, 3) + ' s'],
        ['Frequenza f = 1/T', fmtNum(w / (2 * Math.PI), 3) + ' Hz'],
        ['Pulsazione ω = √(k/m)', fmtNum(w, 3) + ' rad/s'],
        ['Posizione x', fmtNum(s.x * 100, 1) + ' cm'],
        ['Velocità v', fmtNum(s.v, 2) + ' m/s'],
        ['Accelerazione a', fmtNum((F - s.b * s.v) / s.m, 2) + ' m/s²'],
        ['Forza elastica F = −kx', fmtNum(F, 2) + ' N'],
        ['Energia cinetica ½mv²', fmtNum(Ek, 3) + ' J'],
        ['Energia elastica ½kx²', fmtNum(Ep, 3) + ' J'],
        ['Energia totale', fmtNum(Ek + Ep, 3) + ' J'],
      ]);
    }
    sims.molla = { step, st };
  })();

  /* ---------- Ciclo principale ---------- */
  App.setupTabs(document.getElementById('tabs'), name => { active = name; });
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (active && sims[active] && sims[active].st.w > 0 && sims[active].st.h > 0) sims[active].step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
