/**
 * APPOINTMENTS ACTION HUD — HORIZONTAL CONTROLLER
 */

const AppointmentsHUD = {
    _activeId: null,
    _activeTrigger: null,
    _closer: null, // ✅ Stored so close() can always remove it

    toggle(triggerEl, aptId, status, patientId) {
        if (this._activeId === aptId) {
            this.close();
            return;
        }

        this.close();

        this._activeId = aptId;
        this._activeTrigger = triggerEl;
        triggerEl.classList.add('active');

        let panel = document.getElementById('aptActionPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'aptActionPanel';
            panel.className = 'appt-hud-panel';
            document.body.appendChild(panel);
        }

        const icons = {
            view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
            edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
            cancel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
        };

        const canCancel = status !== 'done';

        panel.innerHTML = `
            <button class="appt-btn-icon appt-btn-view" data-label="View" onclick="AppointmentsHUD.exec('view', '${aptId}', '${patientId}')">${icons.view}</button>
            <button class="appt-btn-icon appt-btn-edit" data-label="Edit" onclick="AppointmentsHUD.exec('edit', '${aptId}')">${icons.edit}</button>
            ${canCancel ? `<button class="appt-btn-icon appt-btn-cancel" data-label="Cancel" onclick="AppointmentsHUD.exec('cancel', '${aptId}')">${icons.cancel}</button>` : ''}
        `;

        const rect = triggerEl.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        panel.style.position = 'absolute';
        
        const btnCount = canCancel ? 3 : 2;
        const offset = btnCount * 40 + 20;
        
        panel.style.left = `${rect.left + scrollX - offset}px`;
        panel.style.top = `${rect.top + scrollY + rect.height / 2}px`;
        panel.style.right = 'auto';

        panel.classList.add('on');

        // ✅ FIX 2A: Store reference on object — close() removes it regardless of how dial was dismissed
        setTimeout(() => {
            this._closer = (e) => {
                if (!panel.contains(e.target) && !triggerEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('mousedown', this._closer);
        }, 10);
    },

    exec(action, aptId, patientId) {
        this.close();
        switch (action) {
            case 'view': 
                if (patientId) window.location.href = `../patients/patient-profile.html?id=${encodeURIComponent(patientId)}`;
                break;
            case 'edit': if (typeof editAppointment === 'function') editAppointment(aptId); break;
            case 'cancel': if (typeof cancelAppointment === 'function') cancelAppointment(aptId); break;
        }
    },

    close() {
        const panel = document.getElementById('aptActionPanel');
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

window.AppointmentsHUD = AppointmentsHUD;
