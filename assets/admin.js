/* PT Surya Abadi Raya — panel admin.
   Tanpa server: membaca & menulis data/gallery.json, data/customers.json dan gambar langsung ke
   repositori GitHub lewat API (satu commit per penyimpanan). Token hanya ada di browser admin. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var CATS = [
    ["products", "Produk Unggulan"], ["services", "Layanan & Fasilitas"],
    ["training", "Pelatihan Kerja"], ["production", "Proses Produksi"], ["office", "Ruang Office"]
  ];
  var CATNAME = {}; CATS.forEach(function (c) { CATNAME[c[0]] = c[1]; });
  var DELETABLE = /^assets\/img\/(g-|up-|logos\/)/;
  var G_PATH = "data/gallery.json", C_PATH = "data/customers.json";

  var cfg = null;
  var S = { gallery: [], customers: [], baseG: [], baseC: [], removedG: [], removedC: [], uid: 0, gcat: "all", gq: "", cq: "" };
  var queue = [];
  var saving = false;

  /* ---------- util ---------- */
  function toast(msg, bad) {
    var t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 7000 : 4200);
  }
  function store(kind) { try { return window[kind + "Storage"]; } catch (e) { return null; } }
  function sget(k) { var a = store("session"), b = store("local"); try { return (a && a.getItem(k)) || (b && b.getItem(k)) || ""; } catch (e) { return ""; } }
  function sset(k, v, persist) { try { var s = store(persist ? "local" : "session"); if (s) s.setItem(k, v); } catch (e) {} }
  function sdel(k) { try { var a = store("session"), b = store("local"); if (a) a.removeItem(k); if (b) b.removeItem(k); } catch (e) {} }
  function slug(s) { return String(s).toLowerCase().replace(/\.[a-z0-9]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "foto"; }
  function stamp() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function nid() { return "i" + (++S.uid); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function gh(path, opt) {
    opt = opt || {};
    var h = { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (opt.body) h["Content-Type"] = "application/json";
    return fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + path, {
      method: opt.method || "GET", headers: h, cache: "no-store", body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      return r.json().catch(function () { return {}; }).then(function (j) {
        var e = new Error(j.message || ("HTTP " + r.status)); e.status = r.status; throw e;
      });
    });
  }
  function explain(e) {
    if (e.status === 401) return "Token tidak valid atau sudah kedaluwarsa.";
    if (e.status === 403) return "Token tidak punya izin (butuh Contents: Read and write) atau terkena batas akses GitHub.";
    if (e.status === 404) return "Repositori tidak ditemukan atau token tidak punya akses ke repositori ini.";
    if (e.status === 422) return "GitHub menolak perubahan (kemungkinan ada perubahan lain). Muat ulang halaman lalu coba lagi.";
    if (e instanceof TypeError) return "Tidak bisa terhubung ke GitHub. Periksa koneksi internet.";
    return e.message || "Terjadi kesalahan.";
  }
  function b64utf8(b64) {
    var bin = atob(b64.replace(/\s/g, "")), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u);
  }
  function blobB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(",")[1]); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  /* ---------- gambar: kecilkan di browser ---------- */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); res(im); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Gambar tidak bisa dibaca: " + file.name)); };
      im.src = url;
    });
  }
  function resize(im, maxSide, type, q) {
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    if (!w || !h) return Promise.reject(new Error("Ukuran gambar tidak valid"));
    var k = Math.min(1, maxSide / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    var c = document.createElement("canvas"); c.width = cw; c.height = ch;
    var ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(im, 0, 0, cw, ch);
    return new Promise(function (res) {
      c.toBlob(function (b) {
        if (b && b.type === type) return res({ blob: b, w: cw, h: ch, ext: type === "image/webp" ? "webp" : "jpg" });
        c.toBlob(function (b2) { res({ blob: b2, w: cw, h: ch, ext: "png" }); }, "image/png"); // peramban tanpa WebP
      }, type, q);
    });
  }

  /* ---------- login ---------- */
  function showApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    $("#repo-label").textContent = cfg.owner + "/" + cfg.repo + " · " + cfg.branch;
  }
  function logout() { sdel("sar_token"); location.reload(); }

  function connect(token, owner, repo) {
    cfg = { token: token, owner: owner, repo: repo, branch: "main" };
    return gh("").then(function (r) {
      if (r.permissions && r.permissions.push === false) throw Object.assign(new Error("Token hanya punya akses baca. Buat token dengan Contents: Read and write."), { status: 0 });
      cfg.branch = r.default_branch || "main";
      return Promise.all([readJSON(G_PATH), readJSON(C_PATH)]);
    }).then(function (d) {
      S.gallery = d[0].map(function (x) { x.id = nid(); return x; });
      S.customers = d[1].map(function (x) { x.id = nid(); x.logo = x.logo || ""; return x; });
      S.baseG = clone(S.gallery); S.baseC = clone(S.customers);
      S.removedG = []; S.removedC = [];
    });
  }
  function readJSON(path) {
    return gh("/contents/" + path + "?ref=" + encodeURIComponent(cfg.branch)).then(function (r) {
      var v = JSON.parse(b64utf8(r.content));
      if (!Array.isArray(v)) throw new Error("Format " + path + " tidak dikenali.");
      return v;
    }, function (e) {
      if (e.status === 404) throw new Error("File " + path + " belum ada di repositori. Unggah dulu paket website terbaru (termasuk folder data), lalu coba lagi.");
      throw e;
    });
  }

  $("#login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var btn = $("#login-btn"), err = $("#login-err");
    err.hidden = true; btn.disabled = true; btn.innerHTML = '<span class="busy"></span> Memeriksa…';
    var token = $("#token").value.trim(), owner = $("#owner").value.trim(), repo = $("#repo").value.trim();
    connect(token, owner, repo).then(function () {
      sset("sar_token", token, $("#remember").checked);
      sset("sar_repo", owner + "/" + repo, $("#remember").checked);
      $("#token").value = ""; showApp(); renderAll();
    }, function (e) {
      err.textContent = explain(e); err.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });
  $("#logout").addEventListener("click", function () {
    if (dirtyInfo().total && !confirm("Ada perubahan yang belum disimpan. Tetap keluar?")) return;
    window.onbeforeunload = null; logout();
  });

  /* ---------- perubahan (dirty) ---------- */
  function gPlain(x) { return { cat: x.cat, caption: x.caption || "", thumb: x.thumb, full: x.full, tw: x.tw, th: x.th }; }
  function cPlain(x) { return { name: x.name, place: x.place || "", city: x.city || "", map: x.map || "", logo: x.logo || "" }; }
  function dirtyInfo() {
    var baseG = {}, baseC = {};
    S.baseG.forEach(function (x) { baseG[x.id] = x; }); S.baseC.forEach(function (x) { baseC[x.id] = x; });
    var d = { gAdd: 0, gDel: S.removedG.length, gEdit: 0, cAdd: 0, cDel: S.removedC.length, cEdit: 0 };
    S.gallery.forEach(function (x) { if (x.isNew) d.gAdd++; else if (JSON.stringify(gPlain(x)) !== JSON.stringify(gPlain(baseG[x.id] || {}))) d.gEdit++; });
    S.customers.forEach(function (x) { if (x.isNew) d.cAdd++; else if (JSON.stringify(cPlain(x)) !== JSON.stringify(cPlain(baseC[x.id] || {}))) d.cEdit++; });
    d.total = d.gAdd + d.gDel + d.gEdit + d.cAdd + d.cDel + d.cEdit;
    return d;
  }
  function updateBar() {
    var d = dirtyInfo(), bar = $("#savebar");
    bar.hidden = d.total === 0;
    window.onbeforeunload = d.total ? function (e) { e.preventDefault(); e.returnValue = ""; } : null;
    if (!d.total) return;
    var parts = [];
    if (d.gAdd) parts.push(d.gAdd + " foto baru"); if (d.gEdit) parts.push(d.gEdit + " foto diubah"); if (d.gDel) parts.push(d.gDel + " foto dihapus");
    if (d.cAdd) parts.push(d.cAdd + " customer baru"); if (d.cEdit) parts.push(d.cEdit + " customer diubah"); if (d.cDel) parts.push(d.cDel + " customer dihapus");
    $("#save-count").textContent = d.total + " perubahan belum disimpan";
    $("#save-detail").textContent = parts.join(" · ");
  }

  /* ---------- render galeri ---------- */
  function renderGallery() {
    $("#n-gallery").textContent = S.gallery.length;
    var counts = { all: S.gallery.length };
    CATS.forEach(function (c) { counts[c[0]] = S.gallery.filter(function (x) { return x.cat === c[0]; }).length; });
    var h = '<button class="chip" data-cat="all" aria-pressed="' + (S.gcat === "all") + '">Semua (' + counts.all + ")</button>";
    CATS.forEach(function (c) { h += '<button class="chip" data-cat="' + c[0] + '" aria-pressed="' + (S.gcat === c[0]) + '">' + esc(c[1]) + " (" + counts[c[0]] + ")</button>"; });
    $("#g-chips").innerHTML = h;
    var q = S.gq.toLowerCase();
    var list = S.gallery.filter(function (x) { return (S.gcat === "all" || x.cat === S.gcat) && (!q || (x.caption || "").toLowerCase().indexOf(q) > -1); });
    $("#g-grid").innerHTML = list.map(function (x) {
      var opts = CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === x.cat ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("");
      return '<article class="gcard' + (x.isNew ? " new" : "") + '" data-id="' + x.id + '">' +
        '<div class="gtop">' + (x.isNew ? '<span class="tag">Baru</span>' : "<span></span>") + '<button class="del" type="button" data-act="del" aria-label="Hapus foto" title="Hapus foto">✕</button></div>' +
        '<div class="gimg"><img src="' + esc(x._url || x.thumb) + '" alt="' + esc(x.caption) + '" loading="lazy" /></div>' +
        '<div class="gbody"><input data-f="caption" value="' + esc(x.caption) + '" maxlength="90" aria-label="Keterangan foto" /><select data-f="cat" aria-label="Kategori">' + opts + "</select></div></article>";
    }).join("");
    $("#g-empty").hidden = list.length > 0;
  }

  /* ---------- render customer ---------- */
  function initials(n) {
    var w = n.split(/\s+/).filter(function (t) { return !/^(PT\.?|LPK|CV)$/i.test(t); });
    if (!w.length) w = [n];
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }
  function renderCustomers() {
    $("#n-customers").textContent = S.customers.length;
    var q = S.cq.toLowerCase();
    var list = S.customers.filter(function (x) { return !q || (x.name + " " + x.city + " " + x.place).toLowerCase().indexOf(q) > -1; });
    $("#c-list").innerHTML = list.map(function (x) {
      var av = x.logo || x._url ? '<img src="' + esc(x._url || x.logo) + '" alt="" />' : esc(initials(x.name));
      return '<article class="crow' + (x.isNew ? " new" : "") + '" data-id="' + x.id + '"><div class="cav">' + av + '</div>' +
        '<div class="cinfo"><strong>' + esc(x.name) + "</strong><span>" + esc(x.place || x.city) + (x.map ? " · peta ✓" : "") + (x.isNew ? " · <b style='color:#0f766e'>baru</b>" : "") + "</span></div>" +
        '<div class="cact"><button class="btn ghost" data-act="edit" type="button">Ubah</button><button class="btn ghost" data-act="del" type="button" style="color:#b42318">Hapus</button></div></article>';
    }).join("");
    $("#c-empty").hidden = list.length > 0;
    $("#c-cities").innerHTML = Object.keys(S.customers.reduce(function (m, x) { if (x.city) m[x.city] = 1; return m; }, {})).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }
  function renderAll() { renderGallery(); renderCustomers(); updateBar(); }

  /* ---------- tab ---------- */
  $$(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      $("#panel-gallery").hidden = b.dataset.tab !== "gallery";
      $("#panel-customers").hidden = b.dataset.tab !== "customers";
      window.scrollTo(0, 0);
    });
  });

  /* ---------- konfirmasi ---------- */
  function confirmBox(title, text, yes) {
    return new Promise(function (res) {
      var d = $("#confirm-dlg");
      $("#cf-title").textContent = title; $("#cf-text").textContent = text; $("#cf-yes").textContent = yes || "Hapus";
      d.returnValue = "";
      d.addEventListener("close", function f() { d.removeEventListener("close", f); res(d.returnValue === "yes"); });
      d.showModal();
    });
  }

  /* ---------- galeri: aksi ---------- */
  $("#g-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    S.gcat = b.dataset.cat; renderGallery();
  });
  $("#g-q").addEventListener("input", function () { S.gq = this.value.trim(); renderGallery(); });
  $("#g-grid").addEventListener("input", function (e) {
    var card = e.target.closest(".gcard"); if (!card || e.target.dataset.f !== "caption") return;
    var it = S.gallery.filter(function (x) { return x.id === card.dataset.id; })[0];
    it.caption = e.target.value; updateBar();
  });
  $("#g-grid").addEventListener("change", function (e) {
    var card = e.target.closest(".gcard"); if (!card || e.target.dataset.f !== "cat") return;
    var it = S.gallery.filter(function (x) { return x.id === card.dataset.id; })[0];
    it.cat = e.target.value; renderGallery(); updateBar();
  });
  $("#g-grid").addEventListener("click", function (e) {
    var b = e.target.closest('[data-act="del"]'); if (!b) return;
    var card = b.closest(".gcard"), i = S.gallery.map(function (x) { return x.id; }).indexOf(card.dataset.id), it = S.gallery[i];
    confirmBox("Hapus foto ini?", "“" + (it.caption || "Tanpa keterangan") + "” akan dihapus dari galeri setelah Anda menekan Simpan ke Website.").then(function (ok) {
      if (!ok) return;
      S.gallery.splice(i, 1);
      if (!it.isNew) S.removedG.push(it);
      renderGallery(); updateBar();
    });
  });

  /* ---------- galeri: tambah ---------- */
  var drop = $("#g-drop"), fileIn = $("#g-file");
  drop.addEventListener("click", function () { fileIn.click(); });
  drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } });
  ["dragenter", "dragover"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { addToQueue(e.dataTransfer.files); });
  fileIn.addEventListener("change", function () { addToQueue(fileIn.files); fileIn.value = ""; });

  function addToQueue(files) {
    Array.prototype.forEach.call(files, function (f) {
      if (!/^image\//.test(f.type)) { toast("“" + f.name + "” bukan gambar, dilewati.", true); return; }
      if (f.size > 25 * 1024 * 1024) { toast("“" + f.name + "” terlalu besar (maks 25 MB).", true); return; }
      queue.push({ qid: nid(), file: f, url: URL.createObjectURL(f), caption: f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim(), cat: S.gcat !== "all" ? S.gcat : "products" });
    });
    renderQueue();
  }
  function renderQueue() {
    $("#g-queue").hidden = !queue.length;
    $("#g-queue-list").innerHTML = queue.map(function (q) {
      var opts = CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === q.cat ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("");
      return '<div class="qitem" data-q="' + q.qid + '"><img src="' + q.url + '" alt="" /><input data-f="caption" value="' + esc(q.caption) + '" maxlength="90" placeholder="Keterangan foto" aria-label="Keterangan" />' +
        '<select data-f="cat" aria-label="Kategori">' + opts + '</select><button class="x" type="button" data-act="rm" aria-label="Buang">×</button></div>';
    }).join("");
  }
  $("#g-queue-list").addEventListener("input", function (e) {
    var row = e.target.closest(".qitem"); if (!row) return;
    var q = queue.filter(function (x) { return x.qid === row.dataset.q; })[0]; if (q) q[e.target.dataset.f] = e.target.value;
  });
  $("#g-queue-list").addEventListener("click", function (e) {
    var b = e.target.closest('[data-act="rm"]'); if (!b) return;
    var id = b.closest(".qitem").dataset.q;
    queue = queue.filter(function (x) { if (x.qid === id) URL.revokeObjectURL(x.url); return x.qid !== id; }); renderQueue();
  });
  $("#g-queue-clear").addEventListener("click", function () { queue.forEach(function (q) { URL.revokeObjectURL(q.url); }); queue = []; renderQueue(); });
  $("#g-queue-add").addEventListener("click", function () {
    var btn = this; if (!queue.length) return;
    btn.disabled = true; btn.innerHTML = '<span class="busy"></span> Memproses…';
    var jobs = queue.slice(), chain = Promise.resolve(), added = 0;
    jobs.forEach(function (q) {
      chain = chain.then(function () {
        return loadImage(q.file).then(function (im) {
          return Promise.all([resize(im, 640, "image/webp", 0.8), resize(im, 1600, "image/webp", 0.82)]);
        }).then(function (r) {
          var base = "assets/img/up-" + stamp() + "-" + slug(q.file.name), t = r[0], l = r[1];
          var item = { id: nid(), isNew: true, cat: q.cat, caption: q.caption.trim() || "Foto", thumb: base + "-t." + t.ext, full: base + "-l." + l.ext, tw: t.w, th: t.h,
            _url: URL.createObjectURL(t.blob), _files: [{ path: base + "-t." + t.ext, blob: t.blob }, { path: base + "-l." + l.ext, blob: l.blob }] };
          S.gallery.unshift(item); added++;
          URL.revokeObjectURL(q.url); queue = queue.filter(function (x) { return x !== q; });
        }).catch(function (e) { toast(e.message, true); });
      });
    });
    chain.then(function () {
      btn.disabled = false; btn.textContent = "Tambahkan ke galeri"; renderQueue(); renderGallery(); updateBar();
      if (added) toast(added + " foto ditambahkan. Tekan “Simpan ke Website” untuk menerbitkan.");
    });
  });

  /* ---------- customer ---------- */
  var cdlg = $("#c-dlg"), editing = null, dlgLogo = null /* {blob,url,ext,w,h} */, dlgClear = false;
  function setLogoPrev(url) {
    $("#c-logo-prev").innerHTML = url ? '<img src="' + esc(url) + '" alt="" />' : "—";
    $("#c-logo-clear").hidden = !url;
  }
  function openCustomer(it) {
    editing = it || null; dlgLogo = null; dlgClear = false;
    $("#c-dlg-title").textContent = it ? "Ubah Customer" : "Tambah Customer";
    $("#c-name").value = it ? it.name : ""; $("#c-city").value = it ? it.city : ""; $("#c-place").value = it ? it.place : ""; $("#c-map").value = it ? it.map : "";
    setLogoPrev(it ? (it._url || it.logo) : ""); $("#c-err").hidden = true; cdlg.showModal(); $("#c-name").focus();
  }
  $("#c-new").addEventListener("click", function () { openCustomer(null); });
  $("#c-cancel").addEventListener("click", function () { cdlg.close(); });
  $("#c-logo-pick").addEventListener("click", function () { $("#c-logo-file").click(); });
  $("#c-logo-clear").addEventListener("click", function () { dlgLogo = null; dlgClear = true; setLogoPrev(""); });
  $("#c-logo-file").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    if (!/^image\//.test(f.type)) { $("#c-err").textContent = "File logo harus berupa gambar."; $("#c-err").hidden = false; return; }
    loadImage(f).then(function (im) { return resize(im, 360, "image/webp", 0.9); }).then(function (r) {
      dlgLogo = { blob: r.blob, ext: r.ext, url: URL.createObjectURL(r.blob) }; dlgClear = false; $("#c-err").hidden = true; setLogoPrev(dlgLogo.url);
    }, function (e) { $("#c-err").textContent = e.message; $("#c-err").hidden = false; });
  });
  $("#c-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("#c-name").value.trim(), city = $("#c-city").value.trim(), place = $("#c-place").value.trim(), map = $("#c-map").value.trim(), err = $("#c-err");
    function bad(m) { err.textContent = m; err.hidden = false; }
    if (name.length < 2) return bad("Nama perusahaan wajib diisi.");
    if (!city) return bad("Kota wajib diisi.");
    if (map && !/^https?:\/\//i.test(map)) return bad("Tautan peta harus diawali https://");
    var dup = S.customers.some(function (x) { return x !== editing && x.name.toLowerCase() === name.toLowerCase(); });
    if (dup) return bad("Customer dengan nama itu sudah ada.");
    var it = editing || { id: nid(), isNew: true, logo: "" };
    it.name = name; it.city = city; it.place = place || city; it.map = map;
    if (dlgLogo) { it.logo = "assets/img/logos/" + slug(name) + "-" + stamp() + "." + dlgLogo.ext; it._file = { path: it.logo, blob: dlgLogo.blob }; it._committed = false; it._url = dlgLogo.url; }
    else if (dlgClear) { it.logo = ""; it._file = null; it._url = ""; }
    if (!editing) S.customers.push(it);
    cdlg.close(); renderCustomers(); updateBar();
    toast(editing ? "Customer diperbarui (belum disimpan)." : "Customer ditambahkan. Tekan “Simpan ke Website” untuk menerbitkan.");
    if (!editing) setTimeout(function () { var el = $('.crow[data-id="' + it.id + '"]'); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  });
  $("#c-q").addEventListener("input", function () { S.cq = this.value.trim(); renderCustomers(); });
  $("#c-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = b.closest(".crow").dataset.id, i = S.customers.map(function (x) { return x.id; }).indexOf(id), it = S.customers[i];
    if (b.dataset.act === "edit") return openCustomer(it);
    confirmBox("Hapus customer ini?", "“" + it.name + "” akan dihapus dari daftar customer setelah Anda menekan Simpan ke Website.").then(function (ok) {
      if (!ok) return;
      S.customers.splice(i, 1); if (!it.isNew) S.removedC.push(it);
      renderCustomers(); updateBar();
    });
  });

  /* ---------- simpan ke GitHub (satu commit) ---------- */
  $("#discard").addEventListener("click", function () {
    confirmBox("Batalkan semua perubahan?", "Semua perubahan yang belum disimpan akan hilang.", "Ya, batalkan").then(function (ok) {
      if (!ok) return;
      S.gallery = clone(S.baseG).map(function (x) { return x; }); S.customers = clone(S.baseC);
      S.removedG = []; S.removedC = []; renderAll();
    });
  });

  $("#save").addEventListener("click", function () {
    if (saving) return;
    var btn = this, d = dirtyInfo(); if (!d.total) return;
    saving = true; btn.disabled = true;
    function step(t) { btn.innerHTML = '<span class="busy"></span> ' + t; }
    step("Menyiapkan…");

    var newFiles = [];
    S.gallery.forEach(function (x) { if (x.isNew && x._files) newFiles = newFiles.concat(x._files); });
    S.customers.forEach(function (x) { if (x._file && x.logo === x._file.path && !x._committed) newFiles.push(x._file); });
    // semua berkas gambar yang masih dipakai (untuk memastikan tidak menghapus yang masih dirujuk)
    var inUse = {};
    S.gallery.forEach(function (x) { inUse[x.thumb] = 1; inUse[x.full] = 1; });
    S.customers.forEach(function (x) { if (x.logo) inUse[x.logo] = 1; });
    var toDelete = {};
    S.removedG.forEach(function (x) { [x.thumb, x.full].forEach(function (p) { if (DELETABLE.test(p) && !inUse[p]) toDelete[p] = 1; }); });
    S.removedC.forEach(function (x) { if (x.logo && DELETABLE.test(x.logo) && !inUse[x.logo]) toDelete[x.logo] = 1; });
    var baseLogo = {}; S.baseC.forEach(function (x) { baseLogo[x.id] = x.logo; });
    S.customers.forEach(function (x) { var o = baseLogo[x.id]; if (o && o !== x.logo && DELETABLE.test(o) && !inUse[o]) toDelete[o] = 1; });

    var gJson = JSON.stringify(S.gallery.map(gPlain), null, 1) + "\n";
    var cJson = JSON.stringify(S.customers.map(cPlain), null, 1) + "\n";
    var headSha, baseTree, existing = null, entries = [];

    gh("/git/ref/heads/" + encodeURIComponent(cfg.branch)).then(function (r) {
      headSha = r.object.sha; return gh("/git/commits/" + headSha);
    }).then(function (c) {
      baseTree = c.tree.sha;
      if (!Object.keys(toDelete).length) return null;
      return gh("/git/trees/" + baseTree + "?recursive=1").then(function (t) {
        if (!t.truncated) { existing = {}; t.tree.forEach(function (n) { existing[n.path] = 1; }); }
      });
    }).then(function () {
      var chain = Promise.resolve(), n = 0;
      newFiles.forEach(function (f) {
        chain = chain.then(function () { step("Mengunggah gambar " + (++n) + "/" + newFiles.length + "…"); return blobB64(f.blob); })
          .then(function (b64) { return gh("/git/blobs", { method: "POST", body: { content: b64, encoding: "base64" } }); })
          .then(function (r) { entries.push({ path: f.path, mode: "100644", type: "blob", sha: r.sha }); });
      });
      return chain;
    }).then(function () {
      step("Menyimpan data…");
      entries.push({ path: G_PATH, mode: "100644", type: "blob", content: gJson });
      entries.push({ path: C_PATH, mode: "100644", type: "blob", content: cJson });
      Object.keys(toDelete).forEach(function (p) { if (!existing || existing[p]) entries.push({ path: p, mode: "100644", type: "blob", sha: null }); });
      return gh("/git/trees", { method: "POST", body: { base_tree: baseTree, tree: entries } });
    }).then(function (t) {
      var parts = [];
      if (d.gAdd || d.gDel || d.gEdit) parts.push("galeri");
      if (d.cAdd || d.cDel || d.cEdit) parts.push("customer");
      return gh("/git/commits", { method: "POST", body: { message: "Admin: perbarui " + parts.join(" & ") + " (" + d.total + " perubahan)", tree: t.sha, parents: [headSha] } });
    }).then(function (c) {
      return gh("/git/refs/heads/" + encodeURIComponent(cfg.branch), { method: "PATCH", body: { sha: c.sha } });
    }).then(function () {
      S.gallery.forEach(function (x) { x.isNew = false; x._files = null; });
      S.customers.forEach(function (x) { x.isNew = false; x._committed = true; });
      S.baseG = clone(S.gallery); S.baseC = clone(S.customers); S.removedG = []; S.removedC = [];
      renderAll();
      toast("Tersimpan! Website akan menampilkan perubahan dalam ±1–2 menit (muat ulang halaman website).");
    }).catch(function (e) {
      toast("Gagal menyimpan: " + explain(e), true);
      if (e.status === 401) setTimeout(logout, 2500);
    }).then(function () { saving = false; btn.disabled = false; btn.textContent = "Simpan ke Website"; });
  });

  /* ---------- mulai ---------- */
  var saved = sget("sar_token"), repo = sget("sar_repo");
  if (repo && repo.indexOf("/") > 0) { $("#owner").value = repo.split("/")[0]; $("#repo").value = repo.split("/")[1]; }
  if (saved) {
    $("#login-btn").disabled = true; $("#login-btn").innerHTML = '<span class="busy"></span> Masuk…';
    var parts = (repo || "rikardo09/surya-abadi-raya").split("/");
    connect(saved, parts[0], parts[1]).then(function () { showApp(); renderAll(); }, function (e) {
      sdel("sar_token"); $("#login-err").textContent = explain(e); $("#login-err").hidden = false;
    }).then(function () { $("#login-btn").disabled = false; $("#login-btn").textContent = "Masuk"; });
  }
})();
