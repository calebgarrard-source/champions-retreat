/* Champions Retreat, concept page */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- nav ---------- */
  var nav = $('#nav'), hero = $('.hero'), menuBtn = $('.nav__menu'), menu = $('#menu');
  function onScroll() {
    var past = window.scrollY > Math.max(40, (hero ? hero.offsetHeight : 400) - 90);
    nav.classList.toggle('is-solid', past);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('.nav__menu-label').textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
    var main = $('#main'), foot = $('.foot');
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      main.inert = true; foot.inert = true; document.body.style.overflow = 'hidden';
      var first = $('a', menu); if (first) first.focus();
    } else {
      menu.classList.remove('is-open'); menu.hidden = true;
      main.inert = false; foot.inert = false; document.body.style.overflow = '';
    }
  }
  menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });
  window.addEventListener('resize', function () { if (window.innerWidth >= 1240 && menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false); });

  /* in-page links glide; keyboard focus still jumps at once */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    var id = a.getAttribute('href').slice(1), t = id ? document.getElementById(id) : null; if (!t) return;
    e.preventDefault();
    var y = id === 'top' ? 0 : t.getBoundingClientRect().top + window.scrollY - (id === 'inquire' ? nav.offsetHeight + 16 : nav.offsetHeight);
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + id);
    if (id !== 'top') { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });

  /* ---------- hero: entrance and film ---------- */
  requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('is-in'); }); });
  var film = $('.hero__film'), toggle = $('.film-toggle');
  var userPaused = store('cr-film') === 'paused';
  function setToggle(paused) {
    toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    $('.film-toggle__label', toggle).textContent = paused ? 'Play film' : 'Pause film';
  }
  if (film && !reduce) {
    var startFilm = function () {
      var tall = window.innerHeight > window.innerWidth * 1.05;
      var src = tall ? film.dataset.srcTall : (window.innerWidth > 960 ? film.dataset.srcWide : film.dataset.srcNarrow);
      film.src = src; film.load();
      toggle.hidden = false; setToggle(userPaused);
      film.addEventListener('playing', function () { film.classList.add('is-on'); }, { once: true });
      if (!userPaused) { var p = film.play(); if (p && p.catch) p.catch(function () { setToggle(true); }); }
      else { film.classList.add('is-on'); }
    };
    if (document.readyState === 'complete') setTimeout(startFilm, 300); else window.addEventListener('load', function () { setTimeout(startFilm, 300); });
    toggle.addEventListener('click', function () {
      if (film.paused) { userPaused = false; store('cr-film', 'playing'); film.play(); setToggle(false); }
      else { userPaused = true; store('cr-film', 'paused'); film.pause(); setToggle(true); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (!film.src) return; if (en.isIntersecting) { if (!userPaused) film.play().catch(function () {}); } else film.pause(); });
      }, { threshold: 0.05 }).observe(hero);
    }
  }

  /* ---------- the club film, with sound ---------- */
  var theater = $('#theater'), watch = $('.film-watch');
  if (theater && watch && typeof theater.showModal === 'function') {
    var tv = $('.theater__video', theater), heroWasPlaying = false;
    watch.addEventListener('click', function () {
      if (!tv.src) tv.src = tv.dataset.src;
      heroWasPlaying = film && !film.paused;
      if (film) film.pause();
      theater.showModal();
      var p = tv.play(); if (p && p.catch) p.catch(function () {});
    });
    if (film) film.addEventListener('play', function () { if (theater.open) film.pause(); });
    $('.theater__close', theater).addEventListener('click', function () { theater.close(); });
    theater.addEventListener('click', function (e) { if (e.target === theater) theater.close(); });
    theater.addEventListener('close', function () {
      tv.pause();
      if (film && heroWasPlaying && !userPaused) film.play().catch(function () {});
      watch.focus();
    });
  } else if (watch) { watch.hidden = true; }

  /* ---------- photographs arrive once ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var f = en.target, img = $('img', f); fio.unobserve(f);
        var show = function () { f.classList.remove('is-wait'); f.classList.add('is-in'); };
        if (img && img.decode) img.decode().then(show, show); else show();
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    $$('.frame').forEach(function (f) {
      var r = f.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) return;
      f.classList.add('is-wait'); fio.observe(f);
    });
  }

  /* ---------- the deal of the cards ---------- */
  var ORDER = ['Island', 'Bluff', 'Creek'];
  var NINE = {
    Island: { by: 'Arnold Palmer drew first', c: 'var(--island)', say: 'Island: the Palmer nine. Arnold Palmer drew first.' },
    Bluff: { by: 'Jack Nicklaus drew second', c: 'var(--bluff)', say: 'Bluff: the Nicklaus nine. Jack Nicklaus drew second.' },
    Creek: { by: 'Gary Player kept the last', c: 'var(--creek)', say: 'Creek: the Player nine. The last card belonged to Gary Player, the host.' }
  };
  var cards = $$('.card'), deal = $('.deal'), live = $('#deal-live');
  var startPanel = $('[data-nine-panel="start"]'), hint = $('.nines__hint');
  var btnAll = $('.nines__all'), btnAgain = $('.nines__again');
  var drawn = [], active = null;
  function land() { return window.CRLand || { select: function () {}, overview: function () {}, reset: function () {}, flyHole: function () {}, tour: function () {}, stopTour: function () {}, touring: function () { return false; } }; }
  /* a row of tee markers per nine: fly one hole, or the whole nine */
  $$('.nine').forEach(function (art) {
    var n = art.dataset.ninePanel;
    var fly = document.createElement('div'); fly.className = 'fly';
    fly.innerHTML = '<p class="fly__label" id="fly-' + n + '">Fly over a hole</p><div class="fly__holes" role="group" aria-labelledby="fly-' + n + '"></div><button class="link fly__tour" type="button"><span class="fly__go">Fly the nine</span><span class="fly__stop" aria-hidden="true">Stop the tour</span></button>';
    var row = $('.fly__holes', fly);
    for (var r = 1; r <= 9; r++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tee'; b.dataset.hole = r; b.textContent = r;
      b.setAttribute('aria-label', n + ' hole ' + r); b.setAttribute('aria-pressed', 'false');
      row.appendChild(b);
    }
    art.insertBefore(fly, $('.nine__photos', art));
    row.addEventListener('click', function (e) {
      var b = e.target.closest('.tee'); if (!b) return;
      land().stopTour(); land().flyHole(n, +b.dataset.hole); markHole(n, +b.dataset.hole);
      live.textContent = n + ' hole ' + b.dataset.hole + '.';
    });
    var tour = $('.fly__tour', fly);
    tour.addEventListener('click', function () {
      if (land().touring()) { land().stopTour(); return; }
      tour.classList.add('is-touring'); $('.fly__go', tour).setAttribute('aria-hidden', 'true'); $('.fly__stop', tour).removeAttribute('aria-hidden');
      live.textContent = 'Flying the ' + n + ' nine, hole by hole.';
      land().tour(n, function (r) { markHole(n, r); }, function () {
        tour.classList.remove('is-touring'); $('.fly__stop', tour).setAttribute('aria-hidden', 'true'); $('.fly__go', tour).removeAttribute('aria-hidden');
      });
    });
  });
  function markHole(n, r) {
    $$('.tee').forEach(function (b) { var on = b.closest('.nine').dataset.ninePanel === n && +b.dataset.hole === r; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function showPanel(n) {
    $$('.nine').forEach(function (a) { a.classList.toggle('is-on', a.dataset.ninePanel === n); });
    startPanel.hidden = !!n;
  }
  function markActive() {
    cards.forEach(function (c) { var on = c.dataset.nine && c.dataset.nine === active; c.classList.toggle('is-active', !!on); });
  }
  function nameCard(c) {
    var n = c.dataset.nine;
    $('.card__name', c).textContent = n ? n + ', ' + NINE[n].by + '. Show this nine' : 'Draw a card';
  }
  cards.forEach(function (c) {
    c.addEventListener('click', function () {
      var n = c.dataset.nine;
      if (!n) {
        if (drawn.length >= 3) return;
        n = ORDER[drawn.length]; drawn.push(n);
        c.dataset.nine = n;
        $('.card__word', c).textContent = n;
        $('.card__by', c).textContent = NINE[n].by;
        c.style.setProperty('--c', NINE[n].c);
        c.classList.add('is-up');
        c.setAttribute('aria-pressed', 'true');
        if (!reduce) { c.classList.add('is-drawing'); setTimeout(function () { c.classList.remove('is-drawing'); }, 1500); }
        nameCard(c);
      }
      active = n; markActive(); showPanel(n); markHole(null, 0);
      live.textContent = NINE[n].say;
      land().select(n);
      btnAll.hidden = false; btnAgain.hidden = drawn.length < 1;
      if (drawn.length === 3) deal.setAttribute('aria-label', 'Three index cards, all turned over');
    });
  });
  btnAll.addEventListener('click', function () {
    active = null; markActive(); showPanel(null); markHole(null, 0);
    hint.textContent = drawn.length === 3 ? 'All 27 holes. Pick a card to fly back to its nine.' : 'All 27 holes so far. Draw the next card, or pick a turned card to fly back to its nine.';
    live.textContent = 'Showing all 27 holes.';
    land().overview();
    btnAll.hidden = true;
  });
  btnAgain.addEventListener('click', function () {
    drawn = []; active = null;
    cards.forEach(function (c) {
      delete c.dataset.nine; c.classList.remove('is-up', 'is-active', 'is-drawing'); c.setAttribute('aria-pressed', 'false'); c.style.removeProperty('--c'); nameCard(c);
    });
    showPanel(null); hint.textContent = 'Draw a card. They turn over in the order the champions drew them.';
    deal.setAttribute('aria-label', 'Three index cards, face down');
    live.textContent = 'The cards are face down again.';
    land().reset();
    btnAll.hidden = true; btnAgain.hidden = true;
    cards[0].focus();
  });
  /* a hole clicked on the model itself */
  if (window.CRLand && window.CRLand.ready) {
    window.CRLand.onHole = function (n, r) {
      if (active !== n) { active = n; markActive(); showPanel(n); }
      markHole(n, r); btnAll.hidden = false;
      live.textContent = n + ' hole ' + r + '.';
    };
  }
  /* the cards start face down, whatever the markup showed without scripts */
  cards.forEach(function (c) { $('.card__word', c).textContent = ''; $('.card__by', c).textContent = ''; nameCard(c); });
  showPanel(null);

  /* ---------- the field: 72 start, 30 go on ---------- */
  var svg = $('.field__svg');
  if (svg) {
    var NS = 'http://www.w3.org/2000/svg';
    var make = function (tag, attrs) { var el = document.createElementNS(NS, tag); for (var k in attrs) el.setAttribute(k, attrs[k]); svg.appendChild(el); return el; };
    var SP = 20, X0 = 8, Y0 = 52, X1 = 418;
    make('text', { x: X0, y: 24 }).textContent = 'Rounds one and two, here';
    make('text', { x: X1, y: 24 }).textContent = 'Augusta National';
    make('line', { class: 'field__line', x1: 268, y1: 120, x2: 392, y2: 120 });
    var dotsEls = [], adv = {};
    /* a fixed, even spread of 30 from 72 */
    for (var a = 0; a < 30; a++) adv[Math.floor(a * 72 / 30 + 1)] = true;
    for (var i = 0; i < 72; i++) {
      var cx = X0 + 6 + (i % 12) * SP, cy = Y0 + Math.floor(i / 12) * SP;
      dotsEls.push(make('circle', { cx: cx, cy: cy, r: 5.4 }));
    }
    var k = 0, targets = [];
    dotsEls.forEach(function (d, i) {
      if (!adv[i]) return;
      var tx = X1 + 6 + (k % 6) * SP, ty = Y0 + Math.floor(k / 6) * SP + 10;
      targets.push({ d: d, dx: tx - (+d.getAttribute('cx')), dy: ty - (+d.getAttribute('cy')) }); k++;
    });
    var finish = function () {
      dotsEls.forEach(function (d, i) { if (!adv[i]) d.classList.add('is-cut'); });
      targets.forEach(function (t, n) {
        t.d.classList.add('is-on');
        t.d.style.transitionDelay = (reduce ? 0 : n * 22) + 'ms';
        t.d.style.transform = 'translate(' + t.dx + 'px,' + t.dy + 'px)';
      });
    };
    if (reduce || !('IntersectionObserver' in window)) finish();
    else {
      dotsEls.forEach(function (d) { d.style.opacity = '0'; });
      var sio = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; sio.disconnect();
        dotsEls.forEach(function (d, i) { setTimeout(function () { d.style.opacity = ''; }, i * 9); });
        setTimeout(finish, 72 * 9 + 700);
      }, { threshold: 0.5 });
      sio.observe(svg);
    }
  }

  /* the honours board fills in name by name */
  var board = $('.board');
  if (board && !reduce && 'IntersectionObserver' in window && board.getBoundingClientRect().top > window.innerHeight * 0.9) {
    board.classList.add('is-wait');
    $$('.board__list li', board).forEach(function (li, i) { li.style.transitionDelay = (140 + i * 120) + 'ms'; });
    var bio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { board.classList.remove('is-wait'); bio.disconnect(); } }, { threshold: 0.35 });
    bio.observe(board);
  }

  /* ---------- a day at the club ---------- */
  var day = $('.day'), track = $('.day__track'), stops = $$('.stop'), photos = $$('.day__photos img');
  var sunDot = $('.sun__dot'), sunLit = $('.sun__lit'), arc = $('.sun__arc');
  var GROUND = [
    ['#dde2e2', '#16181b', '#43474d', 'rgba(22,24,27,.16)'],
    ['#eceeea', '#16181b', '#43474d', 'rgba(22,24,27,.14)'],
    ['#f3f3ef', '#16181b', '#43474d', 'rgba(22,24,27,.14)'],
    ['#f1f2ec', '#16181b', '#43474d', 'rgba(22,24,27,.14)'],
    ['#f4f2eb', '#16181b', '#43474d', 'rgba(22,24,27,.14)'],
    ['#eee2cf', '#16181b', '#43474d', 'rgba(22,24,27,.16)'],
    ['#15120f', '#edece7', '#b3b5b0', 'rgba(237,236,231,.2)']
  ];
  var pinned = false, cur = -1, arcLen = 0;
  if (sunLit) { arcLen = sunLit.getTotalLength(); sunLit.style.strokeDasharray = arcLen; sunLit.style.strokeDashoffset = arcLen; }
  function setStop(n) {
    if (n === cur) return; cur = n;
    stops.forEach(function (s, i) { s.classList.toggle('is-on', i === n); s.setAttribute('aria-hidden', pinned && i !== n ? 'true' : 'false'); });
    photos.forEach(function (p, i) { p.classList.toggle('is-on', i === n); });
    var g = GROUND[n] || GROUND[0];
    day.style.setProperty('--day-bg', g[0]); day.style.setProperty('--day-ink', g[1]); day.style.setProperty('--day-ink-2', g[2]); day.style.setProperty('--day-rule', g[3]);
    day.classList.toggle('is-night', n === stops.length - 1);
  }
  function hourAt(p) {
    var f = p * stops.length - 0.5, i0 = Math.max(0, Math.min(stops.length - 1, Math.floor(f))), i1 = Math.min(stops.length - 1, i0 + 1), t = Math.max(0, Math.min(1, f - i0));
    var h0 = +stops[i0].dataset.hour, h1 = +stops[i1].dataset.hour;
    return h0 + (h1 - h0) * t;
  }
  function daySun(p) {
    if (!arc) return;
    var h = hourAt(p), t = Math.max(0, Math.min(1, (h - 5) / (19 - 5)));
    var pt = arc.getPointAtLength(arcLen * t);
    sunDot.setAttribute('cx', pt.x.toFixed(1)); sunDot.setAttribute('cy', pt.y.toFixed(1));
    sunLit.style.strokeDashoffset = (arcLen * (1 - t)).toFixed(1);
  }
  function dayScroll() {
    if (!pinned) return;
    var r = track.getBoundingClientRect(), span = track.offsetHeight - window.innerHeight;
    var p = Math.max(0, Math.min(1, -r.top / Math.max(1, span)));
    setStop(Math.min(stops.length - 1, Math.floor(p * stops.length)));
    daySun(p);
  }
  function dayMode() {
    var want = !reduce && window.innerWidth >= 1000 && window.innerHeight >= 600;
    if (want === pinned && cur !== -1) { dayScroll(); return; }
    pinned = want;
    day.classList.toggle('is-pinned', pinned);
    day.style.setProperty('--stops', stops.length);
    if (pinned) { cur = -1; dayScroll(); if (cur === -1) setStop(0); }
    else {
      cur = -1; stops.forEach(function (s) { s.classList.remove('is-on'); s.removeAttribute('aria-hidden'); });
      ['--day-bg', '--day-ink', '--day-ink-2', '--day-rule'].forEach(function (v) { day.style.removeProperty(v); });
      day.classList.remove('is-night');
    }
  }
  if (day) {
    dayMode();
    window.addEventListener('scroll', dayScroll, { passive: true });
    window.addEventListener('resize', dayMode);
  }

  /* ---------- membership finder ---------- */
  var finder = $('#finder'), plans = $$('.plan'), askName = $('.plans__name'), planSelect = $('#f-plan');
  function pick() {
    var f = new FormData(finder), live = f.get('live'), age = f.get('age'), want = f.get('for');
    if (want === 'clients') return 'Corporate';
    if (want === 'social') return 'Social';
    if (live === 'far') return 'National';
    if (age === '39') return 'Young Executive';
    return 'Full Golf';
  }
  function showPlan() {
    var p = pick();
    plans.forEach(function (a) { a.classList.toggle('is-on', a.dataset.plan === p); });
    askName.textContent = p;
    planSelect.value = p;
  }
  if (finder) {
    finder.addEventListener('change', showPlan);
    finder.addEventListener('submit', function (e) { e.preventDefault(); });
    showPlan();
    $('.plans__ask').addEventListener('click', function () { planSelect.value = pick(); });
  }

  /* ---------- inquiry form: opens an email to Kayla ---------- */
  var form = $('#inquire-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      [['f-name', function (v) { return v.trim().length > 1; }], ['f-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }]].forEach(function (pair) {
        var el = document.getElementById(pair[0]), err = document.getElementById(pair[0] + '-err'), good = pair[1](el.value);
        el.setAttribute('aria-invalid', good ? 'false' : 'true');
        if (good) { err.hidden = true; el.removeAttribute('aria-describedby'); }
        else { err.hidden = false; el.setAttribute('aria-describedby', err.id); ok = false; if (!first) first = el; }
      });
      if (!ok) { first.focus(); return; }
      var d = new FormData(form);
      var body = 'Name: ' + d.get('name') + '\nEmail: ' + d.get('email') + (d.get('phone') ? '\nPhone: ' + d.get('phone') : '') + '\nMembership: ' + d.get('plan') + (d.get('note') ? '\n\n' + d.get('note') : '');
      window.location.href = 'mailto:Kayla.Routson@arcisgolf.com?subject=' + encodeURIComponent('Membership inquiry: ' + d.get('plan')) + '&body=' + encodeURIComponent(body);
      $('.form__how', form).textContent = 'Your email app should open with the message ready to send.';
    });
  }

  /* ---------- hours: open now, on Evans time ---------- */
  var HOURS = {
    grille: [null, [7, 20], [7, 20], [7, 20], [7, 20], [7, 20], [7, 14]],
    shop: [null, [7, 19], [7, 19], [7, 19], [7, 19], [7, 19], [7, 19]],
    kings: [null, null, [17, 22], [17, 22], [17, 22], [17, 22], [14, 20]],
    concierge: [[9, 16], [9, 18], [9, 18], [9, 18], [9, 18], [9, 18], [9, 16]],
    fitness: [[5, 23], [5, 23], [5, 23], [5, 23], [5, 23], [5, 23], [5, 23]]
  };
  function evansNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      var dayIdx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday);
      return { d: dayIdx, h: (+o.hour % 24) + (+o.minute) / 60 };
    } catch (e) { return null; }
  }
  function markHours() {
    var now = evansNow(); if (!now || now.d < 0) return;
    $$('.hours__table tbody tr').forEach(function (tr) {
      var span = (HOURS[tr.dataset.venue] || [])[now.d];
      var open = !!span && now.h >= span[0] && now.h < span[1];
      tr.classList.add('is-today'); tr.classList.toggle('is-closed', !open);
    });
  }
  markHours(); setInterval(markHours, 60000);

  /* back from an outside link: controls come back restored, so read them again */
  window.addEventListener('pageshow', function () { if (finder) showPlan(); });
})();
