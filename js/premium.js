/* ============================================
   BudMed News — Premium Paywall + Invite Code
   ============================================ */

(function () {
  'use strict';

  // ─── Invite Codes Config ───
  var INVITE_CODES = {
    'BUDMED2026': { label: 'Early Adopter', maxUses: 100 },
    'PREVIEW':    { label: 'Preview Access', maxUses: 50 },
    'ALPHA':      { label: 'Alpha Tester', maxUses: 25 }
  };

  // ─── Paywall Helpers ───
  function getRegistered() {
    try { return JSON.parse(localStorage.getItem('budmed-premium-registered') || 'null'); }
    catch (e) { return null; }
  }
  function isRegistered() { return !!getRegistered(); }

  function getUnlocked() {
    try { return JSON.parse(localStorage.getItem('budmed-premium-unlocked') || '[]'); }
    catch (e) { return []; }
  }
  function setUnlocked(arr) {
    localStorage.setItem('budmed-premium-unlocked', JSON.stringify(arr));
  }
  function isUnlocked(slug) {
    if (isRegistered()) return true;
    return getUnlocked().indexOf(slug) !== -1;
  }
  function unlockSlug(slug) {
    var u = getUnlocked();
    if (u.indexOf(slug) === -1) { u.push(slug); setUnlocked(u); }
  }

  function validateCode(code) {
    var c = (code || '').trim().toUpperCase();
    if (!c) return { ok: false, msg_ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434', msg_en: 'Enter a code' };
    var config = INVITE_CODES[c];
    if (!config) return { ok: false, msg_ru: '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u0434', msg_en: 'Invalid code' };
    return { ok: true, code: c };
  }

  function unlockAll() {
    document.querySelectorAll('[data-premium]').forEach(function (card) {
      var slug = card.getAttribute('data-premium');
      if (slug) unlockSlug(slug);
    });
  }

  // ─── Premium Modal ───
  var modal = document.getElementById('premium-modal');
  var modalInput = document.getElementById('premium-code-input');
  var modalMsg = document.getElementById('premium-code-msg');
  var modalSubmit = document.getElementById('premium-code-submit');
  var modalClose = document.getElementById('premium-modal-close');
  var modalGetCode = document.getElementById('premium-modal-get-code');

  function openPremiumModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    modalInput.value = '';
    modalMsg.textContent = '';
    modalMsg.className = 'premium-modal-msg';
    setTimeout(function () { modalInput.focus(); }, 300);
  }

  function closePremiumModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
  }

  if (modalClose) modalClose.addEventListener('click', closePremiumModal);
  if (modal) modal.addEventListener('click', function (e) {
    if (e.target === modal) closePremiumModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closePremiumModal();
  });

  function getLang() {
    return localStorage.getItem('budmed-news-lang') || 'ru';
  }

  function validateAndUnlock() {
    var result = validateCode(modalInput.value);
    if (!result.ok) {
      modalMsg.textContent = getLang() === 'en' ? result.msg_en : result.msg_ru;
      modalMsg.className = 'premium-modal-msg error';
      return;
    }
    unlockAll();
    modalMsg.textContent = getLang() === 'en' ? 'Access granted!' : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442!';
    modalMsg.className = 'premium-modal-msg success';
    setTimeout(function () {
      closePremiumModal();
      if (typeof window.__renderCards === 'function') window.__renderCards();
    }, 1200);
  }

  if (modalSubmit) modalSubmit.addEventListener('click', validateAndUnlock);
  if (modalInput) modalInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') validateAndUnlock();
  });
  if (modalGetCode) modalGetCode.addEventListener('click', function (e) {
    e.preventDefault();
    closePremiumModal();
    var target = document.getElementById('subscribe');
    if (target) {
      var headerHeight = document.querySelector('.site-header') ? document.querySelector('.site-header').offsetHeight : 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16, behavior: 'smooth' });
    }
  });

  // ─── Landing Invite Code Form ───
  var landingForm = document.getElementById('invite-landing-form');
  var landingInput = document.getElementById('invite-landing-input');
  var landingMsg = document.getElementById('invite-landing-msg');

  if (landingForm) landingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var result = validateCode(landingInput.value);
    if (!result.ok) {
      landingMsg.textContent = getLang() === 'en' ? result.msg_en : result.msg_ru;
      landingMsg.className = 'subscribe-invite-msg error';
      return;
    }
    unlockAll();
    landingMsg.textContent = getLang() === 'en'
      ? 'Access granted! Premium articles unlocked.'
      : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442! \u041f\u0440\u0435\u043c\u0438\u0443\u043c-\u0441\u0442\u0430\u0442\u044c\u0438 \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b.';
    landingMsg.className = 'subscribe-invite-msg success';
    setTimeout(function () {
      if (typeof window.__renderCards === 'function') window.__renderCards();
    }, 800);
  });

  // ─── Landing Registration Form ───
  var regForm = document.getElementById('subscribe-register-form');
  if (regForm) regForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var formData = new FormData(regForm);
    var name = (formData.get('name') || '').trim();
    var email = (formData.get('email') || '').trim();
    if (!name || !email) return;

    // Store registration locally
    localStorage.setItem('budmed-premium-registered', JSON.stringify({ name: name, email: email, date: new Date().toISOString() }));
    // Auto-unlock premium
    unlockAll();
    if (landingMsg) {
      landingMsg.textContent = getLang() === 'en'
        ? 'Registered! Premium articles unlocked.'
        : '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u043f\u0440\u0438\u043d\u044f\u0442\u0430! \u041f\u0440\u0435\u043c\u0438\u0443\u043c-\u0441\u0442\u0430\u0442\u044c\u0438 \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b.';
      landingMsg.className = 'subscribe-invite-msg success';
    }
    setTimeout(function () {
      if (typeof window.__renderCards === 'function') window.__renderCards();
    }, 800);
  });

  // ─── Init premium card click handlers ───
  function initPremiumCards() {
    document.querySelectorAll('[data-premium-unlock]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openPremiumModal();
      });
    });
  }

  // Expose for external use
  window.__initPremiumCards = initPremiumCards;
  window.__isUnlocked = isUnlocked;

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumCards);
  } else {
    initPremiumCards();
  }

})();
