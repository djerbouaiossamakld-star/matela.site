/* =====================================================================
   لوحة التحكم: المنتجات، الأصناف، قوالب الخيارات، معلومات المحل، نسخ احتياطي
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var A = { settings: null, cats: [], prods: [], tab: 'products', q: '', D: null, T: null, I: null };

  var MODES = {
    price: 'السعر يتحدد بالاختيار (مثل المقاس)',
    extra: 'زيادة أو نقصان على السعر',
    none: 'لا يؤثر على السعر'
  };
  var TABS = [
    ['products', 'المنتجات'], ['categories', 'الأصناف'], ['templates', 'قوالب الخيارات'],
    ['info', 'المحلات والمعلومات'], ['backup', 'نسخ احتياطي']
  ];
  var MAX_IMAGES = 5;
  var MAX_IMG_CHARS = 170000;

  /* ---------- أدوات ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3600);
  }
  function errMsg(e) {
    var c = (e && e.code) || '';
    if (c === 'permission-denied') return 'لا تملك صلاحية الحفظ. تأكد أن بريدك مطابق للبريد المكتوب في قواعد Firestore.';
    if (/auth\/(invalid|wrong|user-not)/.test(c)) return 'البريد أو كلمة المرور غير صحيحة.';
    if (c === 'auth/too-many-requests') return 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'تعذّر الاتصال، تحقق من الإنترنت.';
    return (e && e.message) || 'حدث خطأ غير متوقع.';
  }
  function setPath(o, path, val) {
    var k = path.split('.'), i;
    for (i = 0; i < k.length - 1; i++) { if (!o[k[i]] || typeof o[k[i]] !== 'object') o[k[i]] = {}; o = o[k[i]]; }
    o[k[k.length - 1]] = val;
  }
  function catName(id) {
    var c = A.cats.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : 'بدون صنف';
  }
  function minPrice(p) {
    var g = (p.options || []).filter(function (x) { return x.mode === 'price'; })[0];
    if (g) {
      var ps = g.values.map(function (v) { return +v.price || 0; }).filter(function (n) { return n > 0; });
      if (ps.length) return { v: Math.min.apply(null, ps), from: true };
    }
    return { v: +p.basePrice || 0, from: false };
  }
  function fmt(n) { return '⁦' + String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '⁩'; }

  async function run(btn, fn, okMsg) {
    if (btn) { btn.disabled = true; }
    try { await fn(); if (okMsg) toast(okMsg); }
    catch (e) { toast(errMsg(e)); if (window.console) console.error(e); }
    finally { if (btn) btn.disabled = false; }
  }

  /* ---------- معالجة الصور ---------- */
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('تعذّرت قراءة الصورة. جرّب صورة بصيغة JPG أو PNG.')); };
      im.src = src;
    });
  }
  function drawOut(im, max, q) {
    var r = Math.min(1, max / Math.max(im.width, im.height));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.width * r)); c.height = Math.max(1, Math.round(im.height * r));
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(im, 0, 0, c.width, c.height);
    var out = c.toDataURL('image/webp', q);
    if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', q);
    return out;
  }
  function fileToDataUrl(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('تعذّرت قراءة الملف')); };
      fr.readAsDataURL(file);
    });
  }
  async function shrink(file) {
    var im = await loadImg(await fileToDataUrl(file));
    var tries = [[1000, .76], [1000, .62], [860, .56], [720, .48], [600, .42]], out = '';
    for (var i = 0; i < tries.length; i++) {
      out = drawOut(im, tries[i][0], tries[i][1]);
      if (out.length <= MAX_IMG_CHARS) break;
    }
    return out;
  }
  async function makeThumb(dataUrl) { return drawOut(await loadImg(dataUrl), 480, .7); }

  /* ---------- الهيكل العام ---------- */
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(function (t) {
      return '<button class="chip" type="button" data-tab="' + t[0] + '" aria-pressed="' + (A.tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
  }
  function render() {
    renderTabs();
    var p = $('#panel');
    if (A.tab === 'products') p.innerHTML = A.D ? editorHtml() : listHtml();
    else if (A.tab === 'categories') p.innerHTML = catsHtml();
    else if (A.tab === 'templates') p.innerHTML = tplHtml();
    else if (A.tab === 'info') p.innerHTML = infoHtml();
    else p.innerHTML = backupHtml();
  }
  async function reload() {
    var d = await MX.getAll();
    A.settings = d.settings;
    A.cats = d.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    A.prods = d.products.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  /* ---------- المنتجات: القائمة ---------- */
  function listHtml() {
    var q = A.q.trim().toLowerCase();
    var list = A.prods.filter(function (p) { return !q || (p.name || '').toLowerCase().indexOf(q) >= 0; });
    var h = '<div class="panel-head"><h2>المنتجات (' + A.prods.length + ')</h2>' +
      '<button class="btn btn-primary btn-auto" type="button" data-act="new">+ منتج جديد</button></div>' +
      '<input class="inp" id="adminSearch" type="search" placeholder="ابحث في المنتجات" value="' + esc(A.q) + '" style="margin-bottom:14px">';
    if (!list.length) {
      h += '<div class="card-box"><p class="muted" style="margin:0">' + (A.prods.length ? 'لا نتائج.' : 'لا توجد منتجات بعد. اضغط "منتج جديد" لإضافة أول منتج.') + '</p></div>';
    }
    list.forEach(function (p) {
      var m = minPrice(p);
      h += '<div class="prow"><img src="' + esc(p.thumb || MX.placeholder()) + '" alt="">' +
        '<div class="prow-main"><b>' + esc(p.name) + '</b><small>' + esc(catName(p.categoryId)) + ' · ' + (m.v > 0 ? (m.from ? 'من ' : '') + fmt(m.v) + ' دج' : 'السعر عند الطلب') + '</small></div>' +
        '<label class="sw"><input type="checkbox" data-act="toggle" data-id="' + esc(p.id) + '"' + (p.active !== false ? ' checked' : '') + '>ظاهر</label>' +
        '<div class="prow-act"><button class="btn btn-line sm" type="button" data-act="edit" data-id="' + esc(p.id) + '">تعديل</button>' +
        '<button class="btn btn-danger sm" type="button" data-act="del" data-id="' + esc(p.id) + '">حذف</button></div></div>';
    });
    return h;
  }

  /* ---------- محرر الخيارات (مشترك بين المنتج والقوالب) ---------- */
  function groupsOf(sc) { return sc === 'p' ? A.D.options : A.T; }

  function groupHtml(g, gi, sc) {
    var tpl = null;
    if (sc === 'p') tpl = A.settings.templates.filter(function (t) { return t.name === g.name; })[0] || null;
    var h = '<div class="grp"><div class="grp-head">' +
      '<label class="field" style="margin:0"><span>اسم الخيار</span><input class="inp" data-sc="' + sc + '" data-gi="' + gi + '" data-f="name" value="' + esc(g.name) + '" placeholder="مثال: المقاس"></label>' +
      '<label class="field" style="margin:0"><span>تأثيره على السعر</span><select class="inp" data-sc="' + sc + '" data-gi="' + gi + '" data-f="mode">' +
      Object.keys(MODES).map(function (k) { return '<option value="' + k + '"' + (g.mode === k ? ' selected' : '') + '>' + MODES[k] + '</option>'; }).join('') +
      '</select></label>' +
      '<button class="btn btn-danger sm" type="button" data-act="del-group" data-sc="' + sc + '" data-gi="' + gi + '">حذف الخيار</button></div>';
    g.values.forEach(function (v, vi) {
      var np = g.mode === 'none';
      h += '<div class="vrow' + (np ? ' noprice' : '') + '"><input class="inp" data-sc="' + sc + '" data-gi="' + gi + '" data-vi="' + vi + '" data-f="label" dir="auto" value="' + esc(v.label) + '" placeholder="القيمة (مثال: 140×190)">' +
        (np ? '' : '<input class="inp" type="number" inputmode="numeric" data-sc="' + sc + '" data-gi="' + gi + '" data-vi="' + vi + '" data-f="price" value="' + (v.price ? esc(v.price) : '') + '" placeholder="' + (g.mode === 'price' ? 'السعر دج' : '+/− دج') + '">') +
        '<button type="button" data-act="del-val" data-sc="' + sc + '" data-gi="' + gi + '" data-vi="' + vi + '" aria-label="حذف القيمة">×</button></div>';
    });
    h += '<div class="addbar"><button type="button" data-act="add-val" data-sc="' + sc + '" data-gi="' + gi + '">+ قيمة</button></div>';
    if (tpl) {
      var have = g.values.map(function (v) { return v.label; });
      var miss = tpl.values.map(function (v, i) { return [v, i]; }).filter(function (x) { return have.indexOf(x[0].label) < 0; });
      if (miss.length) {
        h += '<div class="quick">' + miss.map(function (x) {
          return '<button type="button" data-act="tpl-val" data-gi="' + gi + '" data-tv="' + x[1] + '">+ ' + esc(x[0].label) + '</button>';
        }).join('') + '</div>';
      }
    }
    return h + '</div>';
  }

  function groupsBlock(sc) {
    var gs = groupsOf(sc);
    var h = gs.map(function (g, i) { return groupHtml(g, i, sc); }).join('');
    h += '<div class="addbar">';
    if (sc === 'p') {
      A.settings.templates.forEach(function (t, i) {
        h += '<button type="button" data-act="add-tpl-group" data-tv="' + i + '">+ ' + esc(t.name) + '</button>';
      });
    }
    h += '<button type="button" data-act="add-new-group" data-sc="' + sc + '">+ خيار جديد</button></div>';
    return h;
  }

  /* ---------- المنتجات: المحرر ---------- */
  function editorHtml() {
    var D = A.D;
    var h = '<div class="panel-head"><h2>' + (D.id ? 'تعديل المنتج' : 'منتج جديد') + '</h2>' +
      '<button class="btn btn-line sm" type="button" data-act="back">رجوع</button></div>';

    h += '<div class="card-box"><h3>المعلومات الأساسية</h3>' +
      '<label class="field"><span>اسم المنتج</span><input class="inp" data-d="name" value="' + esc(D.name) + '" placeholder="مثال: مرتبة طبية كلاسيك"></label>' +
      '<label class="field"><span>الصنف</span><select class="inp" data-d="categoryId"><option value="">بدون صنف</option>' +
      A.cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (D.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select><small>أنشئ الأصناف من تبويب "الأصناف".</small></label>' +
      '<label class="field"><span>الوصف</span><textarea class="inp" data-d="desc" placeholder="وصف مختصر يظهر للزبون">' + esc(D.desc) + '</textarea></label>' +
      '<div class="row2"><label class="field"><span>السعر الأساسي (دج)</span><input class="inp" type="number" inputmode="numeric" data-d="basePrice" data-num="1" value="' + (D.basePrice ? esc(D.basePrice) : '') + '"><small>اتركه فارغًا إذا كان السعر يتحدد حسب المقاس (خيار "السعر يتحدد بالاختيار").</small></label>' +
      '<label class="field"><span>السعر قبل التخفيض (اختياري)</span><input class="inp" type="number" inputmode="numeric" data-d="oldPrice" data-num="1" value="' + (D.oldPrice ? esc(D.oldPrice) : '') + '"><small>يظهر مشطوبًا بجانب السعر، للمنتجات بدون خيار سعر.</small></label></div>' +
      '<label class="field"><span>شارة على الصورة (اختياري)</span><input class="inp" data-d="badge" value="' + esc(D.badge) + '" placeholder="مثال: جديد، تخفيض، الأكثر طلبًا"></label>' +
      '<div class="checks"><label><input type="checkbox" data-d="active"' + (D.active ? ' checked' : '') + '>ظاهر في الموقع</label>' +
      '<label><input type="checkbox" data-d="featured"' + (D.featured ? ' checked' : '') + '>مميّز (يظهر في المقدمة)</label></div></div>';

    h += '<div class="card-box"><h3>الصور (حتى ' + MAX_IMAGES + ')</h3>';
    if (D.loadingImgs) h += '<p class="muted">جارٍ تحميل الصور…</p>';
    h += '<div class="imgs">' + D.images.map(function (src, i) {
      return '<div class="imgbox' + (i === 0 ? ' main' : '') + '"><img src="' + esc(src) + '" alt="">' + (i === 0 ? '<span class="tag">الرئيسية</span>' : '') +
        '<div class="acts">' + (i === 0 ? '<span></span>' : '<button type="button" data-act="img-main" data-i="' + i + '">رئيسية</button>') +
        '<button type="button" data-act="img-del" data-i="' + i + '">حذف</button></div></div>';
    }).join('') + '</div>';
    if (D.images.length < MAX_IMAGES) {
      h += '<label class="btn btn-line sm btn-auto" style="cursor:pointer">+ إضافة صور<input type="file" id="fileImgs" accept="image/*" multiple hidden></label>';
    }
    h += '<p class="hint">تُصغَّر الصور وتُضغط تلقائيًا قبل الحفظ، فلا تقلق من حجمها.</p></div>';

    h += '<div class="card-box"><h3>الخيارات (المقاس، الارتفاع، الكثافة، القماش…)</h3>' +
      '<p class="hint">أضف الخيارات التي تنطبق على هذا المنتج. يختار الزبون قيمة من كل خيار وتصل مع الطلب في واتساب.</p>' +
      groupsBlock('p') + '</div>';

    h += '<div class="sticky-save"><button class="btn btn-primary" type="button" data-act="save-product">حفظ المنتج</button>' +
      '<button class="btn btn-line" type="button" data-act="back">إلغاء</button></div>';
    return h;
  }

  function newDraft() {
    return { id: '', name: '', categoryId: A.cats[0] ? A.cats[0].id : '', desc: '', basePrice: '', oldPrice: '', badge: '',
      featured: false, active: true, options: [], images: [], createdAt: 0, loadingImgs: false };
  }

  function cleanOptions(opts) {
    var out = [];
    opts.forEach(function (g) {
      var name = (g.name || '').trim();
      var vals = (g.values || []).filter(function (v) { return (v.label || '').trim(); })
        .map(function (v) { return { label: v.label.trim(), price: g.mode === 'none' ? 0 : (+v.price || 0) }; });
      if (name && vals.length) out.push({ name: name, mode: g.mode || 'none', values: vals });
    });
    return out;
  }

  async function saveProduct() {
    var D = A.D;
    if (!D.name.trim()) throw new Error('اكتب اسم المنتج أولًا.');
    var opts = cleanOptions(D.options);
    var pg = opts.filter(function (g) { return g.mode === 'price'; });
    if (pg.length > 1) throw new Error('يمكن أن يكون خيار واحد فقط "يحدد السعر". غيّر تأثير الخيار الآخر.');
    if (pg.length && pg[0].values.every(function (v) { return !(v.price > 0); })) throw new Error('أدخل سعرًا لقيم الخيار الذي يحدد السعر (مثل المقاس).');
    var total = D.images.reduce(function (s, x) { return s + x.length; }, 0);
    if (total > 950000) throw new Error('حجم الصور كبير. احذف صورة أو اثنتين ثم أعد الحفظ.');
    var p = {
      id: D.id || '', name: D.name.trim(), categoryId: D.categoryId || '', desc: (D.desc || '').trim(),
      basePrice: +D.basePrice || 0, oldPrice: +D.oldPrice || 0, badge: (D.badge || '').trim(),
      featured: !!D.featured, active: !!D.active, options: opts,
      thumb: D.images.length ? await makeThumb(D.images[0]) : '', createdAt: D.createdAt || 0
    };
    await MX.saveProduct(p, D.images);
    A.D = null;
    await reload();
    render();
  }

  /* ---------- الأصناف ---------- */
  function catsHtml() {
    var h = '<div class="panel-head"><h2>الأصناف</h2></div><div class="card-box">';
    if (!A.cats.length) h += '<p class="muted">لا توجد أصناف بعد. أضف أول صنف (مثل: مراتب طبية).</p>';
    A.cats.forEach(function (c, i) {
      h += '<div class="vrow" style="grid-template-columns:1fr auto auto auto">' +
        '<input class="inp" data-cid="' + esc(c.id) + '" value="' + esc(c.name) + '" aria-label="اسم الصنف">' +
        '<button type="button" data-act="cat-up" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="للأعلى">↑</button>' +
        '<button type="button" data-act="cat-down" data-i="' + i + '"' + (i === A.cats.length - 1 ? ' disabled' : '') + ' aria-label="للأسفل">↓</button>' +
        '<button type="button" data-act="cat-del" data-id="' + esc(c.id) + '" aria-label="حذف">×</button></div>';
    });
    h += '<div class="vrow" style="grid-template-columns:1fr auto;margin-top:14px"><input class="inp" id="newCat" placeholder="اسم صنف جديد">' +
      '<button class="btn btn-primary sm" type="button" data-act="cat-add">إضافة</button></div></div>' +
      '<p class="hint">يظهر الصنف في الموقع فقط عندما يحتوي على منتج ظاهر. ترتيبه هنا هو ترتيبه في الموقع.</p>';
    return h;
  }

  /* ---------- قوالب الخيارات ---------- */
  function tplHtml() {
    if (!A.T) A.T = clone(A.settings.templates);
    return '<div class="panel-head"><h2>قوالب الخيارات</h2></div>' +
      '<p class="hint">القوالب قوائم جاهزة (المقاس، الارتفاع، الكثافة، نوع القماش…) تسرّع إضافة المنتجات: عند إنشاء منتج تضغط على اسم القالب فتُضاف قيمه، ثم تعدّل منها ما شئت. أضف هنا أي خيار جديد أو غيّر قيمه متى أردت.</p>' +
      '<div class="card-box">' + groupsBlock('t') + '</div>' +
      '<div class="sticky-save"><button class="btn btn-primary" type="button" data-act="tpl-save">حفظ القوالب</button></div>';
  }

  /* ---------- المحلات والمعلومات ---------- */
  function infoHtml() {
    if (!A.I) A.I = clone(A.settings);
    var I = A.I, so = I.social || {};
    function f(label, path, val, extra) {
      return '<label class="field"><span>' + label + '</span><input class="inp" data-i="' + path + '" value="' + esc(val) + '"' + (extra || '') + '></label>';
    }
    var h = '<div class="panel-head"><h2>المحلات والمعلومات</h2></div>';
    h += '<div class="card-box"><h3>هوية الموقع</h3>' +
      f('اسم المحل / العلامة', 'brandName', I.brandName) +
      f('العنوان الرئيسي في الواجهة', 'heroTitle', I.heroTitle) +
      '<label class="field"><span>الوصف تحت العنوان</span><textarea class="inp" data-i="heroSub">' + esc(I.heroSub) + '</textarea></label>' +
      '<label class="field"><span>نص أسفل الصفحة (اختياري)</span><textarea class="inp" data-i="footerText" placeholder="مثال: التوصيل متوفر لبعض الولايات، اتصل للتأكد.">' + esc(I.footerText) + '</textarea></label>' +
      '<div class="field"><span>الشعار (اختياري)</span>' + (I.logo ? '<img class="logo-prev" src="' + esc(I.logo) + '" alt="">' : '') +
      '<div class="addbar"><label class="btn btn-line sm btn-auto" style="cursor:pointer">' + (I.logo ? 'تغيير الشعار' : 'رفع شعار') + '<input type="file" id="fileLogo" accept="image/*" hidden></label>' +
      (I.logo ? '<button class="btn btn-danger sm" type="button" data-act="logo-del">إزالة</button>' : '') + '</div></div></div>';

    h += '<div class="card-box"><h3>المحلات</h3><p class="hint">رقم واتساب كل محل يستقبل الطلبات. اكتبه بالشكل المعتاد (0555123456) وسيُحوَّل تلقائيًا للصيغة الدولية. الخريطة: افتح موقع المحل في خرائط جوجل، انسخ الرابط وألصقه، ثم اضغط "استخرج الإحداثيات".</p>';
    I.shops.forEach(function (s, i) {
      h += '<div class="shopf"><div class="row2">' +
        '<label class="field"><span>اسم المحل</span><input class="inp" data-shop="' + i + '" data-f="name" value="' + esc(s.name) + '"></label>' +
        '<label class="field"><span>رقم واتساب</span><input class="inp" dir="ltr" inputmode="tel" data-shop="' + i + '" data-f="whatsapp" value="' + esc(s.whatsapp) + '" placeholder="0555 12 34 56"></label></div>' +
        '<label class="field"><span>العنوان</span><input class="inp" data-shop="' + i + '" data-f="address" value="' + esc(s.address) + '"></label>' +
        '<label class="field"><span>أوقات العمل (اختياري)</span><input class="inp" data-shop="' + i + '" data-f="hours" value="' + esc(s.hours) + '" placeholder="مثال: يوميًا من 8:00 إلى 19:00"></label>' +
        '<label class="field"><span>رابط الموقع من خرائط جوجل</span><input class="inp" dir="ltr" id="maplink' + i + '" placeholder="الصق الرابط هنا"></label>' +
        '<div class="addbar" style="margin:-4px 0 12px"><button type="button" data-act="parse-map" data-si="' + i + '">استخرج الإحداثيات</button></div>' +
        '<div class="row2"><label class="field"><span>خط العرض</span><input class="inp" dir="ltr" inputmode="decimal" data-shop="' + i + '" data-f="lat" value="' + esc(s.lat) + '"></label>' +
        '<label class="field"><span>خط الطول</span><input class="inp" dir="ltr" inputmode="decimal" data-shop="' + i + '" data-f="lng" value="' + esc(s.lng) + '"></label></div>' +
        (I.shops.length > 1 ? '<button class="btn btn-danger sm" type="button" data-act="shop-del" data-si="' + i + '">حذف هذا المحل</button>' : '') + '</div>';
    });
    if (I.shops.length < 4) h += '<div class="addbar"><button type="button" data-act="shop-add">+ إضافة محل</button></div>';
    h += '</div>';

    h += '<div class="card-box"><h3>روابط التواصل (اختياري)</h3>' +
      f('فيسبوك', 'social.facebook', so.facebook, ' dir="ltr" placeholder="https://facebook.com/..."') +
      f('إنستغرام', 'social.instagram', so.instagram, ' dir="ltr" placeholder="https://instagram.com/..."') +
      f('تيك توك', 'social.tiktok', so.tiktok, ' dir="ltr" placeholder="https://tiktok.com/@..."') + '</div>';

    return h + '<div class="sticky-save"><button class="btn btn-primary" type="button" data-act="info-save">حفظ</button></div>';
  }

  function parseMaps(u) {
    u = String(u || '').trim();
    var m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      u.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) ||
      u.match(/^\s*(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)\s*$/);
    return m ? { lat: +m[1], lng: +m[2] } : null;
  }

  /* ---------- النسخ الاحتياطي ---------- */
  function backupHtml() {
    return '<div class="panel-head"><h2>نسخ احتياطي</h2></div>' +
      '<div class="card-box"><h3>تنزيل نسخة</h3><p class="hint">ملف واحد يحتوي كل منتجاتك وصورك وإعداداتك. احتفظ به في هاتفك أو حاسوبك بين فترة وأخرى.</p>' +
      '<button class="btn btn-primary btn-auto" type="button" data-act="export">تنزيل النسخة الاحتياطية</button></div>' +
      '<div class="card-box"><h3>استرجاع نسخة</h3><p class="hint">يستبدل المنتجات الموجودة بنفس المعرّف، ويضيف الباقي. لا يحذف شيئًا.</p>' +
      '<label class="btn btn-line sm btn-auto" style="cursor:pointer">اختيار ملف النسخة<input type="file" id="fileImport" accept="application/json,.json" hidden></label></div>' +
      (MX.live ? '' : '<div class="card-box"><h3>الوضع التجريبي</h3><p class="hint">أنت الآن في وضع تجريبي: البيانات في متصفحك فقط. بعد ربط Firebase ستصبح حقيقية ومحفوظة دائمًا.</p>' +
        '<button class="btn btn-danger sm btn-auto" type="button" data-act="reset-demo">مسح بيانات التجربة</button></div>');
  }

  /* ---------- الأحداث ---------- */
  var panel = $('#panel');

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-act]');
    if (!t) return;
    if (t.dataset.tab) {
      if (t.dataset.tab !== A.tab) { A.tab = t.dataset.tab; A.D = null; A.T = null; A.I = null; render(); }
      return;
    }
    act(t.dataset.act, t);
  });

  $('#panel').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.act === 'toggle') {
      var id = t.dataset.id, val = t.checked;
      run(null, async function () {
        await MX.patchProduct(id, { active: val });
        var p = A.prods.filter(function (x) { return x.id === id; })[0]; if (p) p.active = val;
      }, val ? 'أصبح المنتج ظاهرًا' : 'تم إخفاء المنتج');
      return;
    }
    if (t.id === 'fileImgs') { addImages(t); return; }
    if (t.id === 'fileLogo') { setLogo(t); return; }
    if (t.id === 'fileImport') { importFile(t); return; }
    if (t.dataset.cid) {
      var name = t.value.trim(); if (!name) { render(); return; }
      var c = A.cats.filter(function (x) { return x.id === t.dataset.cid; })[0];
      if (c && c.name !== name) run(null, async function () { c.name = name; await MX.saveCategory(c); }, 'تم تعديل الصنف');
      return;
    }
    if (t.dataset.f === 'mode') { applyInput(t); render(); return; }
    if (t.tagName === 'SELECT' || t.type === 'checkbox') applyInput(t);
  });

  $('#panel').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'adminSearch') {
      A.q = t.value;
      var pos = t.selectionStart; render();
      var s = $('#adminSearch'); if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } }
      return;
    }
    if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'file') return;
    applyInput(t);
  });

  function applyInput(t) {
    if (t.dataset.d && A.D) {
      var v = t.type === 'checkbox' ? t.checked : t.value;
      A.D[t.dataset.d] = v;
      return;
    }
    if (t.dataset.sc !== undefined && t.dataset.f) {
      var g = groupsOf(t.dataset.sc)[+t.dataset.gi]; if (!g) return;
      if (t.dataset.vi !== undefined) {
        var val = g.values[+t.dataset.vi]; if (!val) return;
        val[t.dataset.f] = t.dataset.f === 'price' ? (t.value === '' ? 0 : +t.value) : t.value;
      } else g[t.dataset.f] = t.value;
      return;
    }
    if (t.dataset.i && A.I) { setPath(A.I, t.dataset.i, t.value); return; }
    if (t.dataset.shop !== undefined && A.I) {
      var s = A.I.shops[+t.dataset.shop]; if (!s) return;
      var f = t.dataset.f;
      s[f] = (f === 'lat' || f === 'lng') ? (t.value === '' ? '' : (isNaN(+t.value) ? s[f] : +t.value)) : t.value;
    }
  }

  function act(a, t) {
    var d = t.dataset;
    switch (a) {
      case 'new': A.D = newDraft(); render(); window.scrollTo(0, 0); break;
      case 'edit': {
        var p = A.prods.filter(function (x) { return x.id === d.id; })[0]; if (!p) return;
        A.D = {
          id: p.id, name: p.name || '', categoryId: p.categoryId || '', desc: p.desc || '',
          basePrice: p.basePrice || '', oldPrice: p.oldPrice || '', badge: p.badge || '',
          featured: !!p.featured, active: p.active !== false, options: clone(p.options || []),
          images: [], createdAt: p.createdAt || 0, loadingImgs: true
        };
        render(); window.scrollTo(0, 0);
        MX.getGallery(p.id).then(function (imgs) {
          if (A.D && A.D.id === p.id) { A.D.images = imgs.slice(); A.D.loadingImgs = false; render(); }
        }).catch(function (er) { if (A.D) { A.D.loadingImgs = false; render(); } toast(errMsg(er)); });
        break;
      }
      case 'back': A.D = null; render(); break;
      case 'del':
        if (confirm('حذف هذا المنتج نهائيًا؟')) run(t, async function () { await MX.deleteProduct(d.id); await reload(); render(); }, 'تم الحذف');
        break;
      case 'save-product': run(t, saveProduct, 'تم حفظ المنتج'); break;
      case 'img-del': A.D.images.splice(+d.i, 1); render(); break;
      case 'img-main': { var im = A.D.images.splice(+d.i, 1)[0]; A.D.images.unshift(im); render(); break; }

      case 'add-tpl-group': {
        var tp = clone(A.settings.templates[+d.tv]);
        tp.values.forEach(function (v) { v.price = 0; });
        tp.values = []; // نبدأ فارغًا ثم يضغط على القيم المناسبة
        A.D.options.push(tp); render(); break;
      }
      case 'add-new-group': groupsOf(d.sc).push({ name: '', mode: 'none', values: [{ label: '', price: 0 }] }); render(); break;
      case 'del-group': groupsOf(d.sc).splice(+d.gi, 1); render(); break;
      case 'add-val': groupsOf(d.sc)[+d.gi].values.push({ label: '', price: 0 }); render(); break;
      case 'del-val': groupsOf(d.sc)[+d.gi].values.splice(+d.vi, 1); render(); break;
      case 'tpl-val': {
        var g = A.D.options[+d.gi];
        var tpl = A.settings.templates.filter(function (x) { return x.name === g.name; })[0];
        if (tpl && tpl.values[+d.tv]) g.values.push({ label: tpl.values[+d.tv].label, price: 0 });
        render(); break;
      }
      case 'tpl-save':
        run(t, async function () {
          var s = clone(A.settings);
          s.templates = cleanOptions(A.T);
          await MX.saveSettings(s); A.settings = s; A.T = null; render();
        }, 'تم حفظ القوالب');
        break;

      case 'cat-add': {
        var inp = $('#newCat'), name = inp.value.trim(); if (!name) { inp.focus(); return; }
        run(t, async function () {
          var max = A.cats.reduce(function (m, c) { return Math.max(m, c.order || 0); }, 0);
          await MX.saveCategory({ id: '', name: name, order: max + 1 }); await reload(); render();
        }, 'تمت إضافة الصنف');
        break;
      }
      case 'cat-del':
        if (confirm('حذف هذا الصنف؟ المنتجات التابعة له تبقى لكن بدون صنف.')) run(t, async function () { await MX.deleteCategory(d.id); await reload(); render(); }, 'تم حذف الصنف');
        break;
      case 'cat-up': case 'cat-down': {
        var i = +d.i, j = a === 'cat-up' ? i - 1 : i + 1;
        if (j < 0 || j >= A.cats.length) return;
        run(t, async function () {
          var x = A.cats[i], y = A.cats[j], ox = i + 1, oy = j + 1;
          x.order = oy; y.order = ox;
          await MX.saveCategory(x); await MX.saveCategory(y); await reload(); render();
        });
        break;
      }

      case 'logo-del': A.I.logo = ''; render(); break;
      case 'shop-add': A.I.shops.push({ name: '', address: '', whatsapp: '', lat: '', lng: '', hours: '' }); render(); break;
      case 'shop-del': if (confirm('حذف هذا المحل؟')) { A.I.shops.splice(+d.si, 1); render(); } break;
      case 'parse-map': {
        var r = parseMaps(($('#maplink' + d.si) || {}).value);
        if (!r) { toast('لم أجد إحداثيات في هذا الرابط. جرّب فتح الرابط في المتصفح ثم انسخ العنوان الطويل، أو الصق الإحداثيات مباشرة مثل: 36.6386, 2.7681'); return; }
        A.I.shops[+d.si].lat = r.lat; A.I.shops[+d.si].lng = r.lng; render(); toast('تم استخراج الإحداثيات');
        break;
      }
      case 'info-save':
        run(t, async function () {
          var s = clone(A.I);
          s.brandName = (s.brandName || '').trim() || 'اسم المحل';
          s.shops = s.shops.filter(function (x) { return (x.name || '').trim() || (x.address || '').trim() || (x.whatsapp || '').trim(); })
            .map(function (x) { x.lat = x.lat === '' ? '' : +x.lat; x.lng = x.lng === '' ? '' : +x.lng; return x; });
          await MX.saveSettings(s); A.settings = s; A.I = null; render();
        }, 'تم حفظ المعلومات');
        break;

      case 'export':
        run(t, async function () {
          var data = await MX.exportAll();
          var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          var a2 = document.createElement('a');
          a2.href = URL.createObjectURL(blob);
          a2.download = 'backup-' + new Date().toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a2); a2.click(); a2.remove();
          setTimeout(function () { URL.revokeObjectURL(a2.href); }, 4000);
        }, 'تم تنزيل النسخة');
        break;
      case 'reset-demo':
        if (confirm('مسح كل بيانات التجربة؟')) { MX.resetDemo(); reload().then(render); toast('تم المسح'); }
        break;
    }
  }

  async function addImages(inp) {
    var files = Array.prototype.slice.call(inp.files || []);
    inp.value = '';
    var room = MAX_IMAGES - A.D.images.length;
    if (files.length > room) { toast('الحد الأقصى ' + MAX_IMAGES + ' صور، سأضيف أول ' + room + ' فقط.'); files = files.slice(0, room); }
    for (var i = 0; i < files.length; i++) {
      toast('جارٍ معالجة الصورة ' + (i + 1) + ' من ' + files.length + '…');
      try { A.D.images.push(await shrink(files[i])); }
      catch (e) { toast(errMsg(e)); }
    }
    render();
  }

  async function setLogo(inp) {
    var f = inp.files && inp.files[0]; inp.value = '';
    if (!f) return;
    try {
      var im = await loadImg(await fileToDataUrl(f));
      A.I.logo = drawOut(im, 240, .8);
      render();
    } catch (e) { toast(errMsg(e)); }
  }

  function importFile(inp) {
    var f = inp.files && inp.files[0]; inp.value = '';
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      run(null, async function () {
        var data = JSON.parse(fr.result);
        await MX.importAll(data); await reload(); A.I = null; A.T = null; render();
      }, 'تم الاسترجاع');
    };
    fr.readAsText(f);
  }

  /* ---------- الدخول والخروج ---------- */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'); $('#loginErr').textContent = '';
    btn.disabled = true;
    MX.login($('#email').value.trim(), $('#pass').value).then(function () {
      if (!MX.live) showApp();
    }).catch(function (er) {
      $('#loginErr').textContent = errMsg(er);
    }).then(function () { btn.disabled = false; });
  });
  $('#logoutBtn').addEventListener('click', function () {
    MX.logout().then(function () { if (!MX.live) showLogin(); });
  });

  async function showApp() {
    $('#loginView').hidden = true; $('#appView').hidden = false;
    var bar = $('#demoBar');
    if (!MX.live) { bar.hidden = false; bar.textContent = 'وضع تجريبي: كل ما تفعله هنا محفوظ في هذا المتصفح فقط.'; }
    try { await reload(); render(); }
    catch (e) { $('#panel').innerHTML = '<div class="card-box"><p>' + esc(errMsg(e)) + '</p></div>'; }
  }
  function showLogin() {
    $('#appView').hidden = true; $('#loginView').hidden = false;
    if (!MX.live) {
      $('#loginNote').textContent = 'وضع تجريبي: اضغط "دخول" مباشرة (لا حاجة لبريد أو كلمة مرور).';
      $('#email').required = false; $('#pass').required = false;
    }
  }

  MX.onAuth(function (u) { if (u) showApp(); else showLogin(); });
})();
