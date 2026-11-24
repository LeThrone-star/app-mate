/* =========================================================
   Grafici — calcolatrice grafica in stile "lista di espressioni"
   ========================================================= */
(function () {
  'use strict';
  const P = window.MathParser;
  const { cssVar } = window.App;

  const COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#7048e8', '#f08c00', '#0c8599', '#d6336c', '#5c677d'];
  const EXAMPLES = [
    { name: 'Parabola con slider', list: ['y = a(x - h)^2 + k', 'a = 1', 'h = 0', 'k = -2'] },
    { name: 'Onda sinusoidale', list: ['y = A sin(ω x + φ)', 'A = 2', 'ω = 1', 'φ = 0'] },
    { name: 'Retta y = mx + q', list: ['y = m x + q', 'm = 0.5', 'q = 1'] },
    { name: 'Circonferenza', list: ['(x - a)^2 + (y - b)^2 = r^2', 'a = 1', 'b = 0', 'r = 3', '(a, b)'] },
    { name: 'Coniche', list: ['x^2/16 + y^2/9 = 1', 'x^2/4 - y^2/9 = 1', 'y^2 = 4x'] },
    { name: 'Disequazioni', list: ['y <= 4 - x^2', 'y > x^2 - 4', 'x^2 + y^2 < 1'] },
    { name: 'Funzione e derivate', list: ['f(x) = x^3 - 3x', "f'(x)", "f''(x)"] },
    { name: 'Retta tangente', list: ['f(x) = sin(x) + x/2', 'a = 1', "y = f'(a)(x - a) + f(a)", '(a, f(a))'] },
    { name: 'Esponenziale e logaritmo', list: ['y = e^x', 'y = ln(x)', 'y = x'] },
    { name: 'Valore assoluto e parte intera', list: ['y = |x| - 2', 'y = floor(x)'] },
    { name: 'Tangente e asintoti', list: ['y = tan(x)', 'y = 1/(x - 2)'] },
    { name: 'Cuore', list: ['(x^2 + y^2 - 1)^3 = x^2 y^3'] },
  ];

  /* ---------- Stato ---------- */
  let exprs = [];
  let uid = 1;
  let colorIdx = 0;
  let model = { items: [], scope: {}, byId: {} };
  let focusedId = null;
  let lastInput = null;
  let hover = null;      // { px, py }
  let trace = null;      // { it, x }
  let dragPoint = null;  // { it }
  const rows = new Map();

  const listEl = document.getElementById('expr-list');
  const canvas = document.getElementById('graph');
  const plot = new window.Plot(canvas, { scale: 40, onDraw: drawAll });

  function nextColor() { return COLORS[(colorIdx++) % COLORS.length]; }
  function newExpr(text) { return { id: uid++, text: text || '', color: nextColor(), visible: true, slider: null }; }

  /* ---------- Analisi delle espressioni ---------- */
  const uses = (node, v) => P.freeVars(node).has(v);
  const isNumLiteral = n => n.t === 'num' || (n.t === 'neg' && n.a.t === 'num');

  function analyze() {
    const fnNames = new Set();
    const fnRe = /^\s*([A-Za-z](?:_[A-Za-z0-9]+)?)\s*\(\s*([A-Za-zͰ-Ͽ](?:_[A-Za-z0-9]+)?(?:\s*,\s*[A-Za-zͰ-Ͽ](?:_[A-Za-z0-9]+)?)*)\s*\)\s*=/;
    for (const e of exprs) {
      const m = fnRe.exec(e.text);
      if (m && !['x', 'y', 'e'].includes(m[1])) fnNames.add(m[1]);
    }
    const user = {};
    const env = { user };
    const items = [];
    const consts = {};

    for (const e of exprs) {
      const it = { e, kind: 'empty', error: null };
      items.push(it);
      if (!e.text.trim()) continue;
      let ast;
      try { ast = P.parse(e.text, { userFns: fnNames }); } catch (err) { it.kind = 'error'; it.error = err.message; continue; }
      if (!ast) continue;
      it.ast = ast;
      classify(it, ast, fnNames, user, env, consts);
    }

    // funzioni ricorsive / circolari
    const fnItems = items.filter(i => i.kind === 'fndef' && !i.error);
    const deps = {};
    fnItems.forEach(i => { deps[i.name] = [...P.calledFns(i.body)].filter(n => user[n]); });
    const cyc = (n, stack) => {
      if (stack.has(n)) return true;
      stack.add(n);
      for (const d of deps[n] || []) if (cyc(d, stack)) return true;
      stack.delete(n);
      return false;
    };
    fnItems.forEach(i => {
      if (cyc(i.name, new Set())) {
        i.error = 'Definizione circolare';
        user[i.name] = { params: i.params, call: () => NaN };
      }
    });

    // costanti (risolte in ordine di dipendenza)
    const scope = {};
    const pend = items.filter(i => i.kind === 'const' && !i.error);
    let progress = true;
    while (progress) {
      progress = false;
      for (const it of pend) {
        if (it.done || it.error) continue;
        const fv = [...P.freeVars(it.expr)];
        if (fv.every(v => v in scope)) {
          try {
            it.value = P.compile(it.expr, env)(scope);
            scope[it.name] = it.value;
            it.done = true; progress = true;
          } catch (err) { it.error = err.message; }
        }
      }
    }
    for (const it of pend) {
      if (it.done || it.error) continue;
      const missing = [...P.freeVars(it.expr)].filter(v => !(v in scope));
      if (missing.some(v => consts[v])) it.error = 'Definizione circolare';
      else setMissing(it, missing);
    }

    const checkMissing = (it, node, allowed) => {
      const missing = [...P.freeVars(node)].filter(v => !allowed.includes(v) && !(v in scope));
      if (missing.length) { setMissing(it, missing); return false; }
      return true;
    };

    for (const it of items) {
      if (it.error) continue;
      try {
        switch (it.kind) {
          case 'fndef': {
            if (!checkMissing(it, it.body, it.params)) break;
            if (it.params.length === 1) {
              const uf = user[it.name];
              it.fx = x => uf.call([x], scope);
            }
            break;
          }
          case 'curveY': {
            if (!checkMissing(it, it.expr, ['x'])) break;
            const f = P.compile(it.expr, env), s = Object.create(scope);
            it.fx = x => { s.x = x; return f(s); };
            break;
          }
          case 'curveX': {
            if (!checkMissing(it, it.expr, ['y'])) break;
            const f = P.compile(it.expr, env), s = Object.create(scope);
            it.gy = y => { s.y = y; return f(s); };
            break;
          }
          case 'implicit': case 'ineq': {
            if (!checkMissing(it, it.expr, ['x', 'y'])) break;
            const f = P.compile(it.expr, env), s = Object.create(scope);
            it.F = (x, y) => { s.x = x; s.y = y; return f(s); };
            if (it.boundY) {
              const g = P.compile(it.boundY, env), s2 = Object.create(scope);
              it.fx = x => { s2.x = x; return g(s2); };
            }
            break;
          }
          case 'point': {
            if (!checkMissing(it, it.ast, [])) break;
            const f = P.compile(it.ast, env);
            it.pt = f(scope);
            it.dragX = it.ast.items[0].t === 'var' && consts[it.ast.items[0].n] && consts[it.ast.items[0].n].isSlider ? consts[it.ast.items[0].n] : null;
            it.dragY = it.ast.items[1].t === 'var' && consts[it.ast.items[1].n] && consts[it.ast.items[1].n].isSlider ? consts[it.ast.items[1].n] : null;
            break;
          }
          case 'value': {
            if (!checkMissing(it, it.expr, [])) break;
            it.value = P.compile(it.expr, env)(scope);
            break;
          }
        }
      } catch (err) { it.error = err.message; }
    }

    const byId = {};
    items.forEach(i => { byId[i.e.id] = i; });
    model = { items, scope, byId };
  }

  function setMissing(it, missing) {
    const bad = missing.filter(v => v === 'x' || v === 'y');
    if (bad.length) { it.error = `Qui non si può usare "${bad[0]}"`; return; }
    it.missing = missing;
    it.error = (missing.length === 1 ? 'Variabile non definita: ' : 'Variabili non definite: ') + missing.join(', ');
  }

  function classify(it, ast, fnNames, user, env, consts) {
    if (ast.t === 'rel') {
      const { lhs, rhs, op } = ast;
      if (op === '=') {
        if (lhs.t === 'call' && fnNames.has(lhs.n) && !lhs.d && lhs.args.every(a => a.t === 'var')) {
          it.kind = 'fndef'; it.name = lhs.n; it.params = lhs.args.map(a => a.n); it.body = rhs;
          if (user[it.name]) { it.error = `"${it.name}" è già definita`; return; }
          user[it.name] = P.userFunction(it.params, rhs, env);
          return;
        }
        if (lhs.t === 'var' && lhs.n === 'y' && !uses(rhs, 'y')) { it.kind = 'curveY'; it.expr = rhs; return; }
        if (rhs.t === 'var' && rhs.n === 'y' && !uses(lhs, 'y')) { it.kind = 'curveY'; it.expr = lhs; return; }
        if (lhs.t === 'var' && lhs.n === 'x' && !uses(rhs, 'x')) { it.kind = 'curveX'; it.expr = rhs; return; }
        if (lhs.t === 'var' && lhs.n !== 'x' && lhs.n !== 'y' && !(lhs.n in P.CONSTS)) {
          const fv = P.freeVars(rhs);
          if (!fv.has('x') && !fv.has('y') && !fv.has(lhs.n)) {
            it.kind = 'const'; it.name = lhs.n; it.expr = rhs; it.isSlider = isNumLiteral(rhs);
            if (consts[it.name]) { it.error = `"${it.name}" è già definita`; return; }
            consts[it.name] = it;
            return;
          }
        }
        it.kind = 'implicit';
        it.expr = { t: 'bin', op: '-', a: lhs, b: rhs };
        return;
      }
      it.kind = 'ineq'; it.op = op;
      it.expr = { t: 'bin', op: '-', a: lhs, b: rhs };
      it.strict = op === '<' || op === '>';
      if (lhs.t === 'var' && lhs.n === 'y' && !uses(rhs, 'y')) { it.boundY = rhs; it.above = op[0] === '>'; }
      else if (rhs.t === 'var' && rhs.n === 'y' && !uses(lhs, 'y')) { it.boundY = lhs; it.above = op[0] === '<'; }
      return;
    }
    if (ast.t === 'tuple') {
      if (ast.items.length === 2) { it.kind = 'point'; return; }
      it.error = 'Un punto ha due coordinate: (x, y)';
      return;
    }
    const fv = P.freeVars(ast);
    if (fv.has('y')) { it.error = 'Aggiungi un\'uguaglianza, ad es. … = 0'; return; }
    if (fv.has('x')) { it.kind = 'curveY'; it.expr = ast; return; }
    it.kind = 'value'; it.expr = ast;
  }

  /* ---------- Interfaccia della lista ---------- */
  function sliderDefaults(v) {
    const a = Math.abs(v);
    if (a <= 10) return { min: -10, max: 10, step: 0.1 };
    const p = Math.pow(10, Math.floor(Math.log10(a)));
    return { min: -Math.ceil(a / p) * p * 2, max: Math.ceil(a / p) * p * 2, step: p / 10 };
  }
  function decimals(step) { return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)); }

  function buildRow(e) {
    const el = document.createElement('div');
    el.className = 'expr-row';
    el.innerHTML = `
      <div class="expr-gutter">
        <span class="expr-index"></span>
        <button class="expr-swatch" title="Mostra/nascondi" aria-label="Mostra o nascondi"></button>
      </div>
      <div class="expr-main">
        <div class="expr-tex" tabindex="-1"></div>
        <input class="expr-input" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Scrivi un'espressione…">
        <div class="expr-info"></div>
        <div class="expr-slider hidden">
          <button class="play" title="Anima" aria-label="Anima">▶</button>
          <input class="lim min" title="Minimo">
          <input type="range">
          <input class="lim max" title="Massimo">
        </div>
      </div>
      <button class="expr-del" title="Elimina" aria-label="Elimina">×</button>`;
    const r = {
      el, e,
      input: el.querySelector('.expr-input'),
      tex: el.querySelector('.expr-tex'),
      info: el.querySelector('.expr-info'),
      swatch: el.querySelector('.expr-swatch'),
      index: el.querySelector('.expr-index'),
      sl: el.querySelector('.expr-slider'),
    };
    r.range = r.sl.querySelector('input[type=range]');
    r.min = r.sl.querySelector('.min');
    r.max = r.sl.querySelector('.max');
    r.play = r.sl.querySelector('.play');
    r.input.value = e.text;
    if (window.MathKeypad) window.MathKeypad.syncInput(r.input);

    r.input.addEventListener('input', () => { e.text = r.input.value; update(); });
    r.input.addEventListener('focus', () => {
      focusedId = e.id; lastInput = r.input;
      el.classList.add('focused');
      el.classList.remove('show-tex');
      plot.request();
    });
    r.input.addEventListener('blur', () => {
      el.classList.remove('focused');
      refreshRow(r);
    });
    r.tex.addEventListener('click', () => { r.input.focus(); });
    r.input.addEventListener('keydown', ev => {
      const idx = exprs.indexOf(e);
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const ne = newExpr('');
        exprs.splice(idx + 1, 0, ne);
        renderList();
        focusRow(ne.id);
        update();
      } else if (ev.key === 'Backspace' && r.input.value === '' && exprs.length > 1) {
        ev.preventDefault();
        exprs.splice(idx, 1);
        renderList();
        focusRow(exprs[Math.max(0, idx - 1)].id);
        update();
      } else if (ev.key === 'ArrowUp' && idx > 0) {
        ev.preventDefault(); focusRow(exprs[idx - 1].id);
      } else if (ev.key === 'ArrowDown' && idx < exprs.length - 1) {
        ev.preventDefault(); focusRow(exprs[idx + 1].id);
      }
    });
    r.swatch.addEventListener('click', () => { e.visible = !e.visible; refreshRow(r); plot.request(); });
    el.querySelector('.expr-del').addEventListener('click', () => {
      exprs = exprs.filter(x => x !== e);
      if (!exprs.length) exprs.push(newExpr(''));
      renderList(); update();
    });
    r.info.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-var]');
      if (!b) return;
      const idx = exprs.indexOf(e);
      const ne = newExpr(`${b.dataset.var} = 1`);
      exprs.splice(idx + 1, 0, ne);
      renderList(); update();
    });
    // slider
    r.range.addEventListener('input', () => setSliderValue(e, +r.range.value));
    const limChange = () => {
      const mn = parseFloat(r.min.value.replace(',', '.')), mx = parseFloat(r.max.value.replace(',', '.'));
      if (isFinite(mn) && isFinite(mx) && mn < mx) {
        e.slider.min = mn; e.slider.max = mx;
        e.slider.step = Math.pow(10, Math.round(Math.log10((mx - mn) / 200)));
      }
      refreshRow(r);
    };
    r.min.addEventListener('change', limChange);
    r.max.addEventListener('change', limChange);
    r.play.addEventListener('click', () => {
      if (!e.slider) return;
      e.slider.playing = !e.slider.playing;
      e.slider.dir = e.slider.dir || 1;
      refreshRow(r);
      if (e.slider.playing) startAnim();
    });
    return r;
  }

  function setSliderValue(e, v) {
    const it = model.byId[e.id];
    if (!it || it.kind !== 'const') return;
    const d = decimals(e.slider.step);
    const val = +v.toFixed(d);
    e.text = `${it.name} = ${val}`;
    const r = rows.get(e.id);
    if (r && document.activeElement !== r.input) r.input.value = e.text;
    else if (r) r.input.value = e.text;
    update();
  }

  function focusRow(id) {
    const r = rows.get(id);
    if (r) { r.input.focus(); const n = r.input.value.length; r.input.setSelectionRange(n, n); }
  }

  function renderList() {
    const keep = new Set(exprs.map(e => e.id));
    for (const [id, r] of rows) if (!keep.has(id)) { r.el.remove(); rows.delete(id); }
    exprs.forEach(e => {
      let r = rows.get(e.id);
      if (!r) { r = buildRow(e); rows.set(e.id, r); }
      listEl.appendChild(r.el);
    });
  }

  function refreshRow(r) {
    const e = r.e, it = model.byId[e.id] || { kind: 'empty' };
    r.index.textContent = exprs.indexOf(e) + 1;
    const drawable = ['fndef', 'curveY', 'curveX', 'implicit', 'ineq', 'point'].includes(it.kind) && !it.error &&
      !(it.kind === 'fndef' && !it.fx);
    r.swatch.style.setProperty('--c', e.color);
    r.swatch.classList.toggle('off', !e.visible);
    r.swatch.classList.toggle('none', !drawable);
    r.el.classList.toggle('has-error', !!it.error);
    if (r.input.value !== e.text && document.activeElement !== r.input) r.input.value = e.text;

    // riga informativa
    let info = '';
    if (it.error) {
      info = `<span class="err">⚠ ${escapeHtml(it.error)}</span>`;
      if (it.missing && it.missing.length) {
        info += ' <span class="mk">crea slider:</span> ' + it.missing.map(v => `<button class="chip" data-var="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join(' ');
      }
    } else if ((it.kind === 'value' || (it.kind === 'const' && !it.isSlider)) && it.value !== undefined) {
      info = `<span class="val">= ${escapeHtml(P.formatNumber(it.value))}</span>`;
    } else if (it.kind === 'point' && it.pt) {
      info = `<span class="val">(${P.formatNumber(it.pt[0], 6)}, ${P.formatNumber(it.pt[1], 6)})</span>`;
    }
    r.info.innerHTML = info;
    r.info.classList.toggle('hidden', !info);

    // slider
    if (it.kind === 'const' && it.isSlider && !it.error) {
      if (!e.slider) e.slider = sliderDefaults(it.value);
      const s = e.slider;
      if (it.value < s.min) s.min = Math.floor(it.value);
      if (it.value > s.max) s.max = Math.ceil(it.value);
      r.sl.classList.remove('hidden');
      r.range.min = s.min; r.range.max = s.max; r.range.step = s.step;
      if (document.activeElement !== r.range) r.range.value = it.value;
      if (document.activeElement !== r.min) r.min.value = s.min;
      if (document.activeElement !== r.max) r.max.value = s.max;
      r.play.textContent = s.playing ? '❚❚' : '▶';
      r.play.classList.toggle('on', !!s.playing);
    } else {
      r.sl.classList.add('hidden');
      if (e.slider) e.slider.playing = false;
    }

    // anteprima tipografica
    const showTex = window.katex && it.ast && !it.error && document.activeElement !== r.input;
    if (showTex) {
      try {
        window.katex.render(P.toTex(it.ast), r.tex, { throwOnError: true });
        r.el.classList.add('show-tex');
      } catch (err) { r.el.classList.remove('show-tex'); }
    } else r.el.classList.remove('show-tex');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let saveTimer = null;
  function update() {
    analyze();
    for (const r of rows.values()) refreshRow(r);
    plot.request();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveHash, 400);
  }

  /* ---------- Animazione slider ---------- */
  let animRunning = false, lastT = 0;
  function startAnim() {
    if (animRunning) return;
    animRunning = true; lastT = performance.now();
    requestAnimationFrame(animStep);
  }
  function animStep(t) {
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    let any = false;
    for (const e of exprs) {
      const s = e.slider, it = model.byId[e.id];
      if (!s || !s.playing || !it || it.kind !== 'const') continue;
      any = true;
      let v = it.value + s.dir * (s.max - s.min) / 4 * dt;
      if (v > s.max) { v = s.max; s.dir = -1; }
      if (v < s.min) { v = s.min; s.dir = 1; }
      const d = decimals(s.step);
      e.text = `${it.name} = ${+v.toFixed(Math.max(d, 2))}`;
      const r = rows.get(e.id); if (r) r.input.value = e.text;
    }
    if (any) { update(); requestAnimationFrame(animStep); } else animRunning = false;
  }

  /* ---------- Disegno ---------- */
  function drawAll(ctx) {
    const items = model.items.filter(i => i.e.visible && !i.error);
    // 1. disequazioni
    for (const it of items) if (it.kind === 'ineq' && it.F) drawIneq(ctx, it);
    // 2. curve implicite
    for (const it of items) if (it.kind === 'implicit' && it.F) drawContour(ctx, it.F, it.e.color, false, it.e.id === focusedId ? 3.5 : 2.5);
    // 3. curve esplicite
    for (const it of items) {
      const w = it.e.id === focusedId ? 3.5 : 2.5;
      if ((it.kind === 'curveY' || it.kind === 'fndef') && it.fx) plot.drawFunction(it.fx, it.e.color, w);
      if (it.kind === 'curveX' && it.gy) plot.drawFunctionY(it.gy, it.e.color, w);
    }
    // 4. punti
    for (const it of items) {
      if (it.kind === 'point' && it.pt && isFinite(it.pt[0]) && isFinite(it.pt[1])) {
        const draggable = it.dragX || it.dragY;
        plot.point(it.pt[0], it.pt[1], it.e.color, draggable ? 7 : 5.5);
        if (draggable) {
          ctx.save(); ctx.globalAlpha = 0.2;
          ctx.beginPath(); ctx.arc(plot.toPx(it.pt[0]), plot.toPy(it.pt[1]), 14, 0, Math.PI * 2);
          ctx.fillStyle = it.e.color; ctx.fill(); ctx.restore();
        }
      }
    }
    // 5. punti notevoli dell'espressione selezionata
    const sel = model.byId[focusedId];
    let poi = [];
    if (sel && sel.e.visible && !sel.error && sel.fx && (sel.kind === 'curveY' || sel.kind === 'fndef')) {
      poi = computePOI(sel);
      for (const p of poi) plot.point(p.x, p.y, cssVar('--muted'), 4.5, true);
    }
    // 6. etichette al passaggio del mouse / traccia
    let shown = false;
    if (hover && !trace && !dragPoint && !plot.isPanning) {
      for (const p of poi) {
        if (Math.hypot(plot.toPx(p.x) - hover.px, plot.toPy(p.y) - hover.py) < 10) {
          plot.point(p.x, p.y, cssVar('--muted'), 6);
          plot.label(`${p.type} (${fmt(p.x)}; ${fmt(p.y)})`, p.x, p.y, cssVar('--text'), 10, -14);
          shown = true; break;
        }
      }
      if (!shown) {
        for (const it of items) {
          if (it.kind === 'point' && it.pt && Math.hypot(plot.toPx(it.pt[0]) - hover.px, plot.toPy(it.pt[1]) - hover.py) < 10) {
            plot.label(`(${fmt(it.pt[0])}; ${fmt(it.pt[1])})`, it.pt[0], it.pt[1], it.e.color, 12, -14);
            shown = true; break;
          }
        }
      }
      if (!shown) {
        const near = nearestCurve(hover.px, hover.py, 8);
        if (near) drawTrace(near.it, near.x, near.y);
      }
    }
    if (trace) {
      const y = safe(trace.it.fx, trace.x);
      if (isFinite(y)) drawTrace(trace.it, trace.x, y);
    }
  }

  function drawTrace(it, x, y) {
    plot.point(x, y, it.e.color, 6);
    plot.label(`(${fmt(x)}; ${fmt(y)})`, x, y, it.e.color, 10, -16);
  }

  function fmt(v) {
    const step = Math.pow(10, Math.floor(Math.log10(40 / plot.sx)));
    const d = Math.max(0, Math.min(8, -Math.floor(Math.log10(step)) + 1));
    let s = (+v.toFixed(d)).toString();
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0 && s === '0')) s = v.toExponential(3);
    return s.replace('-', '−');
  }

  function safe(f, x) { try { const y = f(x); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } }

  function nearestCurve(px, py, tol) {
    let best = null;
    const x = plot.toX(px);
    for (const it of model.items) {
      if (!it.e.visible || it.error || !it.fx || !(it.kind === 'curveY' || it.kind === 'fndef' || it.kind === 'ineq')) continue;
      const y = safe(it.fx, x);
      if (!isFinite(y)) continue;
      const d = Math.abs(plot.toPy(y) - py);
      if (d < tol && (!best || d < best.d)) best = { it, x, y, d };
    }
    return best;
  }

  /* Riempimento delle disequazioni */
  function drawIneq(ctx, it) {
    const color = it.e.color;
    if (it.boundY && it.fx) {
      ctx.save();
      ctx.fillStyle = color; ctx.globalAlpha = 0.18;
      ctx.beginPath();
      const step = 2;
      for (let px = 0; px < plot.w + step; px += step) {
        const y = safe(it.fx, plot.toX(px + step / 2));
        if (!isFinite(y)) continue;
        const py = Math.max(-10, Math.min(plot.h + 10, plot.toPy(y)));
        if (it.above) ctx.rect(px, 0, step, py); else ctx.rect(px, py, step, plot.h - py);
      }
      ctx.fill();
      ctx.restore();
      plot.drawFunction(it.fx, color, it.e.id === focusedId ? 3.5 : 2.5, it.strict ? [8, 6] : null);
      return;
    }
    drawContour(ctx, it.F, color, it.op, it.e.id === focusedId ? 3.5 : 2.5, it.strict);
  }

  /* Marching squares per F(x,y) = 0 e regioni F(x,y) <> 0 */
  function drawContour(ctx, F, color, op, width, dashed) {
    const cell = op ? 5 : 4;
    const nx = Math.ceil(plot.w / cell) + 1, ny = Math.ceil(plot.h / cell) + 1;
    const W = ny + 1;
    const vals = new Float64Array((nx + 1) * W);
    for (let i = 0; i <= nx; i++) {
      const x = plot.toX(i * cell);
      for (let j = 0; j <= ny; j++) {
        let v;
        try { v = F(x, plot.toY(j * cell)); } catch (e) { v = NaN; }
        vals[i * W + j] = v;
      }
    }
    const V = (i, j) => vals[i * W + j];
    const corner = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const interp = (i0, j0, i1, j1) => {
      const a = V(i0, j0), b = V(i1, j1);
      let t = (isFinite(a) && isFinite(b) && a !== b) ? a / (a - b) : 0.5;
      t = Math.max(0, Math.min(1, t));
      return [(i0 + (i1 - i0) * t) * cell, (j0 + (j1 - j0) * t) * cell];
    };

    if (op) {
      const sat = op === '<' ? (v => v < 0) : op === '<=' ? (v => v <= 0) : op === '>' ? (v => v > 0) : (v => v >= 0);
      ctx.save();
      ctx.fillStyle = color; ctx.globalAlpha = 0.18;
      ctx.beginPath();
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const s = corner.map(([di, dj]) => sat(V(i + di, j + dj)));
          const n = s.filter(Boolean).length;
          if (n === 0) continue;
          if (n === 4) { ctx.rect(i * cell, j * cell, cell, cell); continue; }
          let first = true;
          for (let k = 0; k < 4; k++) {
            const [ai, aj] = corner[k], [bi, bj] = corner[(k + 1) % 4];
            if (s[k]) {
              const px = (i + ai) * cell, py = (j + aj) * cell;
              if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
            }
            if (s[k] !== s[(k + 1) % 4]) {
              const [px, py] = interp(i + ai, j + aj, i + bi, j + bj);
              if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
            }
          }
          ctx.closePath();
        }
      }
      ctx.fill();
      ctx.restore();
    }

    // contorno
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([8, 6]);
    ctx.beginPath();
    const crossing = (i0, j0, i1, j1) => {
      const a = V(i0, j0), b = V(i1, j1);
      if (!isFinite(a) || !isFinite(b) || (a < 0) === (b < 0)) return null;
      const p = interp(i0, j0, i1, j1);
      let m;
      try { m = F(plot.toX(p[0]), plot.toY(p[1])); } catch (e) { m = NaN; }
      if (!isFinite(m) || Math.abs(m) > 0.5 * Math.max(Math.abs(a), Math.abs(b)) + 1e-12 && Math.abs(m) > 1e-9) return null;
      return p;
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const [ai, aj] = corner[k], [bi, bj] = corner[(k + 1) % 4];
          const p = crossing(i + ai, j + aj, i + bi, j + bj);
          if (p) pts.push(p);
        }
        if (pts.length >= 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); }
        if (pts.length === 4) { ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* Punti notevoli: zeri, massimi, minimi, intersezioni */
  function computePOI(it) {
    const f = it.fx, out = [];
    const N = 500, a = plot.xmin, b = plot.xmax, dx = (b - a) / N;
    const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { xs[i] = a + i * dx; ys[i] = safe(f, xs[i]); }
    const yspan = Math.abs(plot.ymax - plot.ymin);
    const bisect = (g, lo, hi) => {
      let glo = g(lo);
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2, gm = g(mid);
        if ((gm < 0) === (glo < 0)) { lo = mid; glo = gm; } else hi = mid;
      }
      return (lo + hi) / 2;
    };
    // zeri
    for (let i = 0; i < N; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      if (!isFinite(y0) || !isFinite(y1)) continue;
      if (y0 === 0) { out.push({ x: xs[i], y: 0, type: 'Zero' }); continue; }
      if ((y0 < 0) !== (y1 < 0) && y1 !== 0) {
        const r = bisect(x => safe(f, x), xs[i], xs[i + 1]);
        if (Math.abs(safe(f, r)) < 1e-6 * Math.max(1, yspan)) out.push({ x: r, y: 0, type: 'Zero' });
      }
    }
    // massimi e minimi
    const gold = (lo, hi, sgn) => {
      const g = x => sgn * safe(f, x), R = 0.618033988749895;
      let c = hi - R * (hi - lo), d = lo + R * (hi - lo);
      for (let k = 0; k < 60; k++) {
        if (g(c) > g(d)) hi = d; else lo = c;
        c = hi - R * (hi - lo); d = lo + R * (hi - lo);
      }
      return (lo + hi) / 2;
    };
    for (let i = 1; i < N; i++) {
      const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
      if (!isFinite(y0) || !isFinite(y1) || !isFinite(y2)) continue;
      if (Math.abs(y1 - y0) > yspan || Math.abs(y2 - y1) > yspan) continue;
      if (y1 > y0 && y1 > y2) { const x = gold(xs[i - 1], xs[i + 1], 1); out.push({ x, y: safe(f, x), type: 'Massimo' }); }
      else if (y1 < y0 && y1 < y2) { const x = gold(xs[i - 1], xs[i + 1], -1); out.push({ x, y: safe(f, x), type: 'Minimo' }); }
    }
    // intersezione con l'asse y
    if (a < 0 && b > 0) { const y = safe(f, 0); if (isFinite(y)) out.push({ x: 0, y, type: 'Asse y' }); }
    // intersezioni con le altre curve
    for (const o of model.items) {
      if (o === it || !o.e.visible || o.error || !o.fx || !(o.kind === 'curveY' || o.kind === 'fndef')) continue;
      const h = x => safe(f, x) - safe(o.fx, x);
      let prev = h(xs[0]);
      for (let i = 0; i < N; i++) {
        const cur = h(xs[i + 1]);
        if (isFinite(prev) && isFinite(cur) && (prev < 0) !== (cur < 0)) {
          const r = bisect(h, xs[i], xs[i + 1]);
          if (Math.abs(h(r)) < 1e-6 * Math.max(1, yspan)) out.push({ x: r, y: safe(f, r), type: 'Intersezione' });
        }
        prev = cur;
      }
    }
    return out.filter(p => isFinite(p.y));
  }

  /* ---------- Interazione sul grafico ---------- */
  plot.onHover = ev => {
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (dragPoint) { moveDrag(px, py); return; }
    if (trace) { trace.x = plot.toX(px); plot.request(); return; }
    hover = { px, py };
    plot.request();
  };
  plot.onLeave = () => { hover = null; plot.request(); };
  plot.onPointerDown = ev => {
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    for (const it of model.items) {
      if (it.kind === 'point' && it.pt && (it.dragX || it.dragY) && it.e.visible &&
        Math.hypot(plot.toPx(it.pt[0]) - px, plot.toPy(it.pt[1]) - py) < 16) {
        dragPoint = { it };
        canvas.setPointerCapture(ev.pointerId);
        return true;
      }
    }
    const near = nearestCurve(px, py, ev.pointerType === 'touch' ? 18 : 10);
    if (near) {
      trace = { it: near.it, x: near.x };
      canvas.setPointerCapture(ev.pointerId);
      plot.request();
      return true;
    }
    hover = null;
    return false;
  };
  canvas.addEventListener('pointerup', () => {
    if (trace || dragPoint) { trace = null; dragPoint = null; plot.request(); }
  });
  function moveDrag(px, py) {
    const it = dragPoint.it;
    const apply = (c, v) => {
      const s = c.e.slider || sliderDefaults(c.value);
      c.e.slider = s;
      v = Math.round(v / s.step) * s.step;
      v = Math.max(s.min, Math.min(s.max, v));
      c.e.text = `${c.name} = ${+v.toFixed(decimals(s.step))}`;
      const row = rows.get(c.e.id); if (row) row.input.value = c.e.text;
    };
    if (it.dragX) apply(it.dragX, plot.toX(px));
    if (it.dragY) apply(it.dragY, plot.toY(py));
    update();
    dragPoint.it = model.items.find(i => i.e === it.e) || it;
  }

  /* ---------- Barra degli strumenti ---------- */
  function resetView() { plot.setView(-10, 10, -7, 7); }
  document.getElementById('zoom-in').addEventListener('click', () => plot.zoomAt(plot.w / 2, plot.h / 2, 1.5));
  document.getElementById('zoom-out').addEventListener('click', () => plot.zoomAt(plot.w / 2, plot.h / 2, 1 / 1.5));
  document.getElementById('zoom-home').addEventListener('click', resetView);
  document.getElementById('add-expr').addEventListener('click', () => {
    const ne = newExpr('');
    exprs.push(ne); renderList(); update(); focusRow(ne.id);
  });
  document.getElementById('clear-all').addEventListener('click', () => {
    if (!confirm('Cancellare tutte le espressioni?')) return;
    colorIdx = 0;
    exprs = [newExpr('')];
    renderList(); update(); focusRow(exprs[0].id);
  });
  const exSel = document.getElementById('examples');
  EXAMPLES.forEach((ex, i) => {
    const o = document.createElement('option'); o.value = i; o.textContent = ex.name; exSel.appendChild(o);
  });
  exSel.addEventListener('change', () => {
    const ex = EXAMPLES[+exSel.value];
    if (!ex) return;
    load(ex.list);
    exSel.value = '';
  });
  document.getElementById('share').addEventListener('click', async ev => {
    saveHash();
    const btn = ev.currentTarget;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Link copiato ✓'; }
    catch (e) { btn.textContent = 'Copia dalla barra degli indirizzi'; }
    setTimeout(() => { btn.textContent = 'Condividi'; }, 2000);
  });

  // tastiera matematica
  window.MathKeypad.init({
    getInput() {
      if (lastInput && document.body.contains(lastInput)) return lastInput;
      const r = rows.get(exprs[exprs.length - 1].id);
      return r ? r.input : null;
    },
  });
  document.getElementById('toggle-keypad').addEventListener('click', () => window.MathKeypad.toggle());
  document.getElementById('kp-fab').addEventListener('click', () => window.MathKeypad.toggle());

  /* ---------- Persistenza nell'URL ---------- */
  function saveHash() {
    const list = exprs.map(e => e.text);
    while (list.length > 1 && !list[list.length - 1].trim()) list.pop();
    history.replaceState(null, '', '#e=' + encodeURIComponent(JSON.stringify(list)));
  }
  function readHash() {
    const m = /^#e=(.*)$/.exec(location.hash);
    if (!m) return null;
    try {
      const list = JSON.parse(decodeURIComponent(m[1]));
      return Array.isArray(list) ? list.map(String) : null;
    } catch (e) { return null; }
  }
  function load(list) {
    colorIdx = 0;
    exprs = list.map(t => newExpr(t));
    exprs.push(newExpr(''));
    renderList();
    update();
  }

  window.addEventListener('themechange', () => plot.request());
  window.addEventListener('load', () => update()); // ridisegna le formule quando KaTeX è pronto
  window.addEventListener('hashchange', () => { const l = readHash(); if (l) load(l); });

  load(readHash() || ['f(x) = a sin(b x)', 'a = 2', 'b = 1', 'x^2 + y^2 = 9', "y = f'(x)"]);
  resetView();
  requestAnimationFrame(resetView);
})();
