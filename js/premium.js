/* ============================================
   BudMed News — Premium Paywall + Supabase
   Double Opt-In · Expiring Codes · Rate Limit
   ============================================ */

(function () {
  'use strict';

  // ─── Config ───
  // TODO: Replace with your Supabase project values
  var SUPABASE_URL = 'https://bbxxgruemnovbbitcaet.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJieHhncnVlbW5vdmJiaXRjYWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzQ3MzYsImV4cCI6MjEwMzMxMDczNn0.HUeX_K5h1hIzMdmzrcSC--8evy-z3F46PqgiiclaYrg';
  var API_URL = SUPABASE_URL + '/functions/v1/premium-access';

  // Static invite codes (always valid, no backend needed)
  var STATIC_CODES = {
    'BUDMED2026': true,
    'PREVIEW': true,
    'ALPHA': true
  };

  // ─── Helpers ───
  function getLang() {
    return localStorage.getItem('budmed-news-lang') || 'ru';
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('budmed-premium-session') || 'null'); }
    catch (e) { return null; }
  }

  function setSession(data) {
    localStorage.setItem('budmed-premium-session', JSON.stringify(data));
  }

  function clearSession() {
    localStorage.removeItem('budmed-premium-session');
  }

  function isUnlocked(slug) {
    var s = getSession();
    if (s && s.email && new Date(s.expires_at) > new Date()) return true;
    return false;
  }

  function getPendingEmail() {
    try { return JSON.parse(localStorage.getItem('budmed-premium-pending') || 'null'); }
    catch (e) { return null; }
  }

  function setPendingEmail(email) {
    localStorage.setItem('budmed-premium-pending', JSON.stringify({ email: email, ts: Date.now() }));
  }

  function clearPendingEmail() {
    localStorage.removeItem('budmed-premium-pending');
  }

  // ─── API Call ───
  async function apiCall(action, data) {
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON,
        },
        body: JSON.stringify({ action, ...data }),
      });
      return await resp.json();
    } catch (err) {
      console.error('Premium API error:', err);
      return { error: 'Network error. Please try again.' };
    }
  }

  // ─── Step Indicator ───
  function setStep(n) {
    var steps = document.querySelectorAll('.subscribe-step');
    steps.forEach(function (s, i) {
      s.classList.remove('active', 'done');
      if (i + 1 < n) s.classList.add('done');
      else if (i + 1 === n) s.classList.add('active');
    });
  }

  // ─── Resend Timer ───
  var resendTimer = null;
  function startResendTimer(seconds) {
    var btn = document.getElementById('subscribe-resend-btn');
    if (!btn) return;
    btn.disabled = true;
    var remaining = seconds;
    btn.textContent = getLang() === 'en'
      ? 'Resend (' + remaining + 's)'
      : '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c (' + remaining + '\u0441)';
    resendTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        btn.textContent = getLang() === 'en' ? 'Resend code' : '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c \u043a\u043e\u0434';
      } else {
        btn.textContent = getLang() === 'en'
          ? 'Resend (' + remaining + 's)'
          : '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c (' + remaining + '\u0441)';
      }
    }, 1000);
  }

  // ─── Landing Registration Form ───
  var regForm = document.getElementById('subscribe-register-form');
  var regMsg = document.getElementById('subscribe-reg-msg');
  var resendBtn = document.getElementById('subscribe-resend-btn');

  if (regForm) regForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var formData = new FormData(regForm);
    var name = (formData.get('name') || '').trim();
    var email = (formData.get('email') || '').trim();
    if (!name || !email || !regMsg) return;

    var submitBtn = regForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = getLang() === 'en' ? 'Sending...' : '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...';

    var result = await apiCall('send_code', { email: email });

    submitBtn.disabled = false;
    submitBtn.textContent = getLang() === 'en' ? 'Send code' : '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u0434';

    if (result.error) {
      regMsg.className = 'subscribe-invite-msg error';
      regMsg.textContent = getLang() === 'en' ? result.error : '\u041e\u0448\u0438\u0431\u043a\u0430: ' + result.error;
      return;
    }

    setPendingEmail(email);
    setStep(2);
    regMsg.className = 'subscribe-invite-msg success';
    regMsg.innerHTML = (getLang() === 'en'
      ? 'Code sent to <strong>' + email + '</strong>. Check your inbox.'
      : '\u041a\u043e\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043d\u0430 <strong>' + email + '</strong>. \u041f\u043e\u0447\u0442\u0430.');

    regForm.reset();
    if (resendBtn) {
      resendBtn.style.display = 'inline-block';
      startResendTimer(60);
    }
  });

  // ─── Resend Code ───
  if (resendBtn) resendBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    var pending = getPendingEmail();
    if (!pending) return;

    resendBtn.disabled = true;
    var result = await apiCall('resend_code', { email: pending.email });

    if (result.error) {
      regMsg.className = 'subscribe-invite-msg error';
      regMsg.textContent = result.error;
      resendBtn.disabled = false;
      return;
    }

    startResendTimer(60);
    regMsg.className = 'subscribe-invite-msg success';
    regMsg.innerHTML = (getLang() === 'en'
      ? 'New code sent to <strong>' + pending.email + '</strong>'
      : '\u041d\u043e\u0432\u044b\u0439 \u043a\u043e\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043d\u0430 <strong>' + pending.email + '</strong>');
  });

  // ─── Landing Invite Code Form ───
  var landingForm = document.getElementById('invite-landing-form');
  var landingInput = document.getElementById('invite-landing-input');
  var landingMsg = document.getElementById('invite-landing-msg');

  if (landingForm) landingForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var code = (landingInput.value || '').trim().toUpperCase();
    if (!code) {
      landingMsg.textContent = getLang() === 'en' ? 'Enter a code' : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434';
      landingMsg.className = 'subscribe-invite-msg error';
      return;
    }

    // Check static codes first (no API needed)
    if (STATIC_CODES[code]) {
      setSession({ email: 'static@budmed.news', expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() });
      landingMsg.textContent = getLang() === 'en' ? 'Access granted!' : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442!';
      landingMsg.className = 'subscribe-invite-msg success';
      setStep(3);
      setTimeout(function () { if (typeof window.__renderCards === 'function') window.__renderCards(); }, 800);
      return;
    }

    // Validate via API
    var submitBtn = landingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    var result = await apiCall('validate_code', { code: code, email: getPendingEmail()?.email });
    submitBtn.disabled = false;

    if (result.error) {
      landingMsg.textContent = getLang() === 'en' ? 'Invalid or expired code' : '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0438\u043b\u0438 \u043f\u0440\u043e\u0441\u0442\u0443\u0447\u0430\u0432\u0448\u0438\u0439 \u043a\u043e\u0434';
      landingMsg.className = 'subscribe-invite-msg error';
      return;
    }

    setSession({ email: result.email, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
    clearPendingEmail();
    setStep(3);
    landingMsg.textContent = getLang() === 'en'
      ? 'Access granted! Premium articles unlocked.'
      : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442! \u041f\u0440\u0435\u043c\u0438\u0443\u043c-\u0441\u0442\u0430\u0442\u044c\u0438 \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b.';
    landingMsg.className = 'subscribe-invite-msg success';
    setTimeout(function () { if (typeof window.__renderCards === 'function') window.__renderCards(); }, 800);
  });

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
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closePremiumModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closePremiumModal();
  });

  async function validateAndUnlock() {
    var code = (modalInput.value || '').trim().toUpperCase();
    if (!code) {
      modalMsg.textContent = getLang() === 'en' ? 'Enter a code' : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434';
      modalMsg.className = 'premium-modal-msg error';
      return;
    }

    // Static codes
    if (STATIC_CODES[code]) {
      setSession({ email: 'static@budmed.news', expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() });
      modalMsg.textContent = getLang() === 'en' ? 'Access granted!' : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442!';
      modalMsg.className = 'premium-modal-msg success';
      setTimeout(function () { closePremiumModal(); if (typeof window.__renderCards === 'function') window.__renderCards(); }, 1200);
      return;
    }

    modalSubmit.disabled = true;
    var result = await apiCall('validate_code', { code: code });
    modalSubmit.disabled = false;

    if (result.error) {
      modalMsg.textContent = getLang() === 'en' ? 'Invalid or expired code' : '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0438\u043b\u0438 \u043f\u0440\u043e\u0441\u0442\u0443\u0447\u0430\u0432\u0448\u0438\u0439 \u043a\u043e\u0434';
      modalMsg.className = 'premium-modal-msg error';
      return;
    }

    setSession({ email: result.email, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
    modalMsg.textContent = getLang() === 'en' ? 'Access granted!' : '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043a\u0440\u044b\u0442!';
    modalMsg.className = 'premium-modal-msg success';
    setTimeout(function () { closePremiumModal(); if (typeof window.__renderCards === 'function') window.__renderCards(); }, 1200);
  }

  if (modalSubmit) modalSubmit.addEventListener('click', validateAndUnlock);
  if (modalInput) modalInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') validateAndUnlock(); });
  if (modalGetCode) modalGetCode.addEventListener('click', function (e) {
    e.preventDefault();
    closePremiumModal();
    var target = document.getElementById('subscribe');
    if (target) {
      var headerHeight = document.querySelector('.site-header') ? document.querySelector('.site-header').offsetHeight : 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16, behavior: 'smooth' });
    }
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
