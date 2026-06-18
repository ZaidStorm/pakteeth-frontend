/**
 * BILLING ACTION HUD — HORIZONTAL CONTROLLER
 */

const BillingHUD = {
    _activeId: null,
    _activeTrigger: null,
    _closer: null, // ✅ Stored so close() can always remove it

    toggle(triggerEl, invId, isPaid) {
        if (this._activeId === invId) {
            this.close();
            return;
        }

        this.close();

        this._activeId = invId;
        this._activeTrigger = triggerEl;
        triggerEl.classList.add('active');

        let panel = document.getElementById('billingActionPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'billingActionPanel';
            panel.className = 'bill-hud-panel';
            document.body.appendChild(panel);
        }

        const icons = {
            pay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
            print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
            email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
            wa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
            waauto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 1.5 1.5 0 0 1 .5 0z"/><path d="M3 21l1.9-1.9"/></svg>`,
            sms: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        };

        panel.innerHTML = `
            ${!isPaid ? `<button class="bill-btn-icon bill-btn-pay" data-label="Pay" onclick="BillingHUD.exec('pay', '${invId}')">${icons.pay}</button>` : ''}
            <button class="bill-btn-icon bill-btn-print" data-label="Print" onclick="BillingHUD.exec('print', '${invId}')">${icons.print}</button>
            <button class="bill-btn-icon bill-btn-email" data-label="Email" onclick="BillingHUD.exec('email', '${invId}')">${icons.email}</button>
            <button class="bill-btn-icon bill-btn-wa" data-label="WA PDF" onclick="BillingHUD.exec('wa', '${invId}')">${icons.wa}</button>
            <button class="bill-btn-icon bill-btn-waauto" data-label="WA Auto" onclick="BillingHUD.exec('waauto', '${invId}')">${icons.waauto}</button>
            <button class="bill-btn-icon bill-btn-sms" data-label="SMS" onclick="BillingHUD.exec('sms', '${invId}')">${icons.sms}</button>
            <button class="bill-btn-icon bill-btn-delete" data-label="Delete" onclick="BillingHUD.exec('delete', '${invId}')">${icons.delete}</button>
        `;

        const rect = triggerEl.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        panel.style.position = 'absolute';
        panel.style.left = `${rect.left + scrollX - (isPaid ? 250 : 335)}px`;
        panel.style.top = `${rect.top + scrollY + rect.height / 2}px`;
        panel.style.right = 'auto';

        panel.classList.add('on');

        // ✅ FIX 2B: Store reference on object — close() removes it regardless of how dial was dismissed
        setTimeout(() => {
            this._closer = (e) => {
                if (!panel.contains(e.target) && !triggerEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('mousedown', this._closer);
        }, 10);
    },

    exec(action, invId) {
        this.close();
        switch (action) {
            case 'pay': if (typeof openPaymentModal === 'function') openPaymentModal(invId); break;
            case 'print': if (typeof printInvoice === 'function') printInvoice(invId); break;
            case 'email': if (typeof shareInvoiceEmail === 'function') shareInvoiceEmail(invId); break;
            case 'wa': if (typeof shareInvoiceWhatsApp === 'function') shareInvoiceWhatsApp(invId); break;
            case 'waauto': if (typeof shareInvoiceWhatsAppAuto === 'function') shareInvoiceWhatsAppAuto(invId); break;
            case 'sms': if (typeof shareInvoiceSMS === 'function') shareInvoiceSMS(invId); break;
            case 'delete': if (typeof deleteInvoice === 'function') deleteInvoice(invId); break;
        }
    },

    close() {
        const panel = document.getElementById('billingActionPanel');
        if (panel) panel.classList.remove('on');
        if (this._activeTrigger) this._activeTrigger.classList.remove('active');
        // ✅ Always remove the outside-click listener — even when closed via button action
        if (this._closer) {
            document.removeEventListener('mousedown', this._closer);
            this._closer = null;
        }
        this._activeId = null;
        this._activeTrigger = null;
    }
};

window.BillingHUD = BillingHUD;
