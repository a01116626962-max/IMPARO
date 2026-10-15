/* =========================================================
   Speech — Web Speech API + Fallback ذكي لأجهزة أندرويد
   -----------------------------------------------------
   Cascade:
     1. صوت it-IT بالضبط
     2. أي صوت يبدأ بـ it
     3. صوت اسمه يحتوي "italian"
     4. الصوت الافتراضي + تنبيه لطيف
   ========================================================= */

window.Speech = (function () {
  'use strict';

  const supported = 'speechSynthesis' in window;
  let voices = [];
  let voicesReady = false;
  let fallbackHandler = null;
  let warnedOnce = false;
  let cachedVoice = null;

  function loadVoices() {
    if (!supported) return;
    try {
      voices = window.speechSynthesis.getVoices() || [];
      voicesReady = voices.length > 0;
    } catch (err) {
      console.warn('[Speech] loadVoices error:', err);
    }
  }

  if (supported) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
      cachedVoice = null;
    };
    setTimeout(loadVoices, 300);
    setTimeout(loadVoices, 1200);
  }

  function pickItalianVoice() {
    if (cachedVoice) return cachedVoice;
    if (!voicesReady) loadVoices();

    // Tier 1: it-IT exact
    let v = voices.find(x => (x.lang || '').replace('_', '-').toLowerCase() === 'it-it');
    if (v) return (cachedVoice = { voice: v, tier: 'exact' });

    // Tier 2: any italian
    v = voices.find(x => /^it([-_]|$)/i.test(x.lang || ''));
    if (v) return (cachedVoice = { voice: v, tier: 'italian' });

    // Tier 3: name heuristic
    v = voices.find(x => /ital/i.test(x.name || ''));
    if (v) return (cachedVoice = { voice: v, tier: 'name-based' });

    // Tier 4: none
    return (cachedVoice = { voice: null, tier: 'none' });
  }

  function speak(text) {
    if (!text || !text.trim()) return;

    if (!supported) {
      notifyFallback('هذا المتصفح لا يدعم النطق الصوتي.');
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const pick = pickItalianVoice();

      if (pick.voice) {
        utterance.voice = pick.voice;
        utterance.lang = pick.voice.lang || 'it-IT';
      } else {
        utterance.lang = 'it-IT';
        if (!warnedOnce) {
          warnedOnce = true;
          notifyFallback('لا يتوفر صوت إيطالي على جهازك — سيتم استخدام الصوت الافتراضي.');
        }
      }

      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onerror = (e) => {
        console.warn('[Speech] utterance error:', e.error || e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[Speech] speak exception:', err);
      notifyFallback('تعذّر تشغيل النطق الصوتي على هذا الجهاز.');
    }
  }

  function notifyFallback(msg) {
    if (typeof fallbackHandler === 'function') {
      try { fallbackHandler(msg); } catch (_) {}
    }
  }

  function setFallbackHandler(fn) { fallbackHandler = fn; }
  function isSupported() { return supported; }
  function cancel() {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  return { speak, setFallbackHandler, isSupported, cancel };
})();
