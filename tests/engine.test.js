'use strict';
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/vendor/tonal.min.js'), 'utf8') + ';this.Tonal = Tonal;', ctx);
const Tonal = ctx.Tonal;
const E = require('../js/engine.js')(Tonal);

const names = (s, t) => E.fromParts(s[0], s.slice(1), t).notes.join(' ');

test('enharmonic spelling is preserved (C ≠ B#)', () => {
  assert.equal(names('C', ''), 'C E G');
  assert.equal(names('B#', ''), 'B# D## F##');
  assert.equal(names('Db', ''), 'Db F Ab');
  assert.equal(names('C#', ''), 'C# E# G#');
  assert.equal(names('Cb', 'maj7'), 'Cb Eb Gb Bb');
  assert.equal(names('E#', 'm7b5'), 'E# G# B D#');
  assert.equal(names('F', 'dim7'), 'F Ab Cb Ebb');
  assert.equal(names('G##', ''), 'G## B## D##');
  assert.equal(names('Dbb', 'm'), 'Dbb Fbb Abb');
});

test('same keys, different names', () => {
  const a = E.fromParts('C', '', ''), b = E.fromParts('B', '#', '');
  assert.deepEqual(a.keys.map((k) => k.midi % 12), b.keys.map((k) => k.midi % 12));
  assert.notDeepEqual(a.notes, b.notes);
  assert.ok(a.enharmonic.some((e) => e.name === 'B#'));
});

test('all 13 types × 35 spelled roots: letters, semitones, key range', () => {
  const FORMULA = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10] };
  const LETTER_STEPS = { '': [0, 2, 4], m: [0, 2, 4], dim: [0, 2, 4], aug: [0, 2, 4], 7: [0, 2, 4, 6], maj7: [0, 2, 4, 6], m7: [0, 2, 4, 6], sus2: [0, 1, 4], sus4: [0, 3, 4], 6: [0, 2, 4, 5], m6: [0, 2, 4, 5], dim7: [0, 2, 4, 6], m7b5: [0, 2, 4, 6] };
  let count = 0;
  for (const l of E.LETTERS) for (const a of E.ACCIDENTALS) for (const t of E.TYPES) {
    const c = E.fromParts(l, a, t.suffix);
    assert.ok(c, `${l}${a}${t.suffix}`);
    const rootChroma = Tonal.Note.get(l + a).chroma;
    c.notes.forEach((n, i) => {
      assert.equal(Tonal.Note.get(n).chroma, (rootChroma + FORMULA[t.suffix][i]) % 12, `${c.name} note ${n}`);
      assert.equal(Tonal.Note.get(n).letter, E.LETTERS[(E.LETTERS.indexOf(l) + LETTER_STEPS[t.suffix][i]) % 7], `${c.name} letter of ${n}`);
    });
    const midis = c.keys.map((k) => k.midi);
    assert.equal(new Set(midis).size, midis.length, `${c.name} duplicate keys`);
    midis.forEach((m, i) => {
      assert.ok(m >= c.keyLow && m <= c.keyHigh, `${c.name} key ${m} out of range`);
      assert.equal(m % 12, (rootChroma + FORMULA[t.suffix][i]) % 12);
    });
    count++;
  }
  assert.equal(count, 5 * 7 * 13);
});

test('parsing', () => {
  const ok = (s) => { const r = E.parse(s); assert.ok(r.ok, s); return r.chord; };
  assert.equal(ok('C#m7').notes.join(' '), 'C# E G# B');
  assert.equal(ok('Bbmaj7').name, 'Bbmaj7');
  assert.equal(ok('bb').name, 'Bb');
  assert.equal(ok('F##dim').notes.join(' '), 'F## A# C#');
  assert.equal(ok('Ebb').name, 'Ebb');
  assert.equal(ok('Cø').name, 'Cm7b5');
  assert.equal(ok('CΔ').name, 'Cmaj7');
  assert.equal(ok('C♯m').name, 'C#m');
  assert.equal(ok('D-7').name, 'Dm7');
  assert.equal(ok('Gsus').name, 'Gsus4');
  assert.equal(ok('C9').name, 'C9');
  for (const bad of ['', 'H', 'Cfoo', 'C/E', 'x'.repeat(40), '123']) assert.equal(E.parse(bad).ok, false, bad);
});

test('name round-trips through parse (URL stability)', () => {
  for (const l of E.LETTERS) for (const a of E.ACCIDENTALS) for (const t of E.TYPES) {
    const c = E.fromParts(l, a, t.suffix);
    const back = E.parse(c.name);
    assert.ok(back.ok, c.name);
    assert.equal(back.chord.name, c.name);
  }
});


