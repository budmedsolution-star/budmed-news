/* ============================================
   BudMed News — Main JavaScript
   Language Toggle, Sticky Header, Mobile Menu,
   Smooth Scroll, Scroll-to-Top
   ============================================ */

(function () {
  'use strict';

  // ─── DOM Ready ───
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initLanguageToggle();
    initStickyHeader();
    initMobileMenu();
    initSmoothScroll();
    initScrollToTop();
    initCardAnimations();
  }

  // ─── 1. Language Toggle ───
  function initLanguageToggle() {
    const langBtns = document.querySelectorAll('.lang-btn');
    const savedLang = localStorage.getItem('budmed-news-lang') || 'ru';

    // Set initial language
    applyLanguage(savedLang);

    langBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        applyLanguage(lang);
        localStorage.setItem('budmed-news-lang', lang);
      });
    });
  }

  function applyLanguage(lang) {
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Update html lang attribute
    document.documentElement.setAttribute('lang', lang);

    // Update all bilingual elements
    document.querySelectorAll('[data-ru][data-en]').forEach(function (el) {
      var text = el.getAttribute('data-' + lang);
      if (text) {
        el.textContent = text;
      }
    });

    // Update placeholder attributes for inputs
    document.querySelectorAll('[data-ru-placeholder][data-en-placeholder]').forEach(function (el) {
      var placeholder = el.getAttribute('data-' + lang + '-placeholder');
      if (placeholder) {
        el.setAttribute('placeholder', placeholder);
      }
    });

    // Re-render CMS-driven article cards
    if (typeof window.__renderCards === 'function') {
      window.__renderCards();
      // Re-apply animations after re-render
      if (typeof window.__reapplyAnimations === 'function') {
        setTimeout(function(){ window.__reapplyAnimations(); }, 100);
      }
    }
  }

  // ─── 2. Sticky Header ───
  function initStickyHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var scrollThreshold = 10;

    function onScroll() {
      if (window.scrollY > scrollThreshold) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Initial check
  }

  // ─── 3. Mobile Menu ───
  function initMobileMenu() {
    var hamburger = document.querySelector('.hamburger');
    var mobileMenu = document.querySelector('.mobile-menu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';

      // Update aria
      hamburger.setAttribute('aria-expanded', isOpen);
      mobileMenu.setAttribute('aria-hidden', !isOpen);
    });

    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // ─── 4. Smooth Scroll ───
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = anchor.getAttribute('href');
        if (href === '#') return;

        var target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        var headerHeight = document.querySelector('.site-header')
          ? document.querySelector('.site-header').offsetHeight
          : 0;

        var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;

        window.scrollTo({
          top: top,
          behavior: 'smooth'
        });
      });
    });
  }

  // ─── 5. Scroll-to-Top Button ───
  function initScrollToTop() {
    var scrollBtn = document.querySelector('.scroll-top');
    if (!scrollBtn) return;

    var showThreshold = 400;

    function toggleVisibility() {
      if (window.scrollY > showThreshold) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true });

    scrollBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── 6. Card Animation on Scroll ───
  function initCardAnimations() {
    if (!('IntersectionObserver' in window)) return;

    var cards = document.querySelectorAll('.news-card');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    cards.forEach(function (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(card);
    });
  }

})();
