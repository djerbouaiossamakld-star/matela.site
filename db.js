/* =====================================================================
   طبقة البيانات: Firebase Firestore (حقيقي) أو وضع تجريبي محلي
   ===================================================================== */
(function () {
  'use strict';

  var cfg = window.MX_FIREBASE || {};
  var live = !!(cfg.apiKey && cfg.projectId);   // مضبوط = وضع حقيقي
  var fdb = null, fauth = null;
  if (live && typeof firebase !== 'undefined') {
    firebase.initializeApp(cfg);
    fdb = firebase.firestore();
    // يساعد على الاتصال في الشبكات الضعيفة أو التي تحجب بعض الاتصالات
    try { fdb.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) { /* ignore */ }
    if (firebase.auth) fauth = firebase.auth();
  }
  function needDb() { if (!fdb) throw new Error('تعذّر تحميل مكتبة Firebase. تحقق من الاتصال بالإنترنت.'); }

  /* ---------- القوالب الجاهزة للخيارات (تعدّلها من لوحة التحكم) ---------- */
  var DEFAULT_TEMPLATES = [
    { name: 'المقاس', mode: 'price', values: [
      { label: '90×190', price: 0 }, { label: '120×190', price: 0 },
      { label: '140×190', price: 0 }, { label: '160×190', price: 0 },
      { label: '180×200', price: 0 } ] },
    { name: 'الارتفاع', mode: 'none', values: [
      { label: '15 سم', price: 0 }, { label: '20 سم', price: 0 }, { label: '25 سم', price: 0 } ] },
    { name: 'الكثافة', mode: 'none', values: [
      { label: '25', price: 0 }, { label: '30', price: 0 }, { label: '35', price: 0 } ] },
    { name: 'نوع القماش', mode: 'extra', values: [
      { label: 'جاكار', price: 0 }, { label: 'قطن', price: 0 }, { label: 'ستريتش', price: 0 } ] }
  ];

  var DEFAULT_SETTINGS = {
    brandName: 'سكينة للمراتب',
    heroTitle: 'نوم هادئ يبدأ من مرتبة تناسبك',
    heroSub: 'اختر المقاس والارتفاع والكثافة ونوع القماش، ثم أرسل طلبك إلى أحد محلاتنا عبر واتساب بنقرة واحدة.',
    footerText: '',
    logo: '',
    social: { facebook: '', instagram: '', tiktok: '' },
    shops: [
      { name: 'المحل الأول', address: 'القليعة، تيبازة', whatsapp: '', lat: 36.6386, lng: 2.7681, hours: '' },
      { name: 'المحل الثاني', address: 'القليعة، تيبازة', whatsapp: '', lat: 36.6386, lng: 2.7681, hours: '' }
    ],
    templates: DEFAULT_TEMPLATES
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  function mergeSettings(d) {
    var s = clone(DEFAULT_SETTINGS);
    d = d || {};
    Object.keys(d).forEach(function (k) { s[k] = d[k]; });
    if (!Array.isArray(s.shops)) s.shops = clone(DEFAULT_SETTINGS.shops);
    if (!Array.isArray(s.templates)) s.templates = clone(DEFAULT_TEMPLATES);
    s.social = s.social || {};
    return s;
  }

  /* ---------- صورة بديلة (رسم مرتبة) ---------- */
  function placeholder(h) {
    h = (h === undefined) ? 232 : h;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',60%,92%)"/><stop offset="1" stop-color="hsl(' + h + ',45%,78%)"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#g)"/>' +
      '<rect x="48" y="150" width="304" height="62" rx="22" fill="hsl(' + h + ',50%,98%)"/>' +
      '<rect x="48" y="200" width="304" height="40" rx="14" fill="hsl(' + h + ',35%,62%)"/>' +
      '<path d="M78 181 H322" stroke="hsl(' + h + ',30%,72%)" stroke-width="3" stroke-dasharray="7 7" fill="none"/>' +
      '<ellipse cx="108" cy="138" rx="46" ry="20" fill="#fff"/></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /* ---------- الوضع التجريبي ---------- */
  var DEMO_KEY = 'mx_demo_v1';

  function seedDemo() {
    var cats = [
      { id: 'c1', name: 'مراتب طبية', order: 1 },
      { id: 'c2', name: 'مراتب زنبركية', order: 2 },
      { id: 'c3', name: 'إسفنج', order: 3 },
      { id: 'c4', name: 'وسائد وإكسسوارات', order: 4 }
    ];
    var T = DEFAULT_TEMPLATES;
    function g(i, prices) {
      var o = clone(T[i]);
      if (prices) o.values.forEach(function (v, k) { v.price = prices[k] || 0; });
      return o;
    }
    var sizes = function (arr) { var o = g(0, arr); o.values = o.values.filter(function (v) { return v.price > 0; }); return o; };
    var prods = [
      { id: 'p1', name: 'مرتبة طبية كلاسيك (نموذج)', categoryId: 'c1', badge: 'الأكثر طلبًا', featured: true, active: true,
        desc: 'مرتبة بإسناد متوازن لعمودك الفقري. هذا منتج تجريبي لمعاينة التصميم، احذفه وأضف منتجاتك.',
        basePrice: 0, oldPrice: 0, options: [sizes([22000, 28000, 34000, 40000, 48000]), g(1), g(2)], thumb: placeholder(232), createdAt: 4 },
      { id: 'p2', name: 'مرتبة زنبركية فاخرة (نموذج)', categoryId: 'c2', badge: 'جديد', featured: false, active: true,
        desc: 'زنبركات مستقلة مع طبقات راحة علوية. منتج تجريبي.',
        basePrice: 0, oldPrice: 0, options: [sizes([32000, 40000, 49000, 57000, 66000]), g(1), g(3, [0, 1500, 2500])], thumb: placeholder(262), createdAt: 3 },
      { id: 'p3', name: 'مرتبة إسفنج عالي الكثافة (نموذج)', categoryId: 'c3', badge: '', featured: false, active: true,
        desc: 'خفيفة وعملية للاستعمال اليومي. منتج تجريبي.',
        basePrice: 0, oldPrice: 0, options: [sizes([12000, 16000, 20000, 24000, 29000]), g(1), g(2)], thumb: placeholder(200), createdAt: 2 },
      { id: 'p4', name: 'وسادة مريحة (نموذج)', categoryId: 'c4', badge: '', featured: false, active: true,
        desc: 'وسادة ناعمة بدعم للرقبة. منتج تجريبي.',
        basePrice: 1800, oldPrice: 2200, options: [], thumb: placeholder(24), createdAt: 1 }
    ];
    var gal = {};
    prods.forEach(function (p) { gal[p.id] = [p.thumb]; });
    return { settings: clone(DEFAULT_SETTINGS), categories: cats, products: prods, gallery: gal };
  }

  function loadDemo() {
    try {
      var s = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (s && s.settings) return s;
    } catch (e) { /* ignore */ }
    var n = seedDemo();
    saveDemo(n);
    return n;
  }
  function saveDemo(s) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); }
    catch (e) { throw new Error('ذاكرة المتصفح التجريبية ممتلئة. اربط Firebase لحفظ عدد أكبر من الصور.'); }
  }

  /* ---------- الواجهة العامة ---------- */
  var MX = {
    live: live,
    uid: uid,
    placeholder: placeholder,
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    clone: clone,

    getAll: async function () {
      if (!live) {
        var s = loadDemo();
        return { settings: mergeSettings(s.settings), categories: s.categories, products: s.products };
      }
      needDb();
      var r = await Promise.all([
        fdb.collection('settings').doc('site').get(),
        fdb.collection('categories').get(),
        fdb.collection('products').get()
      ]);
      var cats = [], prods = [];
      r[1].forEach(function (d) { var o = d.data(); o.id = d.id; cats.push(o); });
      r[2].forEach(function (d) { var o = d.data(); o.id = d.id; prods.push(o); });
      return { settings: mergeSettings(r[0].exists ? r[0].data() : null), categories: cats, products: prods };
    },

    getGallery: async function (id) {
      if (!live) { var s = loadDemo(); return (s.gallery && s.gallery[id]) || []; }
      needDb();
      var d = await fdb.collection('gallery').doc(id).get();
      return d.exists ? (d.data().images || []) : [];
    },

    saveSettings: async function (obj) {
      if (!live) { var s = loadDemo(); s.settings = obj; saveDemo(s); return; }
      needDb();
      await fdb.collection('settings').doc('site').set(obj);
    },

    saveCategory: async function (c) {
      if (!c.id) c.id = uid();
      if (!live) {
        var s = loadDemo();
        var i = s.categories.findIndex(function (x) { return x.id === c.id; });
        if (i < 0) s.categories.push(c); else s.categories[i] = c;
        saveDemo(s); return c.id;
      }
      needDb();
      await fdb.collection('categories').doc(c.id).set({ name: c.name, order: c.order || 0 });
      return c.id;
    },

    deleteCategory: async function (id) {
      if (!live) {
        var s = loadDemo();
        s.categories = s.categories.filter(function (x) { return x.id !== id; });
        saveDemo(s); return;
      }
      needDb();
      await fdb.collection('categories').doc(id).delete();
    },

    /* p: بيانات المنتج (بدون الصور)، images: مصفوفة صور كاملة (dataURL) */
    saveProduct: async function (p, images) {
      var isNew = !p.id;
      if (live) needDb();
      if (isNew) p.id = live ? fdb.collection('products').doc().id : uid();
      p.updatedAt = Date.now();
      if (isNew && !p.createdAt) p.createdAt = p.updatedAt;
      if (!live) {
        var s = loadDemo();
        var i = s.products.findIndex(function (x) { return x.id === p.id; });
        if (i < 0) s.products.push(p); else s.products[i] = p;
        s.gallery = s.gallery || {};
        s.gallery[p.id] = images;
        saveDemo(s); return p.id;
      }
      var id = p.id, data = clone(p);
      delete data.id;
      var b = fdb.batch();
      b.set(fdb.collection('products').doc(id), data);
      b.set(fdb.collection('gallery').doc(id), { images: images });
      await b.commit();
      return id;
    },

    deleteProduct: async function (id) {
      if (!live) {
        var s = loadDemo();
        s.products = s.products.filter(function (x) { return x.id !== id; });
        if (s.gallery) delete s.gallery[id];
        saveDemo(s); return;
      }
      needDb();
      var b = fdb.batch();
      b.delete(fdb.collection('products').doc(id));
      b.delete(fdb.collection('gallery').doc(id));
      await b.commit();
    },

    /* تعديل حقول محددة في المنتج (مثل إظهاره/إخفائه) دون لمس الصور */
    patchProduct: async function (id, fields) {
      if (!live) {
        var s = loadDemo();
        var p = s.products.filter(function (x) { return x.id === id; })[0];
        if (p) { Object.keys(fields).forEach(function (k) { p[k] = fields[k]; }); saveDemo(s); }
        return;
      }
      needDb();
      await fdb.collection('products').doc(id).update(fields);
    },

    /* ---------- نسخ احتياطي ---------- */
    exportAll: async function () {
      var all = await MX.getAll();
      var gallery = {};
      for (var i = 0; i < all.products.length; i++) {
        var id = all.products[i].id;
        gallery[id] = await MX.getGallery(id);
      }
      return { version: 1, exportedAt: new Date().toISOString(), settings: all.settings,
               categories: all.categories, products: all.products, gallery: gallery };
    },

    importAll: async function (data) {
      if (!data || !data.settings || !Array.isArray(data.products)) throw new Error('الملف غير صالح');
      await MX.saveSettings(data.settings);
      for (var i = 0; i < (data.categories || []).length; i++) await MX.saveCategory(data.categories[i]);
      for (var j = 0; j < data.products.length; j++) {
        var p = data.products[j];
        var imgs = (data.gallery && data.gallery[p.id]) || [];
        // نحافظ على المعرّف نفسه
        if (!live) {
          var s = loadDemo();
          var k = s.products.findIndex(function (x) { return x.id === p.id; });
          if (k < 0) s.products.push(p); else s.products[k] = p;
          s.gallery = s.gallery || {}; s.gallery[p.id] = imgs;
          saveDemo(s);
        } else {
          var d = clone(p); delete d.id;
          var b = fdb.batch();
          b.set(fdb.collection('products').doc(p.id), d);
          b.set(fdb.collection('gallery').doc(p.id), { images: imgs });
          await b.commit();
        }
      }
    },

    resetDemo: function () { if (!live) localStorage.removeItem(DEMO_KEY); },

    /* ---------- الدخول ---------- */
    login: async function (email, pass) {
      if (!live) { sessionStorage.setItem('mx_demo_auth', '1'); return; }
      if (!fauth) throw new Error('تعذّر تحميل مكتبة الدخول. تحقق من الاتصال بالإنترنت.');
      await fauth.signInWithEmailAndPassword(email, pass);
    },
    logout: async function () {
      if (!live) { sessionStorage.removeItem('mx_demo_auth'); return; }
      if (fauth) await fauth.signOut();
    },
    onAuth: function (cb) {
      if (!live) { cb(sessionStorage.getItem('mx_demo_auth') ? { email: 'demo' } : null); return; }
      if (!fauth) { cb(null); return; }
      fauth.onAuthStateChanged(function (u) { cb(u ? { email: u.email } : null); });
    }
  };

  // بعد أي حفظ من لوحة التحكم نمسح النسخة المؤقتة للموقع في هذا المتصفح،
  // فتظهر التعديلات فورًا عند فتح الموقع (وبعد 3 دقائق على الأكثر عند الزبائن).
  ['saveSettings', 'saveCategory', 'deleteCategory', 'saveProduct', 'deleteProduct', 'patchProduct', 'importAll'].forEach(function (name) {
    var orig = MX[name];
    MX[name] = async function () {
      var r = await orig.apply(MX, arguments);
      try { localStorage.removeItem('mx_cache_v1'); } catch (e) { /* ignore */ }
      return r;
    };
  });

  window.MX = MX;
})();
