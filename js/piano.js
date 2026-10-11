/* Chord Lab — full 88-key piano behind an animated, chord-sized viewport. */
(function (root) {
  'use strict';
  const E = root.ChordEngine;
  const WHITE = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const BLACK = { 1: ['C#', 'Db'], 3: ['D#', 'Eb'], 6: ['F#', 'Gb'], 8: ['G#', 'Ab'], 10: ['A#', 'Bb'] };
  const LOW = 21, HIGH = 108;
  const WHITE_COUNT = 52;
  const states = new WeakMap();

  function el(cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function render(container, chord, mode) {
    let track = container.querySelector('.piano-track');
    const fresh = !track;
    if (fresh) {
      container.textContent = '';
      track = el('piano-track');
      let whiteIndex = 0;
      for (let midi = LOW; midi <= HIGH; midi++) {
        const isWhite = WHITE[midi % 12] !== undefined;
        const key = el('pk ' + (isWhite ? 'w' : 'b'));
        key.dataset.midi = midi;
        key.style.left = (whiteIndex / WHITE_COUNT * 100) + '%';
        key.style.width = ((isWhite ? 1 : 0.62) / WHITE_COUNT * 100) + '%';
        if (isWhite) whiteIndex++;
        key.appendChild(el('pk-lbl'));
        track.appendChild(key);
      }
      container.appendChild(track);
    }
    let state = states.get(container);
    if (!state) { state = { revision: 0, root: null, timer: null, fadeTimer: null }; states.set(container, state); }
    clearTimeout(state.timer);
    clearTimeout(state.fadeTimer);
    track.classList.remove('piano-labels-fading');
    const revision = ++state.revision;
    const rootMidi = chord.keys.find(k => k.isRoot).midi;
    let shift = 0;
    if (state.root !== null) {
      const candidates = [];
      for (let octave = -8; octave <= 8; octave++) {
        const delta = octave * 12;
        if (chord.keyLow + delta >= LOW && chord.keyHigh + delta <= HIGH) candidates.push(delta);
      }
      candidates.sort((a, b) => Math.abs(rootMidi + a - state.root) - Math.abs(rootMidi + b - state.root) || Math.abs(a) - Math.abs(b));
      shift = candidates[0] || 0;
    }
    state.root = rootMidi + shift;
    const lit = new Map(chord.keys.map(k => [k.midi + shift, k]));
    const low = chord.keyLow + shift, high = chord.keyHigh + shift;
    const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let before = 0, visible = 0;
    for (let midi = LOW; midi <= HIGH; midi++) {
      if (WHITE[midi % 12] === undefined) continue;
      if (midi < low) before++;
      else if (midi <= high) visible++;
    }
    const nextTransform = 'translateX(-' + (before / WHITE_COUNT * 100) + '%)';
    const nextWidth = (WHITE_COUNT / visible * 100) + '%';
    const moved = track.style.transform !== nextTransform || track.style.width !== nextWidth;
    container.style.width = 'min(100%, ' + (visible * 44) + 'px)';
    container.style.marginInline = 'auto';
    // Percent translation is relative to the complete track, not the viewport.
    track.style.width = nextWidth;
    track.style.transform = nextTransform;
    function paint() {
    if (state.revision !== revision) return;
    for (const key of track.children) {
      const midi = Number(key.dataset.midi), pc = midi % 12;
      const hit = lit.get(midi), isWhite = WHITE[pc] !== undefined;
      const outside = midi < low || midi > high;
      key.className = 'pk ' + (isWhite ? 'w' : 'b') + (hit ? ' hl' : '') + (hit && hit.isRoot ? ' root' : '');
      key.setAttribute('aria-hidden', 'true');
      const lbl = key.firstChild;
      lbl.textContent = '';
      // Edge halves stay unlabelled. All pitches retain their real positions.
      if (outside) continue;
      if (hit) lbl.textContent = E.noteLabel(hit.note, mode);
      else if (isWhite) lbl.textContent = E.noteLabel(WHITE[pc], mode);
      else BLACK[pc].forEach(n => lbl.appendChild(el('', E.noteLabel(n, mode))));
    }
    container.setAttribute('aria-label', 'מקלדת פסנתר. תווי האקורד: ' + chord.notes.map(E.noteHebrewFull).join(', '));
    }
    function settle() {
      if (state.revision !== revision) return;
      if (reduced || fresh) { paint(); return; }
      track.classList.add('piano-labels-fading');
      state.fadeTimer = setTimeout(() => {
        if (state.revision !== revision) return;
        paint();
        void track.offsetWidth;
        track.classList.remove('piano-labels-fading');

      }, 160);
    }
    if (fresh || reduced || !moved) settle();
    else state.timer = setTimeout(settle, 400);
    if (fresh) {
      // Establish the initial position before enabling subsequent transitions.
      void track.offsetWidth;
      track.classList.add('piano-track-ready');
    }
    container.setAttribute('role', 'img');
  }
  root.ChordPiano = { render };
})(self);
