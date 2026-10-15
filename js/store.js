/* =========================================================
   Store — طبقة Firestore مع Fixed Master User ID
   (نسخة مصحّحة — إصلاح ترتيب ready flag)
   ========================================================= */

window.Store = (function () {
  'use strict';

  let db = null;
  let uid = null;
  let ready = false;

  function ensureReady() {
    if (!ready) throw new Error('Store غير مهيأ بعد. نفّذ init() أولًا.');
  }

  /* =========================================================
     Init
     ========================================================= */
  async function init(onStatus) {
    if (!window.firebase) {
      throw new Error('مكتبات Firebase غير محمّلة. تأكد من تحميلها في index.html.');
    }

    const cfg = window.FIREBASE_CONFIG || {};
    if (!cfg.apiKey || /^YOUR_/.test(cfg.apiKey)) {
      throw new Error('يرجى ضبط مفاتيح Firebase الحقيقية في ملف js/config.js');
    }

    uid = window.USER_ID;
    if (!uid || typeof uid !== 'string' || uid.length < 8) {
      throw new Error(
        'معرّف USER_ID غير مُعرَّف أو قصير جدًا. حدّده في js/config.js بسلسلة طويلة وعشوائية.'
      );
    }

    if (onStatus) onStatus('جارٍ الاتصال بقاعدة البيانات…');

    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();

    // ✅ الآن يمكن تعليم الطبقة كجاهزة (db + uid موجودان)
    ready = true;

    // كاش IndexedDB داخلي (اختياري — نتجاهل الفشل بهدوء)
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      console.warn('[Store] enablePersistence غير متاح:', e.code || e.message);
    }

    // تحقق سريع من صلاحية المسار (اختياري — يساعد في كشف مشاكل القواعد مبكرًا)
    if (onStatus) onStatus('جارٍ التحقق من المسار…');
    try {
      await db.collection('users').doc(uid).get();
    } catch (err) {
      // لو فشل التحقق، نُبلّغ لكن نُبقي ready = true
      // (قد ينجح الحفظ لاحقًا بعد نشر القواعد الصحيحة)
      console.warn('[Store] تحقق المسار فشل:', err.code || err.message);
      throw new Error(
        'فشل الوصول إلى قاعدة البيانات. تحقق من: ' +
        '(1) نشر firestore.rules في تبويب Firestore (ليس Realtime)، ' +
        '(2) تطابق USER_ID بين config.js و firestore.rules. ' +
        'تفاصيل: ' + (err.code || err.message)
      );
    }

    console.info('[Store] جاهز. USER_ID =', uid);
    return uid;
  }

  /* =========================================================
     Refs
     ========================================================= */
  function userRef()      { ensureReady(); return db.collection('users').doc(uid); }
  function sentencesCol() { ensureReady(); return userRef().collection('sentences'); }
  function dictCol()      { ensureReady(); return userRef().collection('dictionary'); }

  /* =========================================================
     User root document
     ========================================================= */
  const defaultUser = () => ({
    streak: 0,
    last_review_day: null,
    reviewed_today: 0,
    reviewed_day_key: null,
    created_at: Date.now(),
    updated_at: Date.now()
  });

  async function loadUser() {
    ensureReady();
    const ref = userRef();
    const snap = await ref.get();
    if (!snap.exists) {
      const initData = defaultUser();
      await ref.set(initData, { merge: true });
      return initData;
    }
    return Object.assign(defaultUser(), snap.data());
  }

  async function saveUser(patch) {
    ensureReady();
    await userRef().set(
      Object.assign({}, patch, { updated_at: Date.now() }),
      { merge: true }
    );
  }

  /* =========================================================
     Sentences
     ========================================================= */
  async function loadSentences() {
    ensureReady();
    const snap = await sentencesCol().get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  async function addSentence(data) {
    ensureReady();
    const ref = await sentencesCol().add(Object.assign({}, data));
    return Object.assign({ id: ref.id }, data);
  }

  async function updateSentence(id, patch) {
    ensureReady();
    await sentencesCol().doc(id).set(patch, { merge: true });
  }

  async function deleteSentence(id) {
    ensureReady();
    await sentencesCol().doc(id).delete();
  }

  /* =========================================================
     Dictionary
     ========================================================= */
  function normalizeKey(word) {
    return String(word || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}']/gu, '')
      .trim();
  }

  async function loadDictionary() {
    ensureReady();
    const snap = await dictCol().get();
    const dict = {};
    snap.docs.forEach(d => {
      const data = d.data() || {};
      dict[d.id] = data.meaning || '';
    });
    return dict;
  }

  async function saveDictionaryWord(word, meaning) {
    ensureReady();
    const key = normalizeKey(word);
    if (!key) return;
    await dictCol().doc(key).set({
      meaning: meaning,
      updated_at: Date.now()
    }, { merge: true });
  }

  /* =========================================================
     Info
     ========================================================= */
  function getUid() { return uid; }
  function isReady() { return ready; }

  return {
    init,
    loadUser, saveUser,
    loadSentences, addSentence, updateSentence, deleteSentence,
    loadDictionary, saveDictionaryWord,
    normalizeKey,
    getUid, isReady
  };
})();
