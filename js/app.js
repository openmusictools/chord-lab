/* Chord Lab — UI, URL state. Chord logic lives in engine.js (Tonal). */
(function () {
  'use strict';
  const E = ChordEngine;
  const $ = (id) => document.getElementById(id);
  const DEFAULT_CHORD = 'C';
  const SITE_DESC = 'מילון אקורדים דיגיטלי בעברית — תווי האקורד עם איות אנהרמוני נכון, ותצוגת פסנתר.';

  let chord = null;
  let sol = false;

  /* ---------- URL <-> state ---------- */
  function readUrl() {
    const p = new URLSearchParams(location.search);
    let storedSol = false;
    try { storedSol = localStorage.getItem('chordlab.sol') === '1'; } catch (_) { /* ignore */ }
    return { root: p.get('root'), type: p.get('type'), c: p.get('c'), sol: p.has('sol') ? p.get('sol') === '1' : storedSol };
  }
  function writeUrl(mode) {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('c');
      u.searchParams.set('root', chord.root);
      u.searchParams.set('type', chord.tonal);
      u.searchParams.set('sol', sol ? '1' : '0');
      if (u.href === location.href) return;
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', u);
    } catch (_) { /* e.g. file:// — the app still works, only the address bar isn't updated */ }
  }

  /* ---------- selection controls ---------- */
  function makeBtn(text, attrs, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sel-btn ' + (cls || '');
    b.textContent = text;
    Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v));
    return b;
  }
  const ACC_BUTTONS = [
    ['', 'טבעי ♮', 'טבעי'], ['b', '♭ במול', 'במול'], ['#', '♯ דיאז', 'דיאז'],
    ['bb', '♭♭', 'במול כפול'], ['##', '♯♯', 'דיאז כפול']
  ];
  function buildControls() {
    const roots = $('root-sel'), accs = $('acc-sel'), types = $('type-sel');
    E.LETTERS.slice().forEach((l) => roots.appendChild(makeBtn(l, { 'data-root': l })));
    ACC_BUTTONS.forEach(([a, text, name]) => {
      const small = a.length === 2 ? 'small' : '';
      accs.appendChild(makeBtn(text, { 'data-acc': a, 'aria-label': name, title: name }, small));
    });
    E.TYPES.forEach((t) => types.appendChild(makeBtn(t.label, { 'data-type': t.suffix }, 'type-btn')));
    roots.addEventListener('click', (e) => { const b = e.target.closest('[data-root]'); if (b) pick(b.dataset.root, chord.acc, chord.suffix); });
    accs.addEventListener('click', (e) => { const b = e.target.closest('[data-acc]'); if (b) pick(chord.letter, b.dataset.acc, chord.suffix); });
    types.addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) pick(chord.letter, chord.acc, b.dataset.type); });
  }
  function pick(letter, acc, suffix) {
    const c = E.fromParts(letter, acc, suffix);
    if (c) setChord(c, 'push');
  }
  function syncButtons() {
    const mark = (container, attr, value) => container.querySelectorAll('[' + attr + ']').forEach((b) => {
      const on = b.getAttribute(attr) === value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    mark($('root-sel'), 'data-root', chord.letter);
    mark($('acc-sel'), 'data-acc', chord.acc);
    mark($('type-sel'), 'data-type', chord.known ? chord.suffix : '\u0000');
  }

  /* ---------- rendering ---------- */
  const mode = () => (sol ? 'sol' : 'abc');
  function setText(id, text) { $(id).textContent = text; }
  function fillNotes(container, notes, degrees) {
    container.textContent = '';
    notes.forEach((n, i) => {
      if (i) { const s = document.createElement('span'); s.className = 'note-sep'; s.textContent = '·'; s.setAttribute('aria-hidden', 'true'); container.appendChild(s); }
      const chip = document.createElement('span');
      chip.className = 'note-chip';
      const name = document.createElement('b'); name.textContent = E.noteLabel(n, mode());
      chip.appendChild(name);
      if (degrees) { const d = document.createElement('i'); d.textContent = degrees[i]; chip.appendChild(d); }
      container.appendChild(chip);
    });
  }

  function render() {
    const name = $('chord-name');
    name.textContent = chord.name;
    name.classList.remove('pop'); void name.offsetWidth; name.classList.add('pop');
    setText('chord-type', E.noteHebrewFull(chord.root) + ' · ' + chord.typeHe);
    fillNotes($('notes-row'), chord.notes, chord.degrees);
    $('notes-row').setAttribute('aria-label', 'תווי האקורד: ' + chord.notes.map(E.noteHebrewFull).join(', '));

    $('aliases').textContent = chord.aliases.length ? chord.aliases.join('  ·  ') : '—';

    const enh = $('enh-block');
    enh.hidden = !(chord.enharmonic.length || chord.exotic);
    const list = $('enh-list'); list.textContent = '';
    chord.enharmonic.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'enh-row';
      const b = document.createElement('b'); b.textContent = e.name;
      const n = document.createElement('span'); n.textContent = e.notes.map((x) => E.noteLabel(x, mode())).join(' · ');
      row.append(b, n);
      list.appendChild(row);
    });
    $('exotic-note').hidden = !chord.exotic;

    const formula = 'דרגות: ' + chord.degrees.join(' · ');
    setText('explain', (chord.explain || `אקורד מסוג ${chord.typeHe}.`) + ' ' + formula + '.');

    ChordPiano.render($('piano'), chord, mode());
    syncButtons();
    $('sol-toggle').setAttribute('aria-pressed', String(sol));
    $('sol-toggle').classList.toggle('on', sol);

    document.title = `${chord.name} — תווי האקורד | Chord Lab`;
    const desc = `אקורד ${chord.name} (${chord.typeHe}): ${chord.notes.join(', ')}. ${SITE_DESC}`;
    document.querySelector('meta[name="description"]').setAttribute('content', desc);
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) { const u = new URL(location.href); u.hash = ''; u.search = ''; u.searchParams.set('root', chord.root); u.searchParams.set('type', chord.tonal); canon.setAttribute('href', u.href); }
    $('live').textContent = `האקורד ${chord.name}: ${chord.notes.map(E.noteHebrewFull).join(', ')}`;
  }

  function setChord(c, urlMode) {
    chord = c;
    render();
    if (urlMode) writeUrl(urlMode);
  }

  /* ---------- manual input ---------- */
  function showMsg(text, isErr) {
    const m = $('manual-msg');
    m.textContent = text || '';
    m.classList.toggle('err', !!isErr);
  }
  function onManual(e) {
    e.preventDefault();
    const r = E.parse($('manual').value);
    if (!r.ok) { showMsg(r.error, true); return; }
    showMsg('');
    setChord(r.chord, 'push');
  }

  /* ---------- small helpers ---------- */
  let toastTimer;
  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('הקישור הועתק');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = location.href; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove(); toast(ok ? 'הקישור הועתק' : 'לא ניתן להעתיק — העתיקו מסרגל הכתובת');
    }
  }
  function loadFromUrl(initial) {
    const st = readUrl();
    sol = st.sol;
    let c = null;
    if (st.root !== null || st.type !== null) {
      if (/^[A-G](?:bb|##|b|#)?$/.test(st.root || '') && st.type !== null) c = E.build(st.root, st.type);
      if (!c) showMsg('האקורד שבכתובת לא זוהה — מוצג C.', true);
    } else if (st.c) {
      const r = E.parse(st.c);
      if (r.ok) c = r.chord;
      else showMsg(`האקורד שבכתובת ("${st.c.slice(0, 20)}") לא זוהה — מוצג ${DEFAULT_CHORD}.`, true);
    }
    setChord(c || E.parse(DEFAULT_CHORD).chord, initial ? 'replace' : null);
  }

  function init() {
    buildControls();
    $('manual-form').addEventListener('submit', onManual);
    $('manual').addEventListener('input', () => showMsg(''));
    $('sol-toggle').addEventListener('click', () => {
      sol = !sol;
      try { localStorage.setItem('chordlab.sol', sol ? '1' : '0'); } catch (_) { /* ignore */ }
      render(); writeUrl('replace');
    });
    $('copy-link').addEventListener('click', copyLink);
    const help = $('help-dialog');
    $('help-btn').addEventListener('click', () => help.showModal());
    help.addEventListener('click', (e) => { if (e.target === help) help.close(); });
    help.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => help.close()));
    ChordFeedback.init(() => ({ chord: chord.name, url: location.href }));
    window.addEventListener('popstate', () => loadFromUrl(false));
    loadFromUrl(true);
  }

  init();
})();
