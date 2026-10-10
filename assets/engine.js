/* Eco Plastics site engine.
   Reveals, count-ups, scroll-driven steps, menu, scroll-lit text, chapter previews, hotspots,
   toggles, market tabs, chart tooltips, the pinned horizontal line, and presentation mode.
   Presentation lives on /present/. Elsewhere, P (or the Present button) opens it at the current chapter. */
(() => {
  const root = document.documentElement;
  const page = root.dataset.page;
  const isDeck = page === 'present';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EP = (window.EP = { reduce });

  /* ---------- Reveal on scroll ---------- */
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  document.querySelectorAll('[data-reveal], .split, .levy-fig, .ruler-fig, .vic-fig, .ladder, .lanes').forEach((el) => reveal.observe(el));
  document.querySelectorAll('.lv-bar').forEach((b, i) => b.style.setProperty('--k', i));

  /* ---------- Count-ups (final value stays in the HTML) ---------- */
  const nf = (n, d) => n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
  function countUp(el) {
    const to = parseFloat(el.dataset.count), d = parseInt(el.dataset.decimals || '0', 10);
    if (reduce) { el.textContent = nf(to, d); return; }
    const t0 = performance.now(), dur = 1600;
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = nf(to * (1 - Math.pow(1 - p, 4)), d); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); counter.unobserve(e.target); } });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => {
    if (!reduce) el.textContent = nf(0, parseInt(el.dataset.decimals || '0', 10));
    counter.observe(el);
  });

  /* ---------- Animated SVG viewBox (network map steps) ---------- */
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  EP.viewBox = (svg, to, dur = 1300) => {
    const vb = svg.viewBox.baseVal, from = [vb.x, vb.y, vb.width, vb.height];
    cancelAnimationFrame(svg._epvb);
    if (reduce) { svg.setAttribute('viewBox', to.join(' ')); return; }
    const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur), k = ease(p);
      svg.setAttribute('viewBox', from.map((v, i) => (v + (to[i] - v) * k).toFixed(2)).join(' '));
      if (p < 1) svg._epvb = requestAnimationFrame(tick); };
    svg._epvb = requestAnimationFrame(tick);
  };
  const scrollies = [...document.querySelectorAll('[data-scrolly]')];
  scrollies.forEach((s) => {
    const svg = s.querySelector('svg[data-viewboxes]');
    if (!svg) return;
    const boxes = JSON.parse(svg.dataset.viewboxes);
    const pick = (i) => { const set = window.innerWidth < 760 ? boxes.narrow : boxes.wide; return set[Math.min(i, set.length - 1)]; };
    svg.setAttribute('viewBox', pick(0).join(' '));
    s.addEventListener('ep:step', (e) => EP.viewBox(svg, pick(e.detail.step)));
  });

  /* ---------- Menu ---------- */
  const menuBtn = document.querySelector('[data-menu]'), menu = document.getElementById('menu');
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelector('span').textContent = open ? 'Close' : 'Menu';
    root.classList.toggle('menu-open', open);
  }
  menuBtn?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  /* ---------- Scroll-lit words ---------- */
  const wordBlocks = [...document.querySelectorAll('[data-words]')].map((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, i) => {
      const s = document.createElement('span');
      s.className = 'w' + (/\d/.test(w) ? ' num' : '');
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    return { el, spans };
  });
  function lightWords() {
    const vh = window.innerHeight, present = root.classList.contains('is-present');
    wordBlocks.forEach(({ el, spans }) => {
      const r = el.getBoundingClientRect();
      let p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.28), 0, 1);
      if (present || reduce) p = r.top < vh && r.bottom > 0 ? 1 : p;
      const lit = Math.round(p * spans.length * 1.12);
      spans.forEach((s, i) => s.classList.toggle('on', i < lit));
    });
  }

  /* ---------- Chapter index: floating preview follows the cursor ---------- */
  document.querySelectorAll('[data-hover-reveal]').forEach((wrap) => {
    if (!fine) return;
    const fl = wrap.querySelector('.ix-float'), imgs = [...fl.querySelectorAll('.ix-img')];
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = false;
    const loop = () => { x += (tx - x) * 0.16; y += (ty - y) * 0.16; fl.style.setProperty('--fx', x + 'px'); fl.style.setProperty('--fy', y + 'px'); raf = on ? requestAnimationFrame(loop) : 0; };
    wrap.querySelectorAll('a[data-ix]').forEach((a) => a.addEventListener('mouseenter', () => {
      imgs.forEach((i) => i.classList.toggle('on', i.dataset.ix === a.dataset.ix));
      fl.classList.add('on');
    }));
    wrap.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      tx = e.clientX - r.left + 40; ty = e.clientY - r.top;
      if (!on) { on = true; x = tx; y = ty; raf = requestAnimationFrame(loop); }
    });
    wrap.addEventListener('mouseleave', () => { fl.classList.remove('on'); on = false; cancelAnimationFrame(raf); });
  });

  /* ---------- Anatomy hotspots ---------- */
  document.querySelectorAll('[data-hotspots]').forEach((sec) => {
    const btns = [...sec.querySelectorAll('[data-hs]')], tips = [...sec.querySelectorAll('[data-tip]')];
    const set = (i) => {
      btns.forEach((b) => { const onB = b.dataset.hs === String(i); b.classList.toggle('on', onB); b.setAttribute('aria-pressed', String(onB)); });
      tips.forEach((t) => t.classList.toggle('on', t.dataset.tip === String(i)));
    };
    btns.forEach((b) => {
      b.addEventListener('click', () => set(b.dataset.hs));
      b.addEventListener('focus', () => set(b.dataset.hs));
      if (fine) b.addEventListener('mouseenter', () => set(b.dataset.hs));
    });
    set(0);
  });

  /* ---------- As collected / as recovered ---------- */
  document.querySelectorAll('[data-recov-wrap]').forEach((sec) => {
    const seg = sec.querySelector('.seg'), grid = sec.querySelector('[data-recov]');
    const set = (rec) => {
      grid.classList.toggle('show-rec', rec);
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.view === 'rec') === rec)));
    };
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) set(b.dataset.view === 'rec'); });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !/input|textarea|select/i.test(e.target.tagName)) set(!grid.classList.contains('show-rec'));
    });
  });

  /* ---------- Market tabs ---------- */
  document.querySelectorAll('[data-markets]').forEach((sec) => {
    const fig = sec.querySelector('.markets-map'), tabs = [...sec.querySelectorAll('[data-market]')], panels = [...sec.querySelectorAll('[data-panel]')];
    const set = (k, focus) => {
      fig.dataset.sel = k;
      fig.querySelectorAll('.route').forEach((r) => r.classList.toggle('is-sel', r.classList.contains('r-' + k)));
      fig.querySelectorAll('.city.market').forEach((g) => g.classList.toggle('is-sel', g.dataset.key === k));
      tabs.forEach((t) => { const onT = t.dataset.market === k; t.setAttribute('aria-selected', String(onT)); t.tabIndex = onT ? 0 : -1; if (onT && focus) t.focus(); });
      panels.forEach((p) => { p.hidden = p.dataset.panel !== k; });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => set(t.dataset.market));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; set(n.dataset.market, true); }
      });
    });
    fig.querySelectorAll('.city.market').forEach((g) => g.addEventListener('click', () => set(g.dataset.key)));
    set(tabs[0].dataset.market);
  });

  /* ---------- Levy chart: tooltip and table ---------- */
  document.querySelectorAll('[data-chart]').forEach((fig) => {
    const tip = fig.querySelector('.lv-tip'), plot = fig.querySelector('.levy-plot');
    fig.querySelectorAll('.lv-bar').forEach((g) => {
      const show = () => {
        const r = g.querySelector('path').getBoundingClientRect(), pr = plot.getBoundingClientRect();
        tip.textContent = g.dataset.tip;
        tip.style.left = (r.left + r.width / 2 - pr.left) + 'px';
        tip.style.top = (r.top - pr.top) + 'px';
        tip.classList.add('on'); g.classList.add('hover');
      };
      const hide = () => { tip.classList.remove('on'); g.classList.remove('hover'); };
      g.addEventListener('mouseenter', show); g.addEventListener('mouseleave', hide);
      g.addEventListener('focus', show); g.addEventListener('blur', hide);
      g.addEventListener('click', show);
    });
    const tb = fig.querySelector('[data-table-toggle]'), table = fig.querySelector('table');
    tb?.addEventListener('click', () => {
      const open = table.hidden; table.hidden = !open;
      tb.setAttribute('aria-expanded', String(open));
      tb.textContent = open ? 'Hide the table' : 'Show as a table';
    });
  });

  /* ---------- Pinned horizontal line ---------- */
  const hlines = [...document.querySelectorAll('[data-hscroll]')];
  function layoutH() {
    hlines.forEach((sec) => {
      const pin = window.innerWidth >= 900 && !reduce && !root.classList.contains('is-present');
      sec.classList.toggle('is-pinned', pin);
      const track = sec.querySelector('.hline-track');
      track.style.transform = '';
      if (pin) {
        const extra = Math.max(0, track.scrollWidth - track.clientWidth);
        sec._extra = extra;
        sec.style.height = (window.innerHeight + extra) + 'px';
      } else { sec._extra = 0; sec.style.height = ''; }
    });
  }
  function updateH() {
    hlines.forEach((sec) => {
      if (!sec.classList.contains('is-pinned')) return;
      const r = sec.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, sec.offsetHeight - window.innerHeight), 0, 1);
      sec.querySelector('.hline-track').style.transform = `translate3d(${(-p * sec._extra).toFixed(1)}px,0,0)`;
      sec.style.setProperty('--p', p.toFixed(4));
    });
  }

  /* ---------- Presentation (deck only) ---------- */
  const stops = [...document.querySelectorAll('[data-stop]')];
  const bar = document.querySelector('[data-hud-bar]');
  const countEl = document.querySelector('[data-hud-count]');
  const whereEl = document.querySelector('.hud-where');
  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  let target = null;
  function nearest() {
    const y = window.scrollY + window.innerHeight * 0.3;
    let i = 0;
    stops.forEach((s, k) => { if (pageTop(s) <= y) i = k; });
    return i;
  }
  function updateHud(i) {
    if (!isDeck || !root.classList.contains('is-present') || !stops.length) return;
    const k = typeof i === 'number' ? i : (target ?? nearest());
    root.toggleAttribute('data-first', k === 0);
    if (bar) bar.style.transform = `scaleX(${(k + 1) / stops.length})`;
    if (countEl) countEl.textContent = `${String(k + 1).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
    const chap = stops[k].closest('[data-chapter]');
    if (whereEl && chap) whereEl.textContent = chap.dataset.title;
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
      lightWords();
      updateH();
      updateHud();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { layoutH(); onScroll(); });

  function go(i) {
    if (!stops.length) return;
    target = clamp(i, 0, stops.length - 1);
    window.scrollTo({ top: Math.round(pageTop(stops[target])), behavior: reduce ? 'auto' : 'smooth' });
    updateHud(target);
  }
  let cursorTimer;
  function armCursor() {
    root.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    if (root.classList.contains('is-present')) cursorTimer = setTimeout(() => root.classList.add('hide-cursor'), 2200);
  }
  function setPresent(on, at) {
    const i = typeof at === 'number' ? at : nearest();
    root.classList.toggle('is-present', on);
    layoutH();
    if (on) { go(i); armCursor(); } else { target = null; root.classList.remove('hide-cursor'); root.removeAttribute('data-first'); }
    lightWords();
  }
  function toggleFullscreen(force) {
    const fs = document.fullscreenElement;
    if ((force === true || !fs) && root.requestFullscreen) root.requestFullscreen().catch(() => {});
    else if ((force === false || fs) && document.exitFullscreen && fs) document.exitFullscreen().catch(() => {});
  }
  const presentURL = (() => { const a = document.querySelector('a.present-btn'); return a ? a.getAttribute('href') : null; })();
  if (!isDeck && presentURL) {
    const from = page === 'stream' ? 'streams' : page;
    const href = presentURL + (from && from !== 'home' && from !== '404' ? `?from=${from}` : '');
    document.querySelectorAll('a.present-btn').forEach((a) => a.setAttribute('href', href));
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/input|textarea|select/i.test(e.target.tagName || '')) return;
    if (!isDeck) {
      if ((e.key === 'p' || e.key === 'P') && presentURL) { e.preventDefault(); window.location.href = document.querySelector('a.present-btn').getAttribute('href'); }
      return;
    }
    const present = root.classList.contains('is-present');
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPresent(!present); return; }
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
    if (!present) return;
    const next = ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (next || prev) { e.preventDefault(); go((target ?? nearest()) + (next ? 1 : -1)); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(stops.length - 1); }
    else if (e.key === 'Escape') { setPresent(false); }
  });
  if (isDeck) {
    ['wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { target = null; }, { passive: true }));
    window.addEventListener('mousemove', armCursor, { passive: true });
    document.querySelectorAll('[data-present]').forEach((b) => b.addEventListener('click', () => { setPresent(true); toggleFullscreen(true); }));
    document.querySelectorAll('[data-exit]').forEach((b) => b.addEventListener('click', () => { setPresent(false); toggleFullscreen(false); }));
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    let startAt = 0;
    if (from) {
      const chap = document.querySelector(`[data-chapter="${CSS.escape(from)}"] [data-stop]`);
      if (chap) startAt = stops.indexOf(chap);
    }
    const wantPresent = !params.has('scroll') && window.innerWidth >= 900;
    window.addEventListener('load', () => {
      if (wantPresent) setPresent(true, Math.max(0, startAt));
      else if (startAt > 0) window.scrollTo(0, Math.round(pageTop(stops[startAt])));
    });
  }

  layoutH();
  onScroll();
})();
