/**
 * APPOINTMENT ACTION HUD — HORIZONTAL CONTROLLER
 */

const AppointmentHUD = {
    _activeId: null,
    _activeTrigger: null,
    _closer: null, // ✅ Stored so close() can always remove it

    toggle(triggerEl, aptId, patientId) {
        if (this._activeId === aptId) {
            this.close();
            return;
        }

        this.close();

        this._activeId = aptId;
        this._activeTrigger = triggerEl;
        triggerEl.classList.add('active');

        let panel = document.getElementById('appointmentActionPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'appointmentActionPanel';
            panel.className = 'appt-hud-panel';
            document.body.appendChild(panel);
        }

        const icons = {
            view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
            wa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
            delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        };

        panel.innerHTML = `
            <button class="appt-btn-icon appt-btn-view" data-label="View Patient" onclick="AppointmentHUD.exec('view', '${patientId}', '${aptId}')">${icons.view}</button>
            <button class="appt-btn-icon appt-btn-wa" data-label="WhatsApp" onclick="AppointmentHUD.exec('wa', '${aptId}')">${icons.wa}</button>
            <button class="appt-btn-icon appt-btn-delete" data-label="Delete" onclick="AppointmentHUD.exec('delete', '${aptId}')">${icons.delete}</button>
        `;

        const rect = triggerEl.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        panel.style.position = 'absolute';
        // Positioned 140px to the left of the gear (panel is ~125px wide)
        panel.style.left = `${rect.left + scrollX - 140}px`;
        // Centered vertically with the gear icon
        panel.style.top = `${rect.top + scrollY + rect.height / 2}px`;
        panel.style.right = 'auto';

        panel.classList.add('on');

        // ✅ FIX 2C: Store reference on object — close() removes it regardless of how dial was dismissed
        setTimeout(() => {
            this._closer = (e) => {
                if (!panel.contains(e.target) && !triggerEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('mousedown', this._closer);
        }, 10);
    },

    exec(action, id1, id2) {
        this.close();
        switch (action) {
            case 'view': if (typeof openPatientProfile === 'function') openPatientProfile(id1); break;
            case 'wa': if (typeof sendWhatsApp === 'function') sendWhatsApp(id1); break;
            case 'delete': if (typeof deleteAppointment === 'function') deleteAppointment(id1); break;
        }
    },

    close() {
        const panel = document.getElementById('appointmentActionPanel');
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

window.AppointmentHUD = AppointmentHUD;
