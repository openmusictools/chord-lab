/*
 * Chord Lab — chord engine.
 * All music-theory computation is delegated to Tonal (MIT, vendored in js/vendor/),
 * which spells notes correctly (B# major = B# D## F##, not C E G).
 * This file only adds: the type table (Hebrew names), parsing, keyboard placement, enharmonic info.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.ChordEngine = factory(root.Tonal);
})(typeof self !== 'undefined' ? self : this, function createEngine(Tonal) {
  'use strict';
  const { Chord, Note, Interval } = Tonal;

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ACCIDENTALS = ['bb', 'b', '', '#', '##'];
  const SOLFEGE = { C: 'דו', D: 'רה', E: 'מי', F: 'פה', G: 'סול', A: 'לה', B: 'סי' };
  const ACC_HE = { b: 'במול', bb: 'במול כפול', '#': 'דיאז', '##': 'דיאז כפול' };
  const ACC_SYM = { '': '', b: '♭', bb: '♭♭', '#': '♯', '##': '♯♯' };

  // The 13 types shown as buttons. `tonal` = Tonal alias, `suffix` = text used in chord names and in the URL.
  const TYPES = [
    { suffix: '', tonal: 'M', label: 'Major', he: "מז'ור", explain: "אקורד מז'ורי — אופי שמח, יציב ובהיר. טרצה גדולה (4 חצאי טון) + קווינטה זכה (7). האקורד הבסיסי ביותר." },
    { suffix: 'm', tonal: 'm', label: 'Minor', he: 'מינור', explain: "אקורד מינורי — אופי נוגה ומלנכולי. טרצה קטנה (3 חצאי טון) + קווינטה זכה (7). שונה ממז'ור רק בטרצה." },
    { suffix: 'dim', tonal: 'dim', label: 'dim', he: 'מוקטן', explain: "אקורד מוקטן — מתוח, דרמטי ולא יציב. טרצה קטנה (3) + קווינטה מוקטנת (6). מופיע בדרגה VII של סולם מז'ורי." },
    { suffix: 'aug', tonal: 'aug', label: 'aug', he: 'מוגדל', explain: 'אקורד מוגדל — מסתורי וחולמני. טרצה גדולה (4) + קווינטה מוגדלת (8). סימטרי: חוזר על עצמו כל 4 חצאי טון.' },
    { suffix: '7', tonal: '7', label: '7', he: 'דומיננטי 7', explain: "מז'ור עם ספטימה קטנה (10 חצאי טון). מתח שרוצה להיפתר לטוניקה. בסיס הבלוז והג'אז." },
    { suffix: 'maj7', tonal: 'maj7', label: 'Maj7', he: "מז'ור 7", explain: "מז'ור עם ספטימה גדולה (11 חצאי טון). צליל רך, עשיר וחולמני — אקורד הג'אז הקלאסי." },
    { suffix: 'm7', tonal: 'm7', label: 'm7', he: 'מינור 7', explain: "מינור עם ספטימה קטנה (10 חצאי טון). חלק ומתוחכם, נפוץ מאוד בג'אז ובסול." },
    { suffix: 'sus2', tonal: 'sus2', label: 'sus2', he: 'מושהה 2', explain: "הטרצה מוחלפת בסקונדה (2 חצאי טון). פתוח ואוורירי, ללא אופי מז'ורי או מינורי." },
    { suffix: 'sus4', tonal: 'sus4', label: 'sus4', he: 'מושהה 4', explain: 'הטרצה מוחלפת בקוורטה (5 חצאי טון). מתח שרוצה להיפתר, נפוץ לפני קדנצה.' },
    { suffix: '6', tonal: '6', label: '6', he: "מז'ור 6", explain: "מז'ור עם סקסטה גדולה (9 חצאי טון). צליל מתוק ונוסטלגי, נפוץ בג'אז ובפופ ישן." },
    { suffix: 'm6', tonal: 'm6', label: 'm6', he: 'מינור 6', explain: "מינור עם סקסטה גדולה (9 חצאי טון). מורכב ומרגש, נפוץ בג'אז מינורי ובמוזיקה לטינית." },
    { suffix: 'dim7', tonal: 'dim7', label: 'dim7', he: 'מוקטן 7', explain: 'מוקטן עם ספטימה מוקטנת (9 חצאי טון). סימטרי לחלוטין — חוזר על עצמו כל 3 חצאי טון.' },
    { suffix: 'm7b5', tonal: 'm7b5', label: 'ø m7b5', he: 'חצי מוקטן', explain: 'מינור 7 עם קווינטה מוקטנת (6 חצאי טון). הדרגה ii במהלך ii–V–i בטונליות מינורית.' }
  ];
  const TYPE_BY_SUFFIX = new Map(TYPES.map((t) => [t.suffix, t]));

  const KEY_LOW = 60;  // C4 — the on-screen keyboard spans C4..B5
  const KEY_HIGH = 83;

  const accCount = (note) => (note.match(/[#b]/g) || []).length;

  function degreeLabel(interval) {
    const iv = Interval.get(interval);
    const perfectType = [1, 4, 5].includes(((iv.num - 1) % 7) + 1);
    if (iv.q === 'm') return '♭' + iv.num;
    if (iv.q === 'A') return '♯' + iv.num;
    if (iv.q === 'd') return (perfectType ? '♭' : '♭♭') + iv.num;
    return String(iv.num);
  }

  /** Spell a note for display. mode 'abc' → C#, Bb, F##; mode 'sol' → דו, פה♯, סי♭♭. */
  function noteLabel(note, mode) {
    const n = Note.get(note);
    if (n.empty) return note;
    return mode === 'sol' ? SOLFEGE[n.letter] + ACC_SYM[n.acc] : n.letter + n.acc;
  }

  /** Spoken Hebrew name, e.g. "פה דיאז כפול". */
  function noteHebrewFull(note) {
    const n = Note.get(note);
    return SOLFEGE[n.letter] + (n.acc ? ' ' + ACC_HE[n.acc] : '');
  }

  /** Build everything we show for a chord, given a spelled root ("C#", "Bbb") and a Tonal alias. */
  function build(rootName, tonalAlias) {
    const root = Note.get(rootName);
    if (root.empty) return null;
    const c = Chord.getChord(tonalAlias, root.pc);
    if (c.empty) return null;
    const canonical = c.aliases[0];
    const known = TYPES.find((t) => t.tonal === canonical);
    const suffix = known ? known.suffix : (c.aliases.find(a => a && !a.includes('/') && !/^[b#]/.test(a)) || canonical);
    const rootBase = KEY_LOW + root.chroma;
    // Stack the chord upward from the root so the keyboard shows the true voicing.
    const keys = c.intervals.map((iv, i) => {
      let midi = rootBase + Interval.semitones(iv);

      return { midi, note: c.notes[i], degree: degreeLabel(iv), isRoot: i === 0 };
    });
    // Same keys, different spelling (B# major sounds like C major but its notes are B# D## F##).
    const enharmonic = [];
    for (const l of LETTERS) for (const a of ACCIDENTALS) {
      const r = l + a;
      if (r === root.pc || Note.get(r).chroma !== root.chroma || accCount(r) > 1) continue;
      const alt = Chord.getChord(canonical, r);
      if (alt.empty || alt.notes.some((n) => accCount(n) > 2)) continue;
      enharmonic.push({ name: r + suffix, root: r, notes: alt.notes });
    }
    enharmonic.sort((x, y) => accCount(x.root) - accCount(y.root));
    return {
      name: root.pc + suffix, root: root.pc, letter: root.letter, acc: root.acc, suffix, tonal: canonical,
      notes: c.notes, intervals: c.intervals, degrees: c.intervals.map(degreeLabel), keys,
      typeHe: known ? known.he : c.name || suffix,
      explain: known ? known.explain : null,
      known: !!known,
      aliases: [...new Set(c.aliases.map((a) => root.pc + a))].filter((n) => n !== root.pc + suffix).slice(0, 6),
      enharmonic: enharmonic.slice(0, 2),
      keyLow: Math.min(...keys.map(k => k.midi)) - (root.chroma === 1 || root.chroma === 3 || root.chroma === 6 || root.chroma === 8 || root.chroma === 10 ? 1 : 0),
      keyHigh: (() => { const high = Math.max(...keys.map(k => k.midi)); return [1,3,6,8,10].includes(high % 12) ? high + 1 : high; })(),
      exotic: c.notes.some((n) => accCount(n) > 2)
    };
  }

  function normalize(text) {
    return text.replace(/[♯＃]/g, '#').replace(/♭/g, 'b').replace(/𝄪/g, '##').replace(/𝄫/g, 'bb').replace(/[Δ∆]/g, 'maj7').replace(/maj77/g, 'maj7');
  }

  /** Parse free text such as "C#m7", "Bbmaj7", "F##dim", "ebb", "Cø" → {ok, chord} | {ok:false, error}. */
  function parse(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return { ok: false, error: 'לא הוקלד אקורד.' };
    if (raw.length > 24) return { ok: false, error: 'הטקסט ארוך מדי.' };
    const m = normalize(raw).match(/^([A-Ga-g])(##|bb|#|b)?(.*)$/);
    if (!m) return { ok: false, error: 'האקורד חייב להתחיל באות A–G (למשל C#m7).' };
    const rootName = m[1].toUpperCase() + (m[2] || '');
    const q = m[3].trim();
    if (/\/[A-Ga-g](?:bb|##|b|#)?$/.test(q)) return { ok: false, error: 'אקורדי בס (למשל C/E) עדיין לא נתמכים.' };
    for (const cand of [q, q.toLowerCase()]) {
      const c = Chord.getChord(cand, rootName);
      if (!c.empty) {
        const chord = build(rootName, c.aliases[0]);
        if (chord) return { ok: true, chord };
      }
    }
    return { ok: false, error: `לא זוהה סוג האקורד "${q}". נסו למשל: m, 7, maj7, dim, sus4.` };
  }

  /** Build from the button state: letter, accidental, type suffix. */
  function fromParts(letter, acc, suffix) {
    const t = TYPE_BY_SUFFIX.get(suffix);
    return build(letter + acc, t ? t.tonal : suffix);
  }

  return { TYPES, LETTERS, ACCIDENTALS, ACC_SYM, KEY_LOW, KEY_HIGH, build, parse, fromParts, noteLabel, noteHebrewFull };
});
