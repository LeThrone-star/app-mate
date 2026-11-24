/* =========================================================
   Tastiera matematica (schede: 123, funzioni, lettere)
   Il simbolo ‸ indica dove finisce il cursore dopo l'inserimento.
   ========================================================= */
(function () {
  'use strict';

  // [etichetta, azione, classi]
  const RIGHT = (tab) => [
    tab === 'fn' ? ['123', 'tab:123', 'act'] : ['f(x)', 'tab:fn', 'act'],
    tab === 'abc' ? ['123', 'tab:123', 'act'] : ['ABC', 'tab:abc', 'act'],
    ['←', 'left', 'act'], ['→', 'right', 'act'],
    ['⌫', 'del', 'act span2'],
    ['↵', 'enter', 'enter span2'],
  ];

  const LAYOUTS = {
    '123': {
      left: [
        ['<i>x</i>', 'ins:x'], ['<i>y</i>', 'ins:y'], ['<i>a</i>²', 'ins:^2'], ['<i>a</i><sup><i>b</i></sup>', 'ins:^'],
        ['(', 'ins:('], [')', 'ins:)'], ['&lt;', 'ins:<'], ['&gt;', 'ins:>'],
        ['|<i>a</i>|', 'ins:|‸|'], [',', 'ins:, '], ['≤', 'ins:<='], ['≥', 'ins:>='],
        ['√', 'ins:sqrt(‸)'], ['π', 'ins:π'], ['<i>e</i>', 'ins:e'], ['<sup>a</sup>⁄<sub>b</sub>', 'ins:(‸)/()'],
      ],
      leftCols: 4,
      mid: [
        ['7', 'ins:7', 'num'], ['8', 'ins:8', 'num'], ['9', 'ins:9', 'num'], ['÷', 'ins:/', 'op'],
        ['4', 'ins:4', 'num'], ['5', 'ins:5', 'num'], ['6', 'ins:6', 'num'], ['×', 'ins:*', 'op'],
        ['1', 'ins:1', 'num'], ['2', 'ins:2', 'num'], ['3', 'ins:3', 'num'], ['−', 'ins:-', 'op'],
        ['0', 'ins:0', 'num'], [',', 'ins:.', 'num'], ['=', 'ins: = ', 'op'], ['+', 'ins:+', 'op'],
      ],
    },
    fn: {
      left: [
        ['sin', 'ins:sin(‸)'], ['cos', 'ins:cos(‸)'], ['tan', 'ins:tan(‸)'], ['csc', 'ins:csc(‸)'],
        ['sec', 'ins:sec(‸)'], ['cot', 'ins:cot(‸)'], ['ln', 'ins:ln(‸)'], ['log', 'ins:log(‸)'],
        ['sin⁻¹', 'ins:arcsin(‸)'], ['cos⁻¹', 'ins:arccos(‸)'], ['tan⁻¹', 'ins:arctan(‸)'], ['sinh', 'ins:sinh(‸)'],
        ['cosh', 'ins:cosh(‸)'], ['tanh', 'ins:tanh(‸)'], ['<i>e</i><sup>x</sup>', 'ins:e^(‸)'], ['log<sub>a</sub>', 'ins:log(‸, )'],
        ['√', 'ins:sqrt(‸)'], ['∛', 'ins:cbrt(‸)'], ['|<i>a</i>|', 'ins:abs(‸)'], ['<i>n</i>!', 'ins:!'],
        ['⌊<i>x</i>⌋', 'ins:floor(‸)'], ['⌈<i>x</i>⌉', 'ins:ceil(‸)'], ['round', 'ins:round(‸)'], ['sign', 'ins:sign(‸)'],
        ['min', 'ins:min(‸, )'], ['max', 'ins:max(‸, )'], ['mod', 'ins:mod(‸, )'], ['nCr', 'ins:nCr(‸, )'],
        ['mcd', 'ins:gcd(‸, )'], ['mcm', 'ins:lcm(‸, )'], ['<i>f</i>′', "ins:'"], ['<i>f</i>(<i>x</i>)', 'ins:f(x) = '],
      ],
      leftCols: 8,
    },
    abc: {
      left: [
        ...'qwertyuiop'.split('').map(c => [c, 'ins:' + c, 'let']),
        ...'asdfghjkl'.split('').map(c => [c, 'ins:' + c, 'let']), ['<i>a</i>₁', 'ins:_', 'let'],
        ...'zxcvbnm'.split('').map(c => [c, 'ins:' + c, 'let']), ['′', "ins:'", 'let'], ['!', 'ins:!', 'let'], ['%', 'ins:/100', 'let'],
        ...'αβγδθλμσφω'.split('').map(c => [c, 'ins:' + c, 'let']),
      ],
      leftCols: 10,
    },
  };

  let tab = '123';
  let open = false;
  let opts = null;
  let root = null;

  const isTouch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function key([label, action, cls]) {
    return `<button type="button" class="kp-key ${cls || ''}" data-a="${action.replace(/"/g, '&quot;')}">${label}</button>`;
  }
  function render() {
    const L = LAYOUTS[tab];
    let html = `<div class="kp-inner kp-${tab}">`;
    html += `<div class="kp-sec kp-left" style="--cols:${L.leftCols}">${L.left.map(key).join('')}</div>`;
    if (L.mid) html += `<div class="kp-sec kp-mid" style="--cols:4">${L.mid.map(key).join('')}</div>`;
    html += `<div class="kp-sec kp-right" style="--cols:2">${RIGHT(tab).map(key).join('')}</div>`;
    html += '</div>';
    root.innerHTML = html;
  }

  function syncInput(input) {
    // con la tastiera aperta sui dispositivi touch non mostriamo quella del telefono
    input.inputMode = open && isTouch() ? 'none' : 'text';
  }
  function syncAll() { document.querySelectorAll('.expr-input').forEach(syncInput); }

  function setOpen(v) {
    open = v;
    root.classList.toggle('hidden', !open);
    document.body.classList.toggle('kp-open', open);
    try { localStorage.setItem('appmate-keypad', open ? '1' : '0'); } catch (e) { /* ignora */ }
    syncAll();
    if (opts.onToggle) opts.onToggle(open);
    window.dispatchEvent(new Event('resize'));
  }

  function act(action) {
    const input = opts.getInput();
    if (!input) return;
    const s = input.selectionStart != null ? input.selectionStart : input.value.length;
    const e = input.selectionEnd != null ? input.selectionEnd : s;
    if (document.activeElement !== input) input.focus();
    if (action.startsWith('ins:')) {
      let txt = action.slice(4);
      const caret = txt.indexOf('‸');
      txt = txt.replace('‸', '');
      // le parentesi avvolgono il testo selezionato
      if (caret >= 0 && e > s) {
        const sel = input.value.slice(s, e);
        input.setRangeText(txt.slice(0, caret) + sel + txt.slice(caret), s, e, 'end');
      } else {
        input.setRangeText(txt, s, e, 'end');
        if (caret >= 0) { const p = s + caret; input.setSelectionRange(p, p); }
      }
      input.dispatchEvent(new Event('input'));
    } else if (action === 'left' || action === 'right') {
      const v = input.value;
      // dal numeratore di una frazione si salta direttamente nel denominatore, e viceversa
      const jump = action === 'right' && v.startsWith(')/(', e) ? 3 : action === 'left' && v.slice(0, s).endsWith(')/(') ? 3 : 1;
      const p = action === 'left' ? Math.max(0, s === e ? s - jump : s) : Math.min(v.length, s === e ? e + jump : e);
      input.setSelectionRange(p, p);
    } else if (action === 'del') {
      if (s !== e) input.setRangeText('', s, e, 'end');
      else if (s > 0) {
        // cancella un nome di funzione intero con la sua parentesi, es. "sin("
        const m = /([A-Za-z]{2,}\()$/.exec(input.value.slice(0, s));
        const n = m ? m[1].length : 1;
        input.setRangeText('', s - n, s, 'end');
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
        return;
      }
      input.dispatchEvent(new Event('input'));
    } else if (action === 'enter') {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }
  }

  function init(o) {
    opts = o;
    root = document.getElementById(o.rootId || 'kp');
    render();
    root.addEventListener('mousedown', ev => ev.preventDefault()); // mantiene il focus sul campo
    root.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') ev.preventDefault(); });
    root.addEventListener('click', ev => {
      const b = ev.target.closest('.kp-key');
      if (!b) return;
      const a = b.dataset.a;
      if (a.startsWith('tab:')) { tab = a.slice(4); render(); return; }
      act(a);
    });
    let saved = null;
    try { saved = localStorage.getItem('appmate-keypad'); } catch (e) { /* ignora */ }
    setOpen(saved === null ? true : saved === '1');
  }

  window.MathKeypad = {
    init,
    toggle() { setOpen(!open); },
    syncInput,
    get open() { return open; },
  };
})();
