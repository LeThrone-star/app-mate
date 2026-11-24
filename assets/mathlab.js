/* =========================================================
   Laboratorio di Matematica
   ========================================================= */
(function () {
  'use strict';
  const P = window.MathParser;
  const { cssVar, slider, fmtNum } = window.App;
  const Plot = window.Plot;
  const RED = '#e03131', BLUE = '#1c7ed6', GREEN = '#2f9e44', PURPLE = '#7048e8', ORANGE = '#f08c00';
  const TAU = Math.PI * 2;

  function readout(el, rows) {
    el.innerHTML = rows.map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ''}">${v}</dd>`).join('');
  }
  function makeFnSafe(text, errEl) {
    try {
      const f = P.makeFn(text, 'x');
      errEl.textContent = '';
      return x => { try { return f(x); } catch (e) { return NaN; } };
    } catch (e) {
      errEl.textContent = '⚠ ' + e.message;
      return null;
    }
  }

  /* =====================================================
     1. CIRCONFERENZA GONIOMETRICA
     ===================================================== */
  (function gonio() {
    const s = { deg: 30, playing: false };
    const showSin = document.getElementById('g-sin');
    const showCos = document.getElementById('g-cos');
    const showTan = document.getElementById('g-tan');
    const out = document.getElementById('out-gonio');
    const ctl = document.getElementById('ctl-gonio');
    const angSl = slider(ctl, { label: 'Angolo α', min: 0, max: 360, step: 1, value: s.deg, unit: '°', decimals: 0, onInput: v => { s.deg = v; redraw(); } });

    const cCircle = document.getElementById('c-circle');
    const circle = new Plot(cCircle, { interactive: false, fixedView: () => [-1.6, 1.6, -1.6, 1.6], gridTarget: 50, onDraw: drawCircle });
    const wave = new Plot(document.getElementById('c-wave'), {
      interactive: false, lockAspect: false, sy: 1, gridTarget: 60, xTickLabels: false,
      fixedView: () => [-0.5, TAU + 0.4, -2.2, 2.2], xLabel: 'α', onDraw: drawWave,
    });
    function redraw() { circle.request(); wave.request(); updateOut(); }
    [showSin, showCos, showTan].forEach(c => c.addEventListener('change', redraw));

    const a = () => s.deg * Math.PI / 180;
    function drawCircle(ctx, p) {
      const al = a(), c = Math.cos(al), sn = Math.sin(al), t = Math.tan(al);
      ctx.save();
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.toPx(0), p.toPy(0), p.sx, 0, TAU); ctx.stroke();
      // arco dell'angolo
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.toPx(0), p.toPy(0), p.sx * 0.22, 0, -al, true); ctx.stroke();
      ctx.restore();
      p.label(`${s.deg}°`, 0.25 * Math.cos(al / 2), 0.25 * Math.sin(al / 2), ORANGE, 4, 0);
      // tangente
      if (showTan.checked && Math.abs(c) > 1e-9) {
        const tt = Math.max(-50, Math.min(50, t));
        p.line(1, -2, 1, 2, cssVar('--grid-major'), 1.5, [4, 4]);
        p.line(0, 0, 1, tt, GREEN, 1.5, [5, 4]);
        p.line(1, 0, 1, tt, GREEN, 4);
        if (Math.abs(t) < 1.6) p.point(1, t, GREEN, 4);
        p.label('tan', 1, Math.max(-1.45, Math.min(1.45, tt / 2)), GREEN, 8, 0);
      }
      p.line(0, 0, c, sn, cssVar('--text'), 2);
      if (showCos.checked) { p.line(0, 0, c, 0, BLUE, 4.5); p.label('cos', c / 2, 0, BLUE, -14, sn >= 0 ? 14 : -14); }
      if (showSin.checked) { p.line(c, 0, c, sn, RED, 4.5); p.label('sin', c, sn / 2, RED, c >= 0 ? 8 : -40, 0); }
      p.point(c, sn, cssVar('--math'), 7);
      p.label('P', c, sn, cssVar('--text'), c >= 0 ? 10 : -26, sn >= 0 ? -12 : 14);
    }
    function drawWave(ctx, p) {
      const al = a();
      ctx.save(); ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'center';
      ['π/2', 'π', '3π/2', '2π'].forEach((lab, i) => {
        const x = p.toPx((i + 1) * Math.PI / 2);
        ctx.fillText(lab, x, p.toPy(0) - 8);
        ctx.fillRect(x - 0.5, p.toPy(0) - 4, 1, 8);
      });
      ctx.restore();
      if (showSin.checked) p.drawFunction(Math.sin, RED, 2.5, null, 0, TAU);
      if (showCos.checked) p.drawFunction(Math.cos, BLUE, 2.5, null, 0, TAU);
      if (showTan.checked) p.drawFunction(Math.tan, GREEN, 2, null, 0, TAU);
      p.line(al, p.ymin, al, p.ymax, cssVar('--grid-major'), 1.5, [4, 4]);
      if (showSin.checked) p.point(al, Math.sin(al), RED, 5);
      if (showCos.checked) p.point(al, Math.cos(al), BLUE, 5);
      if (showTan.checked && Math.abs(Math.tan(al)) < 2.2) p.point(al, Math.tan(al), GREEN, 5);
    }

    const R2 = Math.SQRT2 / 2, R3 = Math.sqrt(3);
    const EXACT = [[0, '0'], [0.5, '1/2'], [R2, '√2/2'], [R3 / 2, '√3/2'], [1, '1'], [R3, '√3'], [R3 / 3, '√3/3']];
    function exact(v) {
      for (const [x, s] of EXACT) {
        if (Math.abs(Math.abs(v) - x) < 1e-9) return (v < 0 && x !== 0 ? '−' : '') + s;
      }
      return null;
    }
    function radText(deg) {
      const g = (x, y) => y ? g(y, x % y) : x;
      if (deg === 0) return '0';
      const d = g(deg, 180), n = deg / d, m = 180 / d;
      if (m > 12) return fmtNum(deg * Math.PI / 180, 4);
      return `${n === 1 ? '' : n}π${m === 1 ? '' : '/' + m}`;
    }
    function val(v) { const e = exact(v); return fmtNum(v, 4) + (e && !/^−?\d$/.test(e) ? `  (${e})` : ''); }
    function updateOut() {
      const al = a(), c = Math.cos(al), sn = Math.sin(al);
      const tanUndef = Math.abs(c) < 1e-12;
      const q = s.deg % 90 === 0 ? 'su un asse' : `${Math.floor((s.deg % 360) / 90) + 1}° quadrante`;
      readout(out, [
        ['Angolo in gradi', s.deg + '°'],
        ['Angolo in radianti', radText(s.deg) + ' rad'],
        ['Posizione', q],
        ['sin α', val(sn)],
        ['cos α', val(c)],
        ['tan α', tanUndef ? 'non definita' : val(Math.tan(al))],
        ['sin²α + cos²α', fmtNum(sn * sn + c * c, 6)],
      ]);
    }

    // trascinamento del punto
    let drag = false;
    cCircle.addEventListener('pointerdown', ev => { drag = true; cCircle.setPointerCapture(ev.pointerId); move(ev); });
    cCircle.addEventListener('pointermove', ev => { if (drag) move(ev); });
    cCircle.addEventListener('pointerup', () => { drag = false; });
    function move(ev) {
      const r = cCircle.getBoundingClientRect();
      const x = circle.toX(ev.clientX - r.left), y = circle.toY(ev.clientY - r.top);
      let d = Math.round(Math.atan2(y, x) * 180 / Math.PI);
      if (d < 0) d += 360;
      s.deg = d; angSl.value = d; redraw();
    }
    const playBtn = document.getElementById('g-play');
    let last = 0, acc = 0;
    playBtn.addEventListener('click', () => {
      s.playing = !s.playing;
      playBtn.textContent = s.playing ? '❚❚ Pausa' : '▶ Anima';
      if (s.playing) { last = performance.now(); requestAnimationFrame(tick); }
    });
    function tick(t) {
      if (!s.playing) return;
      acc += (t - last) / 1000 * 45; last = t;
      if (acc >= 1) { const k = Math.floor(acc); acc -= k; s.deg = (s.deg + k) % 360; angSl.value = s.deg; redraw(); }
      requestAnimationFrame(tick);
    }
    updateOut();
  })();

  /* =====================================================
     2. DERIVATA E TANGENTE
     ===================================================== */
  (function deriv() {
    const fIn = document.getElementById('d-f'), err = document.getElementById('d-err');
    const out = document.getElementById('out-deriv'), ctl = document.getElementById('ctl-deriv');
    const cb = { sec: document.getElementById('d-sec'), tan: document.getElementById('d-tan'), der: document.getElementById('d-der') };
    const s = { x0: 1.5, h: 1.5 };
    let f = makeFnSafe(fIn.value, err);
    const plot = new Plot(document.getElementById('c-deriv'), { initialView: [-5, 5, -4, 4], onDraw: draw });
    slider(ctl, { label: 'Punto x₀', min: -5, max: 5, step: 0.05, value: s.x0, decimals: 2, onInput: v => { s.x0 = v; update(); } });
    slider(ctl, { label: 'Incremento h', min: 0.01, max: 3, step: 0.01, value: s.h, decimals: 2, onInput: v => { s.h = v; update(); } });
    fIn.addEventListener('input', () => { const g = makeFnSafe(fIn.value, err); if (g) f = g; update(); });
    Object.values(cb).forEach(c => c.addEventListener('change', update));
    const d1 = x => { const h = 1e-5 * Math.max(1, Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); };

    function draw(ctx, p) {
      if (!f) return;
      if (cb.der.checked) p.drawFunction(d1, PURPLE, 2, [6, 4]);
      p.drawFunction(f, BLUE, 3);
      const x0 = s.x0, y0 = f(x0), x1 = x0 + s.h, y1 = f(x1);
      const ms = (y1 - y0) / s.h, mt = d1(x0);
      if (cb.sec.checked && isFinite(ms)) {
        p.infiniteLine(x0, y0, ms, ORANGE, 2);
        p.line(x0, y0, x1, y0, ORANGE, 1.5, [4, 4]);
        p.line(x1, y0, x1, y1, ORANGE, 1.5, [4, 4]);
        p.label('h', (x0 + x1) / 2, y0, ORANGE, 0, 14, 'center');
        p.label('Δy', x1, (y0 + y1) / 2, ORANGE, 8, 0);
        p.point(x1, y1, ORANGE, 5);
      }
      if (cb.tan.checked && isFinite(mt)) p.infiniteLine(x0, y0, mt, GREEN, 2.5);
      if (isFinite(y0)) { p.point(x0, y0, cssVar('--text'), 6); p.label(`(${fmtNum(x0, 2)}; ${fmtNum(y0, 2)})`, x0, y0, cssVar('--text'), -10, -16, 'right'); }
      if (cb.der.checked && isFinite(mt)) p.point(x0, mt, PURPLE, 5);
    }
    function update() {
      plot.request();
      if (!f) { out.innerHTML = ''; return; }
      const x0 = s.x0, y0 = f(x0), y1 = f(x0 + s.h);
      const ms = (y1 - y0) / s.h, mt = d1(x0), q = y0 - mt * x0;
      readout(out, [
        ['f(x₀)', fmtNum(y0, 4)],
        ['f(x₀ + h)', fmtNum(y1, 4)],
        ['Rapporto incrementale Δy/h', fmtNum(ms, 4)],
        ['Derivata f′(x₀)', fmtNum(mt, 4)],
        ['Differenza', fmtNum(Math.abs(ms - mt), 4)],
        ['Retta tangente', `y = ${fmtNum(mt, 3)}x ${q < 0 ? '−' : '+'} ${fmtNum(Math.abs(q), 3)}`],
        ['La funzione in x₀', Math.abs(mt) < 1e-3 ? 'punto stazionario' : mt > 0 ? 'cresce ↗' : 'decresce ↘'],
      ]);
    }
    update();
  })();

  /* =====================================================
     3. INTEGRALE — SOMME DI RIEMANN
     ===================================================== */
  (function integ() {
    const fIn = document.getElementById('i-f'), err = document.getElementById('i-err');
    const out = document.getElementById('out-integ'), ctl = document.getElementById('ctl-integ');
    const s = { a: 0, b: 6.3, n: 8, m: 'left' };
    let f = makeFnSafe(fIn.value, err);
    const plot = new Plot(document.getElementById('c-integ'), { initialView: [-1.5, 8, -1.5, 3.5], onDraw: draw });
    slider(ctl, { label: 'Estremo a', min: -10, max: 10, step: 0.1, value: s.a, decimals: 1, onInput: v => { s.a = v; update(); } });
    slider(ctl, { label: 'Estremo b', min: -10, max: 10, step: 0.1, value: s.b, decimals: 1, onInput: v => { s.b = v; update(); } });
    slider(ctl, { label: 'Numero di rettangoli n', min: 1, max: 200, step: 1, value: s.n, decimals: 0, onInput: v => { s.n = v; update(); } });
    fIn.addEventListener('input', () => { const g = makeFnSafe(fIn.value, err); if (g) f = g; update(); });
    const seg = document.getElementById('i-method');
    seg.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      s.m = b.dataset.m; update();
    });

    function riemann() {
      const dx = (s.b - s.a) / s.n;
      let sum = 0;
      const parts = [];
      for (let i = 0; i < s.n; i++) {
        const xl = s.a + i * dx, xr = xl + dx;
        if (s.m === 'trap') {
          const yl = f(xl), yr = f(xr);
          sum += (yl + yr) / 2 * dx;
          parts.push({ xl, xr, yl, yr });
        } else {
          const xs = s.m === 'left' ? xl : s.m === 'right' ? xr : (xl + xr) / 2;
          const y = f(xs);
          sum += y * dx;
          parts.push({ xl, xr, yl: y, yr: y, xs });
        }
      }
      return { sum, parts, dx };
    }
    function simpson(a, b) {
      const n = 2000, h = (b - a) / n;
      let acc = f(a) + f(b);
      for (let i = 1; i < n; i++) acc += f(a + i * h) * (i % 2 ? 4 : 2);
      return acc * h / 3;
    }
    function draw(ctx, p) {
      if (!f) return;
      const R = riemann();
      ctx.save();
      for (const q of R.parts) {
        const pos = (q.yl + q.yr) >= 0;
        ctx.fillStyle = pos ? 'rgba(28,126,214,.28)' : 'rgba(224,49,49,.28)';
        ctx.strokeStyle = pos ? 'rgba(28,126,214,.9)' : 'rgba(224,49,49,.9)';
        ctx.lineWidth = s.n > 80 ? 0.5 : 1.2;
        ctx.beginPath();
        ctx.moveTo(p.toPx(q.xl), p.toPy(0));
        ctx.lineTo(p.toPx(q.xl), p.toPy(q.yl));
        ctx.lineTo(p.toPx(q.xr), p.toPy(q.yr));
        ctx.lineTo(p.toPx(q.xr), p.toPy(0));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (q.xs !== undefined && s.n <= 40) p.point(q.xs, q.yl, ORANGE, 3);
      }
      ctx.restore();
      p.drawFunction(f, cssVar('--text'), 2.5);
      p.line(s.a, p.ymin, s.a, p.ymax, cssVar('--muted'), 1, [4, 4]);
      p.line(s.b, p.ymin, s.b, p.ymax, cssVar('--muted'), 1, [4, 4]);
      p.label('a', s.a, 0, cssVar('--muted'), 0, 16, 'center');
      p.label('b', s.b, 0, cssVar('--muted'), 0, 16, 'center');
    }
    function update() {
      plot.request();
      if (!f) { out.innerHTML = ''; return; }
      const R = riemann(), I = simpson(s.a, s.b);
      const e = Math.abs(R.sum - I);
      readout(out, [
        ['Ampiezza Δx', fmtNum(R.dx, 4)],
        ['Somma approssimata', fmtNum(R.sum, 5)],
        ['Integrale (valore preciso)', fmtNum(I, 5)],
        ['Errore assoluto', fmtNum(e, 5)],
        ['Errore relativo', Math.abs(I) > 1e-12 ? fmtNum(e / Math.abs(I) * 100, 3) + ' %' : '—'],
      ]);
    }
    update();
  })();

  /* =====================================================
     4. EQUAZIONE DI SECONDO GRADO
     ===================================================== */
  (function parab() {
    const out = document.getElementById('out-parab'), ctl = document.getElementById('ctl-parab');
    const steps = document.getElementById('parab-steps');
    const s = { a: 1, b: -2, c: -3 };
    const plot = new Plot(document.getElementById('c-parab'), { initialView: [-8, 8, -8, 8], onDraw: draw });
    slider(ctl, { label: 'a', min: -5, max: 5, step: 0.1, value: s.a, decimals: 1, onInput: v => { s.a = v; update(); } });
    slider(ctl, { label: 'b', min: -10, max: 10, step: 0.1, value: s.b, decimals: 1, onInput: v => { s.b = v; update(); } });
    slider(ctl, { label: 'c', min: -10, max: 10, step: 0.1, value: s.c, decimals: 1, onInput: v => { s.c = v; update(); } });

    const f = x => s.a * x * x + s.b * x + s.c;
    function analysis() {
      const { a, b, c } = s;
      const D = b * b - 4 * a * c;
      const xv = -b / (2 * a), yv = -D / (4 * a);
      let roots = [];
      if (a !== 0) {
        if (D > 1e-12) roots = [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].sort((p, q) => p - q);
        else if (Math.abs(D) <= 1e-12) roots = [xv];
      } else if (b !== 0) roots = [-c / b];
      return { D, xv, yv, roots };
    }
    function draw(ctx, p) {
      const A = analysis();
      p.drawFunction(f, BLUE, 3);
      if (s.a !== 0) {
        p.line(A.xv, p.ymin, A.xv, p.ymax, PURPLE, 1.5, [6, 5]);
        p.point(A.xv, A.yv, PURPLE, 6);
        p.label(`V(${fmtNum(A.xv, 2)}; ${fmtNum(A.yv, 2)})`, A.xv, A.yv, PURPLE, 10, s.a > 0 ? 16 : -16);
      }
      p.point(0, s.c, ORANGE, 5);
      A.roots.forEach((r, i) => {
        p.point(r, 0, RED, 6);
        p.label(`x${A.roots.length > 1 ? (i === 0 ? '₁' : '₂') : ''} = ${fmtNum(r, 2)}`, r, 0, RED, 0, (i === 0 ? -1 : 1) * 18 * (s.a >= 0 ? -1 : 1), 'center');
      });
    }
    const tn = v => fmtNum(v, 3).replace('−', '-').replace(',', '{,}');
    const par = v => v < 0 ? `(${tn(v)})` : tn(v);
    function polyTex() {
      const { a, b, c } = s;
      const term = (k, x, first) => {
        if (k === 0) return '';
        const sign = k < 0 ? '-' : (first ? '' : '+');
        const abs = Math.abs(k);
        const coef = (abs === 1 && x) ? '' : tn(abs);
        return `${sign} ${coef}${x}`;
      };
      let t = term(a, 'x^2', true);
      t += term(b, 'x', !t);
      t += term(c, '', !t);
      return (t || '0') + ' = 0';
    }
    function update() {
      plot.request();
      const A = analysis();
      const { a, b, c } = s;
      if (a === 0) {
        readout(out, [['Tipo', 'equazione di 1° grado'], ['Soluzione', A.roots.length ? 'x = ' + fmtNum(A.roots[0], 4) : (c === 0 ? 'indeterminata' : 'impossibile')]]);
        steps.innerHTML = '';
        const d = document.createElement('div'); steps.appendChild(d);
        App.tex(d, polyTex() + `\\quad\\text{con } a = 0 \\text{ non è di secondo grado}`, true);
        return;
      }
      const sol = A.D > 1e-12 ? 'due soluzioni reali distinte' : Math.abs(A.D) <= 1e-12 ? 'due soluzioni reali coincidenti' : 'nessuna soluzione reale';
      const rows = [
        ['Discriminante Δ = b² − 4ac', fmtNum(A.D, 3)],
        ['Soluzioni', sol, A.D < -1e-12 ? 'bad' : 'good'],
      ];
      if (A.roots.length === 2) rows.push(['x₁', fmtNum(A.roots[0], 4)], ['x₂', fmtNum(A.roots[1], 4)]);
      else if (A.roots.length === 1) rows.push(['x₁ = x₂', fmtNum(A.roots[0], 4)]);
      else rows.push(['Soluzioni complesse', `${fmtNum(A.xv, 3)} ± ${fmtNum(Math.sqrt(-A.D) / (2 * Math.abs(a)), 3)}i`]);
      rows.push(
        ['Vertice V', `(${fmtNum(A.xv, 3)}; ${fmtNum(A.yv, 3)})`],
        ['Asse di simmetria', `x = ${fmtNum(A.xv, 3)}`],
        ['Concavità', a > 0 ? 'verso l\'alto ∪' : 'verso il basso ∩'],
        ['Intersezione asse y', `(0; ${fmtNum(c, 2)})`],
        ['Somma x₁ + x₂ = −b/a', fmtNum(-b / a, 3)],
        ['Prodotto x₁·x₂ = c/a', fmtNum(c / a, 3)],
      );
      readout(out, rows);
      // passaggi
      const lines = [polyTex(), `a = ${tn(a)} \\qquad b = ${tn(b)} \\qquad c = ${tn(c)}`,
        `\\Delta = b^2 - 4ac = ${par(b)}^2 - 4\\cdot ${par(a)}\\cdot ${par(c)} = ${tn(A.D)}`];
      if (A.D > 1e-12) {
        lines.push(`x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${tn(-b)} \\pm \\sqrt{${tn(A.D)}}}{${tn(2 * a)}}`);
        lines.push(`x_1 = ${tn(A.roots[0])} \\qquad x_2 = ${tn(A.roots[1])}`);
      } else if (Math.abs(A.D) <= 1e-12) {
        lines.push(`\\Delta = 0 \\Rightarrow x_1 = x_2 = -\\frac{b}{2a} = ${tn(A.xv)}`);
      } else {
        lines.push(`\\Delta < 0 \\Rightarrow \\text{nessuna soluzione reale}`);
      }
      steps.innerHTML = '';
      for (const l of lines) { const d = document.createElement('div'); steps.appendChild(d); App.tex(d, l, true); }
    }
    window.addEventListener('load', update);
    update();
  })();

  App.setupTabs(document.getElementById('tabs'));
})();