test('manual chord aliases survive serialization without changing notes', () => {
  for (const type of Tonal.ChordType.all()) for (const l of E.LETTERS) for (const a of E.ACCIDENTALS) {
    const c = E.build(l + a, type.aliases[0]);
    const back = E.build(c.root, c.tonal);
    assert.equal(back.name, c.name);
    assert.equal(back.notes.join(' '), c.notes.join(' '));
    const parsed = E.parse(c.name);
    assert.ok(parsed.ok, c.name);
    assert.equal(parsed.chord.notes.join(' '), c.notes.join(' '), c.name);
  }
  assert.equal(E.parse('CmMaj7').chord.name, 'CmM7');
  assert.equal(E.parse('C7b9sus').chord.notes.join(' '), 'C F G Bb Db');
});

test('compact keyboard preserves actual ascending voicing', () => {
  for (const type of Tonal.ChordType.all()) for (const l of E.LETTERS) for (const a of E.ACCIDENTALS) {
    const c = E.build(l + a, type.aliases[0]);
    c.keys.forEach((k, i) => {
      assert.equal(k.midi, 60 + Tonal.Note.chroma(c.root) + Tonal.Interval.semitones(c.intervals[i]));
      assert.ok(k.midi >= c.keyLow && k.midi <= c.keyHigh);
    });
    assert.ok([0,2,4,5,7,9,11].includes(c.keyLow % 12));
    assert.ok([0,2,4,5,7,9,11].includes(c.keyHigh % 12));
  }
  assert.equal(E.parse('C').chord.keyHigh - E.parse('C').chord.keyLow, 7);
  assert.deepEqual(Array.from(E.parse('B13').chord.keys, k => k.midi), [71,75,78,81,85,92]);
});

// Independent arithmetic oracle: letter distance and accidental displacement.
test('all 107 chord types × 35 roots: independent spelling, labels and enharmonic names', () => {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitch = n => natural[n[0]] + [...n.slice(1)].reduce((v, a) => v + (a === '#' ? 1 : -1), 0);
  const pc = n => ((pitch(n) % 12) + 12) % 12;
  let count = 0;
  for (const type of Tonal.ChordType.all()) for (const letter of E.LETTERS) for (const acc of E.ACCIDENTALS) {
    const c = E.build(letter + acc, type.aliases[0]);
    assert.ok(c);
    c.intervals.forEach((iv, i) => {
      const [, number, quality] = iv.match(/^(\d+)(P|M|m|A+|d+)$/);
      const num = Number(number), degree = (num - 1) % 7;
      const perfect = [0, 3, 4].includes(degree);
      let offset = quality === 'm' ? -1 : quality[0] === 'A' ? quality.length : quality[0] === 'd' ? -quality.length - (perfect ? 0 : 1) : 0;
      const semitones = [0, 2, 4, 5, 7, 9, 11][degree] + 12 * Math.floor((num - 1) / 7) + offset;
      assert.equal(pc(c.notes[i]), (pc(c.root) + semitones) % 12, c.name + ' pitch');
      assert.equal(c.notes[i][0], E.LETTERS[(E.LETTERS.indexOf(letter) + num - 1) % 7], c.name + ' letter');
      assert.equal(c.keys[i].midi, 60 + pc(c.root) + semitones, c.name + ' keyboard');
      const degreeText = (offset < 0 ? '♭'.repeat(-offset) : '♯'.repeat(offset)) + num;
      assert.equal(c.degrees[i], degreeText, c.name + ' degree');
      assert.ok(!E.noteLabel(c.notes[i], 'sol').includes('undefined'), c.name + ' solfege');
      assert.ok(!E.noteHebrewFull(c.notes[i]).includes('undefined'), c.name + ' spoken');
    });
    for (const alt of c.enharmonic) {
      const parsed = E.parse(alt.name);
      assert.ok(parsed.ok, alt.name);
      assert.equal(parsed.chord.notes.join(' '), alt.notes.join(' '), alt.name);
      assert.deepEqual(alt.notes.map(pc), c.notes.map(pc), c.name + ' = ' + alt.name);
      assert.ok(alt.notes.every(n => n.slice(1).length <= 2));
    }
    count++;
  }
  assert.equal(count, Tonal.ChordType.all().length * 35);
});

test('double-accidental equivalents and rare spellings stay readable', () => {
  assert.ok(E.parse('C').chord.enharmonic.some(c => c.name === 'Dbb'));
  assert.ok(E.parse('Dbb').chord.enharmonic.some(c => c.name === 'C'));
  assert.equal(E.noteLabel('D###', 'sol'), 'רה♯♯♯');
  assert.equal(E.noteHebrewFull('D###'), 'רה דיאז פי 3');
  assert.equal(E.noteLabel('Bbbb', 'sol'), 'סי♭♭♭');
  assert.equal(E.noteHebrewFull('Bbbb'), 'סי במול פי 3');
  assert.equal(E.parse('G##aug').chord.notes.join(' '), 'G## B## D###');
});
