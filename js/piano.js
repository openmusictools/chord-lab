/* Chord Lab — two-octave piano (C4–B5). Highlights by exact pitch; labels keep the chord's own spelling. */
(function (root) {
  'use strict';
  const E = root.ChordEngine;
  const WHITE = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const BLACK = { 1: ['C#', 'Db'], 3: ['D#', 'Eb'], 6: ['F#', 'Gb'], 8: ['G#', 'Ab'], 10: ['A#', 'Bb'] };
  const WHITE_COUNT = 14;

  function el(cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function render(container, chord, mode) {
    container.textContent = '';
    const lit = new Map(chord.keys.map((k) => [k.midi, k]));
    const low = chord.keyLow, high = chord.keyHigh;
    const whiteCount = Array.from({length: high-low+1}, (_,i) => low+i).filter(m => WHITE[m % 12] !== undefined).length;
    container.style.width = 'min(100%, ' + (whiteCount * 44) + 'px)';
    container.style.marginInline = 'auto';
    const w = 100 / whiteCount;
    let whiteIndex = 0;
    for (let midi = low; midi <= high; midi++) {
      const pc = midi % 12;
      const hit = lit.get(midi);
      const isWhite = WHITE[pc] !== undefined;
      const key = el('pk ' + (isWhite ? 'w' : 'b') + (hit ? ' hl' : '') + (hit && hit.isRoot ? ' root' : ''));
      key.dataset.midi = midi;
      if (isWhite) {
        key.style.left = whiteIndex * w + '%';
        key.style.width = w + '%';
        whiteIndex++;
      } else {
        key.style.left = whiteIndex * w + '%';
        key.style.width = w * 0.62 + '%';
      }
      const lbl = el('pk-lbl');
      if (hit) {
        lbl.textContent = E.noteLabel(hit.note, mode);
      } else if (isWhite) {
        lbl.textContent = E.noteLabel(WHITE[pc], mode);
      } else {
        BLACK[pc].forEach((n) => lbl.appendChild(el('', E.noteLabel(n, mode))));
      }
      key.appendChild(lbl);
      container.appendChild(key);
    }
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'מקלדת פסנתר. תווי האקורד: ' + chord.notes.map(E.noteHebrewFull).join(', '));
  }

  root.ChordPiano = { render };
})(self);
