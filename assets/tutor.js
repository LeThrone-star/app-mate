/* =========================================================
   Tutor IA — foto o testo di un problema, risposta passo per passo
   Funziona dentro claude.ai (capability "sample" con immagini).
   ========================================================= */
(function () {
  'use strict';

  const RULES = `Sei il tutor di Astral, un sito per studenti delle superiori dedicato a matematica e fisica. Rispondi sempre in italiano, con tono amichevole e chiaro, come un bravo insegnante.
Regole:
- Se c'è una foto, prima riscrivi in breve il testo del problema che vedi, così lo studente controlla che tu l'abbia letto bene. Se qualcosa non si legge, dillo e chiedi di rifare la foto.
- Risolvi passo per passo, spiegando il perché di ogni passaggio. In fisica scrivi sempre i dati con le unità di misura e controlla le unità del risultato.
- Scrivi le formule in LaTeX: \\( ... \\) dentro il testo e \\[ ... \\] per le formule su una riga a sé. Non usare mai il simbolo $.
- Metti in **grassetto** il risultato finale. Non usare tabelle. Paragrafi brevi.
- Alla fine, se è utile, consiglia uno strumento di Astral: Grafici (disegnare funzioni), Calcolatrice, Lab Matematica (circonferenza goniometrica, derivata e tangente, integrali, equazioni di 2° grado), Lab Fisica (leve, piano inclinato, moto parabolico, pendolo, molla), Teoria.
- Se la domanda non riguarda la matematica, la fisica o lo studio, rispondi in breve e riporta gentilmente la conversazione sui compiti.`;

  const MODES = {
    passi: '',
    indizio: '\n\n[Modalità INDIZIO: non dare la soluzione completa. Dai solo il primo passo o un suggerimento per farmi ragionare, poi chiedimi di provare.]',
    verifica: '\n\n[Modalità VERIFICA: nel messaggio o nella foto c\'è anche il mio svolgimento. Controllalo passaggio per passaggio e dimmi dove sbaglio e perché. Se è giusto, dimmelo senza rifare tutto.]',
  };

  const ERRORS = {
    not_granted: 'Per usare il tutor serve il permesso di usare Claude. Puoi darlo dal menu Autorizzazioni di questa pagina.',
    sampling_disabled: 'Claude non è disponibile per questo account.',
    rate_limited: 'Troppe domande in poco tempo, oppure hai raggiunto il limite di utilizzo di Claude. Riprova tra un po\'.',
    session_expired: 'Accedi di nuovo a claude.ai e riprova.',
    image_rejected: 'Questa immagine non si può usare (formato o dimensione). Prova con un\'altra foto, in JPG o PNG.',
    images_unavailable: 'Qui non si possono mandare foto: scrivi il problema a parole.',
    refused: 'Su questa richiesta non posso aiutarti. Prova a riformularla.',
    empty_completion: 'Non è arrivata nessuna risposta. Prova a riformulare la domanda.',
    prompt_too_large: 'La conversazione è diventata troppo lunga: inizia una nuova conversazione.',
  };

  const $ = id => document.getElementById(id);
  const log = $('tutor-log'), box = $('tutor-text'), sendBtn = $('tutor-send'), stopBtn = $('tutor-stop');
  const camIn = $('tutor-cam'), galIn = $('tutor-gal'), previews = $('tutor-previews');
  const note = $('tutor-note'), photoBtns = document.querySelectorAll('.tutor-photo');
  if (!log) return;

  let sample = null;
  let maxImages = 0;
  let maxBytes = 20e6;
  let preparing = 0;
  let images = [];      // { file, url }
  let turns = [];       // { role, content }
  let ctl = null;
  let busy = false;

  /* ---------- Disponibilità ---------- */
  function setAvailable(ok, msg) {
    document.getElementById('tutor').classList.toggle('off', !ok);
    note.textContent = msg || '';
    note.hidden = !msg;
    box.disabled = !ok; sendBtn.disabled = !ok;
    photoBtns.forEach(b => { b.disabled = !ok; });
  }
  const CLAUDE_URL = 'https://claude.ai/artifact/LiJHn1eKDhNuFfhFTXkEEc';
  function offerClaude(msg) {
    setAvailable(false, '');
    note.hidden = false;
    note.textContent = msg + ' ';
    const a = document.createElement('a');
    a.href = CLAUDE_URL; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'btn small primary'; a.textContent = 'Apri il tutor su claude.ai';
    note.appendChild(a);
  }
  setAvailable(false, 'Sto collegando il tutor…');
  if (!window.claude || typeof window.claude.use !== 'function') {
    offerClaude('Il tutor IA risponde solo dentro claude.ai: qui puoi aprirlo con un tocco.');
    return;
  }
  window.claude.use('sample').then(async s => {
    if (!s) { offerClaude('Il tutor IA non è disponibile in questa visualizzazione.'); return; }
    sample = s;
    const lim = await s.limits().catch(() => null);
    if (lim && lim.images) {
      maxImages = lim.images.maxCount;
      maxBytes = lim.images.maxInputBytes || maxBytes;
    } else {
      photoBtns.forEach(b => { b.hidden = true; });
    }
    setAvailable(true, '');
  }).catch(() => offerClaude('Il tutor IA non è disponibile in questo momento.'));


  /* ---------- Descrivere l'esercizio: guida e dettatura ---------- */
  const GUIDE = 'Materia: \nTesto dell\'esercizio: \nDati: \nCosa chiede: \nDove mi blocco: ';
  $('tutor-guide').addEventListener('click', () => {
    if (box.disabled) return;
    if (!box.value.trim()) box.value = GUIDE;
    else if (!box.value.includes('Testo dell\'esercizio:')) box.value = box.value.trim() + '\n\n' + GUIDE;
    autosize();
    box.focus();
    const i = box.value.indexOf('Materia: ') + 9;
    box.setSelectionRange(i, i);
  });
  const micBtn = $('tutor-mic'), partialEl = $('tutor-partial'), micHint = $('tutor-mic-hint');
  let dict = null;
  function appendSpoken(t) {
    t = (t || '').trim();
    if (!t) return;
    const v = box.value;
    const sep = !v || /\s$/.test(v) ? '' : ' ';
    box.value = v + sep + t;
    autosize();
  }
  window.claude.use('dictation').then(d => {
    if (!d) return;
    dict = d;
    micBtn.hidden = false;
    micHint.hidden = true;
    d.onPartial(({ text }) => { partialEl.textContent = text ? '🎤 ' + text : ''; partialEl.hidden = !text; });
    d.onFinal(({ text }) => { appendSpoken(text); });
    d.onState(({ state, reason }) => {
      const on = state !== 'idle';
      micBtn.classList.toggle('on', on);
      micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      micBtn.textContent = state === 'listening' ? '■ Stop dettatura' : state === 'starting' ? '🎤 Attendo…' : '🎤 Detta';
      if (!on) { partialEl.hidden = true; partialEl.textContent = ''; }
      if (!on && reason === 'unavailable') { micBtn.hidden = true; micHint.hidden = false; }
      if (!on && reason === 'not_granted') showToast('La dettatura è stata negata: puoi riattivarla dal menu Autorizzazioni della pagina.');
      if (!on && (reason === 'rate_limited' || reason === 'upstream_error')) showToast('Il microfono non ha funzionato. Riprova tra poco.');
    });
  }).catch(() => { /* niente dettatura: resta la tastiera */ });
  micBtn.addEventListener('click', () => {
    if (!dict) return;
    if (dict.active()) { dict.stop().catch(() => {}); return; }
    dict.start().catch(e => {
      if (e && e.code === 'unavailable') { micBtn.hidden = true; micHint.hidden = false; }
      else if (e && e.code === 'not_granted') showToast('Per dettare serve il permesso del microfono.');
    });
  });

  /* ---------- Foto ---------- */
  const MAX_SIDE = 1800;
  const looksLikeImage = f => (f.type && f.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(f.name || '');

  /** Converte qualsiasi foto (anche HEIC dell'iPhone, se il telefono la sa leggere)
   *  in un JPEG ridimensionato e dritto, il formato più sicuro per Claude. */
  async function prepareImage(file) {
    let src = null, w = 0, h = 0, url = null;
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
      w = src.width; h = src.height;
    } catch (e) {
      url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('decode'));
        im.src = url;
      });
      w = src.naturalWidth; h = src.naturalHeight;
    }
    try {
      if (!w || !h) throw new Error('decode');
      const k = Math.min(1, MAX_SIDE / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); // gli sfondi trasparenti diventano bianchi
      ctx.drawImage(src, 0, 0, cw, ch);
      let blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
      if (!blob) throw new Error('encode');
      if (blob.size > maxBytes) blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.6));
      return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    } finally {
      if (src && src.close) src.close();
      if (url) URL.revokeObjectURL(url);
    }
  }

  async function addFiles(list) {
    const files = [...list].filter(looksLikeImage);
    if (!files.length && list.length) { showToast('Questo file non è un\'immagine.'); return; }
    for (const f of files) {
      if (images.length + preparing >= Math.max(1, maxImages)) { showToast(`Puoi allegare al massimo ${maxImages} foto per domanda.`); break; }
      preparing++;
      updatePreparing();
      try {
        const jpg = await prepareImage(f);
        images.push({ file: jpg, url: URL.createObjectURL(jpg) });
      } catch (e) {
        showToast('Non riesco a leggere questa foto. Se è in formato HEIC, prova a fare uno screenshot della foto e allega quello, oppure imposta la fotocamera su "Più compatibile".');
      } finally {
        preparing--;
        updatePreparing();
        renderPreviews();
      }
    }
  }
  function updatePreparing() {
    sendBtn.disabled = preparing > 0 || box.disabled;
    sendBtn.textContent = preparing > 0 ? 'Preparo la foto…' : 'Invia';
  }
  function renderPreviews() {
    previews.innerHTML = '';
    images.forEach((im, i) => {
      const d = document.createElement('div');
      d.className = 'thumb';
      const img = document.createElement('img');
      img.src = im.url; img.alt = 'Foto allegata ' + (i + 1);
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Togli la foto');
      x.addEventListener('click', () => { URL.revokeObjectURL(im.url); images.splice(i, 1); renderPreviews(); });
      d.append(img, x);
      previews.appendChild(d);
    });
    previews.hidden = !images.length;
  }
  $('tutor-cam-btn').addEventListener('click', () => camIn.click());
  $('tutor-gal-btn').addEventListener('click', () => galIn.click());
  [camIn, galIn].forEach(inp => inp.addEventListener('change', () => { addFiles(inp.files); inp.value = ''; }));
  box.addEventListener('paste', ev => {
    if (!maxImages) return;
    const files = [...(ev.clipboardData ? ev.clipboardData.files : [])];
    if (files.length) { ev.preventDefault(); addFiles(files); }
  });
  const drop = $('tutor');
  drop.addEventListener('dragover', ev => { if (maxImages) { ev.preventDefault(); drop.classList.add('drag'); } });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', ev => {
    drop.classList.remove('drag');
    if (!maxImages) return;
    ev.preventDefault(); addFiles(ev.dataTransfer.files);
  });

  /* ---------- Messaggi ---------- */
  function esc(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function md(text) {
    return esc(text)
      .replace(/^#{1,4}\s*(.+)$/gm, '<strong class="h">$1</strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\n/g, '<br>');
  }
  function renderTex(el) {
    if (!window.renderMathInElement) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } catch (e) { /* formula incompleta durante la scrittura */ }
  }
  function bubble(role) {
    const empty = log.querySelector('.tutor-empty');
    if (empty) empty.remove();
    const b = document.createElement('div');
    b.className = 'msg ' + role;
    log.appendChild(b);
    return b;
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function showToast(t) { note.textContent = t; note.hidden = false; setTimeout(() => { if (note.textContent === t) note.hidden = true; }, 4000); }

  function setBusy(v) {
    busy = v;
    sendBtn.hidden = v; stopBtn.hidden = !v;
    box.disabled = v;
  }

  async function send(textOverride) {
    if (!sample || busy || preparing > 0) return;
    if (dict && dict.active()) await dict.stop().catch(() => {});
    let text = (textOverride != null ? textOverride : box.value).trim();
    if (text.replace(/^(Materia|Testo dell'esercizio|Dati|Cosa chiede|Dove mi blocco):\s*$/gm, '').trim() === '') text = '';
    const pics = images.slice();
    if (!text && !pics.length) { box.focus(); return; }
    const mode = document.querySelector('input[name="tutor-mode"]:checked').value;

    // messaggio dello studente
    const ub = bubble('user');
    if (pics.length) {
      const row = document.createElement('div');
      row.className = 'pics';
      pics.forEach(p => { const im = document.createElement('img'); im.src = p.url; im.alt = 'Foto del problema'; row.appendChild(im); });
      ub.appendChild(row);
    }
    if (text) { const t = document.createElement('div'); t.textContent = text; ub.appendChild(t); }
    const label = { indizio: 'Solo un indizio', verifica: 'Controlla la mia soluzione' }[mode];
    if (label) { const t = document.createElement('div'); t.className = 'mode'; t.textContent = label; ub.appendChild(t); }

    let content = text || 'Risolvi il problema che vedi nella foto.';
    if (pics.length) content = `[Ho allegato ${pics.length === 1 ? 'una foto' : pics.length + ' foto'} del problema.]\n` + content;
    content += MODES[mode];
    turns.push({ role: 'user', content });
    if (textOverride == null) box.value = '';
    images = []; renderPreviews();
    autosize();

    // risposta
    const ab = bubble('assistant');
    ab.innerHTML = '<span class="thinking">Sto pensando<span>.</span><span>.</span><span>.</span></span>';
    scrollDown();
    setBusy(true);
    ctl = new AbortController();
    let last = 0, pending = null;
    const draw = txt => { ab.innerHTML = md(txt); renderTex(ab); };
    try {
      const history = turns.slice(-12);
      while (history.length && history[0].role !== 'user') history.shift();
      const res = await sample([{ role: 'user', content: RULES }, ...history], {
        cache: false,
        signal: ctl.signal,
        images: pics.length ? pics.map(p => p.file) : undefined,
        onText: ({ text: t }) => {
          const now = performance.now();
          if (now - last > 250) { last = now; draw(t); scrollDown(); }
          else { clearTimeout(pending); pending = setTimeout(() => { draw(t); scrollDown(); }, 260); }
        },
      });
      clearTimeout(pending);
      draw(res.text);
      turns.push({ role: 'assistant', content: res.text });
      if (res.truncated) addNote(ab, 'La risposta è stata interrotta perché troppo lunga: chiedi di continuare.');
    } catch (e) {
      clearTimeout(pending);
      const code = e && e.code;
      if (e && e.text && code !== 'refused') { draw(e.text); turns.push({ role: 'assistant', content: e.text }); }
      else ab.innerHTML = '';
      if (code === 'cancelled') { if (!e.text) ab.remove(); }
      else {
        addNote(ab, (ERRORS[code] || 'Qualcosa è andato storto. Riprova.') + (code ? ` (codice: ${code})` : ''), true);
        if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) setAvailable(false, ERRORS[code] || ERRORS.not_granted);
        if (code === 'images_unavailable') { maxImages = 0; photoBtns.forEach(b => { b.hidden = true; }); }
      }
    } finally {
      setBusy(false);
      ctl = null;
      scrollDown();
      if (!box.disabled && window.matchMedia('(pointer: fine)').matches) box.focus();
    }
  }
  function addNote(el, t, err) {
    const n = document.createElement('div');
    n.className = 'note' + (err ? ' err' : '');
    n.textContent = t;
    el.appendChild(n);
  }

  sendBtn.addEventListener('click', () => send());
  stopBtn.addEventListener('click', () => { if (ctl) ctl.abort(); });
  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && window.matchMedia('(pointer: fine)').matches) { ev.preventDefault(); send(); }
  });
  function autosize() { box.style.height = 'auto'; box.style.height = Math.min(180, box.scrollHeight + 2) + 'px'; }
  box.addEventListener('input', autosize);
  document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => send(b.dataset.ask)));
  $('tutor-new').addEventListener('click', () => {
    if (ctl) ctl.abort();
    turns = [];
    log.innerHTML = '';
    log.appendChild(emptyState.cloneNode(true));
    log.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => send(b.dataset.ask)));
  });
  const emptyState = log.querySelector('.tutor-empty').cloneNode(true);
})();
