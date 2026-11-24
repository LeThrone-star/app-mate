/* =========================================================
   Laboratorio di Matematica — laboratori aggiuntivi e schede a gruppi
   (sistemi, successioni, triangoli, coniche, numeri complessi,
    studio di funzione, statistica, probabilità)
   ========================================================= */
(function () {
  'use strict';
  const P = window.MathParser;
  const { cssVar, slider, fmtNum, fitCanvas } = window.App;
  const Plot = window.Plot;
  const RED = '#ff6b6b', BLUE = '#4dabf7', GREEN = '#51cf66', PURPLE = '#b197fc', ORANGE = '#ffa94d', YELLOW = '#ffd43b';
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const font = () => getComputedStyle(document.body).fontFamily;

  /* ---------- Schede raggruppate ---------- */
  const GROUPS = [
    ['Algebra ed equazioni', [['parabola', 'Equazione di 2° grado'], ['sistemi', 'Sistemi lineari'], ['successioni', 'Successioni']]],
    ['Geometria e trigonometria', [['goniometria', 'Circonferenza goniometrica'], ['triangoli', 'Triangoli'], ['coniche', 'Coniche'], ['complessi', 'Numeri complessi']]],
    ['Analisi', [['studio', 'Studio di funzione'], ['derivata', 'Derivata e tangente'], ['integrale', 'Integrale e aree']]],
    ['Dati e probabilità', [['statistica', 'Statistica'], ['probabilita', 'Probabilità']]],
  ];
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = GROUPS.map(([g, list]) =>
    `<div class="tab-group"><span class="tab-label">${g}</span>${list.map(([id, l]) => `<button data-tab="${id}">${l}</button>`).join('')}</div>`).join('');

  let lastPanel = document.querySelector('main [data-panel="parabola"]');
  function panel(id, title, theory, extra) {
    const sec = document.createElement('section');
    sec.dataset.panel = id;
    sec.innerHTML = `
      <div class="lab">
        <div class="card stage"><canvas id="c-${id}" aria-label="${title}"></canvas></div>
        <div class="side">
          <div class="card pad"><h3>${extra && extra.title || 'Parametri'}</h3>${extra && extra.top ? extra.top : ''}<div id="ctl-${id}"></div>${extra && extra.bottom ? extra.bottom : ''}</div>
          <div class="card pad"><h3>Risultati</h3><div class="status hidden" id="st-${id}"></div><dl class="readout mt" id="out-${id}"></dl></div>
        </div>
      </div>
      <div class="card pad mt theory-box">${theory}</div>`;
    lastPanel.after(sec);
    lastPanel = sec;
    return {
      canvas: sec.querySelector('canvas'),
      ctl: sec.querySelector('#ctl-' + id),
      out: sec.querySelector('#out-' + id),
      q: sel => sec.querySelector(sel),
      setStatus(cls, msg) { const el = sec.querySelector('#st-' + id); el.className = 'status ' + (msg ? cls : 'hidden'); el.textContent = msg || ''; },
    };
  }
  function readout(el, rows) {
    el.innerHTML = rows.map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ''}">${v}</dd>`).join('');
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
  const link = (hash, label) => `<a href="teoria.html#${hash}">${label || 'Approfondisci nella teoria →'}</a>`;
  const tn = v => fmtNum(v, 3).replace('−', '-').replace(',', '{,}');
  const par = v => v < 0 ? `(${tn(v)})` : tn(v);
  function texLines(el, lines) {
    el.innerHTML = '';
    for (const l of lines) { const d = document.createElement('div'); el.appendChild(d); App.tex(d, l, true); }
  }
  /** Gestisce il trascinamento di punti su un Plot. */
  function draggable(plot, getPoints, onMove, snap) {
    let drag = null;
    plot.onPointerDown = ev => {
      const r = plot.canvas.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
      const pts = getPoints();
      for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(plot.toPx(pts[i][0]) - px, plot.toPy(pts[i][1]) - py) < (ev.pointerType === 'touch' ? 24 : 14)) {
          drag = i; plot.canvas.setPointerCapture(ev.pointerId); return true;
        }
      }
      return false;
    };
    plot.onHover = ev => {
      if (drag === null) return;
      const r = plot.canvas.getBoundingClientRect();
      let x = plot.toX(ev.clientX - r.left), y = plot.toY(ev.clientY - r.top);
      if (snap) { x = Math.round(x / snap) * snap; y = Math.round(y / snap) * snap; }
      onMove(drag, x, y);
      plot.request();
    };
    plot.canvas.addEventListener('pointerup', () => { drag = null; });
  }

  /* =====================================================
     SISTEMI LINEARI
     ===================================================== */
  (function sistemi() {
    const T = panel('sistemi', 'Sistema di due equazioni lineari', `
      <h3>Risoluzione con il metodo di Cramer</h3>
      <div id="sis-steps"></div>
      <p>Ogni equazione \\(ax + by = c\\) è una retta: la soluzione del sistema è il punto in cui le due rette si incontrano. Se le rette sono <b>parallele</b> il sistema è <b>impossibile</b>; se <b>coincidono</b> è <b>indeterminato</b> (infinite soluzioni).</p>
      ${link('equazioni')}`, { title: 'Coefficienti' });
    const s = { a1: 1, b1: 1, c1: 4, a2: 1, b2: -1, c2: 2 };
    const steps = T.q('#sis-steps');
    const lab = { a1: 'a₁', b1: 'b₁', c1: 'c₁', a2: 'a₂', b2: 'b₂', c2: 'c₂' };
    const row = document.createElement('p'); row.className = 'hint'; row.textContent = 'Prima equazione: a₁x + b₁y = c₁'; T.ctl.appendChild(row);
    ['a1', 'b1', 'c1'].forEach(k => slider(T.ctl, { label: lab[k], min: -10, max: 10, step: 0.5, value: s[k], decimals: 1, onInput: v => { s[k] = v; update(); } }));
    const row2 = document.createElement('p'); row2.className = 'hint'; row2.textContent = 'Seconda equazione: a₂x + b₂y = c₂'; T.ctl.appendChild(row2);
    ['a2', 'b2', 'c2'].forEach(k => slider(T.ctl, { label: lab[k], min: -10, max: 10, step: 0.5, value: s[k], decimals: 1, onInput: v => { s[k] = v; update(); } }));
    const plot = new Plot(T.canvas, { initialView: [-8, 8, -6, 6], onDraw: draw });
    function lineDraw(p, a, b, c, col) {
      if (Math.abs(b) > 1e-12) p.drawFunction(x => (c - a * x) / b, col, 3);
      else if (Math.abs(a) > 1e-12) p.line(c / a, p.ymin - 1, c / a, p.ymax + 1, col, 3);
    }
    function solve() {
      const D = s.a1 * s.b2 - s.a2 * s.b1, Dx = s.c1 * s.b2 - s.c2 * s.b1, Dy = s.a1 * s.c2 - s.a2 * s.c1;
      return { D, Dx, Dy };
    }
    function draw(ctx, p) {
      lineDraw(p, s.a1, s.b1, s.c1, BLUE);
      lineDraw(p, s.a2, s.b2, s.c2, ORANGE);
      const { D, Dx, Dy } = solve();
      if (Math.abs(D) > 1e-12) { const x = Dx / D, y = Dy / D; p.point(x, y, RED, 7); p.label(`(${fmtNum(x, 2)}; ${fmtNum(y, 2)})`, x, y, RED, 10, -14); }
    }
    const eq = (a, b, c) => {
      const t = (k, v, first) => k === 0 ? '' : `${k < 0 ? '-' : first ? '' : '+'} ${Math.abs(k) === 1 ? '' : tn(Math.abs(k))}${v}`;
      let l = t(a, 'x', true); l += t(b, 'y', !l);
      return (l || '0') + ' = ' + tn(c);
    };
    function update() {
      plot.request();
      const { D, Dx, Dy } = solve();
      const parallel = Math.abs(D) < 1e-12;
      const same = parallel && Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12;
      const kind = !parallel ? 'determinato: una sola soluzione' : same ? 'indeterminato: infinite soluzioni' : 'impossibile: nessuna soluzione';
      T.setStatus(parallel && !same ? 'bad' : 'good', 'Sistema ' + kind);
      readout(T.out, [
        ['Determinante D = a₁b₂ − a₂b₁', fmtNum(D, 3)],
        ['Dₓ = c₁b₂ − c₂b₁', fmtNum(Dx, 3)],
        ['D_y = a₁c₂ − a₂c₁', fmtNum(Dy, 3)],
        ['Soluzione x', parallel ? '—' : fmtNum(Dx / D, 4)],
        ['Soluzione y', parallel ? '—' : fmtNum(Dy / D, 4)],
        ['Rette', parallel ? (same ? 'coincidenti' : 'parallele') : 'incidenti'],
      ]);
      const lines = [`\\begin{cases} ${eq(s.a1, s.b1, s.c1)} \\\\ ${eq(s.a2, s.b2, s.c2)} \\end{cases}`,
        `D = \\begin{vmatrix} ${tn(s.a1)} & ${tn(s.b1)} \\\\ ${tn(s.a2)} & ${tn(s.b2)} \\end{vmatrix} = ${par(s.a1)}\\cdot ${par(s.b2)} - ${par(s.a2)}\\cdot ${par(s.b1)} = ${tn(D)}`];
      if (!parallel) lines.push(`x = \\frac{D_x}{D} = \\frac{${tn(Dx)}}{${tn(D)}} = ${tn(Dx / D)} \\qquad y = \\frac{D_y}{D} = \\frac{${tn(Dy)}}{${tn(D)}} = ${tn(Dy / D)}`);
      else lines.push(same ? 'D = 0,\\ D_x = D_y = 0 \\Rightarrow \\text{indeterminato}' : 'D = 0,\\ D_x \\neq 0 \\Rightarrow \\text{impossibile}');
      texLines(steps, lines);
    }
    window.addEventListener('load', update);
    update();
  })();

  /* =====================================================
     SUCCESSIONI
     ===================================================== */
  (function successioni() {
    const T = panel('successioni', 'Successioni e progressioni', `
      <h3>Progressioni aritmetiche e geometriche</h3>
      <p>In una <b>progressione aritmetica</b> si somma sempre la stessa <b>ragione</b> \\(d\\); in una <b>geometrica</b> si moltiplica sempre per la stessa ragione \\(q\\). Se \\(|q| &lt; 1\\) i termini tendono a 0 e la somma di infiniti termini è un numero finito (serie geometrica).</p>
      <div class="formula">$$a_n = a_1 + (n-1)d \\qquad S_n = \\frac{n(a_1 + a_n)}{2} \\qquad a_n = a_1 q^{\\,n-1} \\qquad S_n = a_1\\frac{1 - q^n}{1 - q} \\qquad S_\\infty = \\frac{a_1}{1-q}$$</div>
      ${link('successioni')}`, {
      top: seg('suc-type', [['ar', 'Aritmetica'], ['geo', 'Geometrica'], ['f', 'Formula aₙ']], 'ar') +
        `<div class="ctrl" id="suc-fbox" hidden><label><span>aₙ =</span></label><input type="text" id="suc-f" value="1/n" spellcheck="false"><div class="hint" id="suc-err" style="color:var(--bad)"></div></div>`,
      bottom: `<label class="hint mt" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="suc-sum"> Mostra le somme parziali Sₙ</label>`,
    });
    const s = { type: 'ar', a1: 2, d: 1.5, q: 0.8, N: 15, f: n => 1 / n };
    const arBox = document.createElement('div'), geoBox = document.createElement('div'), a1Box = document.createElement('div');
    T.ctl.append(a1Box, arBox, geoBox);
    slider(a1Box, { label: 'Primo termine a₁', min: -10, max: 10, step: 0.5, value: s.a1, decimals: 1, onInput: v => { s.a1 = v; update(); } });
    slider(arBox, { label: 'Ragione d', min: -5, max: 5, step: 0.1, value: s.d, decimals: 1, onInput: v => { s.d = v; update(); } });
    slider(geoBox, { label: 'Ragione q', min: -2, max: 2, step: 0.05, value: s.q, decimals: 2, onInput: v => { s.q = v; update(); } });
    slider(T.ctl, { label: 'Numero di termini n', min: 5, max: 50, step: 1, value: s.N, decimals: 0, onInput: v => { s.N = v; update(); } });
    const fIn = T.q('#suc-f'), fErr = T.q('#suc-err'), showSum = T.q('#suc-sum');
    fIn.addEventListener('input', () => { try { const g = P.makeFn(fIn.value, 'n'); fErr.textContent = ''; s.f = g; } catch (e) { fErr.textContent = '⚠ ' + e.message; } update(); });
    showSum.addEventListener('change', update);
    onSeg(T, 'suc-type', v => { s.type = v; update(); });
    const plot = new Plot(T.canvas, { initialView: [-1, 16, -2, 25], lockAspect: false, sy: 1, onDraw: draw, xLabel: 'n', yLabel: 'aₙ' });
    const term = n => s.type === 'ar' ? s.a1 + (n - 1) * s.d : s.type === 'geo' ? s.a1 * Math.pow(s.q, n - 1) : s.f(n);
    let vals = [], sums = [];
    function compute() {
      vals = []; sums = []; let S = 0;
      for (let n = 1; n <= s.N; n++) { const v = term(n); vals.push(v); S += v; sums.push(S); }
    }
    function fit() {
      const all = vals.concat(showSum.checked ? sums : []).filter(isFinite);
      let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
      if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.12;
      plot.setView(-0.5, s.N + 1, lo - pad, hi + pad);
    }
    function draw(ctx, p) {
      if (showSum.checked) sums.forEach((v, i) => { if (isFinite(v)) p.point(i + 1, v, ORANGE, 4); });
      vals.forEach((v, i) => {
        if (!isFinite(v)) return;
        p.line(i + 1, 0, i + 1, v, 'rgba(130,168,255,.35)', 2);
        p.point(i + 1, v, BLUE, 5);
      });
      if (s.type === 'geo' && Math.abs(s.q) < 1 && showSum.checked) {
        const Sinf = s.a1 / (1 - s.q);
        p.line(p.xmin, Sinf, p.xmax, Sinf, GREEN, 1.5, [6, 5]); p.label('S∞', p.xmax, Sinf, GREEN, -30, -12);
      }
    }
    function update() {
      T.q('#suc-fbox').hidden = s.type !== 'f';
      a1Box.hidden = s.type === 'f'; arBox.hidden = s.type !== 'ar'; geoBox.hidden = s.type !== 'geo';
      compute(); fit(); plot.request();
      const an = vals[vals.length - 1], Sn = sums[sums.length - 1];
      const rows = [['Termine aₙ (n = ' + s.N + ')', fmtNum(an, 4)], ['Somma Sₙ', fmtNum(Sn, 4)], ['Primi termini', vals.slice(0, 6).map(v => fmtNum(v, 3)).join('; ') + '; …']];
      let st = '';
      if (s.type === 'ar') { rows.unshift(['Formula', `aₙ = ${fmtNum(s.a1, 1)} + (n − 1)·${fmtNum(s.d, 1)}`]); st = s.d > 0 ? 'Crescente: diverge a +∞' : s.d < 0 ? 'Decrescente: diverge a −∞' : 'Costante'; }
      else if (s.type === 'geo') {
        rows.unshift(['Formula', `aₙ = ${fmtNum(s.a1, 1)} · ${fmtNum(s.q, 2)}ⁿ⁻¹`]);
        if (Math.abs(s.q) < 1) { st = 'Converge a 0'; rows.push(['Somma infinita S∞ = a₁/(1−q)', fmtNum(s.a1 / (1 - s.q), 4)]); }
        else st = s.q === 1 ? 'Costante' : s.q === -1 ? 'Oscilla senza convergere' : s.q < -1 ? 'Oscilla e diverge' : 'Diverge';
      } else {
        const a = term(1e6);
        st = isFinite(a) && Math.abs(a - term(1e7)) < 1e-4 * Math.max(1, Math.abs(a)) ? `Sembra convergere a ${fmtNum(a, 4)}` : 'Non sembra convergere';
      }
      T.setStatus('good', st);
      readout(T.out, rows);
    }
    update();
  })();

  /* =====================================================
     TRIANGOLI
     ===================================================== */
  (function triangoli() {
    const T = panel('triangoli', 'Triangoli e trigonometria', `
      <h3>Risolvere un triangolo</h3>
      <p>Trascina i vertici A, B, C. La somma degli angoli interni è sempre 180°. Nei triangoli rettangoli vale il <b>teorema di Pitagora</b>; in tutti i triangoli valgono il <b>teorema dei seni</b> e il <b>teorema del coseno</b> (Carnot), che generalizza Pitagora.</p>
      <div class="formula">$$\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta} = \\frac{c}{\\sin\\gamma} = 2R \\qquad a^2 = b^2 + c^2 - 2bc\\cos\\alpha \\qquad A = \\tfrac12 bc\\sin\\alpha = \\sqrt{p(p-a)(p-b)(p-c)}$$</div>
      ${link('geometria')}`, {
      title: 'Opzioni',
      top: `<div class="chk-col">
        <label class="hint"><input type="checkbox" id="tri-circ"> Circonferenza circoscritta</label>
        <label class="hint"><input type="checkbox" id="tri-inc"> Circonferenza inscritta</label>
        <label class="hint"><input type="checkbox" id="tri-h"> Altezza relativa ad AB</label></div>
        <div class="btn-row mt"><button class="btn small" type="button" data-tri="rett">Rettangolo 3-4-5</button><button class="btn small" type="button" data-tri="equi">Equilatero</button><button class="btn small" type="button" data-tri="iso">Isoscele</button></div>`,
    });
    const V = [[0, 0], [6, 0], [2, 4]];
    const plot = new Plot(T.canvas, { initialView: [-2, 9, -1.5, 6.5], onDraw: draw });
    draggable(plot, () => V, (i, x, y) => { V[i] = [x, y]; update(); }, 0.1);
    ['tri-circ', 'tri-inc', 'tri-h'].forEach(id => T.q('#' + id).addEventListener('change', () => plot.request()));
    T.q('.btn-row').addEventListener('click', ev => {
      const b = ev.target.closest('[data-tri]'); if (!b) return;
      const P0 = { rett: [[0, 0], [4, 0], [0, 3]], equi: [[0, 0], [6, 0], [3, 3 * Math.sqrt(3)]], iso: [[0, 0], [6, 0], [3, 5]] }[b.dataset.tri];
      P0.forEach((p, i) => { V[i] = p.slice(); }); update();
    });
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    function geo() {
      const [A, B, C] = V;
      const a = dist(B, C), b = dist(A, C), c = dist(A, B);
      const al = Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c))));
      const be = Math.acos(Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c))));
      const ga = Math.PI - al - be;
      const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
      return { A, B, C, a, b, c, al, be, ga, area };
    }
    function draw(ctx, p) {
      const g = geo(), { A, B, C } = g;
      if (g.area < 1e-9) return;
      ctx.save();
      ctx.fillStyle = 'rgba(130,168,255,.14)'; ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5;
      ctx.beginPath(); [A, B, C].forEach((v, i) => i ? ctx.lineTo(p.toPx(v[0]), p.toPy(v[1])) : ctx.moveTo(p.toPx(v[0]), p.toPy(v[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      const angArc = (V0, V1, V2, ang, col) => {
        const a1 = Math.atan2(-(V1[1] - V0[1]), V1[0] - V0[0]), a2 = Math.atan2(-(V2[1] - V0[1]), V2[0] - V0[0]);
        let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.toPx(V0[0]), p.toPy(V0[1]), 26, a1, a1 + d, d < 0); ctx.stroke(); ctx.restore();
        const mid = a1 + d / 2;
        const lx = p.toPx(V0[0]) + Math.cos(mid) * 44, ly = p.toPy(V0[1]) + Math.sin(mid) * 44;
        ctx.save(); ctx.font = '600 12px ' + font(); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.abs(ang / DEG - 90) < 0.05 ? '90°' : fmtNum(ang / DEG, 1) + '°', lx, ly); ctx.restore();
      };
      angArc(A, B, C, g.al, ORANGE); angArc(B, C, A, g.be, ORANGE); angArc(C, A, B, g.ga, ORANGE);
      const sideLab = (P1, P2, txt) => p.label(txt, (P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2, cssVar('--text'), 0, 0, 'center');
      sideLab(B, C, 'a = ' + fmtNum(g.a, 2)); sideLab(A, C, 'b = ' + fmtNum(g.b, 2)); sideLab(A, B, 'c = ' + fmtNum(g.c, 2));
      if (T.q('#tri-circ').checked) {
        const D = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
        const ux = ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) + (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) + (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) / D;
        const uy = ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) + (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) + (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) / D;
        const R = dist([ux, uy], A);
        ctx.save(); ctx.strokeStyle = PURPLE; ctx.lineWidth = 1.8; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(p.toPx(ux), p.toPy(uy), R * p.sx, 0, TAU); ctx.stroke(); ctx.restore();
        p.point(ux, uy, PURPLE, 4);
      }
      if (T.q('#tri-inc').checked) {
        const per = g.a + g.b + g.c;
        const ix = (g.a * A[0] + g.b * B[0] + g.c * C[0]) / per, iy = (g.a * A[1] + g.b * B[1] + g.c * C[1]) / per;
        const r = 2 * g.area / per;
        ctx.save(); ctx.strokeStyle = GREEN; ctx.lineWidth = 1.8; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(p.toPx(ix), p.toPy(iy), r * p.sx, 0, TAU); ctx.stroke(); ctx.restore();
        p.point(ix, iy, GREEN, 4);
      }
      if (T.q('#tri-h').checked) {
        const dx = B[0] - A[0], dy = B[1] - A[1], t = ((C[0] - A[0]) * dx + (C[1] - A[1]) * dy) / (dx * dx + dy * dy);
        const H = [A[0] + t * dx, A[1] + t * dy];
        if (t < 0 || t > 1) p.line(t < 0 ? A[0] : B[0], t < 0 ? A[1] : B[1], H[0], H[1], cssVar('--muted'), 1, [3, 4]);
        p.line(C[0], C[1], H[0], H[1], YELLOW, 2, [6, 4]);
        p.label('h = ' + fmtNum(dist(C, H), 2), (C[0] + H[0]) / 2, (C[1] + H[1]) / 2, YELLOW, 8, 0);
      }
      [['A', A], ['B', B], ['C', C]].forEach(([n, v]) => { p.point(v[0], v[1], BLUE, 7); p.label(n, v[0], v[1], cssVar('--text'), -18, -16); });
    }
    function update() {
      plot.request();
      const g = geo();
      if (g.area < 1e-9) { T.setStatus('bad', 'I tre punti sono allineati: non è un triangolo'); readout(T.out, []); return; }
      const angs = [g.al, g.be, g.ga].map(x => x / DEG), maxA = Math.max(...angs);
      const sides = [g.a, g.b, g.c].map(x => +x.toFixed(2));
      const eqS = (x, y) => Math.abs(x - y) < 0.01;
      const typeS = eqS(sides[0], sides[1]) && eqS(sides[1], sides[2]) ? 'equilatero' : (eqS(sides[0], sides[1]) || eqS(sides[1], sides[2]) || eqS(sides[0], sides[2])) ? 'isoscele' : 'scaleno';
      const typeA = Math.abs(maxA - 90) < 0.05 ? 'rettangolo' : maxA > 90 ? 'ottusangolo' : 'acutangolo';
      T.setStatus('good', `Triangolo ${typeA} ${typeS}`);
      const rows = [
        ['Lati a, b, c', sides.map(x => fmtNum(x, 2)).join(' · ')],
        ['Angoli α, β, γ', angs.map(x => fmtNum(x, 1) + '°').join(' · ')],
        ['Somma degli angoli', fmtNum(angs.reduce((x, y) => x + y, 0), 1) + '°'],
        ['Perimetro', fmtNum(g.a + g.b + g.c, 3)],
        ['Area', fmtNum(g.area, 3)],
        ['Raggio circoscritto R = a/(2 sin α)', fmtNum(g.a / (2 * Math.sin(g.al)), 3)],
        ['Raggio inscritto r = 2A/(2p)', fmtNum(2 * g.area / (g.a + g.b + g.c), 3)],
      ];
      if (typeA === 'rettangolo') {
        const sorted = [g.a, g.b, g.c].sort((x, y) => x - y);
        rows.push(['Pitagora: cateti² sommati', fmtNum(sorted[0] ** 2 + sorted[1] ** 2, 3)], ['Ipotenusa²', fmtNum(sorted[2] ** 2, 3)]);
      }
      readout(T.out, rows);
    }
    update();
  })();

  /* =====================================================
     CONICHE
     ===================================================== */
  (function coniche() {
    const T = panel('coniche', 'Coniche', `
      <h3>Le coniche</h3>
      <p>Circonferenza, parabola, ellisse e iperbole si ottengono tagliando un cono con un piano. Ognuna è un luogo di punti: la <b>circonferenza</b> ha i punti a distanza \\(r\\) dal centro; la <b>parabola</b> i punti equidistanti da fuoco e direttrice; l'<b>ellisse</b> quelli con somma delle distanze dai fuochi costante; l'<b>iperbole</b> quelli con differenza costante. L'<b>eccentricità</b> \\(e\\) misura quanto la curva è "schiacciata".</p>
      <div id="con-eq" class="formula"></div>
      ${link('coniche')}`, { top: seg('con-type', [['circ', 'Circonferenza'], ['parab', 'Parabola'], ['ell', 'Ellisse'], ['ip', 'Iperbole']], 'circ') });
    const s = { type: 'circ', x0: 0, y0: 0, r: 3, a: 0.5, b: 0, c: -2, A: 5, B: 3 };
    const boxes = { circ: document.createElement('div'), parab: document.createElement('div'), ell: document.createElement('div'), ip: document.createElement('div') };
    Object.values(boxes).forEach(b => T.ctl.appendChild(b));
    const plot = new Plot(T.canvas, { initialView: [-9, 9, -7, 7], onDraw: draw });
    const sl = (box, label, key, min, max, step) => slider(box, { label, min, max, step, value: s[key], decimals: step < 1 ? 1 : 0, onInput: v => { s[key] = v; update(); } });
    sl(boxes.circ, 'Centro x₀', 'x0', -5, 5, 0.5); sl(boxes.circ, 'Centro y₀', 'y0', -5, 5, 0.5); sl(boxes.circ, 'Raggio r', 'r', 0.5, 6, 0.1);
    sl(boxes.parab, 'a', 'a', -3, 3, 0.1); sl(boxes.parab, 'b', 'b', -5, 5, 0.1); sl(boxes.parab, 'c', 'c', -5, 5, 0.1);
    sl(boxes.ell, 'Semiasse a (orizzontale)', 'A', 0.5, 8, 0.1); sl(boxes.ell, 'Semiasse b (verticale)', 'B', 0.5, 8, 0.1);
    const ipA = document.createElement('div'); boxes.ip.appendChild(ipA);
    slider(boxes.ip, { label: 'a', min: 0.5, max: 6, step: 0.1, value: 2, decimals: 1, onInput: v => { s.iA = v; update(); } });
    slider(boxes.ip, { label: 'b', min: 0.5, max: 6, step: 0.1, value: 1.5, decimals: 1, onInput: v => { s.iB = v; update(); } });
    s.iA = 2; s.iB = 1.5;
    onSeg(T, 'con-type', v => { s.type = v; update(); });
    const eqEl = T.q('#con-eq');
    function param(ctx, p, fx, fy, t0, t1, col, n) {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= (n || 400); i++) { const t = t0 + (t1 - t0) * i / (n || 400); const x = p.toPx(fx(t)), y = p.toPy(fy(t)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
    }
    function draw(ctx, p) {
      if (s.type === 'circ') {
        param(ctx, p, t => s.x0 + s.r * Math.cos(t), t => s.y0 + s.r * Math.sin(t), 0, TAU, BLUE);
        p.point(s.x0, s.y0, ORANGE, 5); p.line(s.x0, s.y0, s.x0 + s.r, s.y0, ORANGE, 2, [5, 4]);
        p.label('r', s.x0 + s.r / 2, s.y0, ORANGE, 0, -12, 'center');
      } else if (s.type === 'parab') {
        if (Math.abs(s.a) < 1e-9) { p.drawFunction(x => s.b * x + s.c, BLUE, 3); return; }
        const xv = -s.b / (2 * s.a), yv = s.c - s.b * s.b / (4 * s.a), f = 1 / (4 * s.a);
        p.drawFunction(x => s.a * x * x + s.b * x + s.c, BLUE, 3);
        p.line(p.xmin, yv - f, p.xmax, yv - f, GREEN, 2, [7, 5]); p.label('direttrice', p.xmin, yv - f, GREEN, 6, -12);
        p.line(xv, p.ymin, xv, p.ymax, cssVar('--muted'), 1, [4, 5]);
        p.point(xv, yv + f, ORANGE, 6); p.label('F', xv, yv + f, ORANGE, 8, -10);
        p.point(xv, yv, PURPLE, 5); p.label('V', xv, yv, PURPLE, 8, 12);
      } else if (s.type === 'ell') {
        param(ctx, p, t => s.A * Math.cos(t), t => s.B * Math.sin(t), 0, TAU, BLUE);
        const c = Math.sqrt(Math.abs(s.A * s.A - s.B * s.B)), horiz = s.A >= s.B;
        const F = horiz ? [[c, 0], [-c, 0]] : [[0, c], [0, -c]];
        F.forEach(([x, y], i) => { p.point(x, y, ORANGE, 6); p.label(i ? 'F₂' : 'F₁', x, y, ORANGE, 8, -10); });
        p.line(-s.A, 0, s.A, 0, cssVar('--muted'), 1, [4, 4]); p.line(0, -s.B, 0, s.B, cssVar('--muted'), 1, [4, 4]);
      } else {
        const a = s.iA, b = s.iB, c = Math.sqrt(a * a + b * b), R = 4;
        param(ctx, p, t => a * Math.cosh(t), t => b * Math.sinh(t), -R, R, BLUE);
        param(ctx, p, t => -a * Math.cosh(t), t => b * Math.sinh(t), -R, R, BLUE);
        p.infiniteLine(0, 0, b / a, GREEN, 1.5, [6, 5]); p.infiniteLine(0, 0, -b / a, GREEN, 1.5, [6, 5]);
        [[c, 0], [-c, 0]].forEach(([x, y], i) => { p.point(x, y, ORANGE, 6); p.label(i ? 'F₂' : 'F₁', x, y, ORANGE, 8, -10); });
      }
    }
    function update() {
      Object.entries(boxes).forEach(([k, b]) => { b.hidden = k !== s.type; });
      plot.request();
      let rows = [], eq = '';
      if (s.type === 'circ') {
        eq = `(x ${s.x0 < 0 ? '+' : '-'} ${tn(Math.abs(s.x0))})^2 + (y ${s.y0 < 0 ? '+' : '-'} ${tn(Math.abs(s.y0))})^2 = ${tn(s.r * s.r)}`;
        rows = [['Centro', `(${fmtNum(s.x0, 1)}; ${fmtNum(s.y0, 1)})`], ['Raggio', fmtNum(s.r, 2)], ['Circonferenza 2πr', fmtNum(TAU * s.r, 3)], ['Area πr²', fmtNum(Math.PI * s.r * s.r, 3)], ['Eccentricità', '0']];
      } else if (s.type === 'parab') {
        eq = `y = ${tn(s.a)}x^2 ${s.b < 0 ? '-' : '+'} ${tn(Math.abs(s.b))}x ${s.c < 0 ? '-' : '+'} ${tn(Math.abs(s.c))}`;
        if (Math.abs(s.a) < 1e-9) rows = [['Attenzione', 'con a = 0 è una retta']];
        else {
          const xv = -s.b / (2 * s.a), yv = s.c - s.b * s.b / (4 * s.a), f = 1 / (4 * s.a);
          rows = [['Vertice V', `(${fmtNum(xv, 2)}; ${fmtNum(yv, 2)})`], ['Fuoco F', `(${fmtNum(xv, 2)}; ${fmtNum(yv + f, 2)})`], ['Direttrice', `y = ${fmtNum(yv - f, 2)}`], ['Asse', `x = ${fmtNum(xv, 2)}`], ['Concavità', s.a > 0 ? 'verso l\'alto' : 'verso il basso'], ['Eccentricità', '1']];
        }
      } else if (s.type === 'ell') {
        eq = `\\frac{x^2}{${tn(s.A * s.A)}} + \\frac{y^2}{${tn(s.B * s.B)}} = 1`;
        const big = Math.max(s.A, s.B), c = Math.sqrt(Math.abs(s.A * s.A - s.B * s.B));
        rows = [['Semiassi a, b', `${fmtNum(s.A, 1)}; ${fmtNum(s.B, 1)}`], ['Semidistanza focale c', fmtNum(c, 3)], ['Fuochi', s.A >= s.B ? `(±${fmtNum(c, 2)}; 0)` : `(0; ±${fmtNum(c, 2)})`], ['Eccentricità e = c/a', fmtNum(c / big, 3)], ['Area πab', fmtNum(Math.PI * s.A * s.B, 3)]];
        if (Math.abs(s.A - s.B) < 1e-9) rows.push(['Nota', 'a = b: è una circonferenza']);
      } else {
        const a = s.iA, b = s.iB, c = Math.sqrt(a * a + b * b);
        eq = `\\frac{x^2}{${tn(a * a)}} - \\frac{y^2}{${tn(b * b)}} = 1`;
        rows = [['Semiassi a, b', `${fmtNum(a, 1)}; ${fmtNum(b, 1)}`], ['c = √(a² + b²)', fmtNum(c, 3)], ['Fuochi', `(±${fmtNum(c, 2)}; 0)`], ['Asintoti', `y = ±${fmtNum(b / a, 3)}x`], ['Eccentricità e = c/a', fmtNum(c / a, 3)]];
      }
      App.tex(eqEl, eq, true);
      readout(T.out, rows);
    }
    window.addEventListener('load', update);
    update();
  })();

  /* =====================================================
     NUMERI COMPLESSI
     ===================================================== */
  (function complessi() {
    const T = panel('complessi', 'Numeri complessi nel piano di Gauss', `
      <h3>Numeri complessi</h3>
      <p>Un numero complesso \\(z = a + bi\\) (con \\(i^2 = -1\\)) è un punto del <b>piano di Gauss</b>. La <b>somma</b> segue la regola del parallelogramma; nel <b>prodotto</b> i moduli si moltiplicano e gli argomenti si sommano (una rotazione!). Un numero ha esattamente \\(n\\) radici \\(n\\)-esime, ai vertici di un poligono regolare. Trascina \\(z_1\\) e \\(z_2\\).</p>
      <div class="formula">$$z = a + bi = \\rho(\\cos\\theta + i\\sin\\theta) \\qquad z_1 z_2 = \\rho_1\\rho_2\\,[\\cos(\\theta_1+\\theta_2) + i\\sin(\\theta_1+\\theta_2)] \\qquad z^n = \\rho^n(\\cos n\\theta + i\\sin n\\theta)$$</div>
      ${link('complessi')}`, { title: 'Operazione', top: seg('cpx-op', [['sum', 'z₁ + z₂'], ['dif', 'z₁ − z₂'], ['mul', 'z₁ · z₂'], ['div', 'z₁ / z₂'], ['pow', 'z₁ⁿ'], ['root', 'ⁿ√z₁']], 'sum') });
    const s = { op: 'sum', n: 3 };
    const z = [[2, 1], [1, 2]];
    const nBox = document.createElement('div'); T.ctl.appendChild(nBox);
    slider(nBox, { label: 'Esponente / indice n', min: 2, max: 8, step: 1, value: s.n, decimals: 0, onInput: v => { s.n = v; update(); } });
    const plot = new Plot(T.canvas, { initialView: [-6, 6, -5, 5], onDraw: draw, xLabel: 'Re', yLabel: 'Im' });
    draggable(plot, () => (s.op === 'pow' || s.op === 'root') ? [z[0]] : z, (i, x, y) => { z[i] = [x, y]; update(); }, 0.25);
    onSeg(T, 'cpx-op', v => { s.op = v; update(); });
    const mod = ([a, b]) => Math.hypot(a, b), arg = ([a, b]) => Math.atan2(b, a);
    const mul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
    const fmtZ = ([a, b]) => `${fmtNum(a, 2)} ${b < 0 ? '−' : '+'} ${fmtNum(Math.abs(b), 2)}i`;
    const trig = w => `${fmtNum(mod(w), 2)} ∠ ${fmtNum(arg(w) / DEG, 1)}°`;
    function result() {
      const [z1, z2] = z;
      switch (s.op) {
        case 'sum': return [[z1[0] + z2[0], z1[1] + z2[1]]];
        case 'dif': return [[z1[0] - z2[0], z1[1] - z2[1]]];
        case 'mul': return [mul(z1, z2)];
        case 'div': { const d = z2[0] ** 2 + z2[1] ** 2; return d < 1e-12 ? [] : [[(z1[0] * z2[0] + z1[1] * z2[1]) / d, (z1[1] * z2[0] - z1[0] * z2[1]) / d]]; }
        case 'pow': { const r = Math.pow(mod(z1), s.n), t = arg(z1) * s.n; return [[r * Math.cos(t), r * Math.sin(t)]]; }
        case 'root': { const r = Math.pow(mod(z1), 1 / s.n), t = arg(z1); return Array.from({ length: s.n }, (_, k) => [r * Math.cos((t + TAU * k) / s.n), r * Math.sin((t + TAU * k) / s.n)]); }
      }
      return [];
    }
    const vec = (p, w, col, lab, w2) => { p.line(0, 0, w[0], w[1], col, w2 || 2.5); p.point(w[0], w[1], col, 7); p.label(lab, w[0], w[1], col, 10, -12); };
    function draw(ctx, p) {
      const [z1, z2] = z, R = result();
      const one = s.op === 'pow' || s.op === 'root';
      if (s.op === 'sum') { p.line(z1[0], z1[1], R[0][0], R[0][1], cssVar('--muted'), 1, [5, 4]); p.line(z2[0], z2[1], R[0][0], R[0][1], cssVar('--muted'), 1, [5, 4]); }
      if (s.op === 'root' && R.length) {
        const r = mod(R[0]);
        ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = cssVar('--muted'); ctx.beginPath(); ctx.arc(p.toPx(0), p.toPy(0), r * p.sx, 0, TAU); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5; ctx.beginPath();
        R.forEach((w, i) => i ? ctx.lineTo(p.toPx(w[0]), p.toPy(w[1])) : ctx.moveTo(p.toPx(w[0]), p.toPy(w[1]))); ctx.closePath(); ctx.stroke(); ctx.restore();
      }
      vec(p, z1, BLUE, 'z₁');
      if (!one) vec(p, z2, ORANGE, 'z₂');
      R.forEach((w, i) => vec(p, w, GREEN, s.op === 'root' ? `w${'₀₁₂₃₄₅₆₇'[i]}` : 'risultato', 2));
    }
    function update() {
      nBox.hidden = !(s.op === 'pow' || s.op === 'root');
      plot.request();
      const R = result();
      const rows = [['z₁', fmtZ(z[0])], ['z₁ in forma trigonometrica', trig(z[0])]];
      if (!(s.op === 'pow' || s.op === 'root')) rows.push(['z₂', fmtZ(z[1])], ['z₂ in forma trigonometrica', trig(z[1])]);
      if (!R.length) rows.push(['Risultato', 'non definito (divisione per 0)']);
      else if (s.op === 'root') R.forEach((w, i) => rows.push([`Radice w${'₀₁₂₃₄₅₆₇'[i]}`, fmtZ(w)]));
      else rows.push(['Risultato', fmtZ(R[0])], ['Modulo e argomento', trig(R[0])]);
      rows.push(['Coniugato di z₁', fmtZ([z[0][0], -z[0][1]])]);
      readout(T.out, rows);
    }
    update();
  })();

  /* =====================================================
     STUDIO DI FUNZIONE
     ===================================================== */
  (function studio() {
    const PRE = ['(x^2 - 1)/(x - 2)', 'x^3 - 3x', 'x e^(-x)', 'ln(x)/x', '(x^2 + 1)/(x^2 - 4)', 'x - 2sin(x)'];
    const T = panel('studio', 'Studio di funzione', `
      <h3>Lo studio di funzione</h3>
      <p>Per disegnare il grafico di una funzione si studiano in ordine: <b>dominio</b>, <b>simmetrie</b>, <b>intersezioni con gli assi</b>, <b>segno</b>, <b>limiti e asintoti</b>, <b>derivata prima</b> (crescenza, massimi e minimi) e <b>derivata seconda</b> (concavità e flessi). Qui Astral li calcola in modo numerico nell'intervallo \\([-20, 20]\\): confrontali con i tuoi calcoli!</p>
      <div class="formula">$$f'(x) &gt; 0 \\Rightarrow f \\text{ crescente} \\qquad f'(x_0) = 0 \\text{ e cambio di segno} \\Rightarrow \\text{max/min} \\qquad f''(x) &gt; 0 \\Rightarrow \\text{concava verso l'alto}$$</div>
      ${link('studio-funzione')}`, {
      title: 'Funzione',
      top: `<div class="ctrl"><label><span>f(x) =</span></label><input type="text" id="stu-f" value="${PRE[0]}" spellcheck="false"><div class="hint" id="stu-err" style="color:var(--bad)"></div></div>
        <div class="btn-row">${PRE.map(f => `<button class="btn small" type="button" data-f="${f}">${f}</button>`).join('')}</div>`,
    });
    const fIn = T.q('#stu-f'), err = T.q('#stu-err');
    let f = null, A = null;
    const plot = new Plot(T.canvas, { initialView: [-8, 8, -8, 8], onDraw: draw });
    const safe = x => { try { const y = f(x); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } };
    const d1 = x => { const h = 1e-5 * Math.max(1, Math.abs(x)); return (safe(x + h) - safe(x - h)) / (2 * h); };
    const d2 = x => { const h = 1e-3 * Math.max(1, Math.abs(x)); return (safe(x + h) - 2 * safe(x) + safe(x - h)) / (h * h); };
    const r4 = v => Math.abs(v) < 1e-9 ? 0 : +v.toFixed(4);
    function bisect(g, lo, hi) { let glo = g(lo); for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2, gm = g(m); if ((gm < 0) === (glo < 0)) { lo = m; glo = gm; } else hi = m; } return (lo + hi) / 2; }
    function analyze() {
      const L = 20, N = 8000, h = 2 * L / N;
      const xs = [], ys = [];
      for (let i = 0; i <= N; i++) { const x = -L + i * h + 1e-7; xs.push(x); ys.push(safe(x)); }
      const R = { zeros: [], ext: [], flex: [], vas: [], dom: [], sym: '', hor: [], inc: [], dec: [] };
      // dominio (intervalli in cui f è definita)
      let start = null;
      for (let i = 0; i <= N; i++) {
        const ok = isFinite(ys[i]);
        if (ok && start === null) start = xs[i];
        if ((!ok || i === N) && start !== null) { R.dom.push([start, ok ? xs[i] : xs[i - 1]]); start = null; }
      }
      // asintoti verticali: valori enormi vicino a un punto
      for (let i = 1; i < N; i++) {
        const a = ys[i - 1], b = ys[i];
        const big = v => !isFinite(v) || Math.abs(v) > 1e3;
        if ((isFinite(a) && isFinite(b) && (a < 0) !== (b < 0) && Math.abs(a - b) > 200) || (isFinite(a) !== isFinite(b))) {
          let x0;
          if (isFinite(a) && isFinite(b)) x0 = bisect(x => { const v = safe(x); return isFinite(v) ? v : (a < 0 ? 1 : -1); }, xs[i - 1], xs[i]);
          else x0 = isFinite(a) ? xs[i] : xs[i - 1];
          const near = [safe(x0 - 1e-7), safe(x0 + 1e-7)];
          if (near.some(v => isFinite(v) && Math.abs(v) > 1e4)) {
            const xr = Math.abs(x0 - Math.round(x0)) < 1e-4 ? Math.round(x0) : x0;
            if (!R.vas.some(v => Math.abs(v - xr) < 1e-3)) R.vas.push(xr);
          }
        }
        // isolati: un solo campione non definito con valori enormi intorno
        if (!isFinite(b) && isFinite(a) && big(a)) { /* già gestito sopra */ }
      }
      // zeri
      for (let i = 1; i <= N; i++) {
        const a = ys[i - 1], b = ys[i];
        if (!isFinite(a) || !isFinite(b)) continue;
        if (a === 0) R.zeros.push(xs[i - 1]);
        else if ((a < 0) !== (b < 0) && Math.abs(a - b) < 50) {
          const z = bisect(safe, xs[i - 1], xs[i]);
          if (Math.abs(safe(z)) < 1e-6 && !R.vas.some(v => Math.abs(v - z) < 1e-3)) R.zeros.push(z);
        }
      }
      // estremi e flessi (sul campione più rado)
      const M = 2000, hh = 2 * L / M;
      let pd = null, pdd = null;
      for (let i = 0; i <= M; i++) {
        const x = -L + i * hh + 3e-7, D = d1(x), DD = d2(x);
        if (pd !== null && isFinite(D) && isFinite(pd.v) && (D < 0) !== (pd.v < 0) && !R.vas.some(v => v > pd.x && v < x)) {
          const xe = bisect(d1, pd.x, x), ye = safe(xe);
          if (isFinite(ye) && Math.abs(d1(xe)) < 1e-3 * Math.max(1, Math.abs(ye))) R.ext.push({ x: xe, y: ye, type: pd.v > 0 ? 'max' : 'min' });
        }
        if (pdd !== null && isFinite(DD) && isFinite(pdd.v) && (DD < 0) !== (pdd.v < 0) && Math.abs(DD - pdd.v) < 1e3 && !R.vas.some(v => v > pdd.x && v < x)) {
          const xf = bisect(d2, pdd.x, x), yf = safe(xf);
          if (isFinite(yf)) R.flex.push({ x: xf, y: yf });
        }
        pd = { x, v: D }; pdd = { x, v: DD };
      }
      // simmetria
      let even = true, odd = true, cnt = 0;
      for (let x = 0.37; x < 15; x += 0.73) {
        const a = safe(x), b = safe(-x);
        if (!isFinite(a) || !isFinite(b)) continue;
        cnt++;
        if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) even = false;
        if (Math.abs(a + b) > 1e-6 * Math.max(1, Math.abs(a))) odd = false;
      }
      R.sym = cnt < 3 ? 'non verificabile' : even ? 'pari (simmetrica rispetto all\'asse y)' : odd ? 'dispari (simmetrica rispetto all\'origine)' : 'né pari né dispari';
      // asintoti orizzontali / obliqui
      for (const sgn of [1, -1]) {
        const X1 = sgn * 1e5, X2 = sgn * 1e6;
        const y1 = safe(X1), y2 = safe(X2);
        if (!isFinite(y1) || !isFinite(y2)) continue;
        const m = (y2 - y1) / (X2 - X1), q = y2 - m * X2;
        if (Math.abs(m) < 1e-5 && Math.abs(y2 - y1) < 1e-3 * Math.max(1, Math.abs(y2))) R.hor.push({ sgn, m: 0, q: y2 });
        else if (Math.abs(m) > 1e-5 && Math.abs(m) < 1e3) {
          const q1 = y1 - m * X1;
          if (Math.abs(q - q1) < 1e-2 * Math.max(1, Math.abs(q))) R.hor.push({ sgn, m, q });
        }
      }
      // crescenza tra i punti critici (nella finestra visibile)
      const cps = [-L, ...R.ext.map(e => e.x), ...R.vas, L].sort((a, b) => a - b);
      for (let i = 0; i < cps.length - 1; i++) {
        const xm = (cps[i] + cps[i + 1]) / 2, D = d1(xm);
        if (!isFinite(D) || !isFinite(safe(xm))) continue;
        (D > 0 ? R.inc : R.dec).push([cps[i], cps[i + 1]]);
      }
      R.y0 = safe(0);
      return R;
    }
    function draw(ctx, p) {
      if (!f || !A) return;
      A.vas.forEach(x => { p.line(x, p.ymin, x, p.ymax, RED, 1.5, [7, 5]); });
      A.hor.forEach(h => { p.infiniteLine(0, h.q, h.m, GREEN, 1.5, [7, 5]); });
      p.drawFunction(safe, BLUE, 3);
      A.zeros.forEach(x => p.point(x, 0, RED, 5));
      if (isFinite(A.y0)) p.point(0, A.y0, ORANGE, 5);
      A.ext.forEach(e => { p.point(e.x, e.y, YELLOW, 6); p.label(e.type === 'max' ? 'max' : 'min', e.x, e.y, YELLOW, 8, e.type === 'max' ? -14 : 14); });
      A.flex.forEach(e => p.point(e.x, e.y, PURPLE, 5));
    }
    const iv = ([a, b]) => `(${a <= -19.99 ? '−∞' : fmtNum(a, 2)}; ${b >= 19.99 ? '+∞' : fmtNum(b, 2)})`;
    function update(fit) {
      try { const g = P.makeFn(fIn.value, 'x'); f = g; err.textContent = ''; } catch (e) { err.textContent = '⚠ ' + e.message; f = null; }
      if (!f) { readout(T.out, []); plot.request(); return; }
      A = analyze();
      if (fit) {
        const ys = [0, ...A.ext.map(e => e.y), ...A.flex.map(e => e.y), isFinite(A.y0) ? A.y0 : 0].filter(v => isFinite(v) && Math.abs(v) < 1e4);
        let lo = Math.min(-4, ...ys), hi = Math.max(4, ...ys);
        const pad = (hi - lo) * 0.25;
        const xs = [0, ...A.zeros, ...A.ext.map(e => e.x), ...A.vas, ...A.flex.map(e => e.x)].filter(v => Math.abs(v) <= 20);
        const xl = Math.min(-8, ...xs) - 2, xh = Math.max(8, ...xs) + 2;
        plot.setView(xl, xh, lo - pad, hi + pad);
      }
      plot.request();
      const list = (arr, fm) => arr.length ? arr.slice(0, 6).map(fm).join('; ') + (arr.length > 6 ? ' …' : '') : 'nessuno';
      const full = A.dom.length === 1 && A.dom[0][0] < -19.9 && A.dom[0][1] > 19.9;
      const holes = A.vas.filter(v => A.dom.some(([a, b]) => v > a && v < b));
      const dom = full ? (holes.length ? `ℝ \\ {${holes.map(v => fmtNum(r4(v), 3)).join('; ')}}` : 'ℝ') : (A.dom.map(iv).join(' ∪ ') || 'vuoto') + (holes.length ? `, escluso x = ${holes.map(v => fmtNum(r4(v), 3)).join('; ')}` : '');
      readout(T.out, [
        ['Dominio', dom],
        ['Simmetria', A.sym],
        ['Zeri (asse x)', list(A.zeros, x => 'x = ' + fmtNum(r4(x), 3))],
        ['Intersezione asse y', isFinite(A.y0) ? `(0; ${fmtNum(A.y0, 3)})` : 'nessuna'],
        ['Asintoti verticali', list(A.vas, x => 'x = ' + fmtNum(r4(x), 3))],
        ['Asintoti orizzontali/obliqui', list(A.hor, h => `${h.sgn > 0 ? '+∞' : '−∞'}: y = ${h.m ? fmtNum(h.m, 3) + 'x ' + (h.q < 0 ? '− ' : '+ ') + fmtNum(Math.abs(h.q), 3) : fmtNum(h.q, 3)}`)],
        ['Massimi e minimi', list(A.ext, e => `${e.type} (${fmtNum(r4(e.x), 2)}; ${fmtNum(r4(e.y), 2)})`)],
        ['Flessi', list(A.flex, e => `(${fmtNum(r4(e.x), 2)}; ${fmtNum(r4(e.y), 2)})`)],
        ['Crescente in', list(A.inc, iv)],
        ['Decrescente in', list(A.dec, iv)],
      ]);
    }
    let fitTimer = null;
    fIn.addEventListener('input', () => { update(false); clearTimeout(fitTimer); fitTimer = setTimeout(() => update(true), 700); });
    T.q('.btn-row').addEventListener('click', ev => { const b = ev.target.closest('[data-f]'); if (!b) return; fIn.value = b.dataset.f; update(true); });
    let fitted = false;
    plot.onDraw = (ctx, p) => { if (!fitted && p.w > 0) { fitted = true; update(true); } draw(ctx, p); };
    update(false);
  })();

  /* =====================================================
     STATISTICA
     ===================================================== */
  (function statistica() {
    const T = panel('statistica', 'Statistica descrittiva', `
      <h3>Indici di posizione e di variabilità</h3>
      <p>La <b>media</b> è la somma dei valori divisa per il loro numero; la <b>mediana</b> è il valore centrale dei dati ordinati; la <b>moda</b> è il valore più frequente. La <b>deviazione standard</b> misura quanto i dati sono sparsi intorno alla media. Il <b>box plot</b> mostra minimo, quartili, mediana e massimo.</p>
      <div class="formula">$$\\bar x = \\frac{1}{n}\\sum x_i \\qquad \\sigma^2 = \\frac1n\\sum (x_i - \\bar x)^2 \\qquad \\sigma = \\sqrt{\\sigma^2}$$</div>
      ${link('statistica')}`, {
      title: 'Dati',
      top: `<div class="ctrl"><label><span>Valori (separati da spazi o punto e virgola)</span></label><textarea id="sta-data" rows="4" style="width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:var(--surface-2);font-family:var(--mono);resize:vertical">6 7,5 8 5,5 6 9 7 6,5 8 7 4,5 6 7 8,5 6 7 10 5 6,5 7</textarea><div class="hint">Esempio: voti di una classe. Puoi usare la virgola per i decimali.</div></div>
        <div class="btn-row"><button class="btn small" type="button" id="sta-rnd">Dati casuali</button></div>`,
    });
    const st = fitCanvas(T.canvas, () => draw());
    const ta = T.q('#sta-data');
    let D = null;
    function parse() {
      return ta.value.replace(/(\d),(\d)/g, '$1.$2').split(/[\s;]+/).filter(t => t !== '').map(Number).filter(v => isFinite(v));
    }
    const quant = (a, q) => { const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo); };
    function compute() {
      const v = parse().filter(x => !Number.isNaN(x));
      if (!v.length) { D = null; return; }
      const a = v.slice().sort((x, y) => x - y), n = a.length, sum = a.reduce((x, y) => x + y, 0), mean = sum / n;
      const vari = a.reduce((x, y) => x + (y - mean) ** 2, 0) / n;
      const counts = new Map(); a.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
      const maxC = Math.max(...counts.values());
      const modes = [...counts].filter(([, c]) => c === maxC).map(([x]) => x);
      D = { a, n, sum, mean, vari, sd: Math.sqrt(vari), med: quant(a, 0.5), q1: quant(a, 0.25), q3: quant(a, 0.75), modes: maxC > 1 ? modes : [], min: a[0], max: a[n - 1] };
    }
    function draw() {
      const ctx = st.ctx;
      ctx.clearRect(0, 0, st.w, st.h); ctx.fillStyle = cssVar('--canvas-bg'); ctx.fillRect(0, 0, st.w, st.h);
      if (!D) return;
      const L = 50, Rr = st.w - 24, top = 48, hH = st.h * 0.54, axisY = top + hH;
      let lo = D.min, hi = D.max; if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
      const X = x => L + (x - lo) / (hi - lo) * (Rr - L);
      const k = Math.max(3, Math.ceil(Math.log2(D.n) + 1));
      const bw = (D.max - D.min) / k || 1, bins = new Array(k).fill(0);
      D.a.forEach(x => { bins[Math.min(k - 1, Math.floor((x - D.min) / bw))]++; });
      const maxB = Math.max(...bins);
      ctx.font = '12px ' + font(); ctx.textAlign = 'center';
      bins.forEach((c, i) => {
        const x0 = X(D.min + i * bw), x1 = X(D.min + (i + 1) * bw), h = c / maxB * (hH - 20);
        ctx.fillStyle = 'rgba(77,171,247,.55)'; ctx.fillRect(x0 + 1, axisY - h, x1 - x0 - 2, h);
        ctx.strokeStyle = BLUE; ctx.strokeRect(x0 + 1, axisY - h, x1 - x0 - 2, h);
        if (c) { ctx.fillStyle = cssVar('--text'); ctx.fillText(String(c), (x0 + x1) / 2, axisY - h - 6); }
      });
      ctx.strokeStyle = cssVar('--axis'); ctx.beginPath(); ctx.moveTo(L, axisY); ctx.lineTo(Rr, axisY); ctx.stroke();
      const step = window.Plot.niceStep((Rr - L) / (hi - lo), 60).major;
      ctx.fillStyle = cssVar('--muted');
      for (let x = Math.ceil(lo / step) * step; x <= hi; x += step) { ctx.fillText(fmtNum(x, 2), X(x), axisY + 16); ctx.fillRect(X(x), axisY, 1, 4); }
      const vline = (x, col, lab, dy) => { ctx.save(); ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(x), top - 6); ctx.lineTo(X(x), axisY); ctx.stroke(); ctx.restore(); ctx.fillStyle = col; ctx.fillText(lab, X(x), top - 10 + (dy || 0)); };
      vline(D.mean, RED, 'media', -16); vline(D.med, GREEN, 'mediana', 0);
      // box plot
      const by = axisY + 44, bh = 26;
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(D.min), by + bh / 2); ctx.lineTo(X(D.q1), by + bh / 2); ctx.moveTo(X(D.q3), by + bh / 2); ctx.lineTo(X(D.max), by + bh / 2);
      ctx.moveTo(X(D.min), by + 4); ctx.lineTo(X(D.min), by + bh - 4); ctx.moveTo(X(D.max), by + 4); ctx.lineTo(X(D.max), by + bh - 4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,169,77,.25)'; ctx.fillRect(X(D.q1), by, X(D.q3) - X(D.q1), bh); ctx.strokeRect(X(D.q1), by, X(D.q3) - X(D.q1), bh);
      ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.moveTo(X(D.med), by); ctx.lineTo(X(D.med), by + bh); ctx.stroke();
      ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'left'; ctx.fillText('box plot', L, by + bh + 18);
    }
    function update() {
      compute(); draw();
      if (!D) { readout(T.out, [['Dati', 'inserisci almeno un numero']]); return; }
      readout(T.out, [
        ['Numero di dati n', String(D.n)],
        ['Media', fmtNum(D.mean, 3)],
        ['Mediana', fmtNum(D.med, 3)],
        ['Moda', D.modes.length ? D.modes.map(x => fmtNum(x, 2)).join('; ') : 'nessuna (tutti diversi)'],
        ['Minimo · Massimo', `${fmtNum(D.min, 2)} · ${fmtNum(D.max, 2)}`],
        ['Campo di variazione', fmtNum(D.max - D.min, 3)],
        ['1° e 3° quartile', `${fmtNum(D.q1, 2)} · ${fmtNum(D.q3, 2)}`],
        ['Varianza σ²', fmtNum(D.vari, 4)],
        ['Deviazione standard σ', fmtNum(D.sd, 4)],
        ['Coefficiente di variazione σ/x̄', D.mean ? fmtNum(D.sd / Math.abs(D.mean) * 100, 1) + ' %' : '—'],
      ]);
    }
    ta.addEventListener('input', update);
    T.q('#sta-rnd').addEventListener('click', () => {
      const n = 25, v = [];
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < 4; j++) s += Math.random(); v.push(Math.round((3 + s * 1.75) * 2) / 2); }
      ta.value = v.join(' ').replace(/\./g, ','); update();
    });
    window.addEventListener('themechange', draw);
    update();
  })();

  /* =====================================================
     PROBABILITÀ
     ===================================================== */
  (function probabilita() {
    const EXP = {
      moneta: { out: ['Testa', 'Croce'], p: [0.5, 0.5], roll: () => Math.random() < 0.5 ? 0 : 1, focus: 0 },
      dado: { out: ['1', '2', '3', '4', '5', '6'], p: Array(6).fill(1 / 6), roll: () => Math.floor(Math.random() * 6), focus: 5 },
      dadi: { out: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], p: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map(x => x / 36), roll: () => Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6), focus: 5 },
    };
    const T = panel('probabilita', 'Probabilità e legge dei grandi numeri', `
      <h3>Probabilità e frequenza</h3>
      <p>La <b>probabilità classica</b> di un evento è il rapporto tra casi favorevoli e casi possibili. La <b>frequenza relativa</b> è quante volte l'evento è uscito diviso il numero di prove. La <b>legge dei grandi numeri</b> dice che, aumentando le prove, la frequenza si avvicina alla probabilità: lancia 1000 volte e guarda il grafico in basso stabilizzarsi.</p>
      <div class="formula">$$P(E) = \\frac{\\text{casi favorevoli}}{\\text{casi possibili}} \\qquad f(E) = \\frac{\\text{successi}}{\\text{prove}} \\xrightarrow{\\;n\\to\\infty\\;} P(E)$$</div>
      ${link('probabilita')}`, {
      title: 'Esperimento',
      top: seg('pro-exp', [['moneta', 'Moneta'], ['dado', 'Dado'], ['dadi', 'Due dadi (somma)']], 'moneta') +
        `<div class="btn-row mt">${[1, 10, 100, 1000].map(n => `<button class="btn ${n === 1 ? 'primary' : ''} small" type="button" data-n="${n}">Lancia ${n === 1 ? '' : n + ' volte'}${n === 1 ? '1 volta' : ''}</button>`).join('')}<button class="btn small" type="button" id="pro-reset">Azzera</button></div>`,
    });
    const s = { exp: 'moneta', counts: [], n: 0, hist: [], last: null };
    const st = fitCanvas(T.canvas, () => draw());
    const reset = () => { const E = EXP[s.exp]; s.counts = new Array(E.out.length).fill(0); s.n = 0; s.hist = []; s.last = null; };
    reset();
    onSeg(T, 'pro-exp', v => { s.exp = v; reset(); update(); });
    T.q('#pro-reset').addEventListener('click', () => { reset(); update(); });
    T.q('.btn-row').addEventListener('click', ev => {
      const b = ev.target.closest('[data-n]'); if (!b) return;
      const E = EXP[s.exp];
      for (let i = 0; i < +b.dataset.n; i++) {
        const r = E.roll(); s.counts[r]++; s.n++; s.last = r;
        if (s.n <= 20 || s.n % Math.max(1, Math.floor(s.n / 200)) === 0) s.hist.push([s.n, s.counts[E.focus] / s.n]);
      }
      update();
    });
    function draw() {
      const ctx = st.ctx, E = EXP[s.exp];
      ctx.clearRect(0, 0, st.w, st.h); ctx.fillStyle = cssVar('--canvas-bg'); ctx.fillRect(0, 0, st.w, st.h);
      const L = 46, Rr = st.w - 20, top = 40, hH = st.h * 0.48, base = top + hH;
      const k = E.out.length, bw = (Rr - L) / k;
      const maxP = Math.max(...E.p, ...(s.n ? s.counts.map(c => c / s.n) : [0])) * 1.2;
      ctx.font = '12px ' + font(); ctx.textAlign = 'center';
      for (let i = 0; i < k; i++) {
        const fr = s.n ? s.counts[i] / s.n : 0, h = fr / maxP * hH;
        ctx.fillStyle = i === E.focus ? 'rgba(255,169,77,.75)' : 'rgba(77,171,247,.6)';
        ctx.fillRect(L + i * bw + 4, base - h, bw - 8, h);
        const ph = E.p[i] / maxP * hH;
        ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(L + i * bw + 2, base - ph); ctx.lineTo(L + (i + 1) * bw - 2, base - ph); ctx.stroke();
        ctx.fillStyle = cssVar('--text'); ctx.fillText(E.out[i], L + i * bw + bw / 2, base + 16);
      }
      ctx.strokeStyle = cssVar('--axis'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, base); ctx.lineTo(Rr, base); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = GREEN; ctx.fillText('— probabilità teorica', L, 18);
      ctx.fillStyle = BLUE; ctx.fillText('■ frequenza relativa', L + 160, 18);
      if (s.last !== null) { ctx.textAlign = 'right'; ctx.font = '700 20px ' + font(); ctx.fillStyle = cssVar('--text'); ctx.fillText('Ultimo: ' + E.out[s.last], Rr, 22); }
      // legge dei grandi numeri
      const gy = base + 40, gh = st.h - gy - 26;
      const pf = E.p[E.focus];
      ctx.font = '12px ' + font(); ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--muted');
      ctx.fillText(`Frequenza di "${E.out[E.focus]}" al crescere dei lanci`, L, gy - 8);
      ctx.strokeStyle = cssVar('--axis'); ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(L, gy + gh); ctx.lineTo(Rr, gy + gh); ctx.stroke();
      const yMax = Math.min(1, pf * 2.5);
      const Y = v => gy + gh - Math.min(1, v / yMax) * gh;
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.moveTo(L, Y(pf)); ctx.lineTo(Rr, Y(pf)); ctx.stroke(); ctx.restore();
      if (s.hist.length) {
        const nMax = Math.max(10, s.n), X = n => L + Math.log10(n) / Math.log10(nMax) * (Rr - L);
        ctx.strokeStyle = ORANGE; ctx.lineWidth = 2; ctx.beginPath();
        s.hist.forEach(([n, f], i) => i ? ctx.lineTo(X(n), Y(f)) : ctx.moveTo(X(n), Y(f))); ctx.stroke();
        ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'right'; ctx.fillText(`n = ${s.n} (scala logaritmica)`, Rr, gy + gh + 16);
      }
    }
    function update() {
      draw();
      const E = EXP[s.exp];
      const rows = [['Lanci effettuati', String(s.n)]];
      E.out.forEach((o, i) => { if (E.out.length <= 6 || i === E.focus || i % 2 === 0) rows.push([`${o}: frequenza / probabilità`, `${s.n ? fmtNum(s.counts[i] / s.n, 3) : '—'} / ${fmtNum(E.p[i], 3)}`]); });
      if (s.n) {
        const err = Math.abs(s.counts[E.focus] / s.n - E.p[E.focus]);
        rows.push([`Scarto per "${E.out[E.focus]}"`, fmtNum(err, 4)]);
      }
      readout(T.out, rows);
    }
    window.addEventListener('themechange', draw);
    update();
  })();

  App.setupTabs(tabsEl);
})();
