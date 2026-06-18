/**
 * PRESCRIPTION ACTION HUD — HORIZONTAL CONTROLLER
 * Manages the floating action bar for prescription records.
 */

const PrescriptionHUD = {
    _activeId: null,
    _activeTrigger: null,
    _closer: null, // ✅ Stored so close() can always remove it

    /**
     * Toggles the HUD for a specific prescription row
     */
    toggle(triggerEl, rxId, isLocked) {
        if (this._activeId === rxId) {
            this.close();
            return;
        }

        this.close(); // Close any existing one

        this._activeId = rxId;
        this._activeTrigger = triggerEl;
        triggerEl.classList.add('active');

        // Find or Create Panel
        let panel = document.getElementById('rxActionPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'rxActionPanel';
            panel.className = 'rx-hud-panel';
            document.body.appendChild(panel);
        }

        // SVGs for Actions
        const icons = {
            edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
            email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
            wapdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
            waauto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 1.5 1.5 0 0 1 .5 0z"/><path d="M3 21l1.9-1.9"/><path d="M12 7a5 5 0 0 1 5 5"/></svg>`,
            sms: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        };

        panel.innerHTML = `
            ${!isLocked ? `<button class="rx-btn-icon rx-btn-edit" data-label="Edit" onclick="PrescriptionHUD.exec('edit', '${rxId}')">${icons.edit}</button>` : ''}
            <button class="rx-btn-icon rx-btn-print" data-label="Print" onclick="PrescriptionHUD.exec('print', '${rxId}')">${icons.print}</button>
            <button class="rx-btn-icon rx-btn-email" data-label="Email" onclick="PrescriptionHUD.exec('email', '${rxId}')">${icons.email}</button>
            <button class="rx-btn-icon rx-btn-wapdf" data-label="WA PDF" onclick="PrescriptionHUD.exec('wapdf', '${rxId}')">${icons.wapdf}</button>
            <button class="rx-btn-icon rx-btn-waauto" data-label="WA Auto" onclick="PrescriptionHUD.exec('waauto', '${rxId}')">${icons.waauto}</button>
            <button class="rx-btn-icon rx-btn-sms" data-label="SMS" onclick="PrescriptionHUD.exec('sms', '${rxId}')">${icons.sms}</button>
            <button class="rx-btn-icon rx-btn-delete" data-label="Delete" onclick="PrescriptionHUD.exec('delete', '${rxId}')">${icons.delete}</button>
        `;

        const rect = triggerEl.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        panel.style.position = 'absolute';
        panel.style.left = `${rect.left + scrollX - (isLocked ? 250 : 295)}px`;
        panel.style.top = `${rect.top + scrollY + rect.height / 2}px`;
        panel.style.right = 'auto';

        panel.classList.add('on');

        // ✅ FIX 2E: Store reference on object — close() removes it regardless of how dial was dismissed
        // Click outside listener
        setTimeout(() => {
            this._closer = (e) => {
                if (!panel.contains(e.target) && !triggerEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('mousedown', this._closer);
        }, 10);
    },

    exec(action, rxId) {
        this.close();
        switch (action) {
            case 'edit': if (typeof editRx === 'function') editRx(rxId); break;
            case 'print': if (typeof printRx === 'function') printRx(rxId); break;
            case 'email': if (typeof shareRxEmail === 'function') shareRxEmail(rxId); break;
            case 'wapdf': if (typeof shareRxWhatsApp === 'function') shareRxWhatsApp(rxId); break;
            case 'waauto': if (typeof shareRxWhatsAppAuto === 'function') shareRxWhatsAppAuto(rxId); break;
            case 'sms': if (typeof shareRxSMS === 'function') shareRxSMS(rxId); break;
            case 'delete': if (typeof deleteRx === 'function') deleteRx(rxId); break;
        }
    },

    close() {
        const panel = document.getElementById('rxActionPanel');
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

window.PrescriptionHUD = PrescriptionHUD;
