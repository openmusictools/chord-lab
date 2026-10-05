/* Chord Lab — feedback dialog. Posts straight to a Google Form (formResponse endpoint). */
(function (root) {
  'use strict';
  const FORM_ID = '1FAIpQLSetn0fef0vEVkaqitvPxXdCr45Lfq1e_Qdb_4NBYFraOQXXdQ';
  const ENDPOINT = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/formResponse';
  const ENTRY = { rating: 'entry.487510200', improve: 'entry.584018924', email: 'entry.963417793' };
  const LABELS = ['', 'גרוע', 'חלש', 'סביר', 'טוב', 'מצוין'];
  const COOLDOWN_MS = 30000;

  /** Sends the answers as an application/x-www-form-urlencoded POST. The response is opaque (no-cors). */
  async function send({ rating, improve, email }) {
    const body = new URLSearchParams();
    body.set(ENTRY.rating, String(rating)); // sent as a plain number: "1".."5"
    body.set(ENTRY.improve, improve || '');
    body.set(ENTRY.email, email || '');
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', body });
  }

  function init(getContext) {
    const $ = (id) => document.getElementById(id);
    const dlg = $('fb-dialog'), form = $('fb-form'), stars = Array.from(document.querySelectorAll('#fb-stars .star'));
    const status = $('fb-status'), submit = $('fb-submit'), label = $('fb-rating-label');
    let rating = 0, sending = false;

    function paint(hover) {
      const n = hover || rating;
      stars.forEach((s, i) => {
        s.classList.toggle('on', i < n);
        s.setAttribute('aria-checked', String(i + 1 === rating));
        s.tabIndex = (rating ? i + 1 === rating : i === 0) ? 0 : -1;
      });
      label.textContent = n ? `${n} — ${LABELS[n]}` : '';
    }
    function setRating(n) { rating = n; paint(); status.textContent = ''; }

    stars.forEach((s, i) => {
      s.addEventListener('click', () => setRating(i + 1));
      s.addEventListener('mouseenter', () => paint(i + 1));
      s.addEventListener('mouseleave', () => paint());
      s.addEventListener('keydown', (e) => {
        const k = e.key;
        let n = null;
        // The page is RTL: star 1 is on the right, so ArrowLeft moves toward 5.
        if (k === 'ArrowLeft' || k === 'ArrowUp') n = Math.min(5, (rating || 0) + 1);
        if (k === 'ArrowRight' || k === 'ArrowDown') n = Math.max(1, (rating || 2) - 1);
        if (k === 'Home') n = 1;
        if (k === 'End') n = 5;
        if (n) { e.preventDefault(); setRating(n); stars[n - 1].focus(); }
      });
    });

    function reset() {
      form.reset(); rating = 0; paint(); status.textContent = ''; status.className = 'fb-status';
      form.hidden = false; $('fb-thanks').hidden = true; submit.disabled = false;
    }
    function open() { reset(); dlg.showModal(); }
    document.querySelectorAll('[data-open-feedback]').forEach((b) => b.addEventListener('click', open));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));

    function fail(msg) { status.textContent = msg; status.className = 'fb-status err'; }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      if (!rating) return fail('נא לבחור דירוג בכוכבים (1–5).');
      const email = $('fb-email').value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('כתובת המייל אינה תקינה.');
      let last = 0;
      try { last = Number(localStorage.getItem('chordlab.fb') || 0); } catch (_) { /* storage may be blocked */ }
      if (Date.now() - last < COOLDOWN_MS) return fail('המשוב כבר נשלח. אפשר לשלוח שוב בעוד רגע.');
      const ctx = getContext();
      const text = $('fb-text').value.trim().slice(0, 2000);
      const improve = (text ? text + '\n\n' : '') + `[אקורד: ${ctx.chord} | כתובת: ${ctx.url}]`;
      sending = true; submit.disabled = true; status.className = 'fb-status'; status.textContent = 'שולח…';
      try {
        await send({ rating, improve, email });
        try { localStorage.setItem('chordlab.fb', String(Date.now())); } catch (_) { /* ignore */ }
        form.hidden = true; $('fb-thanks').hidden = false; $('fb-thanks-close').focus();
      } catch (_) {
        fail('השליחה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.');
        submit.disabled = false;
      } finally { sending = false; }
    });
    paint();
  }

  root.ChordFeedback = { init, send };
})(self);
