/* PT Surya Abadi Raya — interaksi halaman utama (tanpa library) */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Tahun di footer ---------- */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Navbar ---------- */
  var nav = $("#nav");
  var menu = $("#menu");
  var toggle = $(".nav-toggle");

  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 24); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
  }
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- Hero slider ---------- */
  var hero = $(".hero");
  var slides = $$(".slide", hero);
  var tabs = $$(".tab", hero);
  var current = 0;

  function go(index) {
    var next = (index + slides.length) % slides.length;
    var same = next === current;
    current = next;
    slides.forEach(function (s, i) {
      var on = i === current;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
    tabs.forEach(function (t, i) {
      var on = i === current;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on && same) { // klik tab aktif: ulangi progres dari awal
        var fill = $(".tab-fill", t);
        fill.style.animation = "none";
        void fill.offsetWidth;
        fill.style.animation = "";
      }
    });
  }

  // Slide berganti saat animasi progres selesai (tanpa timer terpisah → selalu sinkron).
  hero.addEventListener("animationend", function (e) {
    if (e.target.classList && e.target.classList.contains("tab-fill")) go(current + 1);
  });

  tabs.forEach(function (t, i) { t.addEventListener("click", function () { go(i); }); });
  tabs.forEach(function (t, i) {
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(i + 1); tabs[current].focus(); }
      if (e.key === "ArrowLeft") { go(i - 1); tabs[current].focus(); }
    });
  });
  var hp = $("[data-hero-prev]"), hn = $("[data-hero-next]");
  if (hp) hp.addEventListener("click", function () { go(current - 1); });
  if (hn) hn.addEventListener("click", function () { go(current + 1); });

  // Jeda saat kursor/fokus berada di hero atau tab sedang tidak terlihat.
  function pause(on) { hero.classList.toggle("is-paused", on); }
  hero.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pause(true); });
  hero.addEventListener("pointerleave", function () { pause(false); });
  hero.addEventListener("focusin", function () { pause(true); });
  hero.addEventListener("focusout", function () { pause(false); });
  document.addEventListener("visibilitychange", function () { pause(document.hidden); });

  // Geser (swipe) di layar sentuh.
  var sx = null;
  var area = $(".slides", hero);
  area.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  area.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- Carousel produk ---------- */
  var track = $(".track");
  var prev = $("[data-prev]");
  var next = $("[data-next]");

  if (track && prev && next) {
    var step = function () {
      var card = $(".p-card", track);
      var gap = parseFloat(getComputedStyle(track).columnGap) || 22;
      return card.getBoundingClientRect().width + gap;
    };
    var update = function () {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); next.click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); }
    });
    update();

    // Seret dengan mouse.
    var down = false, moved = false, startX = 0, startLeft = 0;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add("is-dragging"); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false;
      if (moved) setTimeout(function () { track.classList.remove("is-dragging"); }, 60);
    });
  }

  /* ---------- Animasi muncul saat scroll ---------- */
  // Setelah animasi muncul selesai, kelas reveal dilepas agar efek :hover elemen itu
  // (mis. kartu terangkat) tidak tertimpa aturan .reveal.is-visible.
  var items = $$(".reveal");
  function revealDone(el) {
    el.classList.remove("reveal", "reveal-left", "reveal-right", "is-visible");
    el.style.removeProperty("--d");
  }
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("is-visible");
        io.unobserve(el);
        setTimeout(function () { revealDone(el); }, (parseInt(el.style.getPropertyValue("--d"), 10) || 0) + 1000);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(revealDone);
  }
})();
