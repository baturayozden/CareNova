(function () {
  'use strict';

  // ── 1. Find our script tag and read site key ────────────────────────────────
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[data-site-key]');
  if (!scriptEl) return;

  const siteKey = scriptEl.getAttribute('data-site-key');
  if (!siteKey) return;

  const API_BASE = 'https://api.carenova.ai';

  // ── 2. Shadow DOM host ──────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'cd-widget-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // ── 3. Styles ───────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px; color: #0f172a; }

    /* Launcher button */
    #cd-launcher {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      background: #2563EB; color: #fff; border: none; border-radius: 28px;
      padding: 13px 22px; font-size: 15px; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 14px rgba(37,99,235,.45);
      transition: background .15s, transform .1s;
      display: flex; align-items: center; gap: 8px;
    }
    #cd-launcher:hover { background: #1d4ed8; transform: translateY(-1px); }
    #cd-launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }

    /* Overlay */
    #cd-overlay {
      display: none; position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(15,23,42,.45); align-items: center; justify-content: center;
    }
    #cd-overlay.open { display: flex; }

    /* Modal card */
    #cd-modal {
      background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
      max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.22);
      display: flex; flex-direction: column;
      margin: 16px;
    }

    /* Modal header */
    .cd-header {
      padding: 20px 24px 0; display: flex; align-items: center; justify-content: space-between;
    }
    .cd-clinic-name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .cd-close {
      background: none; border: none; cursor: pointer; color: #64748b;
      font-size: 22px; line-height: 1; padding: 4px; border-radius: 6px;
    }
    .cd-close:hover { color: #0f172a; background: #f1f5f9; }
    .cd-close:focus-visible { outline: 2px solid #93c5fd; }

    /* Tabs */
    .cd-tabs {
      display: flex; gap: 0; padding: 16px 24px 0; border-bottom: 1px solid #e2e8f0;
      margin-top: 12px;
    }
    .cd-tab {
      background: none; border: none; cursor: pointer; padding: 8px 18px;
      font-size: 14px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent;
      margin-bottom: -1px; border-radius: 0; transition: color .12s;
    }
    .cd-tab:hover { color: #2563EB; }
    .cd-tab.active { color: #2563EB; border-bottom-color: #2563EB; }
    .cd-tab:focus-visible { outline: 2px solid #93c5fd; outline-offset: -2px; }

    /* Form panels */
    .cd-panel { display: none; padding: 20px 24px 24px; flex-direction: column; gap: 14px; }
    .cd-panel.active { display: flex; }

    /* Form fields */
    .cd-field { display: flex; flex-direction: column; gap: 5px; }
    .cd-field label { font-size: 13px; font-weight: 600; color: #374151; }
    .cd-field input, .cd-field select, .cd-field textarea {
      border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 9px 12px;
      font-size: 14px; font-family: inherit; color: #0f172a; background: #fff;
      transition: border-color .12s;
      width: 100%;
    }
    .cd-field input:focus, .cd-field select:focus, .cd-field textarea:focus {
      outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    .cd-field input.error, .cd-field select.error, .cd-field textarea.error {
      border-color: #ef4444;
    }
    .cd-field textarea { resize: vertical; min-height: 80px; }
    .cd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* Consent */
    .cd-consent { display: flex; align-items: flex-start; gap: 10px; }
    .cd-consent input[type="checkbox"] { margin-top: 2px; accent-color: #2563EB; width: 16px; height: 16px; flex-shrink: 0; }
    .cd-consent label { font-size: 12.5px; color: #475569; line-height: 1.4; cursor: pointer; }
    .cd-consent.error label { color: #ef4444; }

    /* Honeypot */
    .cd-hp { position: absolute; left: -9999px; opacity: 0; pointer-events: none; }

    /* Error message */
    .cd-field-error { font-size: 12px; color: #ef4444; margin-top: 2px; }

    /* Submit */
    .cd-submit {
      background: #2563EB; color: #fff; border: none; border-radius: 8px;
      padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: background .15s; margin-top: 4px;
    }
    .cd-submit:hover { background: #1d4ed8; }
    .cd-submit:disabled { background: #93c5fd; cursor: not-allowed; }
    .cd-submit:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }

    /* WhatsApp button */
    .cd-wa {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      background: #25d366; color: #fff; border: none; border-radius: 8px;
      padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: background .12s;
    }
    .cd-wa:hover { background: #1ebe5d; }

    /* Divider */
    .cd-or { display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 13px; }
    .cd-or::before, .cd-or::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }

    /* Thank you / error screens */
    .cd-thankyou, .cd-error-screen {
      padding: 32px 24px; text-align: center; display: flex; flex-direction: column;
      align-items: center; gap: 16px;
    }
    .cd-thankyou h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .cd-thankyou p, .cd-error-screen p { font-size: 14px; color: #475569; line-height: 1.5; }
    .cd-check { font-size: 48px; }
    .cd-error-screen h2 { color: #dc2626; font-size: 17px; font-weight: 700; }

    /* Form error banner */
    .cd-form-error {
      background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; color: #dc2626;
    }

    @media (max-width: 480px) {
      #cd-modal { border-radius: 16px 16px 0 0; max-height: 96vh; margin: 0; align-self: flex-end; width: 100%; max-width: 100%; }
      #cd-overlay { align-items: flex-end; }
      .cd-row { grid-template-columns: 1fr; }
      #cd-launcher { bottom: 16px; right: 16px; }
    }
  `;
  shadow.appendChild(style);

  // ── 4. HTML structure ───────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="cd-launcher" aria-label="Book an appointment">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Book Appointment
    </button>

    <div id="cd-overlay" role="dialog" aria-modal="true" aria-label="Appointment booking">
      <div id="cd-modal">
        <div class="cd-header">
          <span class="cd-clinic-name" id="cd-clinic-name"></span>
          <button class="cd-close" id="cd-close" aria-label="Close">&times;</button>
        </div>
        <div class="cd-tabs" role="tablist">
          <button class="cd-tab active" id="cd-tab-book" role="tab" aria-selected="true" aria-controls="cd-panel-book">Book</button>
          <button class="cd-tab" id="cd-tab-contact" role="tab" aria-selected="false" aria-controls="cd-panel-contact">Contact</button>
        </div>

        <!-- Book panel -->
        <div class="cd-panel active" id="cd-panel-book" role="tabpanel">
          <div id="cd-book-content">
            <div class="cd-row" style="gap:12px;display:grid;grid-template-columns:1fr 1fr;margin-bottom:0">
              <div class="cd-field">
                <label for="cd-b-fname">First name <span aria-hidden="true">*</span></label>
                <input id="cd-b-fname" type="text" autocomplete="given-name" placeholder="Jane" />
              </div>
              <div class="cd-field">
                <label for="cd-b-lname">Last name</label>
                <input id="cd-b-lname" type="text" autocomplete="family-name" placeholder="Smith" />
              </div>
            </div>
            <div class="cd-field">
              <label for="cd-b-phone">Phone <span aria-hidden="true">*</span></label>
              <input id="cd-b-phone" type="tel" autocomplete="tel" placeholder="+44 7700 900000" />
            </div>
            <div class="cd-field">
              <label for="cd-b-email">Email</label>
              <input id="cd-b-email" type="email" autocomplete="email" placeholder="jane@example.com" />
            </div>
            <div class="cd-field" id="cd-b-treatment-field">
              <label for="cd-b-treatment">Treatment</label>
              <input id="cd-b-treatment" type="text" placeholder="e.g. Teeth whitening, Implant…" />
            </div>
            <div class="cd-field">
              <label for="cd-b-date">Preferred date</label>
              <input id="cd-b-date" type="date" />
            </div>
            <div class="cd-field">
              <label for="cd-b-msg">Message</label>
              <textarea id="cd-b-msg" placeholder="Anything else you'd like us to know…"></textarea>
            </div>
            <label class="cd-hp" aria-hidden="true">Leave blank <input id="cd-b-hp" type="text" tabindex="-1" autocomplete="off" /></label>
            <div class="cd-consent" id="cd-b-consent-wrap">
              <input id="cd-b-consent" type="checkbox" />
              <label for="cd-b-consent">I agree to be contacted about my enquiry. My data will be handled in accordance with the clinic's privacy policy.</label>
            </div>
            <button class="cd-submit" id="cd-b-submit">Send Booking Request</button>
            <div id="cd-b-form-error" class="cd-form-error" style="display:none"></div>
          </div>
          <div id="cd-book-thanks" style="display:none">
            <div class="cd-thankyou">
              <div class="cd-check">✓</div>
              <h2>Request received!</h2>
              <p>Thanks! We've received your booking request and will be in touch shortly.</p>
              <div id="cd-b-wa-wrap" style="display:none;width:100%">
                <div class="cd-or">or</div>
                <a id="cd-b-wa-link" class="cd-wa" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.854L.057 23.486a.5.5 0 0 0 .614.6l5.801-1.519A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.88 9.88 0 0 1-5.034-1.378l-.36-.214-3.742.981.999-3.648-.235-.374A9.857 9.857 0 0 1 2.118 12C2.118 6.534 6.534 2.118 12 2.118c5.464 0 9.882 4.416 9.882 9.882 0 5.464-4.418 9.882-9.882 9.882z"/></svg>
                  Message us on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact panel -->
        <div class="cd-panel" id="cd-panel-contact" role="tabpanel">
          <div id="cd-contact-content">
            <div class="cd-row" style="gap:12px;display:grid;grid-template-columns:1fr 1fr;margin-bottom:0">
              <div class="cd-field">
                <label for="cd-c-fname">First name <span aria-hidden="true">*</span></label>
                <input id="cd-c-fname" type="text" autocomplete="given-name" placeholder="Jane" />
              </div>
              <div class="cd-field">
                <label for="cd-c-lname">Last name</label>
                <input id="cd-c-lname" type="text" autocomplete="family-name" placeholder="Smith" />
              </div>
            </div>
            <div class="cd-field">
              <label for="cd-c-phone">Phone <span aria-hidden="true">*</span></label>
              <input id="cd-c-phone" type="tel" autocomplete="tel" placeholder="+44 7700 900000" />
            </div>
            <div class="cd-field">
              <label for="cd-c-email">Email</label>
              <input id="cd-c-email" type="email" autocomplete="email" placeholder="jane@example.com" />
            </div>
            <div class="cd-field">
              <label for="cd-c-msg">Message <span aria-hidden="true">*</span></label>
              <textarea id="cd-c-msg" placeholder="How can we help you?"></textarea>
            </div>
            <label class="cd-hp" aria-hidden="true">Leave blank <input id="cd-c-hp" type="text" tabindex="-1" autocomplete="off" /></label>
            <div class="cd-consent" id="cd-c-consent-wrap">
              <input id="cd-c-consent" type="checkbox" />
              <label for="cd-c-consent">I agree to be contacted about my enquiry. My data will be handled in accordance with the clinic's privacy policy.</label>
            </div>
            <button class="cd-submit" id="cd-c-submit">Send Message</button>
            <div id="cd-c-form-error" class="cd-form-error" style="display:none"></div>
          </div>
          <div id="cd-contact-thanks" style="display:none">
            <div class="cd-thankyou">
              <div class="cd-check">✓</div>
              <h2>Message received!</h2>
              <p>Thanks! We've received your message and will be in touch shortly.</p>
              <div id="cd-c-wa-wrap" style="display:none;width:100%">
                <div class="cd-or">or</div>
                <a id="cd-c-wa-link" class="cd-wa" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.854L.057 23.486a.5.5 0 0 0 .614.6l5.801-1.519A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.88 9.88 0 0 1-5.034-1.378l-.36-.214-3.742.981.999-3.648-.235-.374A9.857 9.857 0 0 1 2.118 12C2.118 6.534 6.534 2.118 12 2.118c5.464 0 9.882 4.416 9.882 9.882 0 5.464-4.418 9.882-9.882 9.882z"/></svg>
                  Message us on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
  shadow.appendChild(container);

  // ── 5. Element refs ─────────────────────────────────────────────────────────
  const $ = (id) => shadow.getElementById(id);

  const launcher    = $('cd-launcher');
  const overlay     = $('cd-overlay');
  const closeBtn    = $('cd-close');
  const clinicName  = $('cd-clinic-name');
  const tabBook     = $('cd-tab-book');
  const tabContact  = $('cd-tab-contact');
  const panelBook   = $('cd-panel-book');
  const panelContact = $('cd-panel-contact');

  // Book refs
  const bFname   = $('cd-b-fname');
  const bLname   = $('cd-b-lname');
  const bPhone   = $('cd-b-phone');
  const bEmail   = $('cd-b-email');
  const bTx      = $('cd-b-treatment');
  const bDate    = $('cd-b-date');
  const bMsg     = $('cd-b-msg');
  const bHp      = $('cd-b-hp');
  const bConsent = $('cd-b-consent');
  const bConsentWrap = $('cd-b-consent-wrap');
  const bSubmit  = $('cd-b-submit');
  const bFormErr = $('cd-b-form-error');
  const bContent = $('cd-book-content');
  const bThanks  = $('cd-book-thanks');
  const bWaWrap  = $('cd-b-wa-wrap');
  const bWaLink  = $('cd-b-wa-link');

  // Contact refs
  const cFname   = $('cd-c-fname');
  const cLname   = $('cd-c-lname');
  const cPhone   = $('cd-c-phone');
  const cEmail   = $('cd-c-email');
  const cMsg     = $('cd-c-msg');
  const cHp      = $('cd-c-hp');
  const cConsent = $('cd-c-consent');
  const cConsentWrap = $('cd-c-consent-wrap');
  const cSubmit  = $('cd-c-submit');
  const cFormErr = $('cd-c-form-error');
  const cContent = $('cd-contact-content');
  const cThanks  = $('cd-contact-thanks');
  const cWaWrap  = $('cd-c-wa-wrap');
  const cWaLink  = $('cd-c-wa-link');

  // ── 6. State ────────────────────────────────────────────────────────────────
  let config = null;

  // ── 7. Fetch config ─────────────────────────────────────────────────────────
  (async function init() {
    try {
      const res = await fetch(
        `${API_BASE}/api/widget/config?siteKey=${encodeURIComponent(siteKey)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return; // 403 or other — silently don't show widget
      config = await res.json();
      clinicName.textContent = config.clinicName || '';
      launcher.style.display = 'flex';

      // Replace treatment input with select if treatments list provided
      if (config.treatments && config.treatments.length > 0) {
        const field = $('cd-b-treatment-field');
        const sel = document.createElement('select');
        sel.id = 'cd-b-treatment';
        sel.innerHTML = '<option value="">Select treatment…</option>' +
          config.treatments.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
        field.replaceChild(sel, bTx);
      }
    } catch (e) {
      // Network error — silently degrade
    }
  })();

  // ── 8. Helpers ───────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resetPanels() {
    // Restore both panels to form-visible / thanks-hidden state.
    // Called every time the modal opens so a previous success screen never leaks through.
    bContent.style.display = '';
    bThanks.style.display  = 'none';
    cContent.style.display = '';
    cThanks.style.display  = 'none';
    bWaWrap.style.display  = 'none';
    cWaWrap.style.display  = 'none';
    hideFormError(bFormErr);
    hideFormError(cFormErr);
    [bFname, bPhone, bEmail].forEach(el => el.classList.remove('error'));
    [cFname, cPhone, cEmail, cMsg].forEach(el => el.classList.remove('error'));
    bConsentWrap.classList.remove('error');
    cConsentWrap.classList.remove('error');
    bConsent.classList.remove('error');
    cConsent.classList.remove('error');
  }

  function openModal() {
    resetPanels();
    switchTab('book');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    launcher.focus();
  }

  function switchTab(active) {
    const isBook = active === 'book';
    tabBook.classList.toggle('active', isBook);
    tabContact.classList.toggle('active', !isBook);
    tabBook.setAttribute('aria-selected', isBook ? 'true' : 'false');
    tabContact.setAttribute('aria-selected', isBook ? 'false' : 'true');
    panelBook.classList.toggle('active', isBook);
    panelContact.classList.toggle('active', !isBook);
  }

  function setError(el, wrap, on) {
    el.classList.toggle('error', on);
    if (wrap) wrap.classList.toggle('error', on);
  }

  function showFormError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideFormError(el) {
    el.style.display = 'none';
  }

  function isValidEmail(v) {
    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function showWhatsApp(waWrap, waLink) {
    if (config && config.showWhatsapp && config.whatsappPhone) {
      waLink.href = `https://wa.me/${config.whatsappPhone.replace(/\D/g, '')}`;
      waWrap.style.display = 'block';
    }
  }

  // ── 9. Events ────────────────────────────────────────────────────────────────
  launcher.style.display = 'none'; // hidden until config loads
  launcher.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });
  tabBook.addEventListener('click', () => switchTab('book'));
  tabContact.addEventListener('click', () => switchTab('contact'));

  // ── 10. Book submit ──────────────────────────────────────────────────────────
  bSubmit.addEventListener('click', async () => {
    if (!config) return;
    hideFormError(bFormErr);

    const firstName    = bFname.value.trim();
    const lastName     = bLname.value.trim();
    const phone        = bPhone.value.trim();
    const email        = bEmail.value.trim();
    const treatmentEl  = $('cd-b-treatment');
    const treatment    = treatmentEl ? treatmentEl.value.trim() : '';
    const preferredDate = bDate.value.trim();
    const message      = bMsg.value.trim();
    const honeypot     = bHp.value;
    const consent      = bConsent.checked;

    let valid = true;
    setError(bFname, null, !firstName);
    setError(bPhone, null, !phone);
    setError(bEmail, null, !isValidEmail(email));
    setError(bConsent, bConsentWrap, !consent);
    if (!firstName || !phone || !isValidEmail(email) || !consent) valid = false;

    if (!valid) {
      showFormError(bFormErr, 'Please fill in all required fields and accept the consent.');
      return;
    }

    bSubmit.disabled = true;
    bSubmit.textContent = 'Sending…';

    try {
      const res = await fetch(`${API_BASE}/api/widget/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey, firstName, lastName, phone, email,
          treatment, preferredDate, message, consent, _gotcha: honeypot,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          bContent.style.display = 'none';
          bThanks.style.display = 'block';
          showWhatsApp(bWaWrap, bWaLink);
          return;
        }
      }
      showFormError(bFormErr, 'Something went wrong. Please try again or call the clinic.');
    } catch (e) {
      showFormError(bFormErr, 'Something went wrong. Please try again or call the clinic.');
    } finally {
      bSubmit.disabled = false;
      bSubmit.textContent = 'Send Booking Request';
    }
  });

  // ── 11. Contact submit ───────────────────────────────────────────────────────
  cSubmit.addEventListener('click', async () => {
    if (!config) return;
    hideFormError(cFormErr);

    const firstName = cFname.value.trim();
    const lastName  = cLname.value.trim();
    const phone     = cPhone.value.trim();
    const email     = cEmail.value.trim();
    const message   = cMsg.value.trim();
    const honeypot  = cHp.value;
    const consent   = cConsent.checked;

    let valid = true;
    setError(cFname, null, !firstName);
    setError(cPhone, null, !phone);
    setError(cEmail, null, !isValidEmail(email));
    setError(cMsg, null, !message);
    setError(cConsent, cConsentWrap, !consent);
    if (!firstName || !phone || !message || !isValidEmail(email) || !consent) valid = false;

    if (!valid) {
      showFormError(cFormErr, 'Please fill in all required fields and accept the consent.');
      return;
    }

    cSubmit.disabled = true;
    cSubmit.textContent = 'Sending…';

    try {
      const res = await fetch(`${API_BASE}/api/widget/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey, firstName, lastName, phone, email, message, consent, _gotcha: honeypot,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          cContent.style.display = 'none';
          cThanks.style.display = 'block';
          showWhatsApp(cWaWrap, cWaLink);
          return;
        }
      }
      showFormError(cFormErr, 'Something went wrong. Please try again or call the clinic.');
    } catch (e) {
      showFormError(cFormErr, 'Something went wrong. Please try again or call the clinic.');
    } finally {
      cSubmit.disabled = false;
      cSubmit.textContent = 'Send Message';
    }
  });

})();
