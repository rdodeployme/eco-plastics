/* Eco Plastics preview: shared engine for both art directions.
   Scroll reveals, count-ups, scroll-driven steps, map zooms and presentation mode.
   Presentation mode: P (or the Present button) to enter, arrows / space / PageUp / PageDown
   (and most clickers) to move, Home / End, F for full screen, Esc or P to leave. */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  const EP = (window.EP = { reduce });

  /* Reveal on scroll */
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));

  /* Count-ups: the element keeps its final value in the HTML for no-JS readers */
  const nf = (n, d) => n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
  function countUp(el) {
    const to = parseFloat(el.dataset.count);
    const d = parseInt(el.dataset.decimals || '0', 10);
    if (reduce) { el.textContent = nf(to, d); return; }
    const dur = parseInt(el.dataset.duration || '1600', 10);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = nf(to * (1 - Math.pow(1 - p, 4)), d);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); counter.unobserve(e.target); } });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => {
    if (!reduce) el.textContent = nf(0, parseInt(el.dataset.decimals || '0', 10));
    counter.observe(el);
  });

  /* Animated SVG viewBox (used by the network maps) */
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  EP.viewBox = (svg, to, dur = 1300) => {
    const vb = svg.viewBox.baseVal;
    const from = [vb.x, vb.y, vb.width, vb.height];
    cancelAnimationFrame(svg._epvb);
    if (reduce) { svg.setAttribute('viewBox', to.join(' ')); return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const k = easeInOut(p);
      svg.setAttribute('viewBox', from.map((v, i) => (v + (to[i] - v) * k).toFixed(2)).join(' '));
      if (p < 1) svg._epvb = requestAnimationFrame(tick);
    };
    svg._epvb = requestAnimationFrame(tick);
  };

  /* Scroll-driven steps: a [data-scrolly] section gets data-active = index of the current [data-step] */
  const scrollies = [...document.querySelectorAll('[data-scrolly]')];
  scrollies.forEach((s) => {
    const svg = s.querySelector('svg[data-viewboxes]');
    if (!svg) return;
    const boxes = JSON.parse(svg.dataset.viewboxes);
    const pick = (step) => {
      const narrow = window.innerWidth < 760 && boxes.narrow;
      const set = narrow ? boxes.narrow : boxes.wide;
      return set[Math.min(step, set.length - 1)];
    };
    svg.setAttribute('viewBox', pick(0).join(' '));
    s.addEventListener('ep:step', (e) => EP.viewBox(svg, pick(e.detail.step)));
  });

  const stops = [...document.querySelectorAll('[data-stop]')];
  const bar = document.querySelector('[data-hud-bar]');
  const counterEl = document.querySelector('[data-hud-count]');
  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  let target = null;

  function nearest() {
    const y = window.scrollY + window.innerHeight * 0.3;
    let i = 0;
    stops.forEach((s, k) => { if (pageTop(s) <= y) i = k; });
    return i;
  }
  function updateHud(i) {
    if (!root.classList.contains('is-present') || !stops.length) return;
    const k = typeof i === 'number' ? i : (target ?? nearest());
    if (bar) bar.style.transform = `scaleX(${(k + 1) / stops.length})`;
    if (counterEl) counterEl.textContent = `${String(k + 1).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const line = window.innerHeight * 0.55;
      scrollies.forEach((s) => {
        const steps = s.querySelectorAll('[data-step]');
        let active = 0;
        steps.forEach((st, i) => { if (st.getBoundingClientRect().top < line) active = i; });
        if (s.dataset.active !== String(active)) {
          s.dataset.active = String(active);
          s.dispatchEvent(new CustomEvent('ep:step', { detail: { step: active } }));
        }
      });
      root.classList.toggle('is-scrolled', window.scrollY > 24);
      updateHud();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* Presentation mode */
  function go(i) {
    if (!stops.length) return;
    target = Math.max(0, Math.min(stops.length - 1, i));
    window.scrollTo({ top: Math.round(pageTop(stops[target])), behavior: reduce ? 'auto' : 'smooth' });
    updateHud(target);
  }
  let cursorTimer;
  function armCursor() {
    root.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    if (root.classList.contains('is-present')) cursorTimer = setTimeout(() => root.classList.add('hide-cursor'), 2200);
  }
  function setPresent(on) {
    const i = nearest();
    root.classList.toggle('is-present', on);
    if (on) { go(i); armCursor(); }
    else { target = null; root.classList.remove('hide-cursor'); }
  }
  function toggleFullscreen(force) {
    const fs = document.fullscreenElement;
    if ((force === true || !fs) && root.requestFullscreen) root.requestFullscreen().catch(() => {});
    else if ((force === false || fs) && document.exitFullscreen && fs) document.exitFullscreen().catch(() => {});
  }
  EP.present = setPresent;

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const present = root.classList.contains('is-present');
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPresent(!present); return; }
    if (!present) return;
    const next = ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (next || prev) { e.preventDefault(); go((target ?? nearest()) + (next ? 1 : -1)); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(stops.length - 1); }
    else if (e.key === 'Escape') { setPresent(false); }
    else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
  });
  ['wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { target = null; }, { passive: true }));
  window.addEventListener('mousemove', armCursor, { passive: true });
  document.querySelectorAll('[data-present]').forEach((b) => b.addEventListener('click', () => { setPresent(true); toggleFullscreen(true); }));
  document.querySelectorAll('[data-exit]').forEach((b) => b.addEventListener('click', () => { setPresent(false); toggleFullscreen(false); }));
  if (new URLSearchParams(window.location.search).has('present')) setPresent(true);
})();
