/* =========================================================
   Calcolatrice scientifica
   ========================================================= */
(function () {
  'use strict';
  const P = window.MathParser;
  const input = document.getElementById('calc-input');
  const resultEl = document.getElementById('result');
  const prettyEl = document.getElementById('pretty');
  const fracEl = document.getElementById('frac');
  const histEl = document.getElementById('hist');
  const varsEl = document.getElementById('vars');
  const modeBtn = document.getElementById('mode-btn');
  const modeLabel = document.getElementById('mode-label');

  let deg = false;
  let justEvaluated = false;
  const scope = { Ans: 0 };
  const history = [];

  function fmt(v) { return P.formatNumber(v, 12).replace('.', ','); }

  function evalText(text) {
    const ast = P.parse(text);
    if (!ast) return null;
    if (ast.t === 'rel') {
      if (ast.op !== '=' || ast.lhs.t !== 'var' || ast.lhs.n === 'Ans' || ast.lhs.n in P.CONSTS) throw new Error('Assegnazione non valida (usa ad es. a = 5)');
      const v = P.compile(ast.rhs, { deg })(scope);
      return { ast, value: v, assign: ast.lhs.n };
    }
    if (ast.t === 'tuple') throw new Error('Usa la virgola solo negli argomenti delle funzioni');
    const missing = [...P.freeVars(ast)].filter(v => !(v in scope));
    if (missing.length) throw new Error('Variabile non definita: ' + missing.join(', '));
    return { ast, value: P.compile(ast, { deg })(scope) };
  }

  function preview() {
    const text = input.value;
    prettyEl.textContent = '';
    fracEl.textContent = '';
    resultEl.className = 'result preview';
    if (!text.trim()) { resultEl.textContent = ''; return; }
    try {
      const r = evalText(text);
      if (!r) { resultEl.textContent = ''; return; }
      App.tex(prettyEl, P.toTex(r.ast));
      resultEl.textContent = (r.assign ? r.assign + ' = ' : '= ') + fmt(r.value);
      const fr = P.toFraction(r.value);
      if (fr) fracEl.textContent = `= ${fr[0]}/${fr[1]}`;
    } catch (e) {
      resultEl.textContent = '';
    }
  }

  function evaluate() {
    const text = input.value.trim();
    if (!text) return;
    try {
      const r = evalText(text);
      resultEl.className = 'result';
      if (r.assign) {
        scope[r.assign] = r.value;
        renderVars();
      }
      scope.Ans = r.value;
      resultEl.textContent = (r.assign ? r.assign + ' = ' : '') + fmt(r.value);
      const fr = P.toFraction(r.value);
      fracEl.textContent = fr ? `= ${fr[0]}/${fr[1]}` : '';
      App.tex(prettyEl, P.toTex(r.ast));
      history.unshift({ text, value: r.value, assign: r.assign });
      renderHistory();
      justEvaluated = true;
    } catch (e) {
      resultEl.className = 'result error';
      resultEl.textContent = '⚠ ' + e.message;
    }
  }

  function renderHistory() {
    if (!history.length) {
      histEl.innerHTML = '<p class="hint">I calcoli appariranno qui. Clicca un risultato per riutilizzarlo.</p>';
      return;
    }
    histEl.innerHTML = '';
    history.slice(0, 50).forEach(h => {
      const d = document.createElement('div');
      d.className = 'hist-item';
      d.innerHTML = `<div class="e"></div><div class="r"></div>`;
      d.querySelector('.e').textContent = h.text;
      d.querySelector('.r').textContent = (h.assign ? h.assign + ' = ' : '= ') + fmt(h.value);
      d.title = 'Clicca per riusare l\'espressione';
      d.addEventListener('click', () => { input.value = h.text; justEvaluated = false; input.focus(); preview(); });
      histEl.appendChild(d);
    });
  }

  function renderVars() {
    const names = Object.keys(scope).filter(n => n !== 'Ans');
    if (!names.length) {
      varsEl.innerHTML = '<span class="hint">Nessuna variabile. Scrivi ad esempio <code>m = 2.5</code>.</span>';
      return;
    }
    varsEl.innerHTML = '';
    names.forEach(n => {
      const b = document.createElement('button');
      b.className = 'var-chip';
      b.textContent = `${n} = ${fmt(scope[n])}`;
      b.title = 'Inserisci';
      b.addEventListener('click', () => insert(n));
      varsEl.appendChild(b);
    });
  }

  function insert(txt, isOp) {
    if (justEvaluated) {
      input.value = isOp ? 'Ans' : '';
      justEvaluated = false;
    }
    const s = input.selectionStart != null && document.activeElement === input ? input.selectionStart : input.value.length;
    const e = input.selectionEnd != null && document.activeElement === input ? input.selectionEnd : input.value.length;
    input.setRangeText(txt, s, e, 'end');
    preview();
  }

  document.getElementById('keys').addEventListener('mousedown', ev => ev.preventDefault());
  document.getElementById('keys').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.i !== undefined) {
      const opLike = b.dataset.op !== undefined || ['^2', '^', '!'].includes(b.dataset.i);
      insert(b.dataset.i, opLike);
    } else if (b.dataset.k === 'eq') evaluate();
    else if (b.dataset.k === 'ac') { input.value = ''; justEvaluated = false; preview(); }
    else if (b.dataset.k === 'del') {
      justEvaluated = false;
      const s = input.selectionStart, e = input.selectionEnd;
      if (s !== e) input.setRangeText('', s, e, 'end');
      else if (s > 0) input.setRangeText('', s - 1, s, 'end');
      preview();
    } else if (b.dataset.k === 'mode') {
      deg = !deg;
      modeBtn.textContent = deg ? 'RAD' : 'DEG';
      modeLabel.textContent = deg ? 'DEG' : 'RAD';
      preview();
    }
    if (window.matchMedia('(pointer: fine)').matches) input.focus();
  });

  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); evaluate(); return; }
    if (ev.key === 'Escape') { input.value = ''; preview(); return; }
    if (justEvaluated && ev.key.length === 1) {
      const isOp = '+-*/^!'.includes(ev.key);
      input.value = isOp ? 'Ans' : '';
      justEvaluated = false;
    }
  });
  input.addEventListener('input', () => { justEvaluated = false; preview(); });
  document.getElementById('clear-hist').addEventListener('click', () => { history.length = 0; renderHistory(); });

  input.focus();
})();
