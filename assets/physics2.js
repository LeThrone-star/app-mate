/* =========================================================
   Laboratorio di Fisica — simulazioni aggiuntive e schede a gruppi
   (moto circolare, urti, orbite, onde, Archimede, gas, calorimetria,
    ottica, cariche elettriche, circuiti)
   ========================================================= */
(function () {
  'use strict';
  const K = window.PhysKit;
  const { sims, COL, DEG, readout, clear, text, ground, canvasPos } = K;
  const { slider, fmtNum, arrow, cssVar, fitCanvas } = window.App;
  const TAU = Math.PI * 2;
  const font = () => getComputedStyle(document.body).fontFamily;

  /* ---------- Schede raggruppate ---------- */
  const GROUPS = [
    ['Meccanica', [['leve', 'Leve'], ['piano', 'Piano inclinato'], ['proiettile', 'Moto parabolico'], ['circolare', 'Moto circolare'], ['urti', 'Urti'], ['orbite', 'Orbite e Keplero']]],
    ['Oscillazioni e onde', [['pendolo', 'Pendolo'], ['molla', 'Molla'], ['onde', 'Onde']]],
    ['Fluidi e calore', [['archimede', 'Archimede'], ['gas', 'Gas perfetti'], ['calore', 'Calorimetria']]],
    ['Ottica', [['ottica', 'Rifrazione e lenti']]],
    ['Elettricità', [['cariche', 'Campo elettrico'], ['circuiti', 'Circuiti']]],
  ];
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = GROUPS.map(([g, list]) =>
    `<div class="tab-group"><span class="tab-label">${g}</span>${list.map(([id, l]) => `<button data-tab="${id}">${l}</button>`).join('')}</div>`).join('');

  /* ---------- Costruzione di un pannello ---------- */
  const anchor = document.querySelector('main [data-panel="molla"]');
  let lastPanel = anchor;
  function panel(id, title, theory, extra) {
    const sec = document.createElement('section');
    sec.dataset.panel = id;
    sec.innerHTML = `
      <div class="lab">
        <div class="card stage"><canvas id="c-${id}" aria-label="${title}"></canvas></div>
        <div class="side">
          <div class="card pad"><h3>Parametri</h3>${extra && extra.top ? extra.top : ''}<div id="ctl-${id}"></div>${extra && extra.bottom ? extra.bottom : ''}</div>
          <div class="card pad"><h3>Misure</h3><div class="status hidden" id="st-${id}"></div><dl class="readout mt" id="out-${id}"></dl></div>
        </div>
      </div>
      <div class="card pad mt theory-box">${theory}</div>`;
    lastPanel.after(sec);
    lastPanel = sec;
    const canvas = sec.querySelector('canvas');
    return {
      canvas, st: fitCanvas(canvas),
      ctl: sec.querySelector('#ctl-' + id),
      out: sec.querySelector('#out-' + id),
      setStatus(cls, msg) {
        const el = sec.querySelector('#st-' + id);
        el.className = 'status ' + (msg ? cls : 'hidden');
        el.textContent = msg || '';
      },
      q: sel => sec.querySelector(sel),
    };
  }
  function seg(id, items, active) {
    return `<div class="ctrl"><div class="seg" id="${id}">${items.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === active ? 'active' : ''}">${l}</button>`).join('')}</div></div>`;
  }
  function onSeg(root, id, fn) {
    const el = root.q('#' + id);
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      fn(b.dataset.v);
    });
  }
  function btns(html) { return `<div class="btn-row mt">${html}</div>`; }
  const disable = (sl, v) => { sl.el.querySelector('input').disabled = v; sl.el.style.opacity = v ? .5 : 1; };
  const link = (hash, label) => `<a href="teoria.html#${hash}">${label || 'Approfondisci nella teoria →'}</a>`;

  /* =====================================================
     MOTO CIRCOLARE UNIFORME
     ===================================================== */
  (function circolare() {
    const P = panel('circolare', 'Moto circolare uniforme', `
      <h3>Il moto circolare uniforme</h3>
      <p>Un corpo che gira su una circonferenza con velocità costante in modulo ha comunque un'<b>accelerazione</b>: la velocità cambia direzione. Questa accelerazione punta sempre verso il centro (<b>centripeta</b>) e richiede una forza, qui la tensione del filo. Se tagli il filo, il corpo prosegue in linea retta lungo la tangente: è il principio d'inerzia.</p>
      <div class="formula">$$\\omega = \\frac{2\\pi}{T} \\qquad v = \\omega r \\qquad a_c = \\frac{v^2}{r} = \\omega^2 r \\qquad F_c = m\\,\\frac{v^2}{r}$$</div>
      ${link('moto-circolare')}`, { bottom: btns('<button class="btn phys small" id="circ-cut" type="button">✂ Taglia il filo</button><button class="btn small" id="circ-reset" type="button">↺ Ricomincia</button>') });
    const s = { r: 2, T: 3, m: 1, th: 0, cut: false, p: null, v: null, laps: 0 };
    slider(P.ctl, { label: 'Raggio r', min: 0.5, max: 5, step: 0.1, value: s.r, unit: 'm', decimals: 1, onInput: v => { s.r = v; } });
    slider(P.ctl, { label: 'Periodo T (un giro)', min: 0.5, max: 10, step: 0.1, value: s.T, unit: 's', decimals: 1, onInput: v => { s.T = v; } });
    K.massSlider(P.ctl, { label: 'Massa m', wLabel: 'Peso P', min: 0.1, max: 5, step: 0.1, stepN: 0.1, value: s.m, onInput: v => { s.m = v; } });
    const cutBtn = P.q('#circ-cut');
    cutBtn.addEventListener('click', () => {
      if (s.cut) return;
      const w = TAU / s.T;
      s.cut = true;
      s.p = [s.r * Math.cos(s.th), s.r * Math.sin(s.th)];
      s.v = [-w * s.r * Math.sin(s.th), w * s.r * Math.cos(s.th)];
      cutBtn.disabled = true;
    });
    P.q('#circ-reset').addEventListener('click', () => { s.cut = false; s.th = 0; s.laps = 0; cutBtn.disabled = false; });

    function step(dt) {
      const st = P.st, ctx = clear(st);
      const w = TAU / s.T, v = w * s.r, ac = v * v / s.r;
      if (!s.cut) {
        const prev = s.th;
        s.th += w * dt;
        if (Math.floor(s.th / TAU) > Math.floor(prev / TAU)) s.laps++;
      } else {
        s.p[0] += s.v[0] * dt; s.p[1] += s.v[1] * dt;
      }
      const cx = st.w / 2, cy = st.h / 2, sc = Math.min(st.w, st.h) * 0.36 / Math.max(1.5, s.r);
      const X = x => cx + x * sc, Y = y => cy - y * sc;
      // traiettoria
      ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = cssVar('--grid-major'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, s.r * sc, 0, TAU); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fillStyle = cssVar('--axis'); ctx.fill();
      let px, py, vx, vy;
      if (!s.cut) {
        px = s.r * Math.cos(s.th); py = s.r * Math.sin(s.th);
        vx = -v * Math.sin(s.th); vy = v * Math.cos(s.th);
        ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X(px), Y(py)); ctx.stroke();
        // accelerazione centripeta
        const la = Math.min(110, 14 + ac * 1.4);
        const ux = -px / s.r, uy = -py / s.r;
        arrow(ctx, X(px), Y(py), X(px) + ux * la, Y(py) - uy * la, COL.green, 3, 'ac');
      } else {
        [px, py] = s.p; [vx, vy] = s.v;
        ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = COL.orange; ctx.lineWidth = 1.5;
        const back = 50;
        ctx.beginPath(); ctx.moveTo(X(px - vx / v * back), Y(py - vy / v * back)); ctx.lineTo(X(px), Y(py)); ctx.stroke(); ctx.restore();
      }
      const lv = Math.min(120, 14 + v * 4);
      arrow(ctx, X(px), Y(py), X(px) + vx / v * lv, Y(py) - vy / v * lv, COL.red, 3, 'v');
      const br = 8 + Math.cbrt(s.m) * 6;
      ctx.beginPath(); ctx.arc(X(px), Y(py), br, 0, TAU); ctx.fillStyle = COL.blue; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, `r = ${fmtNum(s.r, 1)} m`, cx + 8, cy + 16, { size: 12, color: cssVar('--muted') });
      if (s.cut && (X(px) < -30 || X(px) > st.w + 30 || Y(py) < -30 || Y(py) > st.h + 30)) { s.cut = false; s.th = 0; cutBtn.disabled = false; }
      P.setStatus('good', s.cut ? 'Filo tagliato: senza forza centripeta il corpo va dritto lungo la tangente.' : '');
      readout(P.out, [
        ['Velocità angolare ω = 2π/T', fmtNum(w, 3) + ' rad/s'],
        ['Frequenza f = 1/T', fmtNum(1 / s.T, 3) + ' Hz'],
        ['Velocità v = ωr', fmtNum(v, 2) + ' m/s'],
        ['Accel. centripeta v²/r', fmtNum(ac, 2) + ' m/s²'],
        ['Forza centripeta m·v²/r', fmtNum(s.m * ac, 2) + ' N'],
        ['Giri completati', String(s.laps)],
      ]);
    }
    sims.circolare = { step, st: P.st };
  })();

  /* =====================================================
     URTI
     ===================================================== */
  (function urti() {
    const P = panel('urti', 'Urti tra carrelli', `
      <h3>Quantità di moto e urti</h3>
      <p>In un urto tra due corpi isolati la <b>quantità di moto totale si conserva</b> sempre. L'energia cinetica invece si conserva solo negli urti <b>elastici</b>; negli urti <b>anelastici</b> una parte si trasforma in calore e deformazione. Nell'urto <b>completamente anelastico</b> i corpi restano attaccati.</p>
      <div class="formula">$$p = mv \\qquad m_1v_1 + m_2v_2 = m_1v_1' + m_2v_2' \\qquad e = \\frac{v_2' - v_1'}{v_1 - v_2}$$</div>
      ${link('urti')}`, {
      top: seg('urti-type', [['1', 'Elastico'], ['0.5', 'Parz. anelastico'], ['0', 'Compl. anelastico']], '1'),
      bottom: btns('<button class="btn phys small" id="urti-go" type="button">▶ Avvia</button><button class="btn small" id="urti-reset" type="button">↺ Ripristina</button>'),
    });
    const s = { m1: 2, m2: 1, v1: 2, v2: -1, e: 1, x1: 2, x2: 7, u1: 0, u2: 0, run: false, hit: false };
    const reset = () => { s.x1 = 2; s.x2 = 7; s.u1 = s.v1; s.u2 = s.v2; s.run = false; s.hit = false; goBtn.textContent = '▶ Avvia'; };
    K.massSlider(P.ctl, { label: 'Massa carrello A', wLabel: 'Peso carrello A', min: 0.5, max: 5, step: 0.1, stepN: 0.1, value: s.m1, onInput: v => { s.m1 = v; } });
    slider(P.ctl, { label: 'Velocità A', min: -5, max: 5, step: 0.1, value: s.v1, unit: 'm/s', decimals: 1, onInput: v => { s.v1 = v; if (!s.run) reset(); } });
    K.massSlider(P.ctl, { label: 'Massa carrello B', wLabel: 'Peso carrello B', min: 0.5, max: 5, step: 0.1, stepN: 0.1, value: s.m2, onInput: v => { s.m2 = v; } });
    slider(P.ctl, { label: 'Velocità B', min: -5, max: 5, step: 0.1, value: s.v2, unit: 'm/s', decimals: 1, onInput: v => { s.v2 = v; if (!s.run) reset(); } });
    const eSl = slider(P.ctl, { label: 'Coefficiente di restituzione e', min: 0, max: 1, step: 0.05, value: s.e, decimals: 2, onInput: v => { s.e = v; } });
    onSeg(P, 'urti-type', v => { s.e = +v; eSl.value = s.e; });
    const goBtn = P.q('#urti-go');
    goBtn.addEventListener('click', () => { if (!s.run && (s.hit || s.x1 !== 2)) reset(); s.run = !s.run; goBtn.textContent = s.run ? '❚❚ Pausa' : '▶ Avvia'; });
    P.q('#urti-reset').addEventListener('click', reset);
    reset();
    const after = () => {
      const p = s.m1 * s.v1 + s.m2 * s.v2, M = s.m1 + s.m2;
      return [(p - s.m2 * s.e * (s.v1 - s.v2)) / M, (p + s.m1 * s.e * (s.v1 - s.v2)) / M];
    };
    const W = 0.9;
    function step(dt) {
      if (s.run) {
        s.x1 += s.u1 * dt; s.x2 += s.u2 * dt;
        if (!s.hit && s.x2 - s.x1 <= W && s.u1 > s.u2) {
          [s.u1, s.u2] = after();
          s.hit = true;
          if (s.e === 0) s.x2 = s.x1 + W;
        }
        if (s.x1 < -1 || s.x1 > 11 || s.x2 < -1 || s.x2 > 11) {
          s.run = false; goBtn.textContent = '↺ Di nuovo';
        }
      }
      const st = P.st, ctx = clear(st);
      const sc = (st.w - 60) / 10, X = x => 30 + x * sc, gy = st.h * 0.62;
      ground(ctx, 0, st.w, gy);
      for (let i = 0; i <= 10; i++) text(ctx, i + ' m', X(i), gy + 22, { align: 'center', size: 11, weight: 500, color: cssVar('--muted') });
      const cart = (x, m, u, col, lab) => {
        const w = W * sc, h = 26 + m * 8;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X(x) - w / 2, gy - h - 10, w, h, 6) : ctx.rect(X(x) - w / 2, gy - h - 10, w, h); ctx.fill();
        ctx.fillStyle = cssVar('--axis');
        [-w / 3, w / 3].forEach(o => { ctx.beginPath(); ctx.arc(X(x) + o, gy - 6, 6, 0, TAU); ctx.fill(); });
        text(ctx, `${lab} · ${K.massLabel(m)}`, X(x), gy - h / 2 - 10, { align: 'center', color: '#fff', size: 12 });
        if (Math.abs(u) > 0.01) arrow(ctx, X(x), gy - h - 26, X(x) + u * 22, gy - h - 26, col, 3, fmtNum(u, 2) + ' m/s');
      };
      cart(s.x1, s.m1, s.u1, COL.blue, 'A');
      cart(s.x2, s.m2, s.u2, COL.orange, 'B');
      const [a1, a2] = after();
      const p0 = s.m1 * s.v1 + s.m2 * s.v2, p1 = s.m1 * a1 + s.m2 * a2;
      const k0 = 0.5 * s.m1 * s.v1 * s.v1 + 0.5 * s.m2 * s.v2 * s.v2, k1 = 0.5 * s.m1 * a1 * a1 + 0.5 * s.m2 * a2 * a2;
      const will = s.v1 > s.v2;
      P.setStatus(will ? 'good' : 'bad', will ? (s.hit ? 'Urto avvenuto: la quantità di moto totale è la stessa di prima ✓' : 'I carrelli si avvicinano: premi Avvia.') : 'Con queste velocità i carrelli non si scontrano.');
      readout(P.out, [
        ['Quantità di moto prima', fmtNum(p0, 2) + ' kg·m/s'],
        ['Quantità di moto dopo', will ? fmtNum(p1, 2) + ' kg·m/s' : '—'],
        ['Velocità A dopo', will ? fmtNum(a1, 2) + ' m/s' : '—'],
        ['Velocità B dopo', will ? fmtNum(a2, 2) + ' m/s' : '—'],
        ['Energia cinetica prima', fmtNum(k0, 2) + ' J'],
        ['Energia cinetica dopo', will ? fmtNum(k1, 2) + ' J' : '—'],
        ['Energia dissipata', will ? fmtNum(k0 - k1, 2) + ' J' : '—', will && k0 - k1 > 1e-6 ? 'bad' : 'good'],
      ]);
    }
    sims.urti = { step, st: P.st };
  })();

  /* =====================================================
     ORBITE E LEGGI DI KEPLERO
     ===================================================== */
  (function orbite() {
    const P = panel('orbite', 'Orbite e leggi di Keplero', `
      <h3>Gravitazione e leggi di Keplero</h3>
      <p>La forza di gravità tra il Sole e un pianeta è \\(F = G\\frac{Mm}{r^2}\\). Ne seguono le tre <b>leggi di Keplero</b>: (1) le orbite sono ellissi con il Sole in un fuoco; (2) il raggio che unisce Sole e pianeta spazza <b>aree uguali in tempi uguali</b>, per cui il pianeta è più veloce quando è vicino al Sole; (3) il quadrato del periodo è proporzionale al cubo del semiasse maggiore.</p>
      <div class="formula">$$F = G\\frac{Mm}{r^2} \\qquad \\frac{T^2}{a^3} = \\frac{4\\pi^2}{GM} \\qquad v_{fuga} = \\sqrt{\\frac{2GM}{r}}$$</div>
      <p class="hint">Unità: distanze in unità astronomiche (1 UA = distanza Terra–Sole), tempi in anni, masse in masse solari.</p>
      ${link('gravitazione')}`, {
      bottom: `<label class="hint mt" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="orb-areas" checked> Colora le aree (2ª legge)</label>` + btns('<button class="btn small" id="orb-reset" type="button">↺ Ricomincia</button>'),
    });
    const s = { k: 1.25, M: 1 };
    let o = null;
    const reset = () => {
      const GM = 4 * Math.PI * Math.PI * s.M;
      o = { x: 1, y: 0, vx: 0, vy: s.k * Math.sqrt(GM), t: 0, trail: [], lastT: null, Tmeas: null, prevY: 0, escaped: false };
      const E = (o.vy * o.vy) / 2 - GM / 1, h = o.vy;
      o.a = E < 0 ? -GM / (2 * E) : Infinity;
      o.e = Math.sqrt(Math.max(0, 1 + 2 * E * h * h / (GM * GM)));
      o.viewR = E < 0 ? Math.max(1.4, o.a * (1 + o.e) * 1.12) : 6;
      o.T = E < 0 ? TAU * Math.sqrt(o.a ** 3 / GM) : Infinity;
      o.tau = isFinite(o.T) ? o.T / 12 : 0.1;
    };
    slider(P.ctl, { label: 'Velocità iniziale (× velocità circolare)', min: 0.5, max: 1.5, step: 0.01, value: s.k, decimals: 2, onInput: v => { s.k = v; reset(); } });
    slider(P.ctl, { label: 'Massa della stella', min: 0.5, max: 3, step: 0.1, value: s.M, unit: 'M☉', decimals: 1, onInput: v => { s.M = v; reset(); } });
    P.q('#orb-reset').addEventListener('click', reset);
    const areas = P.q('#orb-areas');
    reset();
    function step(dt) {
      const GM = 4 * Math.PI * Math.PI * s.M;
      const simDt = dt * (isFinite(o.T) ? Math.max(0.15, o.T / 5) : 0.3);
      const n = 400, h = simDt / n;
      for (let i = 0; i < n; i++) {
        let r3 = Math.pow(o.x * o.x + o.y * o.y, 1.5);
        o.vx -= GM * o.x / r3 * h / 2; o.vy -= GM * o.y / r3 * h / 2;
        o.x += o.vx * h; o.y += o.vy * h;
        r3 = Math.pow(o.x * o.x + o.y * o.y, 1.5);
        o.vx -= GM * o.x / r3 * h / 2; o.vy -= GM * o.y / r3 * h / 2;
        o.t += h;
        if (o.prevY < 0 && o.y >= 0 && o.x > 0) { if (o.lastT !== null) o.Tmeas = o.t - o.lastT; o.lastT = o.t; }
        o.prevY = o.y;
      }
      o.trail.push({ x: o.x, y: o.y, t: o.t });
      const keep = isFinite(o.T) ? o.T : 3;
      while (o.trail.length > 2 && o.trail[0].t < o.t - keep) o.trail.shift();
      const r = Math.hypot(o.x, o.y), v = Math.hypot(o.vx, o.vy);
      if (r > o.viewR * 1.6) o.escaped = true;
      const st = P.st, ctx = clear(st);
      const cx = st.w / 2, cy = st.h / 2, sc = Math.min(st.w, st.h) / 2 / o.viewR;
      const X = x => cx + x * sc, Y = y => cy - y * sc;
      // aree uguali in tempi uguali
      if (areas.checked && o.trail.length > 2) {
        let cur = [], idx = Math.floor(o.trail[0].t / o.tau);
        const flush = (pts, i) => {
          if (pts.length < 2) return;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          pts.forEach(p => ctx.lineTo(X(p.x), Y(p.y)));
          ctx.closePath();
          ctx.fillStyle = i % 2 ? 'rgba(130,168,255,.22)' : 'rgba(255,173,102,.22)';
          ctx.fill();
        };
        for (const p of o.trail) {
          const i = Math.floor(p.t / o.tau);
          if (i !== idx) { cur.push(p); flush(cur, idx); cur = [p]; idx = i; } else cur.push(p);
        }
        flush(cur, idx);
      }
      ctx.strokeStyle = 'rgba(130,168,255,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); o.trail.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))); ctx.stroke();
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
      g.addColorStop(0, '#fff7d6'); g.addColorStop(0.3, '#ffcf5a'); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
      if (!o.escaped) {
        arrow(ctx, X(o.x), Y(o.y), X(o.x) + o.vx / v * (20 + v * 3), Y(o.y) - o.vy / v * (20 + v * 3), COL.red, 2.5, 'v');
        ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), 8, 0, TAU); ctx.fillStyle = '#4dabf7'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      const tipo = !isFinite(o.a) ? (Math.abs(s.k - Math.SQRT2) < 0.01 ? 'parabolica (fuga)' : 'iperbolica (fuga)') : o.e < 0.02 ? 'circolare' : 'ellittica';
      P.setStatus(o.escaped ? 'bad' : 'good', o.escaped ? 'Il pianeta è sfuggito alla gravità della stella: premi Ricomincia.' : `Orbita ${tipo}`);
      readout(P.out, [
        ['Distanza dalla stella', fmtNum(r, 3) + ' UA'],
        ['Velocità', fmtNum(v * 4.74, 1) + ' km/s'],
        ['Velocità di fuga qui', fmtNum(Math.sqrt(2 * GM / r) * 4.74, 1) + ' km/s'],
        ['Semiasse maggiore a', isFinite(o.a) ? fmtNum(o.a, 3) + ' UA' : '∞'],
        ['Eccentricità e', fmtNum(o.e, 3)],
        ['Periodo T (teorico)', isFinite(o.T) ? fmtNum(o.T, 3) + ' anni' : '—'],
        ['Periodo misurato', o.Tmeas ? fmtNum(o.Tmeas, 3) + ' anni' : '—'],
        ['T² / a³ (3ª legge)', isFinite(o.T) ? fmtNum(o.T * o.T / o.a ** 3, 3) + ' anni²/UA³' : '—'],
      ]);
    }
    sims.orbite = { step, st: P.st };
  })();

  /* =====================================================
     ONDE
     ===================================================== */
  (function onde() {
    const P = panel('onde', 'Onde', `
      <h3>Le onde</h3>
      <p>Un'onda trasporta energia senza trasportare materia: ogni punto della corda oscilla su e giù mentre la forma dell'onda avanza (guarda il punto rosso). <b>Lunghezza d'onda</b>, frequenza e velocità sono legate. Due onde che si incontrano si <b>sommano</b> (principio di sovrapposizione); due onde uguali che viaggiano in versi opposti formano un'<b>onda stazionaria</b> con punti sempre fermi, i <b>nodi</b>.</p>
      <div class="formula">$$v = \\lambda f \\qquad T = \\frac1f \\qquad y(x,t) = A\\sin(kx - \\omega t) \\qquad k = \\frac{2\\pi}{\\lambda}$$</div>
      ${link('onde')}`, { top: seg('onde-mode', [['one', 'Onda'], ['sum', 'Sovrapposizione'], ['stat', 'Stazionaria']], 'one') });
    const s = { mode: 'one', A: 0.5, f: 1, v: 2, A2: 0.5, f2: 1.2, ph: 0, t: 0 };
    slider(P.ctl, { label: 'Ampiezza A', min: 0.1, max: 1, step: 0.05, value: s.A, unit: 'm', decimals: 2, onInput: v => { s.A = v; } });
    slider(P.ctl, { label: 'Frequenza f', min: 0.2, max: 3, step: 0.05, value: s.f, unit: 'Hz', decimals: 2, onInput: v => { s.f = v; } });
    slider(P.ctl, { label: 'Velocità di propagazione v', min: 0.5, max: 5, step: 0.1, value: s.v, unit: 'm/s', decimals: 1, onInput: v => { s.v = v; } });
    const extra = document.createElement('div'); P.ctl.appendChild(extra);
    slider(extra, { label: 'Ampiezza 2ª onda', min: 0.1, max: 1, step: 0.05, value: s.A2, unit: 'm', decimals: 2, onInput: v => { s.A2 = v; } });
    slider(extra, { label: 'Frequenza 2ª onda', min: 0.2, max: 3, step: 0.05, value: s.f2, unit: 'Hz', decimals: 2, onInput: v => { s.f2 = v; } });
    slider(extra, { label: 'Sfasamento φ', min: 0, max: 360, step: 5, value: 0, unit: '°', decimals: 0, onInput: v => { s.ph = v * DEG; } });
    const showExtra = () => { extra.hidden = s.mode !== 'sum'; };
    onSeg(P, 'onde-mode', v => { s.mode = v; showExtra(); });
    showExtra();
    function step(dt) {
      s.t += dt;
      const st = P.st, ctx = clear(st);
      const L = 10, X0 = 30, sx = (st.w - 60) / L, cy = st.h / 2, sy = st.h * 0.2;
      const X = x => X0 + x * sx, Y = y => cy - y * sy;
      const w1 = TAU * s.f, k1 = w1 / s.v, w2 = TAU * s.f2, k2 = w2 / s.v;
      const y1 = x => s.A * Math.sin(k1 * x - w1 * s.t);
      const y2 = x => s.A2 * Math.sin(k2 * x - w2 * s.t + s.ph);
      const yS = x => 2 * s.A * Math.sin(k1 * x) * Math.cos(w1 * s.t);
      ctx.strokeStyle = cssVar('--grid-major'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X0, cy); ctx.lineTo(X(L), cy); ctx.stroke();
      const curve = (f, col, wdt, dash) => {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wdt; if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= 400; i++) { const x = L * i / 400; i ? ctx.lineTo(X(x), Y(f(x))) : ctx.moveTo(X(x), Y(f(x))); }
        ctx.stroke(); ctx.restore();
      };
      let f = y1;
      if (s.mode === 'sum') {
        curve(y1, 'rgba(130,168,255,.55)', 1.5, [5, 4]); curve(y2, 'rgba(255,173,102,.6)', 1.5, [5, 4]);
        f = x => y1(x) + y2(x);
      } else if (s.mode === 'stat') {
        f = yS;
        curve(x => 2 * s.A * Math.sin(k1 * x), 'rgba(130,168,255,.3)', 1, [3, 4]);
        curve(x => -2 * s.A * Math.sin(k1 * x), 'rgba(130,168,255,.3)', 1, [3, 4]);
        const lam = s.v / s.f;
        for (let x = 0; x <= L + 1e-9; x += lam / 2) {
          ctx.beginPath(); ctx.arc(X(x), cy, 5, 0, TAU); ctx.fillStyle = COL.orange; ctx.fill();
        }
        text(ctx, '● nodi', X(L) - 4, 18, { align: 'right', color: COL.orange, size: 12 });
      }
      curve(f, cssVar('--math'), 3);
      // particella della corda
      const xp = 2;
      ctx.beginPath(); ctx.arc(X(xp), Y(f(xp)), 7, 0, TAU); ctx.fillStyle = COL.red; ctx.fill();
      ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = COL.red; ctx.beginPath(); ctx.moveTo(X(xp), Y(2.1)); ctx.lineTo(X(xp), Y(-2.1)); ctx.stroke(); ctx.restore();
      const lam = s.v / s.f;
      if (s.mode === 'one' && lam < L) {
        const x0 = 4.5, yq = -1.35;
        ctx.strokeStyle = COL.green; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(x0), Y(yq)); ctx.lineTo(X(x0 + lam), Y(yq));
        ctx.moveTo(X(x0), Y(yq) - 6); ctx.lineTo(X(x0), Y(yq) + 6); ctx.moveTo(X(x0 + lam), Y(yq) - 6); ctx.lineTo(X(x0 + lam), Y(yq) + 6); ctx.stroke();
        text(ctx, `λ = ${fmtNum(lam, 2)} m`, X(x0 + lam / 2), Y(yq) + 16, { align: 'center', color: COL.green, size: 12 });
      }
      for (let i = 0; i <= L; i += 2) text(ctx, i + ' m', X(i), st.h - 12, { align: 'center', size: 11, weight: 500, color: cssVar('--muted') });
      const rows = [
        ['Lunghezza d\'onda λ = v/f', fmtNum(lam, 3) + ' m'],
        ['Periodo T = 1/f', fmtNum(1 / s.f, 3) + ' s'],
        ['Pulsazione ω = 2πf', fmtNum(w1, 3) + ' rad/s'],
        ['Numero d\'onda k = 2π/λ', fmtNum(k1, 3) + ' rad/m'],
      ];
      if (s.mode === 'sum') {
        rows.push(['λ della 2ª onda', fmtNum(s.v / s.f2, 3) + ' m']);
        if (Math.abs(s.f - s.f2) > 1e-9) rows.push(['Frequenza dei battimenti |f₁−f₂|', fmtNum(Math.abs(s.f - s.f2), 3) + ' Hz']);
        else rows.push(['Interferenza', Math.cos(s.ph) > 0.7 ? 'costruttiva' : Math.cos(s.ph) < -0.7 ? 'distruttiva' : 'intermedia']);
      }
      if (s.mode === 'stat') rows.push(['Distanza tra due nodi λ/2', fmtNum(lam / 2, 3) + ' m'], ['Ampiezza massima (ventri)', fmtNum(2 * s.A, 2) + ' m']);
      readout(P.out, rows);
    }
    sims.onde = { step, st: P.st };
  })();

  /* =====================================================
     ARCHIMEDE
     ===================================================== */
  (function archimede() {
    const LIQ = { acqua: [1000, 'Acqua', 'rgba(77,171,247,.45)'], salata: [1030, 'Acqua di mare', 'rgba(56,217,169,.4)'], olio: [920, 'Olio', 'rgba(250,200,60,.45)'], alcol: [790, 'Alcol', 'rgba(200,220,255,.35)'], mercurio: [13600, 'Mercurio', 'rgba(190,195,205,.75)'] };
    const MAT = [['240', 'Sughero'], ['600', 'Legno'], ['917', 'Ghiaccio'], ['2700', 'Alluminio'], ['7870', 'Ferro'], ['19300', 'Oro']];
    const P = panel('archimede', 'Principio di Archimede', `
      <h3>Il principio di Archimede</h3>
      <p>Un corpo immerso in un fluido riceve una <b>spinta verso l'alto</b> uguale al peso del fluido che sposta. Se la densità del corpo è minore di quella del liquido il corpo <b>galleggia</b>, con una frazione immersa pari al rapporto tra le densità; se è maggiore <b>affonda</b>, ma sembra più leggero (peso apparente).</p>
      <div class="formula">$$S = \\rho_{liquido}\\, g\\, V_{immerso} \\qquad \\frac{V_{immerso}}{V} = \\frac{\\rho_{corpo}}{\\rho_{liquido}} \\qquad p = p_0 + \\rho g h$$</div>
      ${link('fluidi')}`, {
      top: `<div class="ctrl"><label><span>Liquido</span></label><select id="arc-liq">${Object.entries(LIQ).map(([k, v]) => `<option value="${k}">${v[1]} (${v[0]} kg/m³)</option>`).join('')}</select></div>
            <div class="ctrl"><label><span>Materiale del corpo</span></label><div class="btn-row" id="arc-mat">${MAT.map(([d, n]) => `<button class="btn small" type="button" data-d="${d}">${n}</button>`).join('')}</div></div>`,
      bottom: btns('<button class="btn phys small" id="arc-drop" type="button">⬇ Lascia cadere</button>'),
    });
    const g = 9.81;
    const s = { liq: 'acqua', rho: 600, V: 1, d: -0.05, vel: 0 };
    const rhoSl = slider(P.ctl, { label: 'Densità del corpo ρ', min: 100, max: 20000, step: 10, value: s.rho, unit: 'kg/m³', decimals: 0, onInput: v => { s.rho = v; } });
    slider(P.ctl, { label: 'Volume del corpo V', min: 0.5, max: 5, step: 0.1, value: s.V, unit: 'dm³', decimals: 1, onInput: v => { s.V = v; } });
    P.q('#arc-liq').addEventListener('change', e => { s.liq = e.target.value; });
    P.q('#arc-mat').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; s.rho = +b.dataset.d; rhoSl.value = s.rho; drop(); });
    const drop = () => { s.d = -0.08; s.vel = 0; };
    P.q('#arc-drop').addEventListener('click', drop);
    const D = 0.5; // profondità del liquido (m)
    function step(dt) {
      const rl = LIQ[s.liq][0], Vm = s.V / 1000, l = Math.cbrt(Vm);
      const m = s.rho * Vm, W = m * g;
      const n = 10, h = dt / n;
      let B = 0;
      for (let i = 0; i < n; i++) {
        const sub = Math.max(0, Math.min(l, s.d));
        B = rl * g * l * l * sub;
        const drag = 6 * Math.sqrt(m) * s.vel * (sub > 0 ? 1 : 0.1);
        let acc = (W - B - drag) / m;
        s.vel += acc * h; s.d += s.vel * h;
        if (s.d >= D) { s.d = D; if (s.vel > 0) s.vel = 0; }
      }
      const sub = Math.max(0, Math.min(l, s.d)), frac = sub / l;
      B = rl * g * l * l * sub;
      const Bmax = rl * g * Vm;
      const st = P.st, ctx = clear(st);
      const tankW = Math.min(st.w * 0.6, 420), x0 = (st.w - tankW) / 2;
      const top = st.h * 0.28, sc = (st.h - top - 30) / (D + 0.08);
      const surf = top + 0.08 * sc, bottom = surf + D * sc;
      ctx.fillStyle = LIQ[s.liq][2];
      ctx.fillRect(x0, surf, tankW, bottom - surf);
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.lineTo(x0 + tankW, bottom); ctx.lineTo(x0 + tankW, top); ctx.stroke();
      const bl = Math.max(16, l * sc), bx = st.w / 2 - bl / 2, by = surf + s.d * sc - bl;
      const col = s.rho < 1000 ? '#c28a4b' : s.rho < 3000 ? '#adb5bd' : s.rho < 10000 ? '#5c6370' : '#f2c94c';
      ctx.fillStyle = col; ctx.fillRect(bx, by, bl, bl);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(bx, by, bl, bl);
      const cxb = st.w / 2, cyb = by + bl / 2, kf = 70 / Math.max(W, Bmax);
      arrow(ctx, cxb - 12, cyb, cxb - 12, cyb + W * kf, COL.red, 3, 'P');
      if (B > 0.01) arrow(ctx, cxb + 12, cyb, cxb + 12, cyb - B * kf, COL.green, 3, 'S');
      text(ctx, LIQ[s.liq][1], x0 + 8, bottom - 12, { size: 12, color: cssVar('--text') });
      let state;
      if (s.rho < rl * 0.999) state = ['good', `Galleggia: è immerso per il ${fmtNum(s.rho / rl * 100, 1)}%`];
      else if (s.rho > rl * 1.001) state = ['bad', 'Affonda: la spinta massima è minore del peso'];
      else state = ['good', 'Resta sospeso: stessa densità del liquido'];
      P.setStatus(state[0], state[1]);
      readout(P.out, [
        ['Massa del corpo', fmtNum(m, 3) + ' kg'],
        ['Peso P = ρVg', fmtNum(W, 2) + ' N'],
        ['Spinta massima ρ_liq·V·g', fmtNum(Bmax, 2) + ' N'],
        ['Spinta attuale', fmtNum(B, 2) + ' N'],
        ['Frazione immersa', fmtNum(frac * 100, 1) + ' %'],
        ['Peso apparente', s.rho > rl ? fmtNum(W - Bmax, 2) + ' N' : '0 N (galleggia)'],
        ['Pressione sul fondo (in più di p₀)', fmtNum(rl * g * D / 1000, 2) + ' kPa'],
      ]);
    }
    sims.archimede = { step, st: P.st };
  })();

  /* =====================================================
     GAS PERFETTI
     ===================================================== */
  (function gas() {
    const P = panel('gas', 'Gas perfetti', `
      <h3>Gas perfetti e trasformazioni</h3>
      <p>Pressione, volume e temperatura di un gas sono legati dall'<b>equazione di stato</b>. Le palline sono le molecole: più è alta la temperatura, più vanno veloci e più forte urtano le pareti (cioè la pressione aumenta). In una <b>isoterma</b> T è costante (legge di Boyle), in una <b>isobara</b> P è costante, in una <b>isocora</b> V è costante.</p>
      <div class="formula">$$PV = nRT \\qquad R = 8{,}314\\ \\tfrac{J}{mol\\cdot K} \\qquad U = \\tfrac32 nRT \\qquad L = \\int P\\,dV$$</div>
      ${link('termodinamica')}`, {
      top: seg('gas-mode', [['T', 'Isoterma'], ['P', 'Isobara'], ['V', 'Isocora'], ['free', 'Libera']], 'T'),
      bottom: btns('<button class="btn small" id="gas-clear" type="button">Cancella il diagramma</button>'),
    });
    const R = 8.314;
    const s = { mode: 'T', n: 1, T: 300, V: 24.6, P0: 0, W: 0, hist: [] };
    const P_ = () => s.n * R * s.T / (s.V / 1000); // Pa
    const vSl = slider(P.ctl, { label: 'Volume V', min: 5, max: 50, step: 0.1, value: s.V, unit: 'L', decimals: 1, onInput: v => setV(v) });
    const tSl = slider(P.ctl, { label: 'Temperatura T', min: 100, max: 800, step: 1, value: s.T, unit: 'K', decimals: 0, onInput: v => setT(v) });
    const nSl = slider(P.ctl, { label: 'Moli n', min: 0.5, max: 3, step: 0.1, value: s.n, unit: 'mol', decimals: 1, onInput: v => setN(v) });
    function record() { s.hist.push([s.V, P_()]); if (s.hist.length > 600) s.hist.shift(); }
    function setV(v) {
      const p = P_();
      if (s.mode === 'P') { const T = s.P0 * (v / 1000) / (s.n * R); if (T < 100 || T > 800) { vSl.value = s.V; return; } s.T = T; tSl.value = Math.round(T); }
      s.W += p * (v - s.V) / 1000; // J
      s.V = v; record();
    }
    function setT(t) {
      if (s.mode === 'P') { const V = s.n * R * t / s.P0 * 1000; if (V < 5 || V > 50) { tSl.value = Math.round(s.T); return; } s.W += s.P0 * (V - s.V) / 1000; s.V = V; vSl.value = V; }
      s.T = t; record();
    }
    function setN(n) {
      if (s.mode === 'P') { const V = n * R * s.T / s.P0 * 1000; if (V < 5 || V > 50) { nSl.value = s.n; return; } s.V = V; vSl.value = V; }
      s.n = n; parts(); record();
    }
    function applyMode() {
      s.P0 = P_();
      disable(tSl, s.mode === 'T'); disable(vSl, s.mode === 'V');
    }
    onSeg(P, 'gas-mode', m => { s.mode = m; applyMode(); });
    P.q('#gas-clear').addEventListener('click', () => { s.hist = []; s.W = 0; record(); });
    let pts = [];
    function parts() {
      const N = Math.round(s.n * 22);
      while (pts.length < N) pts.push({ x: Math.random(), y: Math.random(), a: Math.random() * TAU });
      pts.length = N;
    }
    parts(); applyMode(); record();
    function step(dt) {
      const st = P.st, ctx = clear(st);
      const Pa = P_(), kPa = Pa / 1000;
      // cilindro
      const cw = Math.min(st.w * 0.36, 230), cx0 = 24, cBottom = st.h - 30, cTopMax = 40;
      const hMax = cBottom - cTopMax, hgt = hMax * s.V / 50;
      const pistonY = cBottom - hgt;
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx0, cTopMax - 10); ctx.lineTo(cx0, cBottom); ctx.lineTo(cx0 + cw, cBottom); ctx.lineTo(cx0 + cw, cTopMax - 10); ctx.stroke();
      const heat = Math.min(1, (s.T - 100) / 700);
      ctx.fillStyle = `rgba(${Math.round(80 + 175 * heat)},${Math.round(140 - 60 * heat)},${Math.round(255 - 200 * heat)},.16)`;
      ctx.fillRect(cx0 + 2, pistonY, cw - 4, hgt - 2);
      ctx.fillStyle = cssVar('--surface-3'); ctx.fillRect(cx0 + 2, pistonY - 12, cw - 4, 12);
      ctx.fillRect(cx0 + cw / 2 - 4, cTopMax - 30, 8, pistonY - 12 - cTopMax + 30);
      const sp = 0.25 * Math.sqrt(s.T / 300);
      ctx.fillStyle = `rgb(${Math.round(120 + 135 * heat)},${Math.round(170 - 70 * heat)},${Math.round(255 - 180 * heat)})`;
      for (const p of pts) {
        p.x += Math.cos(p.a) * sp * dt * 3; p.y += Math.sin(p.a) * sp * dt * 3 * (50 / s.V);
        if (p.x < 0 || p.x > 1) { p.a = Math.PI - p.a; p.x = Math.max(0, Math.min(1, p.x)); }
        if (p.y < 0 || p.y > 1) { p.a = -p.a; p.y = Math.max(0, Math.min(1, p.y)); }
        ctx.beginPath(); ctx.arc(cx0 + 8 + p.x * (cw - 16), pistonY + 6 + p.y * (hgt - 14), 3.2, 0, TAU); ctx.fill();
      }
      // diagramma P-V
      const gx = cx0 + cw + 50, gw = st.w - gx - 20, gy = 24, gh = st.h - 60;
      const pMax = Math.max(300, ...s.hist.map(h => h[1] / 1000), kPa) * 1.15;
      const PX = v => gx + v / 55 * gw, PY = p => gy + gh - p / pMax * gh;
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
      text(ctx, 'P (kPa)', gx + 6, gy + 4, { size: 12, color: cssVar('--muted') });
      text(ctx, 'V (L)', gx + gw, gy + gh + 18, { size: 12, align: 'right', color: cssVar('--muted') });
      for (let v = 10; v <= 50; v += 10) text(ctx, String(v), PX(v), gy + gh + 14, { size: 11, align: 'center', weight: 500, color: cssVar('--muted') });
      const pStep = window.Plot ? window.Plot.niceStep(gh / pMax, 50).major : Math.pow(10, Math.floor(Math.log10(pMax)));
      for (let p = pStep; p < pMax; p += pStep) text(ctx, String(Math.round(p)), gx - 6, PY(p), { size: 11, align: 'right', weight: 500, color: cssVar('--muted') });
      // curva teorica della trasformazione
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = COL.purple; ctx.lineWidth = 1.5; ctx.beginPath();
      if (s.mode === 'T') { for (let v = 5; v <= 50; v += 0.5) { const p = s.n * R * s.T / (v / 1000) / 1000; v === 5 ? ctx.moveTo(PX(v), PY(p)) : ctx.lineTo(PX(v), PY(p)); } }
      else if (s.mode === 'P') { ctx.moveTo(PX(5), PY(kPa)); ctx.lineTo(PX(50), PY(kPa)); }
      else if (s.mode === 'V') { ctx.moveTo(PX(s.V), PY(0)); ctx.lineTo(PX(s.V), PY(pMax)); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = COL.orange; ctx.lineWidth = 2.5; ctx.beginPath();
      s.hist.forEach(([v, p], i) => i ? ctx.lineTo(PX(v), PY(p / 1000)) : ctx.moveTo(PX(v), PY(p / 1000)));
      ctx.stroke();
      ctx.beginPath(); ctx.arc(PX(s.V), PY(kPa), 6, 0, TAU); ctx.fillStyle = COL.red; ctx.fill();
      const names = { T: 'isoterma: PV costante', P: 'isobara: V/T costante', V: 'isocora: P/T costante', free: 'trasformazione libera' };
      P.setStatus('good', names[s.mode]);
      readout(P.out, [
        ['Pressione P', `${fmtNum(kPa, 1)} kPa (${fmtNum(Pa / 101325, 2)} atm)`],
        ['Volume V', fmtNum(s.V, 1) + ' L'],
        ['Temperatura T', `${fmtNum(s.T, 0)} K (${fmtNum(s.T - 273.15, 0)} °C)`],
        ['Prodotto PV', fmtNum(Pa * s.V / 1000, 0) + ' J'],
        ['Energia interna U = 3/2 nRT', fmtNum(1.5 * s.n * R * s.T, 0) + ' J'],
        ['Lavoro fatto dal gas', fmtNum(s.W, 0) + ' J'],
      ]);
    }
    sims.gas = { step, st: P.st };
  })();

  /* =====================================================
     CALORIMETRIA
     ===================================================== */
  (function calore() {
    const MAT = { acqua: [4186, 'Acqua'], alluminio: [900, 'Alluminio'], vetro: [840, 'Vetro'], ferro: [450, 'Ferro'], rame: [385, 'Rame'], piombo: [128, 'Piombo'] };
    const P = panel('calore', 'Calorimetria', `
      <h3>Calore e temperatura di equilibrio</h3>
      <p>Quando due corpi a temperature diverse sono a contatto, il <b>calore</b> passa dal più caldo al più freddo finché raggiungono la stessa <b>temperatura di equilibrio</b>. Il calore ceduto da uno è uguale a quello assorbito dall'altro. Il <b>calore specifico</b> \\(c\\) dice quanta energia serve per scaldare di 1 °C un kg di sostanza: l'acqua ne richiede moltissima.</p>
      <div class="formula">$$Q = m\\,c\\,\\Delta T \\qquad T_{eq} = \\frac{m_1c_1T_1 + m_2c_2T_2}{m_1c_1 + m_2c_2}$$</div>
      ${link('calore')}`, {
      top: `<div class="ctrl"><label><span>Materiale del corpo caldo (A)</span></label><select id="cal-mat">${Object.entries(MAT).map(([k, v]) => `<option value="${k}" ${k === 'ferro' ? 'selected' : ''}>${v[1]} (c = ${v[0]} J/kg·°C)</option>`).join('')}</select></div>`,
      bottom: btns('<button class="btn phys small" id="cal-go" type="button">▶ Metti a contatto</button><button class="btn small" id="cal-reset" type="button">↺ Ripristina</button>'),
    });
    const s = { mat: 'ferro', mA: 1, TA: 150, mB: 1, TB: 20, tA: 150, tB: 20, run: false, t: 0, data: [] };
    const reset = () => { s.tA = s.TA; s.tB = s.TB; s.run = false; s.t = 0; s.data = []; };
    slider(P.ctl, { label: 'Massa di A', min: 0.1, max: 5, step: 0.1, value: s.mA, unit: 'kg', decimals: 1, onInput: v => { s.mA = v; reset(); } });
    slider(P.ctl, { label: 'Temperatura di A', min: 0, max: 300, step: 1, value: s.TA, unit: '°C', decimals: 0, onInput: v => { s.TA = v; reset(); } });
    slider(P.ctl, { label: 'Massa dell\'acqua (B)', min: 0.1, max: 5, step: 0.1, value: s.mB, unit: 'kg', decimals: 1, onInput: v => { s.mB = v; reset(); } });
    slider(P.ctl, { label: 'Temperatura dell\'acqua', min: 0, max: 100, step: 1, value: s.TB, unit: '°C', decimals: 0, onInput: v => { s.TB = v; reset(); } });
    P.q('#cal-mat').addEventListener('change', e => { s.mat = e.target.value; reset(); });
    P.q('#cal-go').addEventListener('click', () => { if (s.t > 0 && !s.run) reset(); s.run = true; });
    P.q('#cal-reset').addEventListener('click', reset);
    const tcol = T => { const k = Math.max(0, Math.min(1, T / 200)); return `rgb(${Math.round(60 + 195 * k)},${Math.round(130 - 60 * k)},${Math.round(240 - 200 * k)})`; };
    function step(dt) {
      const cA = MAT[s.mat][0], cB = 4186;
      const CA = s.mA * cA, CB = s.mB * cB;
      const Teq = (CA * s.TA + CB * s.TB) / (CA + CB);
      if (s.run) {
        const tauK = 1.2; // velocità dello scambio (solo animazione)
        const f = 1 - Math.exp(-dt / tauK);
        s.tA += (Teq - s.tA) * f * (CB / (CA + CB)) * 2;
        s.tB = (CA * s.TA + CB * s.TB - CA * s.tA) / CB;
        s.t += dt;
        s.data.push({ t: s.t, a: s.tA, b: s.tB });
        if (Math.abs(s.tA - Teq) < 0.05) { s.tA = Teq; s.tB = Teq; s.run = false; }
      }
      const st = P.st, ctx = clear(st);
      // becher
      const bw = Math.min(220, st.w * 0.32), bx = 40, by = 60, bh = st.h * 0.5;
      ctx.fillStyle = tcol(s.tB); ctx.globalAlpha = 0.45; ctx.fillRect(bx, by + bh * 0.25, bw, bh * 0.75); ctx.globalAlpha = 1;
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by); ctx.stroke();
      const inWater = s.t > 0 || s.run;
      const cube = 46, cxp = bx + bw / 2 - cube / 2, cyp = inWater ? by + bh - cube - 6 : by - cube - 14;
      ctx.fillStyle = tcol(s.tA); ctx.fillRect(cxp, cyp, cube, cube);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(cxp, cyp, cube, cube);
      text(ctx, 'A', cxp + cube / 2, cyp + cube / 2, { align: 'center', color: '#fff', weight: 700 });
      text(ctx, 'B (acqua)', bx + 8, by + bh - 12, { size: 12 });
      if (inWater && Math.abs(s.tA - s.tB) > 0.2) {
        const hot = s.tA > s.tB;
        text(ctx, hot ? 'calore A → B' : 'calore B → A', bx + bw / 2, by + bh * 0.32, { align: 'center', color: COL.orange, size: 12 });
      }
      // termometri
      const therm = (x, T, lab) => {
        const ty = 40, th = st.h * 0.55, tb = ty + th;
        ctx.fillStyle = cssVar('--surface-2'); ctx.fillRect(x - 6, ty, 12, th);
        const hgt = Math.max(0, Math.min(1, T / 300)) * th;
        ctx.fillStyle = tcol(T); ctx.fillRect(x - 6, tb - hgt, 12, hgt);
        ctx.beginPath(); ctx.arc(x, tb + 8, 11, 0, TAU); ctx.fill();
        text(ctx, `${lab}: ${fmtNum(T, 1)} °C`, x, tb + 34, { align: 'center', size: 12 });
      };
      const tx = bx + bw + 60;
      therm(tx, s.tA, 'A'); therm(tx + 90, s.tB, 'B');
      // grafico T(t)
      const gx = tx + 160, gw = st.w - gx - 16;
      if (gw > 100) {
        const gy = 40, gh = st.h * 0.55;
        ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
        text(ctx, 'T (°C)', gx + 4, gy - 8, { size: 11, color: cssVar('--muted') });
        const tmax = Math.max(1, s.data.length ? s.data[s.data.length - 1].t : 1);
        const Ymax = Math.max(s.TA, s.TB, 10) * 1.1;
        const line = (key, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); s.data.forEach((d, i) => { const x = gx + d.t / tmax * gw, y = gy + gh - d[key] / Ymax * gh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
        line('a', COL.red); line('b', COL.blue);
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.green; ctx.beginPath(); ctx.moveTo(gx, gy + gh - Teq / Ymax * gh); ctx.lineTo(gx + gw, gy + gh - Teq / Ymax * gh); ctx.stroke(); ctx.restore();
        text(ctx, 'T eq', gx + gw - 4, gy + gh - Teq / Ymax * gh - 8, { align: 'right', size: 11, color: COL.green });
      }
      const QA = CA * (s.TA - s.tA), QB = CB * (s.tB - s.TB);
      readout(P.out, [
        ['Capacità termica di A (m·c)', fmtNum(CA, 0) + ' J/°C'],
        ['Capacità termica di B (m·c)', fmtNum(CB, 0) + ' J/°C'],
        ['Temperatura di equilibrio', fmtNum(Teq, 2) + ' °C'],
        ['Calore ceduto da A', fmtNum(QA / 1000, 2) + ' kJ'],
        ['Calore assorbito da B', fmtNum(QB / 1000, 2) + ' kJ'],
      ]);
    }
    sims.calore = { step, st: P.st };
  })();

  /* =====================================================
     OTTICA: RIFRAZIONE E LENTI
     ===================================================== */
  (function ottica() {
    const MED = [['1', 'Aria (1,00)'], ['1.33', 'Acqua (1,33)'], ['1.5', 'Vetro (1,50)'], ['2.42', 'Diamante (2,42)']];
    const sel = (id, v) => `<select id="${id}">${MED.map(([n, l]) => `<option value="${n}" ${n === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const P = panel('ottica', 'Rifrazione e lenti', `
      <h3>Rifrazione e lenti sottili</h3>
      <p>Quando la luce passa da un mezzo a un altro cambia direzione (<b>rifrazione</b>) secondo la legge di Snell. Se passa da un mezzo più denso a uno meno denso oltre l'<b>angolo limite</b>, non esce più: è la <b>riflessione totale</b> (fibre ottiche, brillantezza dei diamanti). Una <b>lente</b> forma immagini che si trovano con l'equazione dei punti coniugati e con tre raggi principali.</p>
      <div class="formula">$$n_1\\sin\\theta_1 = n_2\\sin\\theta_2 \\qquad \\sin\\theta_{lim} = \\frac{n_2}{n_1} \\qquad \\frac1p + \\frac1q = \\frac1f \\qquad G = -\\frac qp$$</div>
      ${link('ottica')}`, {
      top: seg('ott-mode', [['rif', 'Rifrazione'], ['lente', 'Lente']], 'rif') +
        `<div id="ott-rif"><div class="ctrl"><label><span>Mezzo in alto n₁</span></label>${sel('ott-n1', '1')}</div><div class="ctrl"><label><span>Mezzo in basso n₂</span></label>${sel('ott-n2', '1.5')}</div></div>
         <div id="ott-lente" hidden>${seg('ott-lt', [['conv', 'Convergente'], ['div', 'Divergente']], 'conv')}</div>`,
    });
    const s = { mode: 'rif', n1: 1, n2: 1.5, th: 40, lt: 'conv', f: 10, p: 25, h: 4 };
    const rifBox = P.q('#ott-rif'), lenBox = P.q('#ott-lente');
    const thBox = document.createElement('div'), lenCtl = document.createElement('div');
    P.ctl.append(thBox, lenCtl);
    const thSl = slider(thBox, { label: 'Angolo di incidenza θ₁', min: 0, max: 89, step: 1, value: s.th, unit: '°', decimals: 0, onInput: v => { s.th = v; } });
    slider(lenCtl, { label: 'Distanza focale |f|', min: 4, max: 20, step: 0.5, value: s.f, unit: 'cm', decimals: 1, onInput: v => { s.f = v; } });
    slider(lenCtl, { label: 'Distanza dell\'oggetto p', min: 2, max: 40, step: 0.5, value: s.p, unit: 'cm', decimals: 1, onInput: v => { s.p = v; } });
    slider(lenCtl, { label: 'Altezza dell\'oggetto', min: 1, max: 6, step: 0.5, value: s.h, unit: 'cm', decimals: 1, onInput: v => { s.h = v; } });
    const show = () => { const r = s.mode === 'rif'; rifBox.hidden = !r; thBox.hidden = !r; lenBox.hidden = r; lenCtl.hidden = r; };
    onSeg(P, 'ott-mode', v => { s.mode = v; show(); }); show();
    onSeg(P, 'ott-lt', v => { s.lt = v; });
    P.q('#ott-n1').addEventListener('change', e => { s.n1 = +e.target.value; });
    P.q('#ott-n2').addEventListener('change', e => { s.n2 = +e.target.value; });
    let drag = false;
    P.canvas.addEventListener('pointerdown', ev => { if (s.mode === 'rif') { drag = true; P.canvas.setPointerCapture(ev.pointerId); moveRay(ev); } });
    P.canvas.addEventListener('pointermove', ev => { if (drag) moveRay(ev); });
    P.canvas.addEventListener('pointerup', () => { drag = false; });
    function moveRay(ev) {
      const p = canvasPos(P.canvas, ev), cx = P.st.w / 2, cy = P.st.h / 2;
      if (p.y >= cy) return;
      const a = Math.round(Math.atan2(Math.abs(p.x - cx), cy - p.y) / DEG);
      s.th = Math.min(89, a); thSl.value = s.th;
    }
    function drawRif(ctx, st) {
      const cx = st.w / 2, cy = st.h / 2, R = Math.min(st.w, st.h) * 0.45;
      const tint = n => `rgba(130,168,255,${(n - 1) * 0.18})`;
      ctx.fillStyle = tint(s.n1); ctx.fillRect(0, 0, st.w, cy);
      ctx.fillStyle = tint(s.n2); ctx.fillRect(0, cy, st.w, st.h - cy);
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(st.w, cy); ctx.stroke();
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = cssVar('--muted'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke(); ctx.restore();
      const t1 = s.th * DEG, sin2 = s.n1 / s.n2 * Math.sin(t1), tir = sin2 > 1;
      const inc = [cx - R * Math.sin(t1), cy - R * Math.cos(t1)];
      // riflessione di Fresnel (intensità approssimata)
      let Rf = 1;
      if (!tir) {
        const t2 = Math.asin(sin2), c1 = Math.cos(t1), c2 = Math.cos(t2);
        const rs = ((s.n1 * c1 - s.n2 * c2) / (s.n1 * c1 + s.n2 * c2)) ** 2, rp = ((s.n1 * c2 - s.n2 * c1) / (s.n1 * c2 + s.n2 * c1)) ** 2;
        Rf = (rs + rp) / 2;
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(inc[0], inc[1]); ctx.lineTo(cx, cy); ctx.stroke();
      arrow(ctx, inc[0], inc[1], (inc[0] + cx) / 2, (inc[1] + cy) / 2, '#ffd43b', 4);
      ctx.globalAlpha = Math.max(0.15, Rf); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(t1), cy - R * Math.cos(t1)); ctx.stroke();
      ctx.globalAlpha = 1;
      if (!tir) {
        const t2 = Math.asin(sin2);
        ctx.globalAlpha = 1 - Rf * 0.8; ctx.strokeStyle = '#ffa94d'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(t2), cy + R * Math.cos(t2)); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = COL.orange; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 50, Math.PI / 2 - t2, Math.PI / 2, false); ctx.stroke();
        text(ctx, `θ₂ = ${fmtNum(t2 / DEG, 1)}°`, cx + 56, cy + 40, { color: COL.orange, size: 12 });
      }
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 50, -Math.PI / 2 - t1, -Math.PI / 2, false); ctx.stroke();
      text(ctx, `θ₁ = ${s.th}°`, cx - 56, cy - 40, { align: 'right', color: '#ffd43b', size: 12 });
      text(ctx, `n₁ = ${s.n1}`, 12, 18, { size: 12 }); text(ctx, `n₂ = ${s.n2}`, 12, st.h - 14, { size: 12 });
      text(ctx, 'Trascina per cambiare l\'angolo', st.w - 10, 18, { align: 'right', size: 11, weight: 500, color: cssVar('--muted') });
      const lim = s.n1 > s.n2 ? Math.asin(s.n2 / s.n1) / DEG : null;
      P.setStatus(tir ? 'bad' : 'good', tir ? 'Riflessione totale: la luce non passa nel secondo mezzo!' : (s.n2 > s.n1 ? 'Verso un mezzo più denso: il raggio si avvicina alla normale' : s.n2 < s.n1 ? 'Verso un mezzo meno denso: il raggio si allontana dalla normale' : 'Stesso mezzo: nessuna deviazione'));
      readout(P.out, [
        ['Angolo di incidenza θ₁', s.th + '°'],
        ['Angolo di rifrazione θ₂', tir ? '—' : fmtNum(Math.asin(sin2) / DEG, 2) + '°'],
        ['Angolo di riflessione', s.th + '°'],
        ['Luce riflessa (circa)', fmtNum(Rf * 100, 1) + ' %'],
        ['Angolo limite', lim ? fmtNum(lim, 2) + '°' : 'non esiste (n₁ ≤ n₂)'],
        ['Velocità nel mezzo 2', fmtNum(299792 / s.n2, 0) + ' km/s'],
      ]);
    }
    function drawLens(ctx, st) {
      const f = s.lt === 'conv' ? s.f : -s.f, p = s.p, h = s.h;
      const cx = st.w / 2, cy = st.h / 2, sc = (st.w - 40) / 90;
      const X = x => cx + x * sc, Y = y => cy - y * sc;
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(st.w, cy); ctx.stroke();
      // lente
      const lh = Math.min(st.h * 0.42, 14 * sc);
      ctx.strokeStyle = '#74c0fc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy - lh); ctx.lineTo(cx, cy + lh); ctx.stroke();
      const tip = (y, dir) => { ctx.beginPath(); ctx.moveTo(cx - 8, y + dir * 10); ctx.lineTo(cx, y); ctx.lineTo(cx + 8, y + dir * 10); ctx.stroke(); };
      if (s.lt === 'conv') { tip(cy - lh, 1); tip(cy + lh, -1); } else { tip(cy - lh, -1); tip(cy + lh, 1); }
      [[-1, 'F'], [1, "F'"], [-2, '2F'], [2, "2F'"]].forEach(([k, l]) => {
        const x = X(k * Math.abs(f));
        ctx.beginPath(); ctx.arc(x, cy, 3.5, 0, TAU); ctx.fillStyle = cssVar('--text'); ctx.fill();
        text(ctx, l, x, cy + 16, { align: 'center', size: 11, color: cssVar('--muted') });
      });
      // oggetto
      const ox = -p;
      arrow(ctx, X(ox), Y(0), X(ox), Y(h), COL.green, 3, 'oggetto');
      const atInf = Math.abs(p - f) < 1e-6;
      const q = atInf ? Infinity : 1 / (1 / f - 1 / p), G = -q / p, hi = G * h;
      const ray = (pts, col, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; if (dash) ctx.setLineDash([5, 5]); ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke(); ctx.restore(); };
      const far = 60;
      const extend = (x0, y0, x1, y1, xEnd) => [xEnd, y0 + (y1 - y0) / (x1 - x0) * (xEnd - x0)];
      // 1) parallelo all'asse, poi passa per F' (o sembra venire da F)
      ray([[ox, h], [0, h], extend(0, h, f, 0, far)], '#ffd43b');
      // 2) per il centro, non deviato
      ray([[ox, h], extend(ox, h, 0, 0, far)], '#ff922b');
      // 3) verso F (o verso F' virtuale), esce parallelo
      if (Math.abs(ox + f) > 1e-6) {
        const yl = h + (0 - ox) * (0 - h) / (-f - ox);
        ray([[ox, h], [0, yl], [far, yl]], '#63e6be');
        if (q < 0 && isFinite(q)) { ray([[0, yl], [-far, yl]], '#63e6be', true); }
      }
      if (isFinite(q)) {
        if (q < 0) { ray([[0, h], extend(f, 0, 0, h, -far)], '#ffd43b', true); }
        arrow(ctx, X(q), Y(0), X(q), Y(hi), COL.red, 3, q > 0 ? 'immagine' : 'immagine virtuale');
      }
      P.setStatus('good', !isFinite(q) ? 'Oggetto nel fuoco: l\'immagine si forma all\'infinito' :
        `Immagine ${q > 0 ? 'reale' : 'virtuale'}, ${G < 0 ? 'capovolta' : 'diritta'}, ${Math.abs(G) > 1 ? 'ingrandita' : Math.abs(G) < 1 ? 'rimpicciolita' : 'stessa grandezza'}`);
      readout(P.out, [
        ['Focale f', fmtNum(f, 1) + ' cm'],
        ['Distanza oggetto p', fmtNum(p, 1) + ' cm'],
        ['Distanza immagine q', isFinite(q) ? fmtNum(q, 2) + ' cm' : '∞'],
        ['Ingrandimento G = −q/p', isFinite(q) ? fmtNum(G, 2) : '∞'],
        ['Altezza immagine', isFinite(q) ? fmtNum(hi, 2) + ' cm' : '—'],
        ['Potere diottrico 1/f', fmtNum(100 / f, 2) + ' diottrie'],
      ]);
    }
    function step() {
      const st = P.st, ctx = clear(st);
      if (s.mode === 'rif') drawRif(ctx, st); else drawLens(ctx, st);
    }
    sims.ottica = { step, st: P.st };
  })();

  /* =====================================================
     CAMPO ELETTRICO
     ===================================================== */
  (function cariche() {
    const P = panel('cariche', 'Campo elettrico di cariche puntiformi', `
      <h3>Legge di Coulomb e campo elettrico</h3>
      <p>Cariche dello stesso segno si respingono, di segno opposto si attraggono, con una forza che diminuisce col quadrato della distanza. Il <b>campo elettrico</b> dice che forza sentirebbe una carica di prova positiva in ogni punto: le frecce mostrano la sua direzione. Il colore indica il <b>potenziale</b>: rosso vicino alle cariche positive, blu vicino a quelle negative. Trascina le cariche!</p>
      <div class="formula">$$F = k\\frac{|q_1 q_2|}{r^2} \\qquad E = k\\frac{|q|}{r^2} \\qquad V = k\\frac{q}{r} \\qquad k = 8{,}99\\cdot 10^9\\ \\tfrac{N\\,m^2}{C^2}$$</div>
      ${link('elettrostatica')}`, { bottom: `<label class="hint mt" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="car-3"> Aggiungi una terza carica</label>` });
    const k = 8.99e9;
    const Q = [{ q: 3, x: -1.5, y: 0 }, { q: -3, x: 1.5, y: 0 }, { q: 2, x: 0, y: 1.5, on: false }];
    slider(P.ctl, { label: 'Carica q₁', min: -5, max: 5, step: 0.5, value: Q[0].q, unit: 'μC', decimals: 1, onInput: v => { Q[0].q = v; } });
    slider(P.ctl, { label: 'Carica q₂', min: -5, max: 5, step: 0.5, value: Q[1].q, unit: 'μC', decimals: 1, onInput: v => { Q[1].q = v; } });
    const q3box = document.createElement('div'); P.ctl.appendChild(q3box);
    slider(q3box, { label: 'Carica q₃', min: -5, max: 5, step: 0.5, value: Q[2].q, unit: 'μC', decimals: 1, onInput: v => { Q[2].q = v; } });
    q3box.hidden = true;
    P.q('#car-3').addEventListener('change', e => { Q[2].on = e.target.checked; q3box.hidden = !e.target.checked; });
    let view = null, drag = null, mouse = null;
    const active = () => Q.filter((c, i) => i < 2 || c.on);
    const field = (x, y) => {
      let ex = 0, ey = 0, v = 0;
      for (const c of active()) {
        const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + 1e-6, r = Math.sqrt(r2), qC = c.q * 1e-6;
        ex += k * qC * dx / (r2 * r); ey += k * qC * dy / (r2 * r); v += k * qC / r;
      }
      return [ex, ey, v];
    };
    P.canvas.addEventListener('pointerdown', ev => {
      if (!view) return;
      const p = canvasPos(P.canvas, ev);
      for (const c of active()) if (Math.hypot(view.X(c.x) - p.x, view.Y(c.y) - p.y) < 24) { drag = c; P.canvas.setPointerCapture(ev.pointerId); }
    });
    P.canvas.addEventListener('pointermove', ev => {
      if (!view) return;
      const p = canvasPos(P.canvas, ev);
      mouse = [view.ix(p.x), view.iy(p.y)];
      if (drag) { drag.x = Math.max(-view.hw + 0.2, Math.min(view.hw - 0.2, mouse[0])); drag.y = Math.max(-view.hh + 0.2, Math.min(view.hh - 0.2, mouse[1])); }
    });
    P.canvas.addEventListener('pointerup', () => { drag = null; });
    P.canvas.addEventListener('pointerleave', () => { mouse = null; });
    function step() {
      const st = P.st, ctx = clear(st);
      const sc = st.w / 8, hw = 4, hh = st.h / 2 / sc;
      view = { X: x => st.w / 2 + x * sc, Y: y => st.h / 2 - y * sc, ix: px => (px - st.w / 2) / sc, iy: py => (st.h / 2 - py) / sc, hw, hh };
      // potenziale (colore)
      const cell = 10;
      for (let px = 0; px < st.w; px += cell) for (let py = 0; py < st.h; py += cell) {
        const [, , v] = field(view.ix(px + cell / 2), view.iy(py + cell / 2));
        const a = Math.min(0.55, Math.log10(1 + Math.abs(v) / 2000) * 0.14);
        ctx.fillStyle = v > 0 ? `rgba(255,107,107,${a})` : `rgba(77,171,247,${a})`;
        ctx.fillRect(px, py, cell, cell);
      }
      // frecce del campo
      const gs = 34;
      for (let px = gs / 2; px < st.w; px += gs) for (let py = gs / 2; py < st.h; py += gs) {
        const [ex, ey] = field(view.ix(px), view.iy(py)), E = Math.hypot(ex, ey);
        if (E < 1) continue;
        const a = Math.min(1, 0.25 + Math.log10(E) / 8), L = 12;
        const ux = ex / E, uy = -ey / E;
        ctx.globalAlpha = a;
        arrow(ctx, px - ux * L, py - uy * L, px + ux * L, py + uy * L, cssVar('--text'), 1.5);
        ctx.globalAlpha = 1;
      }
      // cariche
      active().forEach((c, i) => {
        const x = view.X(c.x), y = view.Y(c.y), r = 12 + Math.abs(c.q) * 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = c.q > 0 ? '#fa5252' : c.q < 0 ? '#339af0' : '#868e96'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        text(ctx, (c.q > 0 ? '+' : c.q < 0 ? '−' : '0'), x, y + 1, { align: 'center', color: '#fff', size: 16, weight: 800 });
        text(ctx, `q${'₁₂₃'[i]}`, x, y - r - 10, { align: 'center', size: 12 });
      });
      const [a, b] = Q, d = Math.hypot(a.x - b.x, a.y - b.y);
      const F = k * Math.abs(a.q * b.q) * 1e-12 / (d * d);
      const rows = [
        ['Distanza q₁–q₂', fmtNum(d, 2) + ' m'],
        ['Forza tra q₁ e q₂', fmtNum(F, 4) + ' N'],
        ['Tipo di forza', a.q * b.q > 0 ? 'repulsiva' : a.q * b.q < 0 ? 'attrattiva' : 'nessuna'],
      ];
      if (mouse) {
        const [ex, ey, v] = field(mouse[0], mouse[1]);
        rows.push(['Campo E nel cursore', fmtNum(Math.hypot(ex, ey), 0) + ' N/C'], ['Potenziale V nel cursore', fmtNum(v, 0) + ' V']);
      } else rows.push(['Campo e potenziale', 'passa con il mouse sul disegno']);
      P.setStatus('', '');
      readout(P.out, rows);
    }
    sims.cariche = { step, st: P.st };
  })();

  /* =====================================================
     CIRCUITI
     ===================================================== */
  (function circuiti() {
    const P = panel('circuiti', 'Circuiti elettrici', `
      <h3>Legge di Ohm e circuiti</h3>
      <p>La <b>corrente</b> che attraversa un resistore è proporzionale alla tensione (legge di Ohm). In <b>serie</b> la corrente è la stessa in ogni resistore e le resistenze si sommano; in <b>parallelo</b> la tensione è la stessa e si sommano gli inversi. I puntini mostrano il movimento delle cariche: più sono veloci, più corrente passa. L'energia dissipata in calore è l'effetto Joule.</p>
      <div class="formula">$$V = RI \\qquad R_{serie} = R_1 + R_2 + \\dots \\qquad \\frac1{R_{par}} = \\frac1{R_1} + \\frac1{R_2} + \\dots \\qquad P = VI = RI^2$$</div>
      ${link('corrente')}`, {
      top: seg('cir-mode', [['serie', 'Serie'], ['par', 'Parallelo']], 'serie'),
      bottom: `<label class="hint mt" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cir-r3" checked> Usa anche R₃</label>`,
    });
    const s = { mode: 'serie', V: 12, R: [10, 20, 30], use3: true, phase: 0 };
    slider(P.ctl, { label: 'Tensione della batteria V', min: 1, max: 24, step: 0.5, value: s.V, unit: 'V', decimals: 1, onInput: v => { s.V = v; } });
    [0, 1, 2].forEach(i => slider(P.ctl, { label: `Resistenza R${'₁₂₃'[i]}`, min: 1, max: 100, step: 1, value: s.R[i], unit: 'Ω', decimals: 0, onInput: v => { s.R[i] = v; } }));
    onSeg(P, 'cir-mode', v => { s.mode = v; });
    P.q('#cir-r3').addEventListener('change', e => { s.use3 = e.target.checked; });
    // lunghezze e punti lungo una spezzata
    const lenOf = pts => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const at = (pts, d) => {
      for (let i = 1; i < pts.length; i++) {
        const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (d <= L) { const t = d / L; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
        d -= L;
      }
      return pts[pts.length - 1];
    };
    function resistor(ctx, x, y, vertical, lab, info) {
      const L = 54, A = 7;
      ctx.save(); ctx.translate(x, y); if (vertical) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = cssVar('--canvas-bg'); ctx.fillRect(-L / 2 - 2, -A - 2, L + 4, 2 * A + 4);
      ctx.strokeStyle = COL.orange; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-L / 2, 0);
      for (let i = 0; i < 6; i++) ctx.lineTo(-L / 2 + (i + 0.5) * L / 6, i % 2 ? A : -A);
      ctx.lineTo(L / 2, 0); ctx.stroke(); ctx.restore();
      text(ctx, lab, x + (vertical ? 14 : 0), y + (vertical ? 0 : -18), { align: vertical ? 'left' : 'center', size: 13, weight: 700, color: COL.orange });
      text(ctx, info, x + (vertical ? 14 : 0), y + (vertical ? 16 : 22), { align: vertical ? 'left' : 'center', size: 11, weight: 500, color: cssVar('--muted') });
    }
    function step(dt) {
      const Rs = s.use3 ? s.R : s.R.slice(0, 2);
      const Req = s.mode === 'serie' ? Rs.reduce((a, b) => a + b, 0) : 1 / Rs.reduce((a, b) => a + 1 / b, 0);
      const I = s.V / Req;
      const Ii = Rs.map(r => s.mode === 'serie' ? I : s.V / r), Vi = Rs.map((r, i) => r * Ii[i]);
      const st = P.st, ctx = clear(st);
      const x0 = 70, x1 = st.w - (s.mode === 'serie' ? 130 : 110), yT = 60, yB = st.h - 60;
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      const paths = [];
      if (s.mode === 'serie') {
        const loop = [[x0, (yT + yB) / 2 - 18], [x0, yT], [x1, yT], [x1, yB], [x0, yB], [x0, (yT + yB) / 2 + 18]];
        ctx.beginPath(); loop.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        paths.push({ pts: loop, I });
        const n = Rs.length, pos = n === 3 ? [[(x0 + x1) / 2 - (x1 - x0) / 4, yT, 0], [(x0 + x1) / 2 + (x1 - x0) / 4, yT, 0], [x1, (yT + yB) / 2, 1]] : [[(x0 + x1) / 2, yT, 0], [x1, (yT + yB) / 2, 1]];
        pos.forEach(([x, y, v], i) => resistor(ctx, x, y, v, `R${'₁₂₃'[i]} = ${s.R[i]} Ω`, `${fmtNum(Vi[i], 2)} V · ${fmtNum(Ii[i], 3)} A`));
      } else {
        const n = Rs.length, xs = Rs.map((_, i) => x0 + (x1 - x0) * (i + 1) / n);
        ctx.beginPath();
        ctx.moveTo(x0, (yT + yB) / 2 - 18); ctx.lineTo(x0, yT); ctx.lineTo(xs[n - 1], yT);
        ctx.moveTo(x0, (yT + yB) / 2 + 18); ctx.lineTo(x0, yB); ctx.lineTo(xs[n - 1], yB);
        xs.forEach(x => { ctx.moveTo(x, yT); ctx.lineTo(x, yB); });
        ctx.stroke();
        xs.forEach((x, i) => {
          paths.push({ pts: [[x0, (yT + yB) / 2 - 18], [x0, yT], [x, yT], [x, yB], [x0, yB], [x0, (yT + yB) / 2 + 18]], I: Ii[i], skip: true });
          resistor(ctx, x, (yT + yB) / 2, 1, `R${'₁₂₃'[i]} = ${s.R[i]} Ω`, `${fmtNum(Vi[i], 2)} V · ${fmtNum(Ii[i], 3)} A`);
        });
      }
      // batteria
      const by = (yT + yB) / 2;
      ctx.fillStyle = cssVar('--canvas-bg'); ctx.fillRect(x0 - 26, by - 18, 52, 36);
      ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0 - 22, by - 8); ctx.lineTo(x0 + 22, by - 8); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 - 12, by + 8); ctx.lineTo(x0 + 12, by + 8); ctx.stroke();
      text(ctx, '+', x0 + 30, by - 10, { size: 14, weight: 700 }); text(ctx, '−', x0 + 30, by + 12, { size: 14, weight: 700 });
      text(ctx, `${fmtNum(s.V, 1)} V`, x0 - 34, by, { align: 'right', size: 13, weight: 700 });
      // cariche in movimento (verso convenzionale: dal + al −)
      s.phase += dt;
      ctx.fillStyle = '#ffd43b';
      for (const p of paths) {
        const L = lenOf(p.pts), sp = Math.min(260, p.I * 160), gap = 28;
        const off = (s.phase * sp) % gap;
        for (let d = off; d < L; d += gap) { const [x, y] = at(p.pts, d); ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); }
      }
      text(ctx, `I = ${fmtNum(I, 3)} A`, x0 + 10, yT - 16, { size: 13, weight: 700, color: '#ffd43b' });
      const Ptot = s.V * I;
      readout(P.out, [
        ['Resistenza equivalente', fmtNum(Req, 2) + ' Ω'],
        ['Corrente totale I = V/R', fmtNum(I, 3) + ' A'],
        ['Potenza totale P = VI', fmtNum(Ptot, 2) + ' W'],
        ['Calore in 1 minuto (Joule)', fmtNum(Ptot * 60, 0) + ' J'],
        ...Rs.map((r, i) => [`R${'₁₂₃'[i]}: tensione · corrente`, `${fmtNum(Vi[i], 2)} V · ${fmtNum(Ii[i], 3)} A`]),
      ]);
      P.setStatus('good', s.mode === 'serie' ? 'In serie: stessa corrente in ogni resistore' : 'In parallelo: stessa tensione su ogni resistore');
    }
    sims.circuiti = { step, st: P.st };
  })();

  /* ---------- Ciclo principale ---------- */
  let active = null;
  App.setupTabs(tabsEl, name => { active = name; });
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const sim = sims[active];
    if (sim && sim.st.w > 0 && sim.st.h > 0) sim.step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
