/**
 * LumenDesk — Interactive Behavior
 * Pure vanilla JS (no build step, no external dependencies).
 *
 * Modules:
 * 1. Sticky header shrink on scroll
 * 2. Accessible mobile navigation menu
 * 3. Keyboard-accessible FAQ accordion (WAI-ARIA pattern)
 * 4. Pricing CTA focus helper
 * 5. Contact form validation + honest POST /api/contact submission
 * 6. Opt-in analytics placeholder (inactive by default)
 */

(function () {
  'use strict';

  /* =========================================================================
     Configuration & Integration Points
     ========================================================================= */

  /**
   * BACKEND INTEGRATION POINT:
   * Replace or wire this relative endpoint on your server, reverse proxy,
   * Cloudflare Worker, Netlify Function, or Vercel Function.
   * Expected request: POST JSON { name, email, company, message }
   * Expected response: Direct (non-redirected) HTTP 2xx with
   *   Content-Type: application/json and JSON body { "ok": true }
   *   (also accepts { "received": true } or { "status": "ok" | "accepted" }).
   */
  const CONTACT_ENDPOINT = '/api/contact';
  const MIN_MESSAGE_LENGTH = 20;
  const REQUEST_TIMEOUT_MS = 10000;

  /* =========================================================================
     1. Sticky Header Scroll State
     ========================================================================= */

  function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* =========================================================================
     2. Accessible Mobile Navigation
     ========================================================================= */

  function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) return;

    const desktopQuery = window.matchMedia('(min-width: 56rem)');

    function setOpen(open, restoreFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (!open && restoreFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setOpen(!isOpen, false);
    });

    // Close when selecting any anchor link inside the mobile menu
    menu.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (link) {
        setOpen(false, false);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });

    // Ensure mobile menu closes if viewport expands to desktop
    const handleViewportChange = (event) => {
      if (event.matches) {
        setOpen(false, false);
      }
    };

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', handleViewportChange);
    }
  }

  /* =========================================================================
     3. Keyboard-Accessible FAQ Accordion
     ========================================================================= */

  function initAccordion() {
    const triggers = Array.from(document.querySelectorAll('.faq-trigger'));
    if (!triggers.length) return;

    function setPanelState(trigger, expanded) {
      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      trigger.setAttribute('aria-expanded', String(expanded));
      if (panel) {
        panel.hidden = !expanded;
      }
    }

    triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => {
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        setPanelState(trigger, !isExpanded);
      });

      trigger.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowDown') {
          nextIndex = (index + 1) % triggers.length;
        } else if (event.key === 'ArrowUp') {
          nextIndex = (index - 1 + triggers.length) % triggers.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = triggers.length - 1;
        }

        if (nextIndex !== null) {
          event.preventDefault();
          triggers[nextIndex].focus();
        }
      });
    });
  }

  /* =========================================================================
     4. Pricing & Hero CTA Focus Convenience
     ========================================================================= */

  function initContactJumpLinks() {
    const planButtons = document.querySelectorAll('[data-plan-interest]');
    const nameInput = document.getElementById('contact-name');
    const planHint = document.getElementById('plan-interest-hint');

    if (!planButtons.length) return;

    planButtons.forEach((link) => {
      link.addEventListener('click', () => {
        const plan = link.getAttribute('data-plan-interest');
        if (planHint && plan) {
          planHint.textContent = 'Selected tier reference: ' + plan + ' (demo pricing).';
        }
        if (nameInput) {
          // Focus after smooth scroll starts without jarring jump
          window.setTimeout(() => {
            nameInput.focus({ preventScroll: true });
          }, 350);
        }
      });
    });
  }

  /* =========================================================================
     5. Contact Form Validation & POST /api/contact
     ========================================================================= */

  function isValidEmail(email) {
    if (typeof email !== 'string' || email.length === 0 || email.length > 254) {
      return false;
    }

    const atIndex = email.indexOf('@');
    if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
      return false;
    }

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    if (local.length > 64 || domain.length < 3 || domain.length > 253) {
      return false;
    }

    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
      return false;
    }

    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
      return false;
    }

    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
      return false;
    }

    const labels = domain.split('.');
    if (labels.length < 2) {
      return false;
    }

    const labelRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    for (let i = 0; i < labels.length; i += 1) {
      if (!labelRegex.test(labels[i])) {
        return false;
      }
    }

    const tld = labels[labels.length - 1];
    if (!/^(?:[a-zA-Z]{2,63}|xn--[a-zA-Z0-9-]{2,59})$/.test(tld)) {
      return false;
    }

    return true;
  }

  function isJsonContentType(response) {
    const contentType = response && response.headers ? response.headers.get('content-type') : '';
    if (!contentType) return false;
    return /^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType.trim());
  }

  function isConfirmedDeliveryPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }
    if (data.ok === true || data.received === true) {
      return true;
    }
    if (typeof data.status === 'string') {
      const normalized = data.status.trim().toLowerCase();
      return normalized === 'ok' || normalized === 'accepted' || normalized === 'received';
    }
    return false;
  }

  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const fields = {
      name: document.getElementById('contact-name'),
      email: document.getElementById('contact-email'),
      company: document.getElementById('contact-company'),
      message: document.getElementById('contact-message')
    };

    const errors = {
      name: document.getElementById('error-name'),
      email: document.getElementById('error-email'),
      company: document.getElementById('error-company'),
      message: document.getElementById('error-message')
    };

    const messageCount = document.getElementById('message-count');
    const statusBox = document.getElementById('form-status');
    const submitBtn = document.getElementById('contact-submit');
    if (!submitBtn) return;

    // Enable custom inline validation only once JS is active
    form.noValidate = true;

    let hasAttemptedSubmit = false;
    let isSubmitting = false;
    let isSubmitted = false;

    function updateMessageCounter() {
      if (!fields.message || !messageCount) return;
      const len = fields.message.value.trim().length;
      if (len < MIN_MESSAGE_LENGTH) {
        messageCount.textContent = len + ' / ' + MIN_MESSAGE_LENGTH + ' min characters';
      } else {
        messageCount.textContent = len + ' characters';
      }
    }

    function setFieldError(key, message) {
      const input = fields[key];
      const errorEl = errors[key];
      if (!input || !errorEl) return;

      if (message) {
        input.setAttribute('aria-invalid', 'true');
        errorEl.textContent = message;
      } else {
        input.removeAttribute('aria-invalid');
        errorEl.textContent = '';
      }
    }

    function validateField(key) {
      const input = fields[key];
      if (!input) return true;
      const value = input.value.trim();

      if (key === 'name') {
        if (!value) {
          setFieldError('name', 'Please enter your name.');
          return false;
        }
        setFieldError('name', '');
        return true;
      }

      if (key === 'email') {
        if (!value) {
          setFieldError('email', 'Please enter your email address.');
          return false;
        }
        if (!isValidEmail(value)) {
          setFieldError('email', 'Enter a valid email address, such as alex@studio.co.');
          return false;
        }
        setFieldError('email', '');
        return true;
      }

      if (key === 'message') {
        if (!value) {
          setFieldError('message', 'Please describe your studio or workflow.');
          return false;
        }
        if (value.length < MIN_MESSAGE_LENGTH) {
          const remaining = MIN_MESSAGE_LENGTH - value.length;
          setFieldError(
            'message',
            'Please write at least ' + MIN_MESSAGE_LENGTH + ' characters (' + remaining + ' more needed).'
          );
          return false;
        }
        setFieldError('message', '');
        return true;
      }

      // Company is optional
      setFieldError('company', '');
      return true;
    }

    function setStatus(variant, title, bodyHtml) {
      if (!statusBox) return;
      statusBox.className = 'form-status';
      if (!variant) {
        statusBox.textContent = '';
        return;
      }
      statusBox.classList.add('form-status--' + variant);
      statusBox.innerHTML = '<strong>' + title + '</strong>' + bodyHtml;
    }

    ['name', 'email', 'message'].forEach((key) => {
      const input = fields[key];
      if (!input) return;

      input.addEventListener('blur', () => {
        if (hasAttemptedSubmit || input.value.trim().length > 0) {
          validateField(key);
        }
      });

      input.addEventListener('input', () => {
        if (key === 'message') {
          updateMessageCounter();
        }
        if (hasAttemptedSubmit || input.getAttribute('aria-invalid') === 'true') {
          validateField(key);
        }
      });
    });

    updateMessageCounter();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Prevent duplicate requests while in-flight or after confirmed delivery
      if (isSubmitted || isSubmitting) {
        return;
      }

      hasAttemptedSubmit = true;
      const orderedKeys = ['name', 'email', 'message'];
      let firstInvalid = null;

      orderedKeys.forEach((key) => {
        const valid = validateField(key);
        if (!valid && !firstInvalid) {
          firstInvalid = fields[key];
        }
      });

      if (firstInvalid) {
        setStatus(
          'error',
          'Check the highlighted fields',
          'Please fix the validation errors above before sending your note.'
        );
        firstInvalid.focus();
        return;
      }

      const payload = {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        company: fields.company ? fields.company.value.trim() : '',
        message: fields.message.value.trim()
      };

      const defaultLabel = submitBtn.textContent;
      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Sending request…';
      setStatus('', '', '');

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let didTimeout = false;
      const timeoutId = controller
        ? window.setTimeout(() => {
            didTimeout = true;
            controller.abort();
          }, REQUEST_TIMEOUT_MS)
        : null;

      try {
        // BACKEND INTEGRATION POINT: POST JSON to /api/contact
        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          redirect: 'manual',
          body: JSON.stringify(payload)
        };

        if (controller) {
          fetchOptions.signal = controller.signal;
        }

        const response = await fetch(CONTACT_ENDPOINT, fetchOptions);

        // Do not follow or treat redirects (e.g. 301/302/303 -> HTML page) as delivery
        if (
          response.type === 'opaqueredirect' ||
          response.redirected ||
          (response.status >= 300 && response.status < 400)
        ) {
          setStatus(
            'error',
            'Submission not delivered — unexpected redirect',
            '<code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code> returned a redirect instead of a direct JSON API response. Redirects are not treated as confirmed delivery; please check your backend route configuration.'
          );
          return;
        }

        if (response.ok) {
          if (!isJsonContentType(response)) {
            setStatus(
              'demo',
              'Static demo or misconfigured endpoint — non-JSON response (HTTP ' + response.status + ')',
              '<code>POST ' +
                escapeHtml(CONTACT_ENDPOINT) +
                '</code> returned non-JSON content (such as an HTML fallback page) instead of <code>application/json</code>. Nothing was confirmed as delivered. Return HTTP 2xx JSON (e.g. <code>{"ok": true}</code>) from your backend handler to confirm delivery.'
            );
            return;
          }

          let data = null;
          try {
            data = await response.json();
          } catch (_parseError) {
            data = null;
          }

          if (!isConfirmedDeliveryPayload(data)) {
            setStatus(
              'error',
              'Delivery not confirmed — invalid API response (HTTP ' + response.status + ')',
              '<code>POST ' +
                escapeHtml(CONTACT_ENDPOINT) +
                '</code> returned JSON without an explicit delivery confirmation (expected <code>{"ok": true}</code> or <code>{"status": "accepted"}</code>). Nothing was assumed delivered.'
            );
            return;
          }

          isSubmitted = true;
          submitBtn.textContent = 'Request received';
          setStatus(
            'success',
            'Request received',
            'Thank you, ' +
              escapeHtml(payload.name) +
              '. Your note was accepted by <code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code>.'
          );
          return;
        }

        // Honest static-demo handling for unmounted endpoints (404 / 405)
        if (response.status === 404 || response.status === 405) {
          setStatus(
            'demo',
            'Static portfolio demo — no backend connected (HTTP ' + response.status + ')',
            'Your input passed all client-side validation and dispatched JSON to <code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code>, which is not mounted on this static site. Nothing was transmitted to a live inbox. Wire <code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code> to your own server or serverless handler to enable delivery.'
          );
          return;
        }

        // Distinguishable rate-limit response (429)
        if (response.status === 429) {
          const retryAfter = response.headers ? response.headers.get('retry-after') : null;
          const retryHint =
            retryAfter && /^\d+$/.test(retryAfter.trim())
              ? ' Please wait ' + escapeHtml(retryAfter.trim()) + ' seconds before trying again.'
              : ' Please wait a moment before trying again.';
          setStatus(
            'error',
            'Too many requests — rate limited (HTTP 429)',
            '<code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code> temporarily rate-limited this request. Your note was not delivered yet.' +
              retryHint
          );
          return;
        }

        // Distinguishable server error response (5xx)
        if (response.status >= 500) {
          setStatus(
            'error',
            'Server error — unable to deliver right now (HTTP ' + response.status + ')',
            'The backend at <code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code> returned a server error. Your note has not been confirmed as delivered—your entries are preserved here so you can retry shortly.'
          );
          return;
        }

        // Other 4xx rejection
        setStatus(
          'error',
          'Request could not be accepted (HTTP ' + response.status + ')',
          '<code>POST ' +
            escapeHtml(CONTACT_ENDPOINT) +
            '</code> rejected the submission. Nothing was delivered; please check your entries and try again.'
        );
      } catch (error) {
        if (didTimeout || (error && error.name === 'AbortError')) {
          setStatus(
            'error',
            'Request timed out — delivery not confirmed',
            '<code>POST ' +
              escapeHtml(CONTACT_ENDPOINT) +
              '</code> did not respond within ' +
              Math.round(REQUEST_TIMEOUT_MS / 1000) +
              ' seconds. Your note was not confirmed as delivered; your text is preserved so you can try again.'
          );
          return;
        }

        // Distinguishable network / offline / unreachable endpoint error
        setStatus(
          'error',
          'Network error — could not reach ' + escapeHtml(CONTACT_ENDPOINT),
          'Your browser could not connect to <code>POST ' +
            escapeHtml(CONTACT_ENDPOINT) +
            '</code> (you may be offline, blocked by a network issue, or viewing this static demo without a live backend). Nothing was delivered.'
        );
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        isSubmitting = false;
        submitBtn.removeAttribute('aria-busy');
        if (!isSubmitted) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultLabel;
        }
      }
    });

    // Enable submit button only after validation and submit handler are bound
    submitBtn.disabled = false;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* =========================================================================
     6. Analytics Placeholder (Strictly Inactive Unless IDs Are Provided)
     ========================================================================= */

  /**
   * ANALYTICS SETUP (DISABLED BY DEFAULT):
   * Set window.__ANALYTICS__ in index.html before loading js/main.js:
   *   window.__ANALYTICS__ = { ga4: 'G-XXXXXXXXXX', plausibleDomain: 'lumendesk.example' };
   * No third-party scripts are requested while both values remain empty strings.
   */
  function initAnalytics() {
    if (typeof window.__ANALYTICS__ !== 'object' || window.__ANALYTICS__ === null) {
      window.__ANALYTICS__ = { ga4: '', plausibleDomain: '' };
      return;
    }

    const ga4Id = typeof window.__ANALYTICS__.ga4 === 'string'
      ? window.__ANALYTICS__.ga4.trim()
      : '';
    const plausibleDomain = typeof window.__ANALYTICS__.plausibleDomain === 'string'
      ? window.__ANALYTICS__.plausibleDomain.trim()
      : '';

    if (ga4Id) {
      const gtagScript = document.createElement('script');
      gtagScript.async = true;
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id);
      document.head.appendChild(gtagScript);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', ga4Id, { anonymize_ip: true });
    }

    if (plausibleDomain) {
      const plausibleScript = document.createElement('script');
      plausibleScript.defer = true;
      plausibleScript.setAttribute('data-domain', plausibleDomain);
      plausibleScript.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(plausibleScript);
    }
  }

  /* =========================================================================
     Bootstrap
     ========================================================================= */

  document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileNav();
    initAccordion();
    initContactJumpLinks();
    initContactForm();
    initAnalytics();
  });
})();
