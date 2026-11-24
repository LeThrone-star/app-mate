/* =========================================================
   MathParser — parser e compilatore di espressioni
   Supporta: + - * / ^ !, moltiplicazione implicita (2x, 3sin x),
   funzioni (sin, cos, sqrt, ln, log, ...), |x|, costanti (pi, e),
   funzioni utente f(x), derivate f'(x), relazioni = < > <= >=,
   coppie (a, b) per i punti.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Funzioni matematiche ---------- */
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function factorial(n) {
    if (Number.isInteger(n) && n >= 0) {
      if (n > 170) return Infinity;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    return gamma(n + 1);
  }
  function pow(a, b) {
    if (a < 0 && !Number.isInteger(b)) {
      // radici dispari di numeri negativi: (-8)^(1/3) = -2
      for (let q = 3; q <= 15; q += 2) {
        const p = Math.round(b * q);
        if (Math.abs(b * q - p) < 1e-9) {
          const r = Math.pow(-a, b);
          return (p % 2 === 0) ? r : -r;
        }
      }
      return NaN;
    }
    return Math.pow(a, b);
  }
  function gcd(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) [a, b] = [b, a % b]; return a; }

  const D2R = Math.PI / 180;
  function makeFuncs(deg) {
    const ti = deg ? (f => x => f(x * D2R)) : (f => f);
    const to = deg ? (f => x => f(x) / D2R) : (f => f);
    return {
      sin: ti(Math.sin), cos: ti(Math.cos), tan: ti(Math.tan),
      sec: ti(x => 1 / Math.cos(x)), csc: ti(x => 1 / Math.sin(x)), cot: ti(x => 1 / Math.tan(x)),
      asin: to(Math.asin), acos: to(Math.acos), atan: to(Math.atan),
      arcsin: to(Math.asin), arccos: to(Math.acos), arctan: to(Math.atan),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
      ln: Math.log, exp: Math.exp, log2: Math.log2,
      log: (x, b) => b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b),
      floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign,
      min: Math.min, max: Math.max,
      mod: (a, b) => ((a % b) + b) % b,
      nCr: (n, k) => factorial(n) / (factorial(k) * factorial(n - k)),
      nPr: (n, k) => factorial(n) / factorial(n - k),
      gcd: gcd, mcd: gcd,
      lcm: (a, b) => Math.abs(a * b) / gcd(a, b), mcm: (a, b) => Math.abs(a * b) / gcd(a, b),
      gamma: gamma,
    };
  }
  const FUNCS_RAD = makeFuncs(false);
  const FUNCS_DEG = makeFuncs(true);
  const FUNC_NAMES = Object.keys(FUNCS_RAD);
  const CONSTS = { pi: Math.PI, 'π': Math.PI, tau: 2 * Math.PI, 'τ': 2 * Math.PI, e: Math.E };
  const MULTI = ['Ans', 'pi', 'tau'];
  const ALL_NAMES = [...FUNC_NAMES, ...MULTI].sort((a, b) => b.length - a.length);

  /* ---------- Tokenizer ---------- */
  const isLetter = c => /[A-Za-zͰ-Ͽ]/.test(c);

  function normalize(src) {
    return src
      .replace(/[−–—]/g, '-').replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/')
      .replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/√/g, ' sqrt ').replace(/∛/g, ' cbrt ')
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/\*\*/g, '^');
  }

  function tokenize(src, userFns) {
    const s = normalize(src);
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/.exec(s.slice(i));
        if (!m) throw new Error('Numero non valido');
        toks.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if (isLetter(c)) {
        let j = i;
        while (j < s.length && isLetter(s[j])) j++;
        const run = s.slice(i, j);
        let k = 0;
        while (k < run.length) {
          let matched = null;
          for (const nm of userFns) if (nm.length > 1 && run.startsWith(nm, k)) { matched = nm; break; }
          if (!matched) for (const nm of ALL_NAMES) if (run.startsWith(nm, k)) { matched = nm; break; }
          if (matched) {
            toks.push({ t: (FUNCS_RAD[matched] || userFns.has(matched)) ? 'fn' : 'id', v: matched });
            k += matched.length;
            continue;
          }
          let name = run[k];
          k++;
          if (k === run.length && s[j] === '_') {
            const m = /^_\{?([A-Za-z0-9]+)\}?/.exec(s.slice(j));
            if (m) { name += '_' + m[1]; j += m[0].length; }
          }
          toks.push({ t: userFns.has(name) ? 'fn' : 'id', v: name });
        }
        i = j;
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=') { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/^()[],!\'=<>|'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
      throw new Error(`Carattere non riconosciuto "${c}"`);
    }
    return toks;
  }

  /* ---------- Parser (discesa ricorsiva) ---------- */
  function parse(src, opts) {
    opts = opts || {};
    const toks = tokenize(src, opts.userFns || new Set());
    if (!toks.length) return null;
    let p = 0, absDepth = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = v => { const t = toks[p]; return !!t && t.t === 'op' && t.v === v; };
    const expect = v => {
      if (!isOp(v)) throw new Error(p < toks.length ? `Atteso "${v}"` : `Manca "${v}"`);
      p++;
    };
    const startsPrimary = t => {
      if (!t) return false;
      if (t.t === 'num' || t.t === 'id' || t.t === 'fn') return true;
      if (t.t === 'op' && (t.v === '(' || t.v === '[')) return true;
      if (t.t === 'op' && t.v === '|' && absDepth === 0) return true;
      return false;
    };

    function parseRel() {
      const lhs = parseExpr();
      const t = peek();
      if (t && t.t === 'op' && ['=', '<', '>', '<=', '>='].includes(t.v)) {
        p++;
        const rhs = parseExpr();
        return { t: 'rel', op: t.v, lhs, rhs };
      }
      return lhs;
    }
    function parseExpr() {
      let a = parseTerm();
      while (isOp('+') || isOp('-')) {
        const op = next().v;
        a = { t: 'bin', op, a, b: parseTerm() };
      }
      return a;
    }
    function parseTerm() {
      let a = parseUnary();
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = next().v;
          a = { t: 'bin', op, a, b: parseUnary() };
        } else if (startsPrimary(peek())) {
          a = { t: 'bin', op: '*', a, b: parsePower(), imp: true };
        } else break;
      }
      return a;
    }
    function parseUnary() {
      if (isOp('-')) { p++; return { t: 'neg', a: parseUnary() }; }
      if (isOp('+')) { p++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const base = parsePostfix();
      if (isOp('^')) { p++; return { t: 'bin', op: '^', a: base, b: parseUnary() }; }
      return base;
    }
    function parsePostfix() {
      let a = parsePrimary();
      while (isOp('!')) { p++; a = { t: 'fact', a }; }
      return a;
    }
    function parsePrimary() {
      const t = next();
      if (!t) throw new Error('Espressione incompleta');
      if (t.t === 'num') return { t: 'num', v: t.v };
      if (t.t === 'id') return { t: 'var', n: t.v };
      if (t.t === 'fn') {
        let d = 0;
        while (isOp("'")) { p++; d++; }
        let pw = null;
        if (isOp('^')) { p++; pw = parseUnary(); }
        let args;
        if (isOp('(')) {
          p++;
          args = [];
          if (!isOp(')')) {
            args.push(parseExpr());
            while (isOp(',')) { p++; args.push(parseExpr()); }
          }
          expect(')');
        } else {
          if (!startsPrimary(peek()) && !isOp('-')) throw new Error(`Manca l'argomento di ${t.v}`);
          let a = parseUnary();
          while (peek() && (peek().t === 'num' || peek().t === 'id')) a = { t: 'bin', op: '*', a, b: parsePower(), imp: true };
          args = [a];
        }
        let node = { t: 'call', n: t.v, args, d };
        if (pw) node = { t: 'bin', op: '^', a: node, b: pw };
        return node;
      }
      if (t.t === 'op' && (t.v === '(' || t.v === '[')) {
        const close = t.v === '(' ? ')' : ']';
        const saved = absDepth; absDepth = 0;
        const items = [parseExpr()];
        while (isOp(',')) { p++; items.push(parseExpr()); }
        absDepth = saved;
        expect(close);
        return items.length > 1 ? { t: 'tuple', items } : { t: 'group', a: items[0] };
      }
      if (t.t === 'op' && t.v === '|') {
        absDepth++;
        const a = parseExpr();
        absDepth--;
        expect('|');
        return { t: 'call', n: 'abs', args: [a], d: 0, bars: true };
      }
      throw new Error(`Simbolo inatteso "${t.v}"`);
    }

    const ast = parseRel();
    if (p < toks.length) {
      const t = toks[p];
      throw new Error(`Simbolo inatteso "${t.v}"`);
    }
    return ast;
  }

  /* ---------- Analisi ---------- */
  function freeVars(node, out) {
    out = out || new Set();
    if (!node) return out;
    switch (node.t) {
      case 'var': if (!(node.n in CONSTS)) out.add(node.n); break;
      case 'num': break;
      case 'bin': freeVars(node.a, out); freeVars(node.b, out); break;
      case 'neg': case 'fact': case 'group': freeVars(node.a, out); break;
      case 'call': node.args.forEach(a => freeVars(a, out)); break;
      case 'tuple': node.items.forEach(a => freeVars(a, out)); break;
      case 'rel': freeVars(node.lhs, out); freeVars(node.rhs, out); break;
    }
    return out;
  }
  function calledFns(node, out) {
    out = out || new Set();
    if (!node) return out;
    switch (node.t) {
      case 'bin': calledFns(node.a, out); calledFns(node.b, out); break;
      case 'neg': case 'fact': case 'group': calledFns(node.a, out); break;
      case 'call': out.add(node.n); node.args.forEach(a => calledFns(a, out)); break;
      case 'tuple': node.items.forEach(a => calledFns(a, out)); break;
      case 'rel': calledFns(node.lhs, out); calledFns(node.rhs, out); break;
    }
    return out;
  }

  /* ---------- Compilazione in funzioni JS ---------- */
  function compile(node, env) {
    env = env || {};
    const funcs = env.deg ? FUNCS_DEG : FUNCS_RAD;
    const user = env.user || {};
    function c(n) {
      switch (n.t) {
        case 'num': { const v = n.v; return () => v; }
        case 'var': {
          if (n.n in CONSTS) { const v = CONSTS[n.n]; return () => v; }
          const name = n.n;
          return s => { const v = s[name]; return v === undefined ? NaN : v; };
        }
        case 'group': return c(n.a);
        case 'neg': { const a = c(n.a); return s => -a(s); }
        case 'fact': { const a = c(n.a); return s => factorial(a(s)); }
        case 'bin': {
          const a = c(n.a), b = c(n.b);
          switch (n.op) {
            case '+': return s => a(s) + b(s);
            case '-': return s => a(s) - b(s);
            case '*': return s => a(s) * b(s);
            case '/': return s => a(s) / b(s);
            case '^': return s => pow(a(s), b(s));
          }
          break;
        }
        case 'call': {
          const args = n.args.map(c);
          const name = n.n;
          let base;
          if (user[name]) {
            const uf = user[name];
            if (uf.params.length !== args.length) throw new Error(`${name} richiede ${uf.params.length} argomenti`);
            base = (vals, s) => uf.call(vals, s);
          } else if (funcs[name]) {
            const f = funcs[name];
            base = vals => f.apply(null, vals);
          } else {
            throw new Error(`Funzione sconosciuta "${name}"`);
          }
          let fn = base;
          if (n.d > 0) {
            const order = n.d;
            const der = (vals, s, d) => {
              if (d === 0) return base(vals, s);
              const x = vals[0];
              const h = (order === 1 ? 1e-5 : 1e-3) * Math.max(1, Math.abs(x));
              const v1 = vals.slice(); v1[0] = x + h;
              const v2 = vals.slice(); v2[0] = x - h;
              return (der(v1, s, d - 1) - der(v2, s, d - 1)) / (2 * h);
            };
            fn = (vals, s) => der(vals, s, order);
          }
          if (args.length === 1) { const a0 = args[0]; return s => fn([a0(s)], s); }
          return s => fn(args.map(a => a(s)), s);
        }
        case 'tuple': { const items = n.items.map(c); return s => items.map(f => f(s)); }
        case 'rel': throw new Error('Relazione non valutabile');
      }
      throw new Error('Nodo sconosciuto');
    }
    return c(node);
  }

  /** Crea una funzione utente richiamabile. */
  function userFunction(params, bodyAst, env) {
    const uf = { params, call: null };
    let body = null;
    uf.call = (vals, s) => {
      if (!body) body = compile(bodyAst, env);
      const ns = Object.create(s || null);
      for (let i = 0; i < params.length; i++) ns[params[i]] = vals[i];
      return body(ns);
    };
    return uf;
  }

  /** Valuta rapidamente una stringa (usata da calcolatrice e laboratori). */
  function evaluate(src, scope, opts) {
    const ast = parse(src, opts);
    if (!ast) throw new Error('Espressione vuota');
    return compile(ast, opts)(scope || {});
  }

  /** Compila "f(x)" in una funzione JS di una variabile. */
  function makeFn(src, variable) {
    const v = variable || 'x';
    const ast = parse(src);
    if (!ast || ast.t === 'rel' || ast.t === 'tuple') throw new Error('Inserisci un\'espressione in ' + v);
    const fv = freeVars(ast);
    for (const n of fv) if (n !== v) throw new Error(`Variabile "${n}" non definita`);
    const f = compile(ast);
    const s = {};
    return x => { s[v] = x; return f(s); };
  }

  /* ---------- Conversione in LaTeX ---------- */
  const GREEK = { alpha: 1, beta: 1, gamma: 1, delta: 1, theta: 1, lambda: 1, mu: 1, omega: 1, phi: 1, sigma: 1, rho: 1 };
  const GREEK_CH = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'θ': '\\theta', 'λ': '\\lambda', 'μ': '\\mu', 'ω': '\\omega', 'φ': '\\varphi', 'π': '\\pi', 'σ': '\\sigma', 'ρ': '\\rho', 'τ': '\\tau', 'Δ': '\\Delta' };
  const TEX_FN = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'min', 'max', 'arcsin', 'arccos', 'arctan', 'gcd']);
  function fmtTexNum(v) {
    let s = String(+v.toPrecision(12));
    if (s.includes('e')) { const [m, e] = s.split('e'); return `${m}\\times 10^{${+e}}`; }
    return s;
  }
  function texName(n) {
    if (n === 'pi') return '\\pi';
    if (n === 'tau') return '\\tau';
    if (n === 'Ans') return '\\text{Ans}';
    const [b, sub] = n.split('_');
    const base = GREEK_CH[b] || (GREEK[b] ? '\\' + b : b);
    return sub ? `${base}_{${sub}}` : base;
  }
  function toTex(n) {
    if (!n) return '';
    switch (n.t) {
      case 'num': return fmtTexNum(n.v);
      case 'var': return texName(n.n);
      case 'group': return `\\left(${toTex(n.a)}\\right)`;
      case 'neg': return '-' + toTex(n.a);
      case 'fact': return toTex(n.a) + '!';
      case 'tuple': return `\\left(${n.items.map(toTex).join(', ')}\\right)`;
      case 'rel': {
        const op = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge' }[n.op];
        return `${toTex(n.lhs)} ${op} ${toTex(n.rhs)}`;
      }
      case 'bin': {
        const strip = x => (x.t === 'group' ? x.a : x);
        if (n.op === '/') return `\\frac{${toTex(strip(n.a))}}{${toTex(strip(n.b))}}`;
        if (n.op === '^') {
          const base = (n.a.t === 'bin' || n.a.t === 'neg' || n.a.t === 'call') ? `\\left(${toTex(n.a)}\\right)` : `{${toTex(n.a)}}`;
          return `${base}^{${toTex(strip(n.b))}}`;
        }
        if (n.op === '*') {
          const l = toTex(n.a), r = toTex(n.b);
          const needDot = !n.imp || /^[0-9]/.test(r) || n.b.t === 'num';
          return needDot ? `${l} \\cdot ${r}` : `${l}${r}`;
        }
        return `${toTex(n.a)} ${n.op} ${toTex(n.b)}`;
      }
      case 'call': {
        const args = n.args.map(toTex);
        const primes = "'".repeat(n.d || 0);
        if (n.n === 'sqrt') return `\\sqrt{${args[0]}}`;
        if (n.n === 'cbrt') return `\\sqrt[3]{${args[0]}}`;
        if (n.n === 'abs') return `\\left|${args[0]}\\right|`;
        if (n.n === 'exp' && !primes) return `e^{${args[0]}}`;
        if (n.n === 'log' && args.length === 2) return `\\log_{${args[1]}}\\left(${args[0]}\\right)`;
        let name;
        if (TEX_FN.has(n.n)) name = '\\' + n.n;
        else if (n.n.length === 1) name = n.n;
        else name = `\\operatorname{${n.n}}`;
        return `${name}${primes}\\left(${args.join(', ')}\\right)`;
      }
    }
    return '';
  }

  /* ---------- Formattazione numeri ---------- */
  function formatNumber(v, digits) {
    digits = digits || 10;
    if (typeof v !== 'number') return String(v);
    if (Number.isNaN(v)) return 'non definito';
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e12 || a < 1e-7) {
      const [m, e] = v.toExponential(digits - 3).split('e');
      return `${String(+m)} × 10^${+e}`;
    }
    return String(+v.toPrecision(digits));
  }

  /** Approssima v con una frazione p/q (q <= maxDen) se esatta. */
  function toFraction(v, maxDen) {
    maxDen = maxDen || 1000;
    if (!isFinite(v) || Number.isInteger(v)) return null;
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, x = v;
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(x);
      [h1, h0] = [a * h1 + h0, h1];
      [k1, k0] = [a * k1 + k0, k1];
      if (k1 > maxDen) return null;
      if (Math.abs(v - h1 / k1) < 1e-12 * Math.max(1, Math.abs(v))) return k1 === 1 ? null : [h1, k1];
      const f = x - a;
      if (f < 1e-15) break;
      x = 1 / f;
    }
    return null;
  }

  window.MathParser = {
    parse, compile, evaluate, makeFn, userFunction, freeVars, calledFns, toTex,
    formatNumber, toFraction, factorial, CONSTS, FUNC_NAMES, isBuiltin: n => !!FUNCS_RAD[n],
  };
})();
