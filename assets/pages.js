/* PT Surya Abadi Raya — interaksi halaman dalam (tanpa library).
   Modul dipilih lewat <body data-page="about|produk|gallery|contact">. */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var page = document.body.getAttribute("data-page");
  var EMAIL = "surya.abadiraya@gmail.com";

  /* ======================================================================
     UMUM: navbar, progres scroll, kembali ke atas, reveal, counter, parallax
     ====================================================================== */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  var nav = $("#nav"), menu = $("#menu"), toggle = $(".nav-toggle");
  var progress = $(".progress i"), toTop = $(".to-top");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
    if (toTop) toTop.classList.toggle("show", y > 700);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
  }
  toggle.addEventListener("click", function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });

  // Reveal saat scroll
  // Setelah animasi muncul selesai, kelas reveal dilepas agar efek :hover elemen itu
  // (mis. kartu terangkat) tidak tertimpa aturan .reveal.is-visible.
  var reveals = $$(".reveal");
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
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(revealDone);
  }

  // Counter animasi. data-count="20" data-suffix="+"  |  data-years-since="2017"
  function animateCount(el) {
    var target = el.hasAttribute("data-years-since")
      ? new Date().getFullYear() - parseInt(el.getAttribute("data-years-since"), 10)
      : parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion || !isFinite(target)) { el.textContent = target + suffix; return; }
    var start = null, dur = 1400;
    function frame(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = $$("[data-count], [data-years-since]");
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    } else { counters.forEach(animateCount); }
  }

  // Parallax lembut di hero (hanya mouse, bukan layar sentuh)
  var phero = $(".phero");
  if (phero && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    phero.addEventListener("pointermove", function (e) {
      var r = phero.getBoundingClientRect();
      phero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      phero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  }

  /* ======================================================================
     Util: tab aksesibel
     ====================================================================== */
  function makeTabs(root, onSelect) {
    var tabs = $$('[role="tab"]', root);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var cur = 0;
    function select(i, focus) {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, k) {
        var on = k === cur;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabs[cur].focus();
      if (onSelect) onSelect(cur);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(cur + 1, true); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(cur - 1, true); }
        else if (e.key === "Home") { e.preventDefault(); select(0, true); }
        else if (e.key === "End") { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    return { select: select, tabs: tabs, index: function () { return cur; } };
  }

  /* ======================================================================
     TENTANG KAMI
     ====================================================================== */
  function initAbout() {
    // Visi / Misi dengan indikator geser
    var seg = $(".seg");
    if (seg) {
      var ind = $(".seg-ind", seg);
      var vm = makeTabs(seg.closest(".vm-wrap"), place);
      function place() {
        var t = vm.tabs[vm.index()];
        ind.style.width = t.offsetWidth + "px";
        ind.style.transform = "translateX(" + t.offsetLeft + "px)";
        ind.style.background = getComputedStyle(t).getPropertyValue("--ac").trim() || "";
      }
      vm.select(0);
      window.addEventListener("resize", place);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    }

    // Bidang usaha: tab + hash (#garment, #outsourcing, #training, #carrental)
    var bizRoot = $("#bidang");
    if (bizRoot) {
      var keys = $$('.biz-tabs [role="tab"]', bizRoot).map(function (t) { return t.getAttribute("data-key"); });
      var biz = makeTabs(bizRoot, function (i) {
        if (history.replaceState && bizReady) history.replaceState(null, "", "#" + keys[i]);
      });
      var bizReady = false;
      biz.select(0);
      bizReady = true;

      function fromHash(scroll) {
        var h = location.hash.replace("#", "");
        var i = keys.indexOf(h);
        if (i > -1) {
          biz.select(i);
          if (scroll) {
            var target = $(".biz-tabs", bizRoot);
            setTimeout(function () {
              var y = target.getBoundingClientRect().top + window.scrollY - 110;
              window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
            }, 60);
          }
        }
      }
      fromHash(true);
      window.addEventListener("hashchange", function () { fromHash(true); });

      // galeri mini di tiap panel
      $$(".stack", bizRoot).forEach(function (st) {
        var imgs = $$(".stack-main img", st), thumbs = $$(".thumb", st), n = 0;
        function show(i) {
          n = (i + imgs.length) % imgs.length;
          imgs.forEach(function (im, k) { im.classList.toggle("on", k === n); });
          thumbs.forEach(function (t, k) { t.setAttribute("aria-current", k === n ? "true" : "false"); });
        }
        thumbs.forEach(function (t, k) { t.addEventListener("click", function () { show(k); }); });
        $(".stack-main", st).addEventListener("click", function () { show(n + 1); });
        show(0);
      });
    }

    // Daftar pelanggan: cari + filter kota
    var custs = $$(".cust");
    if (custs.length) {
      var q = $("#cust-q"), box = q.closest(".search"), clear = $(".clear", box);
      var chips = $$(".fchip", $("#cust-chips"));
      var line = $("#cust-count"), empty = $("#cust-empty");
      var st = { city: "all", q: "" };
      function applyC() {
        var n = 0;
        custs.forEach(function (c) {
          var ok = (st.city === "all" || c.getAttribute("data-city") === st.city) &&
                   (!st.q || c.getAttribute("data-search").indexOf(st.q) > -1);
          c.hidden = !ok;
          if (ok) {
            n++; c.style.setProperty("--i", n);
            c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
          }
        });
        line.textContent = n === custs.length ? "Menampilkan semua " + n + " perusahaan" : "Menampilkan " + n + " dari " + custs.length + " perusahaan";
        empty.hidden = n > 0;
      }
      q.addEventListener("input", function () {
        st.q = q.value.trim().toLowerCase();
        box.classList.toggle("has-text", !!q.value);
        applyC();
      });
      clear.addEventListener("click", function () { q.value = ""; q.dispatchEvent(new Event("input")); q.focus(); });
      chips.forEach(function (c) {
        c.addEventListener("click", function () {
          st.city = c.getAttribute("data-city");
          chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
          applyC();
        });
      });
      $("#cust-reset").addEventListener("click", function () {
        q.value = ""; st.q = ""; st.city = "all"; box.classList.remove("has-text");
        chips.forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-city") === "all" ? "true" : "false"); });
        applyC();
      });
      applyC();
    }
  }

  /* ======================================================================
     PRODUK
     ====================================================================== */
  function initProduk() {
    var data = JSON.parse($("#catalog-data").textContent);
    var byId = {};
    data.forEach(function (p) { byId[p.id] = p; });

    var cards = $$(".pcard");
    var chips = $$(".fchip", $("#cat-chips"));
    var q = $("#q"), box = q.closest(".search"), clear = $(".clear", box);
    var line = $("#result-line"), empty = $("#empty");
    var st = { cat: "all", q: "" };

    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (st.cat === "all" || c.getAttribute("data-cat") === st.cat) &&
                 (!st.q || c.getAttribute("data-search").indexOf(st.q) > -1);
        c.hidden = !ok;
        if (ok) {
          n++; c.style.setProperty("--i", n);
          c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
        }
      });
      line.textContent = n === cards.length ? "Menampilkan semua " + n + " produk" : "Menampilkan " + n + " dari " + cards.length + " produk";
      empty.hidden = n > 0;
    }
    q.addEventListener("input", function () {
      st.q = q.value.trim().toLowerCase();
      box.classList.toggle("has-text", !!q.value);
      apply();
    });
    clear.addEventListener("click", function () { q.value = ""; q.dispatchEvent(new Event("input")); q.focus(); });
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        st.cat = c.getAttribute("data-cat");
        chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        apply();
      });
    });
    $("#reset").addEventListener("click", function () {
      q.value = ""; st.q = ""; st.cat = "all"; box.classList.remove("has-text");
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-cat") === "all" ? "true" : "false"); });
      apply();
    });
    apply();

    // ---- modal detail ----
    var dlg = $("#pm"), mainImg = $("#pm-img"), thumbsEl = $("#pm-thumbs"), countEl = $("#pm-count");
    var cur = null, idx = 0;

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function icon(name) { return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }

    function showImg(i, instant) {
      idx = (i + cur.images.length) % cur.images.length;
      var im = cur.images[idx];
      function swap() {
        mainImg.src = im.src; mainImg.width = im.w; mainImg.height = im.h;
        mainImg.alt = cur.title + " — foto " + (idx + 1);
        mainImg.classList.remove("swap");
      }
      if (instant || reduceMotion) swap();
      else { mainImg.classList.add("swap"); setTimeout(swap, 170); }
      countEl.textContent = (idx + 1) + " / " + cur.images.length;
      $$("button", thumbsEl).forEach(function (b, k) { b.setAttribute("aria-current", k === idx ? "true" : "false"); });
      var multi = cur.images.length > 1;
      $$(".pm-nav", dlg).forEach(function (b) { b.hidden = !multi; });
      countEl.hidden = !multi; thumbsEl.hidden = !multi;
    }

    function render(p) {
      cur = p;
      dlg.className = "pm tone-" + p.tone;
      dlg.style.setProperty("--bg", p.images[0].bg);
      $("#pm-badge").innerHTML = icon(p.catIcon) + esc(p.catLabel);
      $("#pm-title").textContent = p.title;
      $("#pm-price").innerHTML = icon("tag") + esc(p.price);
      $("#pm-desc").textContent = p.description;
      $("#pm-feats").innerHTML = p.features.map(function (f) { return "<li>" + icon("check2-circle") + esc(f) + "</li>"; }).join("");
      $("#pm-specs").innerHTML = p.specs.map(function (s) { return "<div><dt>" + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd></div>"; }).join("");
      thumbsEl.innerHTML = p.images.map(function (im, k) {
        return '<button type="button" style="--bg:' + im.bg + '" aria-label="Foto ' + (k + 1) + '"><img src="' + im.thumb + '" alt="" width="64" height="80" loading="lazy"></button>';
      }).join("");
      $$("button", thumbsEl).forEach(function (b, k) { b.addEventListener("click", function () { showImg(k); }); });
      $("#pm-quote").href = "contact.html?produk=" + encodeURIComponent(p.title) + "#form";
      showImg(0, true);
    }

    function openModal(id, fromHash) {
      var p = byId[id];
      if (!p) return;
      render(p);
      if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add("lock"); }
      dlg.scrollTop = 0;
      if (!fromHash && history.replaceState) history.replaceState(null, "", "#" + id);
    }
    dlg.addEventListener("close", function () {
      document.documentElement.classList.remove("lock");
      if (history.replaceState && byId[location.hash.slice(1)]) history.replaceState(null, "", location.pathname + location.search);
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    $("#pm-close").addEventListener("click", function () { dlg.close(); });
    $(".pm-nav.prev", dlg).addEventListener("click", function () { showImg(idx - 1); });
    $(".pm-nav.next", dlg).addEventListener("click", function () { showImg(idx + 1); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { showImg(idx - 1); }
      else if (e.key === "ArrowRight") { showImg(idx + 1); }
    });
    var sx = null;
    $(".pm-main", dlg).addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    $(".pm-main", dlg).addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 45) showImg(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    $$("[data-open]").forEach(function (b) { b.addEventListener("click", function () { openModal(b.getAttribute("data-open")); }); });
    if (byId[location.hash.slice(1)]) openModal(location.hash.slice(1), true);
    window.addEventListener("hashchange", function () { if (byId[location.hash.slice(1)]) openModal(location.hash.slice(1), true); });
  }

  /* ======================================================================
     GALERI
     ====================================================================== */
  function initGallery() {
    var items = $$(".gx-item");
    var chips = $$(".fchip", $("#gx-chips"));
    var more = $("#gx-more"), moreBtn = $("button", more), moreNote = $("#gx-more-note");
    var line = $("#gx-line");
    var PAGE = 16;
    var st = { cat: "all", limit: PAGE };
    var matching = items;

    function apply(animate) {
      matching = items.filter(function (it) { return st.cat === "all" || it.getAttribute("data-cat") === st.cat; });
      items.forEach(function (it) { it.hidden = true; });
      matching.forEach(function (it, i) {
        it.hidden = i >= st.limit;
        if (!it.hidden && animate) {
          it.style.setProperty("--i", i);
          it.classList.remove("pop"); void it.offsetWidth; it.classList.add("pop");
        }
      });
      var left = matching.length - st.limit;
      more.hidden = left <= 0;
      if (left > 0) moreBtn.querySelector("span").textContent = "Tampilkan lebih banyak";
      moreNote.textContent = left > 0 ? left + " foto lagi" : "";
      line.textContent = "Menampilkan " + Math.min(st.limit, matching.length) + " dari " + matching.length + " foto";
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        st.cat = c.getAttribute("data-cat"); st.limit = PAGE;
        chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        apply(true);
      });
    });
    moreBtn.addEventListener("click", function () { st.limit += PAGE; apply(true); });
    apply(false);

    // ---- lightbox ----
    var lb = $("#lb"), img = $("#lb-img"), cap = $("#lb-cap"), cnt = $("#lb-count"), tag = $("#lb-tag");
    var cur = 0;
    function icon(name) { return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }

    function show(i) {
      cur = (i + matching.length) % matching.length;
      var it = matching[cur];
      function swap() {
        img.src = it.getAttribute("data-full");
        img.alt = it.getAttribute("data-caption");
        img.classList.remove("swap");
      }
      if (reduceMotion || !lb.open) swap(); else { img.classList.add("swap"); setTimeout(swap, 150); }
      cap.textContent = it.getAttribute("data-caption");
      cnt.textContent = (cur + 1) + " / " + matching.length;
      tag.className = "gx-tag " + it.getAttribute("data-tone");
      tag.innerHTML = icon(it.getAttribute("data-icon")) + it.getAttribute("data-label");
      [matching[(cur + 1) % matching.length], matching[(cur - 1 + matching.length) % matching.length]].forEach(function (n) {
        var p = new Image(); p.src = n.getAttribute("data-full");
      });
    }
    function openLb(it) {
      cur = matching.indexOf(it);
      show(cur);
      if (!lb.open) { lb.showModal(); document.documentElement.classList.add("lock"); }
    }
    items.forEach(function (it) { it.addEventListener("click", function () { openLb(it); }); });
    lb.addEventListener("close", function () { document.documentElement.classList.remove("lock"); });
    $("#lb-close").addEventListener("click", function () { lb.close(); });
    $(".lb-stage .prev", lb).addEventListener("click", function () { show(cur - 1); });
    $(".lb-stage .next", lb).addEventListener("click", function () { show(cur + 1); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(cur - 1);
      else if (e.key === "ArrowRight") show(cur + 1);
    });
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target.classList.contains("lb-stage")) lb.close();
    });
    var sx = null;
    var stage = $(".lb-stage", lb);
    stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 45) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ======================================================================
     KONTAK
     ====================================================================== */
  function initContact() {
    var WA = (document.body.getAttribute("data-wa") || "").replace(/\D/g, "");

    // Status buka/tutup (WIB, Senin–Jumat 08.00–17.00)
    function status() {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
      var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
      var day = get("weekday"), hour = parseInt(get("hour"), 10) % 24, min = parseInt(get("minute"), 10);
      var t = hour * 60 + min, weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(day) > -1;
      var res;
      if (weekday && t >= 480 && t < 1020) res = { open: true, text: "Buka sekarang · tutup pukul 17.00 WIB" };
      else {
        var when;
        if (weekday && t < 480) when = "buka hari ini pukul 08.00 WIB";
        else if (day === "Fri" || day === "Sat" || day === "Sun") when = "buka Senin pukul 08.00 WIB";
        else when = "buka besok pukul 08.00 WIB";
        res = { open: false, text: "Tutup · " + when };
      }
      return res;
    }
    function paintStatus() {
      var s = status();
      $$("[data-status]").forEach(function (el) {
        el.classList.remove("open", "closed");
        el.classList.add(s.open ? "open" : "closed");
        el.textContent = s.text;
      });
    }
    paintStatus();
    setInterval(paintStatus, 60000);

    // Salin ke papan klip
    function copy(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise(function (resolve, reject) {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
        document.body.removeChild(ta);
      });
    }
    function flash(btn, ok) {
      var label = $("span", btn), old = label.textContent;
      btn.classList.toggle("done", ok);
      label.textContent = ok ? "Tersalin" : "Gagal menyalin";
      setTimeout(function () { btn.classList.remove("done"); label.textContent = old; }, 1800);
    }
    $$("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        copy(b.getAttribute("data-copy")).then(function () { flash(b, true); }, function () { flash(b, false); });
      });
    });

    // WhatsApp opsional (isi data-wa pada <body>)
    $$("[data-wa-link]").forEach(function (a) {
      if (WA) { a.href = "https://wa.me/" + WA; a.hidden = false; } else a.hidden = true;
    });

    // Formulir
    var form = $("#fm"), done = $("#fm-done");
    var labels = { garment: "Produksi Garmen", outsourcing: "Layanan Outsourcing", training: "Pelatihan Kerja", rental: "Sewa Mobil", partner: "Peluang Kemitraan", other: "Lainnya" };
    var msg = $("#f-message"), counter = $("#f-count");
    var params = new URLSearchParams(location.search);

    var produk = params.get("produk"), subjek = params.get("subjek");
    if (produk) {
      selectSubject("garment");
      msg.value = "Halo, saya tertarik dengan produk \"" + produk.slice(0, 120) + "\". Mohon info harga dan ketentuan pemesanan (jumlah, bahan, dan waktu produksi).";
    } else if (subjek && labels[subjek]) selectSubject(subjek);
    function selectSubject(v) { var r = $('input[name="subject"][value="' + v + '"]', form); if (r) r.checked = true; }
    function updateCount() { counter.textContent = msg.value.length + " / 1000"; }
    msg.addEventListener("input", updateCount); updateCount();

    function setErr(id, bad) { $("#" + id).closest(".fm-field").classList.toggle("has-error", bad); return bad; }
    function validate() {
      var bad = false, firstBad = null;
      function chk(id, test) { var b = setErr(id, !test); if (b && !firstBad) firstBad = $("#" + id); bad = bad || b; }
      var name = $("#f-name").value.trim(), email = $("#f-email").value.trim(), phone = $("#f-phone").value.trim();
      chk("f-name", name.length >= 2);
      chk("f-email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
      chk("f-phone", !phone || /^[+\d][\d\s().-]{6,}$/.test(phone));
      chk("f-message", msg.value.trim().length >= 10);
      var subjOk = !!$('input[name="subject"]:checked', form);
      $("#f-subject-field").classList.toggle("has-error", !subjOk);
      if (!subjOk) { bad = true; if (!firstBad) firstBad = $('input[name="subject"]', form); }
      var agreeOk = $("#f-agree").checked;
      $("#f-agree-field").classList.toggle("has-error", !agreeOk);
      if (!agreeOk) { bad = true; if (!firstBad) firstBad = $("#f-agree"); }
      if (firstBad) firstBad.focus();
      return !bad;
    }
    ["f-name", "f-email", "f-phone", "f-message"].forEach(function (id) {
      $("#" + id).addEventListener("input", function () { $("#" + id).closest(".fm-field").classList.remove("has-error"); });
    });
    $$('input[name="subject"]', form).forEach(function (r) { r.addEventListener("change", function () { $("#f-subject-field").classList.remove("has-error"); }); });
    $("#f-agree").addEventListener("change", function () { $("#f-agree-field").classList.remove("has-error"); });

    var composed = null;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var subj = labels[$('input[name="subject"]:checked', form).value];
      var name = $("#f-name").value.trim(), phone = $("#f-phone").value.trim();
      var body = "Nama: " + name + "\nEmail: " + $("#f-email").value.trim() + "\nTelepon: " + (phone || "-") +
                 "\nTopik: " + subj + "\n\nPesan:\n" + msg.value.trim() + "\n\n— Dikirim dari website PT Surya Abadi Raya";
      composed = { subject: "[Website] " + subj + " — " + name, body: body };
      var enc = encodeURIComponent;
      $("#send-mail").href = "mailto:" + EMAIL + "?subject=" + enc(composed.subject) + "&body=" + enc(body).replace(/%0A/g, "%0D%0A");
      $("#send-gmail").href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + enc(EMAIL) + "&su=" + enc(composed.subject) + "&body=" + enc(body);
      var wa = $("#send-wa");
      if (WA) { wa.href = "https://wa.me/" + WA + "?text=" + enc(composed.subject + "\n\n" + body); wa.hidden = false; } else wa.hidden = true;
      $("#fm-preview").textContent = body;
      form.hidden = true; done.hidden = false;
      $("#form").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    $("#send-copy").addEventListener("click", function () {
      var b = this;
      copy("Kepada: " + EMAIL + "\nSubjek: " + composed.subject + "\n\n" + composed.body).then(function () { flash(b, true); }, function () { flash(b, false); });
    });
    $("#fm-edit").addEventListener("click", function () { done.hidden = true; form.hidden = false; $("#f-name").focus(); });
  }

  /* ======================================================================
     DATA DINAMIS (galeri & customer dibaca dari data/*.json yang diubah lewat admin.html)
     Bila gagal dimuat, HTML statis bawaan halaman tetap dipakai.
     ====================================================================== */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ico(n, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + n + '"/></svg>'; }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  var GCATS = {
    products: ["Produk Unggulan", "red", "stars", "Produk"],
    services: ["Layanan & Fasilitas", "blue", "truck", "Layanan"],
    training: ["Pelatihan Kerja", "amber", "mortarboard", "Pelatihan"],
    production: ["Proses Produksi", "teal", "scissors", "Produksi"]
  };
  function renderGallery(list) {
    if (!Array.isArray(list)) throw new Error("format");
    list = list.filter(function (x) { return x && GCATS[x.cat] && x.thumb && x.full; });
    var grid = $(".gx-grid"), chips = $("#gx-chips");
    grid.innerHTML = list.map(function (x) {
      var c = GCATS[x.cat], dim = x.tw && x.th ? ' width="' + (+x.tw) + '" height="' + (+x.th) + '"' : "";
      return '<button type="button" class="gx-item" data-cat="' + x.cat + '" data-full="' + esc(x.full) + '" data-caption="' + esc(x.caption || "") + '" data-tone="tone-' + c[1] + '" data-icon="' + c[2] + '" data-label="' + esc(c[3]) + '">' +
        '<img src="' + esc(x.thumb) + '"' + dim + ' alt="' + esc(x.caption || "") + '" loading="lazy" decoding="async" />' +
        '<span class="gx-cap"><strong>' + esc(x.caption || "") + '</strong><span class="gx-tag tone-' + c[1] + '">' + ico(c[2]) + esc(c[3]) + '</span></span>' +
        '<span class="gx-zoom">' + ico("zoom-in") + '</span></button>';
    }).join("");
    var h = '<button class="fchip tone-red" type="button" data-cat="all" aria-pressed="true">Semua <span class="n">' + list.length + '</span></button>';
    Object.keys(GCATS).forEach(function (k) {
      var n = list.filter(function (x) { return x.cat === k; }).length;
      if (n) h += '<button class="fchip tone-' + GCATS[k][1] + '" type="button" data-cat="' + k + '" aria-pressed="false">' + ico(GCATS[k][2]) + esc(GCATS[k][0]) + ' <span class="n">' + n + '</span></button>';
    });
    chips.innerHTML = h;
  }

  function renderCustomers(list) {
    if (!Array.isArray(list)) throw new Error("format");
    list = list.filter(function (x) { return x && x.name; });
    var tones = ["red", "blue", "amber", "teal"], cityTone = ["blue", "amber", "teal", "red"];
    var cities = [], seen = {};
    list.forEach(function (x) { var k = (x.city || "Lainnya").trim(); if (!seen[k.toLowerCase()]) { seen[k.toLowerCase()] = 1; cities.push(k); } });
    function ini(n) {
      var w = n.split(/\s+/).filter(function (t) { return !/^(PT\.?|LPK|CV)$/i.test(t); });
      if (!w.length) w = [n];
      return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
    }
    $(".cust-grid").innerHTML = list.map(function (x, i) {
      var city = (x.city || "Lainnya").trim(), tag = x.map ? "a" : "div";
      var open = tag === "a" ? '<a class="cust tone-' + tones[i % 4] + '" href="' + esc(x.map) + '" target="_blank" rel="noopener noreferrer"' : '<div class="cust tone-' + tones[i % 4] + '"';
      var av = x.logo ? '<span class="avatar has-logo"><img src="' + esc(x.logo) + '" alt="" loading="lazy" decoding="async" /></span>' : '<span class="avatar">' + esc(ini(x.name)) + '</span>';
      return open + ' data-city="' + esc(city.toLowerCase()) + '" data-search="' + esc((x.name + " " + (x.place || "") + " " + city).toLowerCase()) + '" aria-label="' + esc(x.name) + (x.map ? " — lihat di Google Maps" : "") + '">' +
        av + '<div><h3>' + esc(x.name) + '</h3><p>' + ico("geo-alt") + esc(x.place || city) + '</p></div></' + tag + '>';
    }).join("");
    var h = '<button class="fchip tone-red" type="button" data-city="all" aria-pressed="true">Semua <span class="n">' + list.length + '</span></button>';
    cities.forEach(function (c, i) {
      var n = list.filter(function (x) { return (x.city || "Lainnya").trim().toLowerCase() === c.toLowerCase(); }).length;
      h += '<button class="fchip tone-' + cityTone[i % 4] + '" type="button" data-city="' + esc(c.toLowerCase()) + '" aria-pressed="false">' + esc(c) + ' <span class="n">' + n + '</span></button>';
    });
    $("#cust-chips").innerHTML = h;
    $$("[data-cust-count]").forEach(function (el) {
      if (el.hasAttribute("data-count")) el.setAttribute("data-count", list.length); else el.textContent = list.length;
    });
  }

  function boot() {
    if (page === "about") initAbout();
    else if (page === "produk") initProduk();
    else if (page === "gallery") initGallery();
    else if (page === "contact") initContact();
  }
  var pre = page === "gallery" ? getJSON("data/gallery.json").then(renderGallery)
          : page === "about" ? getJSON("data/customers.json").then(renderCustomers)
          : Promise.resolve();
  pre.catch(function () {}).then(boot);
})();
