/* =========================================================
   Imparo — Main Application Controller
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     State
     ========================================================= */
  const state = {
    user: null,
    sentences: [],
    dict: {},
    queue: [],
    qIndex: 0,
    flipped: false,
    session: { easy: 0, medium: 0, hard: 0 },
    listMode: null,
    busy: false
  };

  /* =========================================================
     Helpers
     ========================================================= */
  const $  = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const escapeHtml = s => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  /* =========================================================
     Toast
     ========================================================= */
  let toastTimer = null;
  function toast(msg, type = 'info') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* =========================================================
     Sync Indicator
     ========================================================= */
  function setSync(stateName) {
    const dot = $('#syncDot');
    if (!dot) return;
    dot.className = 'sync-dot ' + (stateName || '');
  }

  /* =========================================================
     Views
     ========================================================= */
  function showView(name) {
    $$('.view').forEach(v => v.classList.remove('is-active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* =========================================================
     Derived Lists
     ========================================================= */
  const dueToday = () => state.sentences.filter(s => SRS.isDue(s));
  const mistakesList = () => state.sentences.filter(s => s.in_mistake_bank && !s.is_frozen);
  const frozenList = () => state.sentences.filter(s => s.is_frozen);

  /* =========================================================
     Streak / Daily Counter
     ========================================================= */
  function resetDailyCounterIfNeeded() {
    const todayKey = SRS.reviewDayKey();
    if (state.user.reviewed_day_key !== todayKey) {
      state.user.reviewed_day_key = todayKey;
      state.user.reviewed_today = 0;
    }
  }

  function bumpStreakIfFirstReviewOfDay() {
    const todayKey = SRS.reviewDayKey();
    if (state.user.last_review_day === todayKey) return;

    if (state.user.last_review_day) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = SRS.reviewDayKey(yesterday);
      state.user.streak = state.user.last_review_day === yesterdayKey
        ? (state.user.streak || 0) + 1
        : 1;
    } else {
      state.user.streak = 1;
    }
    state.user.last_review_day = todayKey;
  }

  /* =========================================================
     Dashboard
     ========================================================= */
  function renderDashboard() {
    resetDailyCounterIfNeeded();

    const due = dueToday().length;
    const mistakes = mistakesList().length;
    const frozen = frozenList().length;
    const total = state.sentences.length;

    $('#statDue').textContent = due;
    $('#statReviewed').textContent = state.user.reviewed_today || 0;
    $('#statMistakes').textContent = mistakes;
    $('#statFrozen').textContent = frozen;

    $('#heroCount').textContent = due;
    $('#navTodayCount').textContent = due;
    $('#navMistakesCount').textContent = mistakes;
    $('#navFrozenCount').textContent = frozen;
    $('#navAllCount').textContent = total;
    $('#streakValue').textContent = state.user.streak || 0;

    const btn = $('#btnStartReview');
    btn.disabled = due === 0;
    btn.classList.toggle('btn-primary', due > 0);
    btn.classList.toggle('btn-secondary', due === 0);
  }

  /* =========================================================
     Quick Add
     ========================================================= */
  async function quickAdd() {
    if (state.busy) return;
    const italian = $('#inputItalian').value.trim();
    const arabic  = $('#inputArabic').value.trim();

    if (!italian || !arabic) {
      toast('أكمل الحقلين من فضلك', 'err');
      return;
    }

    state.busy = true;
    setSync('syncing');

    const payload = {
      italian,
      arabic,
      next_review: Date.now() - 1,
      easy_streak: 0,
      medium_streak: 0,
      in_mistake_bank: false,
      is_frozen: false,
      created_at: Date.now(),
      last_reviewed: null
    };

    try {
      const saved = await Store.addSentence(payload);
      state.sentences.push(saved);
      $('#inputItalian').value = '';
      $('#inputArabic').value = '';
      toast('تمت إضافة الجملة إلى السحابة ✓', 'ok');
      renderDashboard();
      $('#inputItalian').focus();
      setSync('online');
    } catch (err) {
      console.error(err);
      toast('فشل الحفظ في Firebase', 'err');
      setSync('offline');
    } finally {
      state.busy = false;
    }
  }

  /* =========================================================
     Review Flow
     ========================================================= */
  function startReview() {
    const queue = dueToday();
    if (queue.length === 0) {
      toast('لا توجد بطاقات مستحقة اليوم');
      return;
    }
    state.queue = queue;
    state.qIndex = 0;
    state.session = { easy: 0, medium: 0, hard: 0 };
    showView('review');
    renderCard();
  }

  function renderCard() {
    const s = state.queue[state.qIndex];
    if (!s) { finishReview(); return; }

    state.flipped = false;
    $('#flipCard').classList.remove('is-flipped');
    $('#ratingRow').classList.remove('is-visible');

    const italianEl = $('#cardItalian');
    italianEl.innerHTML = '';
    renderItalianWords(italianEl, s.italian);

    $('#cardArabic').textContent = s.arabic;

    const total = state.queue.length;
    const done = state.qIndex;
    $('#progressFill').style.width = (done / total * 100) + '%';
    $('#progressText').textContent = `${done + 1} / ${total}`;

    Speech.speak(s.italian);
  }

  function renderItalianWords(container, text) {
    const parts = String(text).split(/(\s+)/);
    parts.forEach(part => {
      if (/^\s+$/.test(part)) {
        container.appendChild(document.createTextNode(part));
        return;
      }
      const m = part.match(/^([\p{L}']+)(.*)$/u);
      if (m) {
        const [, word, punct] = m;
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        span.addEventListener('click', ev => {
          ev.stopPropagation();
          openDictionary(word);
        });
        container.appendChild(span);
        if (punct) container.appendChild(document.createTextNode(punct));
      } else {
        container.appendChild(document.createTextNode(part));
      }
    });
  }

  function flipCard() {
    if (state.flipped) return;
    state.flipped = true;
    $('#flipCard').classList.add('is-flipped');
    $('#ratingRow').classList.add('is-visible');
  }

  async function rateCard(rating) {
    if (state.busy) return;
    const s = state.queue[state.qIndex];
    if (!s) return;

    let patch;
    if (rating === 'easy')        patch = SRS.applyEasy(s);
    else if (rating === 'medium') patch = SRS.applyMedium(s);
    else                          patch = SRS.applyHard(s);

    Object.assign(s, patch);
    state.session[rating] = (state.session[rating] || 0) + 1;

    resetDailyCounterIfNeeded();
    state.user.reviewed_today = (state.user.reviewed_today || 0) + 1;
    bumpStreakIfFirstReviewOfDay();

    setSync('syncing');
    Promise.all([
      Store.updateSentence(s.id, patch),
      Store.saveUser({
        streak: state.user.streak,
        last_review_day: state.user.last_review_day,
        reviewed_today: state.user.reviewed_today,
        reviewed_day_key: state.user.reviewed_day_key
      })
    ])
    .then(() => setSync('online'))
    .catch(err => {
      console.warn('[rate] sync failed:', err);
      setSync('offline');
      toast('تعذّر التحديث السحابي', 'warn');
    });

    state.qIndex++;
    if (state.qIndex >= state.queue.length) finishReview();
    else renderCard();
  }

  function finishReview() {
    $('#progressFill').style.width = '100%';
    $('#progressText').textContent = `${state.queue.length} / ${state.queue.length}`;

    const { easy, medium, hard } = state.session;
    const total = easy + medium + hard;

    $('#summarySub').textContent = `أكملت مراجعة ${total} بطاقة`;

    $('#summaryStats').innerHTML = `
      <div class="summary-item total">
        <span class="v">${total}</span><span class="l">إجمالي البطاقات</span>
      </div>
      <div class="summary-item total">
        <span class="v">🔥 ${state.user.streak || 0}</span><span class="l">السلسلة اليومية</span>
      </div>
      <div class="summary-item easy">
        <span class="v">${easy}</span><span class="l">سهل</span>
      </div>
      <div class="summary-item medium">
        <span class="v">${medium}</span><span class="l">متوسط</span>
      </div>
      <div class="summary-item hard">
        <span class="v">${hard}</span><span class="l">صعب</span>
      </div>
      <div class="summary-item total">
        <span class="v">${state.user.reviewed_today || 0}</span><span class="l">راجعت اليوم</span>
      </div>
    `;

    showView('summary');
    renderDashboard();
  }

  /* =========================================================
     Dictionary Popup
     ========================================================= */
  let currentDictWord = null;

  function openDictionary(word) {
    const key = Store.normalizeKey(word);
    if (!key) return;
    currentDictWord = key;

    $('#popupWord').textContent = word;
    const meaning = state.dict[key] || '';
    $('#popupMeaning').textContent = meaning || '— لا يوجد معنى محفوظ —';
    $('#popupInput').value = meaning;
    $('#popupOverlay').classList.add('is-open');
    setTimeout(() => $('#popupInput').focus(), 120);
  }

  function closeDictionary() {
    $('#popupOverlay').classList.remove('is-open');
    currentDictWord = null;
  }

  async function saveDictionaryMeaning() {
    if (!currentDictWord) return;
    const val = $('#popupInput').value.trim();
    if (!val) { toast('اكتب المعنى أولًا', 'err'); return; }

    setSync('syncing');
    try {
      await Store.saveDictionaryWord(currentDictWord, val);
      state.dict[currentDictWord] = val;
      $('#popupMeaning').textContent = val;
      toast('تم الحفظ في السحابة ✓', 'ok');
      setSync('online');
      closeDictionary();
    } catch (err) {
      console.error(err);
      toast('تعذّر الحفظ', 'err');
      setSync('offline');
    }
  }

  /* =========================================================
     Lists View
     ========================================================= */
  function openList(mode) {
    state.listMode = mode;
    const titles = {
      today: 'المراجعة اليومية',
      mistakes: 'الجمل الصعبة',
      frozen: 'المجمّدة',
      all: 'كل الجمل'
    };
    $('#listTitle').textContent = titles[mode] || 'القائمة';

    const actions = $('#listActions');
    actions.innerHTML = '';

    if (mode === 'all' && state.sentences.length > 0) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-secondary';
      copyBtn.textContent = '📋 نسخ الكل';
      copyBtn.addEventListener('click', copyAll);

      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-secondary';
      dlBtn.textContent = '⬇️ تحميل .txt';
      dlBtn.addEventListener('click', downloadAll);

      actions.appendChild(copyBtn);
      actions.appendChild(dlBtn);
    }

    renderList();
    showView('list');
  }

  function renderList() {
    const mode = state.listMode;
    const wrap = $('#listContent');
    let items = [];

    if (mode === 'today')    items = dueToday().slice();
    if (mode === 'mistakes') items = mistakesList().slice();
    if (mode === 'frozen')   items = frozenList().slice();
    if (mode === 'all')      items = state.sentences.slice();

    if (items.length === 0) {
      const msgs = {
        today:    'لا توجد بطاقات مستحقة اليوم',
        mistakes: 'لا توجد جمل صعبة — عمل رائع! 🎉',
        frozen:   'لا توجد جمل مجمّدة',
        all:      'لم تُضف أي جملة بعد'
      };
      wrap.innerHTML = `<div class="empty-state"><span class="em">📭</span>${msgs[mode]}</div>`;
      return;
    }

    if (mode === 'all') {
      items.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } else if (mode === 'today') {
      items.sort((a, b) => (a.next_review || 0) - (b.next_review || 0));
    }

    wrap.innerHTML = '';
    items.forEach(s => wrap.appendChild(buildListItem(s, mode)));
  }

  function buildListItem(s, mode) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="list-item-it">${escapeHtml(s.italian)}</div>
      <div class="list-item-ar">${escapeHtml(s.arabic)}</div>
      <div class="list-item-meta">
        ${s.is_frozen ? '<span class="badge frozen">❄️ مجمّدة</span>' : ''}
        ${s.in_mistake_bank ? '<span class="badge hard">⚠️ صعبة</span>' : ''}
        ${s.easy_streak ? `<span class="badge easy">سهل ×${s.easy_streak}</span>` : ''}
        ${s.medium_streak ? `<span class="badge medium">متوسط ×${s.medium_streak}</span>` : ''}
        <span class="badge">${fmtDate(s.next_review)}</span>
      </div>
      <div class="list-item-actions"></div>
    `;

    const actions = el.querySelector('.list-item-actions');

    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'mini-btn ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };

    if (mode === 'mistakes') {
      actions.appendChild(mk('✓ صح', 'ok', () => markCorrect(s.id)));
      actions.appendChild(mk('✗ خطأ', 'no', () => markWrong(s.id)));
      actions.appendChild(mk('❄️ تجميد', 'freeze', () => freezeSentence(s.id)));
    } else if (mode === 'frozen') {
      actions.appendChild(mk('♻️ إلغاء التجميد', 'freeze', () => unfreezeSentence(s.id)));
      actions.appendChild(mk('🔊 نطق', '', () => Speech.speak(s.italian)));
      actions.appendChild(mk('🗑️ حذف', 'danger', () => removeSentence(s.id)));
    } else if (mode === 'all') {
      actions.appendChild(mk('❄️ تجميد', 'freeze', () => freezeSentence(s.id)));
      actions.appendChild(mk('🔊 نطق', '', () => Speech.speak(s.italian)));
      actions.appendChild(mk('🗑️ حذف', 'danger', () => removeSentence(s.id)));
    } else if (mode === 'today') {
      actions.appendChild(mk('🔊 نطق', '', () => Speech.speak(s.italian)));
      actions.appendChild(mk('❄️ تجميد', 'freeze', () => freezeSentence(s.id)));
    }

    return el;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / 86400000);

    if (diffDays === 0) return 'اليوم';
    if (diffDays === -1) return 'أمس';
    if (diffDays === 1) return 'غدًا';
    if (diffDays > 1 && diffDays <= 7) return `بعد ${diffDays} أيام`;
    if (diffDays < 0) return `متأخرة ${Math.abs(diffDays)} يوم`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  /* =========================================================
     List Actions
     ========================================================= */
  async function updateAndRefresh(id, patch) {
    const s = state.sentences.find(x => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
    setSync('syncing');
    try {
      await Store.updateSentence(id, patch);
      setSync('online');
    } catch (err) {
      console.error(err);
      setSync('offline');
      toast('تعذّر التحديث السحابي', 'err');
    }
    renderList();
    renderDashboard();
  }

  async function markCorrect(id) {
    const s = state.sentences.find(x => x.id === id);
    if (!s) return;
    const patch = SRS.applyCorrectFromMistakes(s);
    toast('خرجت من قائمة الصعبة ✓', 'ok');
    await updateAndRefresh(id, patch);
  }

  async function markWrong(id) {
    const s = state.sentences.find(x => x.id === id);
    if (!s) return;
    const patch = SRS.applyWrongFromMistakes(s);
    toast('ستبقى في القائمة الصعبة');
    await updateAndRefresh(id, patch);
  }

  async function freezeSentence(id) {
    await updateAndRefresh(id, { is_frozen: true });
    toast('تم التجميد ❄️');
  }

  async function unfreezeSentence(id) {
    await updateAndRefresh(id, { is_frozen: false });
    toast('تم إلغاء التجميد ♻️', 'ok');
  }

  async function removeSentence(id) {
    if (!confirm('حذف الجملة نهائيًا من Firebase؟')) return;
    setSync('syncing');
    try {
      await Store.deleteSentence(id);
      state.sentences = state.sentences.filter(x => x.id !== id);
      setSync('online');
      toast('تم الحذف');
    } catch (err) {
      console.error(err);
      setSync('offline');
      toast('تعذّر الحذف', 'err');
    }
    renderList();
    renderDashboard();
  }

  /* =========================================================
     Copy / Download
     ========================================================= */
  function serializeAll() {
    return state.sentences
      .slice()
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .map(s => `${s.italian}\t${s.arabic}`)
      .join('\n');
  }

  async function copyAll() {
    const text = serializeAll();
    try {
      await navigator.clipboard.writeText(text);
      toast('تم النسخ إلى الحافظة ✓', 'ok');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('تم النسخ ✓', 'ok'); }
      catch (e) { toast('فشل النسخ', 'err'); }
      ta.remove();
    }
  }

  function downloadAll() {
    const text = serializeAll();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `imparo-backup-${key}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('تم تحميل الملف ✓', 'ok');
  }

  /* =========================================================
     Event Binding
     ========================================================= */
  function bindEvents() {
    // Dashboard
    $('#btnStartReview').addEventListener('click', startReview);
    $('#btnQuickAdd').addEventListener('click', quickAdd);
    $('#inputArabic').addEventListener('keydown', e => {
      if (e.key === 'Enter') quickAdd();
    });

    $$('.list-btn').forEach(btn => {
      btn.addEventListener('click', () => openList(btn.dataset.list));
    });

    // Review
    $('#btnExitReview').addEventListener('click', () => {
      if (confirm('إنهاء الجلسة؟ ما تم تقييمه محفوظ في السحابة.')) {
        showView('dashboard');
        renderDashboard();
      }
    });
    $('#flipCard').addEventListener('click', flipCard);
    $('#btnSpeak').addEventListener('click', e => {
      e.stopPropagation();
      const s = state.queue[state.qIndex];
      if (s) Speech.speak(s.italian);
    });
    $$('.btn-rating').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        rateCard(b.dataset.rating);
      });
    });

    // Summary
    $('#btnBackHome').addEventListener('click', () => {
      showView('dashboard');
      renderDashboard();
    });

    // List
    $('#btnBackList').addEventListener('click', () => {
      showView('dashboard');
      renderDashboard();
    });

    // Dictionary popup
    $('#popupClose').addEventListener('click', closeDictionary);
    $('#popupSave').addEventListener('click', saveDictionaryMeaning);
    $('#popupInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveDictionaryMeaning();
    });
    $('#popupOverlay').addEventListener('click', e => {
      if (e.target === $('#popupOverlay')) closeDictionary();
    });

    // Refresh dashboard each minute
    setInterval(() => {
      if ($('#view-dashboard').classList.contains('is-active')) {
        renderDashboard();
      }
    }, 60 * 1000);

    // Online / Offline indicator
    const updateOnline = () => setSync(navigator.onLine ? 'online' : 'offline');
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    // Stop speech on unload
    window.addEventListener('beforeunload', () => Speech.cancel());
  }

  /* =========================================================
     Boot — بدون Firebase Auth
     ========================================================= */
  function showError(msg) {
    $('#bootScreen').hidden = true;
    const err = $('#errorScreen');
    err.hidden = false;
    $('#errorMessage').textContent = msg;
  }

  function setBootText(msg) {
    const el = $('#bootText');
    if (el) el.textContent = msg;
  }

  async function boot() {
    try {
      // 1. تهيئة Firebase + التحقق من USER_ID (بدون Auth)
      await Store.init(setBootText);

      // 2. ربط معالج Fallback للنطق
      Speech.setFallbackHandler(msg => toast(msg, 'warn'));

      // 3. تحميل البيانات من Firestore بالتوازي
      setBootText('جارٍ تحميل الجمل…');
      const [user, sentences, dict] = await Promise.all([
        Store.loadUser(),
        Store.loadSentences(),
        Store.loadDictionary()
      ]);

      state.user = user;
      state.sentences = sentences;
      state.dict = dict;

      // 4. تهيئة عدّاد اليوم
      resetDailyCounterIfNeeded();

      // 5. ربط الأحداث + أول رسم
      bindEvents();
      renderDashboard();

      // 6. إظهار التطبيق
      $('#bootScreen').hidden = true;
      $('#appRoot').hidden = false;
      setSync('online');

      console.info(
        '[Imparo] جاهز. USER_ID =', Store.getUid(),
        '| الجمل:', sentences.length,
        '| الوضع: سحابي (بدون Auth)'
      );

    } catch (err) {
      console.error('[Imparo] فشل التهيئة:', err);
      showError(err.message || 'خطأ غير متوقع.');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
