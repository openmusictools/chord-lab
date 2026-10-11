/* Chord Lab — full 88-key piano behind an animated, chord-sized viewport. */
(function (root) {
  'use strict';
  const E = root.ChordEngine;
  const WHITE = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const BLACK = { 1: ['C#', 'Db'], 3: ['D#', 'Eb'], 6: ['F#', 'Gb'], 8: ['G#', 'Ab'], 10: ['A#', 'Bb'] };
  const LOW = 21, HIGH = 108;
  const WHITE_COUNT = 52;

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
    const lit = new Map(chord.keys.map(k => [k.midi, k]));
    const low = chord.keyLow, high = chord.keyHigh;
    let before = 0, visible = 0;
    for (let midi = LOW; midi <= HIGH; midi++) {
      if (WHITE[midi % 12] === undefined) continue;
      if (midi < low) before++;
      else if (midi <= high) visible++;
    }
    container.style.width = 'min(100%, ' + (visible * 44) + 'px)';
    container.style.marginInline = 'auto';
    // Percent translation is relative to the complete track, not the viewport.
    track.style.width = (WHITE_COUNT / visible * 100) + '%';
    track.style.transform = 'translateX(-' + (before / WHITE_COUNT * 100) + '%)';
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
    if (fresh) {
      // Establish the initial position before enabling subsequent transitions.
      void track.offsetWidth;
      track.classList.add('piano-track-ready');
    }
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'מקלדת פסנתר. תווי האקורד: ' + chord.notes.map(E.noteHebrewFull).join(', '));
  }
  root.ChordPiano = { render };
})(self);
