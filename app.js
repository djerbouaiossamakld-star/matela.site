/* =====================================================================
   صفحة الزبائن: عرض المنتجات، اختيار الخيارات، إرسال الطلب إلى واتساب
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = {
    settings: null, cats: [], prods: [],
    cat: 'all', q: '',
    cur: null, sel: [], qty: 1, shop: 0, gal: [], gi: 0, lastFocus: null
  };

  var ICON = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 .6 17.6L0 24l6.5-1.7a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.5 3.5Zm-8.4 18.2a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 1 1 8.4 4.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9s-.5-.1-.7.1-.8.9-.9 1.1-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6a.6.6 0 0 0 0-.5c-.1-.1-.7-1.6-.9-2.2s-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.5 13.5 0 0 0 5.2 4.6c1.9.8 2.6.9 3.6.7a3 3 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
    brand: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M23 4.5A12 12 0 1 0 27.5 22 10 10 0 0 1 23 4.5Z" style="fill:var(--thread)"/><path d="M8 25h16" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3.5 3.5" style="stroke:var(--thread)" fill="none"/></svg>'
  };

  /* ---------- أدوات ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtRaw(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  // نعزل الأرقام لتبقى مرتبة صحيحة داخل النص العربي (22 000 وليس 000 22)
  function fmt(n) { return '\u2066' + fmtRaw(n) + '\u2069'; }
  // القيم الرقمية فقط (مثل 140×190) نعزلها لتبقى بترتيبها الصحيح داخل النص العربي
  function lbl(s) {
    s = String(s == null ? '' : s);
    return /[\u0600-\u06FF]/.test(s) ? s : '\u2066' + s + '\u2069';
  }
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  }
  function waNumber(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('00') === 0) d = d.slice(2);
    else if (d.charAt(0) === '0') d = '213' + d.slice(1);
    return d;
  }
  function waUrl(msg, shop) {
    var num = waNumber(shop && shop.whatsapp);
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- الأسعار ---------- */
  function priceGroup(p) {
    return (p.options || []).filter(function (g) { return g.mode === 'price'; })[0] || null;
  }
  function minPrice(p) {
    var g = priceGroup(p);
    if (g) {
      var ps = g.values.map(function (v) { return +v.price || 0; }).filter(function (x) { return x > 0; });
      if (ps.length) {
        var mn = Math.min.apply(null, ps), mx = Math.max.apply(null, ps);
        return { v: mn, from: mx > mn };
      }
    }
    return { v: +p.basePrice || 0, from: false };
  }
  function totalFor(p, sel) {
    var t = +p.basePrice || 0;
    (p.options || []).forEach(function (g, i) {
      var val = g.values[sel[i]];
      if (!val) return;
      if (g.mode === 'price') t = +val.price || 0;
      else if (g.mode === 'extra') t += +val.price || 0;
    });
    return t;
  }

  /* ---------- البيانات ---------- */
  function setData(d) {
    S.settings = d.settings;
    S.cats = (d.categories || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    S.prods = (d.products || []).map(function (p) {
      p.options = (p.options || []).filter(function (g) { return g.values && g.values.length; });
      return p;
    });
  }
  function readCache() {
    if (!MX.live) return null;
    try { return JSON.parse(localStorage.getItem('mx_cache_v1')); } catch (e) { return null; }
  }
  function writeCache(d) {
    if (!MX.live) return;
    lsSet('mx_cache_v1', JSON.stringify({ t: Date.now(), data: d }));
  }

  function visible() {
    var q = norm(S.q.trim());
    return S.prods.filter(function (p) {
      if (p.active === false) return false;
      if (S.cat !== 'all' && p.categoryId !== S.cat) return false;
      if (q && norm(p.name + ' ' + (p.desc || '')).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  /* ---------- العرض: الإعدادات والترويسة ---------- */
  function applySettings() {
    var s = S.settings;
    document.title = s.brandName + ' | مراتب وراحة';
    $('#brandName').textContent = s.brandName;
    $('#footBrand').textContent = s.brandName;
    $('#brandMark').innerHTML = s.logo ? '<img src="' + esc(s.logo) + '" alt="">' : ICON.brand;
    $('#heroTitle').textContent = s.heroTitle;
    $('#heroSub').textContent = s.heroSub;
    $('#footText').textContent = s.footerText || '';
    $('#footYear').textContent = '© ' + new Date().getFullYear() + ' ' + s.brandName;
    var links = [];
    var so = s.social || {};
    if (so.facebook) links.push(['فيسبوك', so.facebook]);
    if (so.instagram) links.push(['إنستغرام', so.instagram]);
    if (so.tiktok) links.push(['تيك توك', so.tiktok]);
    $('#footLinks').innerHTML = links.map(function (l) {
      return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + l[0] + '</a>';
    }).join('');
    var bar = $('#demoBar');
    if (!MX.live) {
      bar.hidden = false;
      bar.innerHTML = 'نسخة تجريبية: البيانات محفوظة في متصفحك فقط. افتح <a href="admin.html">لوحة التحكم</a> للتجربة، ثم اربط Firebase لتصبح حقيقية.';
    }
  }

  function renderChips() {
    var used = {};
    S.prods.forEach(function (p) { if (p.active !== false) used[p.categoryId] = true; });
    var cats = S.cats.filter(function (c) { return used[c.id]; });
    if (S.cat !== 'all' && !used[S.cat]) S.cat = 'all';
    var h = '<button class="chip" type="button" data-cat="all" aria-pressed="' + (S.cat === 'all') + '">الكل</button>';
    cats.forEach(function (c) {
      h += '<button class="chip" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (S.cat === c.id) + '">' + esc(c.name) + '</button>';
    });
    $('#chips').innerHTML = cats.length ? h : '';
  }

  function cardHtml(p) {
    var m = minPrice(p), price;
    if (m.v > 0) {
      price = '<span class="card-price">' +
        (m.from ? '<small>ابتداءً من</small>' : (p.oldPrice > p.basePrice && p.oldPrice > 0 ? '<s>' + fmt(p.oldPrice) + ' دج</s>' : '')) +
        '<span><b>' + fmt(m.v) + '</b> <small>دج</small></span></span>';
    } else {
      price = '<span class="card-price ask">السعر عند الطلب</span>';
    }
    return '<button class="card" type="button" data-id="' + esc(p.id) + '">' +
      '<span class="card-img"><img src="' + esc(p.thumb || MX.placeholder()) + '" alt="" loading="lazy" decoding="async">' +
      (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') + '</span>' +
      '<span class="card-body"><span class="card-name">' + esc(p.name) + '</span>' +
      '<span class="card-foot">' + price + '<span class="card-go">' + ICON.go + '</span></span></span></button>';
  }

  function renderGrid() {
    var list = visible(), g = $('#grid');
    if (!list.length) {
      var any = S.prods.some(function (p) { return p.active !== false; });
      g.innerHTML = '<div class="empty">' + (any
        ? 'لا توجد منتجات تطابق بحثك. جرّب كلمة أخرى أو اختر "الكل".'
        : 'لم تُضف منتجات بعد. ستظهر هنا بمجرد إضافتها من لوحة التحكم.') + '</div>';
      return;
    }
    g.innerHTML = list.map(cardHtml).join('');
  }

  function mapSrc(sh) {
    if (sh.lat && sh.lng) return 'https://maps.google.com/maps?q=' + sh.lat + ',' + sh.lng + '&z=16&output=embed';
    if (sh.address) return 'https://maps.google.com/maps?q=' + encodeURIComponent(sh.address) + '&z=15&output=embed';
    return '';
  }
  function dirUrl(sh) {
    if (sh.lat && sh.lng) return 'https://www.google.com/maps/dir/?api=1&destination=' + sh.lat + ',' + sh.lng;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(sh.address || sh.name || '');
  }
  function renderShops() {
    var shops = (S.settings.shops || []).filter(function (s) { return s && (s.name || s.address); });
    $('#shopList').innerHTML = shops.map(function (sh, i) {
      var src = mapSrc(sh), num = waNumber(sh.whatsapp);
      return '<article class="shop">' +
        (src ? '<div class="shop-map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + esc(src) + '" title="خريطة ' + esc(sh.name) + '"></iframe></div>' : '') +
        '<div class="shop-body"><h3>' + esc(sh.name) + '</h3>' +
        (sh.address ? '<p>' + esc(sh.address) + '</p>' : '') +
        (sh.hours ? '<p>' + esc(sh.hours) + '</p>' : '') +
        '<div class="shop-actions">' +
        '<a class="btn btn-line" target="_blank" rel="noopener" href="' + esc(dirUrl(sh)) + '"><span style="width:20px;height:20px;display:inline-block">' + ICON.pin + '</span>الاتجاهات</a>' +
        (num ? '<a class="btn btn-solid-wa" target="_blank" rel="noopener" href="' + esc(waUrl('السلام عليكم، أريد الاستفسار.', sh)) + '"><span data-wa-ico></span>واتساب</a>' +
          '<a class="btn btn-line" href="tel:+' + num + '"><span style="width:20px;height:20px;display:inline-block">' + ICON.phone + '</span>اتصال</a>' : '') +
        '</div></div></article>';
    }).join('');
    $$('[data-wa-ico]').forEach(function (el) { el.innerHTML = ICON.wa; });
    if (!shops.length) $('#shops').hidden = true;
  }

  function renderAll() {
    applySettings(); renderChips(); renderGrid(); renderShops();
    $$('[data-wa-ico]').forEach(function (el) { el.innerHTML = ICON.wa; });
  }

  /* ---------- نافذة المنتج ---------- */
  function optPriceLabel(g, v) {
    var n = +v.price || 0;
    if (g.mode === 'price') return n > 0 ? fmt(n) + ' دج' : '';
    if (g.mode === 'extra') return n > 0 ? '+' + fmt(n) : (n < 0 ? '−' + fmt(-n) : '');
    return '';
  }

  function renderSheet() {
    var p = S.cur, shops = S.settings.shops.filter(function (s) { return s && (s.name || s.whatsapp); });
    var imgs = S.gal.length ? S.gal : [p.thumb || MX.placeholder()];
    var h = '<button class="sheet-x" type="button" data-close aria-label="إغلاق">' + ICON.close + '</button><div class="sheet-grid">';

    h += '<div class="sheet-gal"><div class="gal-main"><img id="galImg" src="' + esc(imgs[S.gi] || imgs[0]) + '" alt="' + esc(p.name) + '">';
    if (imgs.length > 1) {
      h += '<button class="gal-nav gal-prev" type="button" data-gal="1" aria-label="الصورة التالية">' + ICON.prev + '</button>' +
           '<button class="gal-nav gal-next" type="button" data-gal="-1" aria-label="الصورة السابقة">' + ICON.next + '</button>';
    }
    h += '</div>';
    if (imgs.length > 1) {
      h += '<div class="gal-th">' + imgs.map(function (src, i) {
        return '<button type="button" data-gi="' + i + '" aria-label="صورة ' + (i + 1) + '" aria-current="' + (i === S.gi) + '"><img src="' + esc(src) + '" alt=""></button>';
      }).join('') + '</div>';
    }
    h += '</div>';

    h += '<div class="sheet-info"><div class="sheet-body"><h2 id="sheetTitle">' + esc(p.name) + '</h2>';
    if (p.badge) h += '<span class="sheet-badge">' + esc(p.badge) + '</span>';
    if (p.desc) h += '<p class="desc">' + esc(p.desc) + '</p>';
    (p.options || []).forEach(function (g, gi) {
      h += '<div class="opt-group"><div class="opt-title">' + esc(g.name) + '</div><div class="opt-list">';
      g.values.forEach(function (v, vi) {
        var pl = optPriceLabel(g, v);
        h += '<button class="opt" type="button" data-g="' + gi + '" data-v="' + vi + '" aria-pressed="false">' + esc(lbl(v.label)) + (pl ? '<small>' + pl + '</small>' : '') + '</button>';
      });
      h += '</div></div>';
    });
    h += '</div>';

    h += '<div class="sheet-bar"><div class="bar-row">' +
      '<div class="total"><small>السعر</small><b id="tTotal"></b></div>' +
      '<div class="qty"><button type="button" data-q="-1" aria-label="إنقاص الكمية">−</button><span id="tQty">1</span><button type="button" data-q="1" aria-label="زيادة الكمية">+</button></div></div>';
    if (shops.length > 1) {
      h += '<div class="seg-wrap"><small>أرسل الطلب إلى</small><div class="seg" role="group" aria-label="المحل">' +
        shops.map(function (s, i) { return '<button type="button" data-shop="' + i + '" aria-pressed="false">' + esc(s.name || ('المحل ' + (i + 1))) + '</button>'; }).join('') +
        '</div></div>';
    }
    h += '<button class="btn btn-wa" type="button" id="sendWa"><span data-wa-ico></span>اطلب عبر واتساب</button></div>';
    h += '</div></div>';

    $('#sheet').innerHTML = h;
    $$('[data-wa-ico]', $('#sheet')).forEach(function (el) { el.innerHTML = ICON.wa; });
    updateSheetState();
  }

  function updateSheetState() {
    var p = S.cur;
    $$('.opt', $('#sheet')).forEach(function (b) {
      b.setAttribute('aria-pressed', String(S.sel[+b.dataset.g] === +b.dataset.v));
    });
    $$('[data-shop]', $('#sheet')).forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.shop === S.shop));
    });
    var t = totalFor(p, S.sel);
    $('#tTotal').textContent = t > 0 ? fmt(t * S.qty) + ' دج' : 'السعر عند الطلب';
    $('#tQty').textContent = S.qty;
  }

  function setGallery() {
    var imgs = S.gal.length ? S.gal : [S.cur.thumb || MX.placeholder()];
    if (S.gi >= imgs.length) S.gi = 0;
    var el = $('#galImg');
    if (el) el.src = imgs[S.gi];
    $$('[data-gi]', $('#sheet')).forEach(function (b) { b.setAttribute('aria-current', String(+b.dataset.gi === S.gi)); });
  }

  function openProduct(id, fromHash) {
    var p = S.prods.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    S.cur = p;
    S.sel = (p.options || []).map(function () { return 0; });
    S.qty = 1; S.gi = 0; S.gal = [];
    var saved = parseInt(lsGet('mx_shop'), 10);
    S.shop = (saved >= 0 && saved < S.settings.shops.length) ? saved : 0;
    S.lastFocus = document.activeElement;
    renderSheet();
    $('#sheetWrap').hidden = false;
    document.body.style.overflow = 'hidden';
    var x = $('.sheet-x'); if (x) x.focus();
    if (!fromHash) { try { history.pushState({ p: id }, '', '#p=' + id); } catch (e) { /* file:// */ } }
    MX.getGallery(id).then(function (imgs) {
      if (S.cur && S.cur.id === id && imgs && imgs.length) { S.gal = imgs; renderSheet(); }
    }).catch(function () { /* نكتفي بالصورة المصغّرة */ });
  }

  function closeSheet(viaPop) {
    if ($('#sheetWrap').hidden) return;
    $('#sheetWrap').hidden = true;
    document.body.style.overflow = '';
    S.cur = null;
    if (!viaPop && history.state && history.state.p) { history.back(); }
    else if (!viaPop && /#p=/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
    if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus();
  }

  function buildMessage() {
    var p = S.cur, L = [];
    L.push('السلام عليكم 👋');
    L.push('أريد طلب هذا المنتج من ' + S.settings.brandName + ':');
    L.push('');
    L.push('🛏️ *' + p.name + '*');
    (p.options || []).forEach(function (g, i) {
      var v = g.values[S.sel[i]];
      if (v) L.push('• ' + g.name + ': ' + lbl(v.label));
    });
    L.push('• الكمية: ' + S.qty);
    var t = totalFor(p, S.sel);
    if (t > 0) {
      L.push('💰 السعر: ' + fmtRaw(t) + ' دج' + (S.qty > 1 ? ' للقطعة' : ''));
      if (S.qty > 1) L.push('المجموع: ' + fmtRaw(t * S.qty) + ' دج');
    }
    L.push('🔗 ' + location.href.split('#')[0] + '#p=' + p.id);
    return L.join('\n');
  }

  function sendOrder() {
    var shops = S.settings.shops.filter(function (s) { return s && (s.name || s.whatsapp); });
    var shop = shops[S.shop] || shops[0] || {};
    if (!waNumber(shop.whatsapp)) toast('رقم واتساب المحل غير مضبوط بعد، اختر جهة الاتصال بنفسك.');
    window.open(waUrl(buildMessage(), shop), '_blank', 'noopener');
  }

  function generalWa() {
    var shop = S.settings.shops[0] || {};
    window.open(waUrl('السلام عليكم، أريد الاستفسار عن المراتب.', shop), '_blank', 'noopener');
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest('.card'))) { openProduct(el.dataset.id); return; }
    if ((el = t.closest('[data-cat]'))) { S.cat = el.dataset.cat; renderChips(); renderGrid(); return; }
    if (t.closest('[data-close]')) { closeSheet(); return; }
    if ((el = t.closest('.opt'))) { S.sel[+el.dataset.g] = +el.dataset.v; updateSheetState(); return; }
    if ((el = t.closest('[data-q]'))) { S.qty = Math.min(99, Math.max(1, S.qty + (+el.dataset.q))); updateSheetState(); return; }
    if ((el = t.closest('[data-shop]'))) { S.shop = +el.dataset.shop; lsSet('mx_shop', S.shop); updateSheetState(); return; }
    if ((el = t.closest('[data-gi]'))) { S.gi = +el.dataset.gi; setGallery(); return; }
    if ((el = t.closest('[data-gal]'))) {
      var n = (S.gal.length || 1);
      S.gi = (S.gi + (+el.dataset.gal) + n) % n; setGallery(); return;
    }
    if (t.closest('#sendWa')) { sendOrder(); return; }
    if (t.closest('#fab') || t.closest('#heroWa')) { generalWa(); return; }
    if (t.closest('#themeBtn')) {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', cur);
      lsSet('mx_theme', cur);
      var m = document.querySelector('meta[name=theme-color]');
      if (m) m.setAttribute('content', cur === 'dark' ? '#0e1230' : '#edeff8');
      return;
    }
    if (t.closest('#retry')) { init(); }
  });

  $('#q').addEventListener('input', function (e) { S.q = e.target.value; renderGrid(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
  });

  window.addEventListener('popstate', function () {
    var m = /#p=([\w-]+)/.exec(location.hash);
    if (m) openProduct(m[1], true); else closeSheet(true);
  });

  /* ---------- نجوم الخلفية (تظهر في الوضع الليلي) ---------- */
  function makeStars() {
    var box = $('#stars'), seed = 7, h = '';
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 38; i++) {
      var s = 1 + Math.round(rnd() * 2);
      h += '<i style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (rnd() * 80).toFixed(1) + '%;width:' + s + 'px;height:' + s + 'px;opacity:' + (0.35 + rnd() * 0.6).toFixed(2) + '"></i>';
    }
    box.innerHTML = h;
  }

  /* ---------- التشغيل ---------- */
  function handleHash() {
    var m = /#p=([\w-]+)/.exec(location.hash);
    if (m) openProduct(m[1], true);
  }

  function showSkeleton() {
    var h = '';
    for (var i = 0; i < 8; i++) h += '<div class="skel"></div>';
    $('#grid').innerHTML = h;
  }

  function init() {
    var cached = readCache();
    if (cached && cached.data) {
      setData(cached.data); renderAll();
      if (Date.now() - cached.t < 180000) { handleHash(); return; }
    } else {
      S.settings = MX.DEFAULT_SETTINGS; applySettings(); renderShops(); showSkeleton();
      $$('[data-wa-ico]').forEach(function (el) { el.innerHTML = ICON.wa; });
    }
    MX.getAll().then(function (d) {
      writeCache(d); setData(d); renderAll(); handleHash();
    }).catch(function (err) {
      if (cached && cached.data) return;
      $('#grid').innerHTML = '<div class="empty">تعذّر تحميل المنتجات. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.<br><button class="btn btn-primary" id="retry" type="button">إعادة المحاولة</button></div>';
      if (window.console) console.error(err);
    });
  }

  makeStars();
  $$('[data-wa-ico]').forEach(function (el) { el.innerHTML = ICON.wa; });
  init();
})();
