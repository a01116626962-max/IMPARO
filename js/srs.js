/* =========================================================
   SRS — خوارزمية التكرار المتباعد
   -----------------------------------------------------
   قاعدة أساسية: كل الحسابات تنطلق من "التاريخ الفعلي" لليوم.
   لا نستخدم أبدًا القيمة القديمة لـ next_review عند الحساب.
   ========================================================= */

window.SRS = (function () {
  'use strict';

  const REVIEW_HOUR = 10;
  const EASY_STREAK_MAX = 4;
  const EASY_DAYS = 7;
  const EASY_LONG_DAYS = 30;
  const MEDIUM_DAYS = 2;
  const MEDIUM_STREAK_MAX = 4;

  /** بداية "اليوم الدراسي" (10 صباحًا). */
  function startOfReviewDay(now = new Date()) {
    const d = new Date(now);
    if (d.getHours() < REVIEW_HOUR) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** مفتاح اليوم الدراسي (YYYY-MM-DD). */
  function reviewDayKey(now = new Date()) {
    const d = startOfReviewDay(now);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * يحسب موعد المراجعة القادم من "اليوم الفعلي" عند الساعة 10:00 ص.
   * (تطبيق قاعدة Overdue: لا يعتمد على next_review القديم).
   */
  function scheduleIn(daysAhead, now = new Date()) {
    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    d.setHours(REVIEW_HOUR, 0, 0, 0);
    return d.getTime();
  }

  /** هل الجملة مستحقة اليوم؟ */
  function isDue(sentence, now = Date.now()) {
    if (!sentence) return false;
    if (sentence.is_frozen) return false;
    if (sentence.in_mistake_bank) return false;
    return (sentence.next_review || 0) <= now;
  }

  /* ------------ تطبيق التقييمات ------------ */

  function applyEasy(sentence, now = new Date()) {
    const streak = (sentence.easy_streak || 0) + 1;
    const days = streak > EASY_STREAK_MAX ? EASY_LONG_DAYS : EASY_DAYS;
    return {
      next_review: scheduleIn(days, now),
      easy_streak: streak,
      medium_streak: 0,
      in_mistake_bank: false,
      last_reviewed: now.getTime()
    };
  }

  function applyMedium(sentence, now = new Date()) {
    const mStreak = Math.min((sentence.medium_streak || 0) + 1, MEDIUM_STREAK_MAX);
    return {
      next_review: scheduleIn(MEDIUM_DAYS, now),
      medium_streak: mStreak,
      easy_streak: 0,
      in_mistake_bank: false,
      last_reviewed: now.getTime()
    };
  }

  function applyHard(sentence, now = new Date()) {
    return {
      next_review: scheduleIn(1, now),
      easy_streak: 0,
      medium_streak: 0,
      in_mistake_bank: true,
      last_reviewed: now.getTime()
    };
  }

  function applyCorrectFromMistakes(sentence, now = new Date()) {
    return {
      next_review: scheduleIn(1, now),
      in_mistake_bank: false,
      easy_streak: 0,
      medium_streak: 0,
      last_reviewed: now.getTime()
    };
  }

  function applyWrongFromMistakes(sentence, now = new Date()) {
    return {
      next_review: scheduleIn(1, now),
      easy_streak: 0,
      medium_streak: 0,
      in_mistake_bank: true,
      last_reviewed: now.getTime()
    };
  }

  return {
    REVIEW_HOUR,
    startOfReviewDay,
    reviewDayKey,
    scheduleIn,
    isDue,
    applyEasy,
    applyMedium,
    applyHard,
    applyCorrectFromMistakes,
    applyWrongFromMistakes
  };
})();
