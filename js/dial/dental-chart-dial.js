/**
 * PROCEDURE ROW HUD — ACTION CONTROLLER
 * Handles Delete and Print for individual table rows.
 * Updated: Diagonal expansion (yx / -yx), No glass overlay.
 */

class ProcedureRowHUD {
    constructor(id, isUnsaved = false) {
        this.id = id;
        this.isUnsaved = isUnsaved;
        this.wrapId = isUnsaved ? `hud-wrap-temp-${id}` : `hud-wrap-${id}`;
        this.wrap = document.getElementById(this.wrapId);
        
        if (!this.wrap) return;

        this.gear = this.wrap.querySelector('.ph-gear');
        this.isOpen = false;
        
        // Buttons spread (pixels from gear center)
        // yx and -yx direction = diagonal (Top-Right and Bottom-Left)
        this.spread = 32;
        this.buttons = [
            { type: 'print',  dx: this.spread, dy: -this.spread }, // Top-Right
            { type: 'delete', dx: this.spread, dy: this.spread }   // Bottom-Right
        ];
    }

    static closeActive() {
        if (window._activeProcedureHUD) {
            window._activeProcedureHUD.close();
        }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;
        ProcedureRowHUD.closeActive();
        
        this.isOpen = true;
        window._activeProcedureHUD = this;

        if (this.gear) this.gear.classList.add('active');

        this.buttons.forEach(({ type, dx, dy }) => {
            const btn = this.wrap.querySelector(`.ph-hud-btn.${type}`);
            if (btn) {
                // Apply diagonal expansion via transform
                // Initial state in CSS is translate(-50%, -50%) scale(0.5)
                btn.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
                btn.classList.add('on');
            }
        });

        // Click outside to close
        this._clickOutside = (e) => {
            if (!this.wrap.contains(e.target)) this.close();
        };
        setTimeout(() => document.addEventListener('click', this._clickOutside), 10);

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._escHandler);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        window._activeProcedureHUD = null;

        if (this.gear) this.gear.classList.remove('active');

        this.buttons.forEach(({ type }) => {
            const btn = this.wrap.querySelector(`.ph-hud-btn.${type}`);
            if (btn) {
                // Return to center
                btn.style.transform = `translate(-50%, -50%) scale(0.5)`;
                btn.classList.remove('on');
            }
        });

        if (this._clickOutside) document.removeEventListener('click', this._clickOutside);
        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    }
}

// Global toggle hook
window.toggleProcedureHUD = function(event, id, isUnsaved = false) {
    event.stopPropagation();
    
    // If clicking same gear that is open, just close it
    if (window._activeProcedureHUD && window._activeProcedureHUD.id === id && window._activeProcedureHUD.isUnsaved === isUnsaved) {
        window._activeProcedureHUD.close();
        return;
    }

    const hud = new ProcedureRowHUD(id, isUnsaved);
    hud.toggle();
};

/**
 * Global helper for HUD markup injection
 */
window.getProcedureHUDMarkup = function(id, isUnsaved = false) {
    const wrapId = isUnsaved ? `hud-wrap-temp-${id}` : `hud-wrap-${id}`;
    return `
        <div class="procedure-hud-wrap" id="${wrapId}">
            <div class="ph-gear" onclick="toggleProcedureHUD(event, '${id}', ${isUnsaved})" title="Actions">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div class="ph-hud-btn print" data-label="Print Invoice" onclick="printProcedureInvoice('${id}', ${isUnsaved})">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </div>
            <div class="ph-hud-btn delete" data-label="Delete" onclick="${isUnsaved ? `deleteUnsavedProcedure('${id}')` : `deleteProcedure('${id}')`}">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
        </div>
    `;
};
