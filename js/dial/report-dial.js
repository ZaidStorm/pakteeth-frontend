/**
 * REPORT ACTION HUD — HORIZONTAL CONTROLLER
 */

const ReportHUD = {
    _activeId: null,
    _activeTrigger: null,
    _closer: null, // ✅ Stored so close() can always remove it

    toggle(triggerEl, reportId, isComparing) {
        if (this._activeId === reportId) {
            this.close();
            return;
        }

        this.close();

        this._activeId = reportId;
        this._activeTrigger = triggerEl;
        triggerEl.classList.add('active');

        let panel = document.getElementById('reportActionPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'reportActionPanel';
            panel.className = 'report-hud-panel';
            document.body.appendChild(panel);
        }

        const icons = {
            view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
            edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            compare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isComparing ? '<line x1="5" y1="12" x2="19" y2="12"></line>' : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'}</svg>`,
            delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        };

        panel.innerHTML = `
            <button class="report-btn-icon report-btn-view" data-label="View" onclick="ReportHUD.exec('view', '${reportId}')">${icons.view}</button>
            <button class="report-btn-icon report-btn-edit" data-label="Edit" onclick="ReportHUD.exec('edit', '${reportId}')">${icons.edit}</button>
            <button class="report-btn-icon report-btn-compare" data-label="${isComparing ? 'Remove Compare' : 'Add Compare'}" onclick="ReportHUD.exec('compare', '${reportId}')">${icons.compare}</button>
            <button class="report-btn-icon report-btn-delete" data-label="Delete" onclick="ReportHUD.exec('delete', '${reportId}')">${icons.delete}</button>
        `;

        const rect = triggerEl.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        panel.style.position = 'absolute';
        panel.style.left = `${rect.left + scrollX - 175}px`;
        panel.style.top = `${rect.top + scrollY + rect.height / 2}px`;
        panel.style.right = 'auto';

        panel.classList.add('on');

        // ✅ FIX 2D: Store reference on object — close() removes it regardless of how dial was dismissed
        setTimeout(() => {
            this._closer = (e) => {
                if (!panel.contains(e.target) && !triggerEl.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('mousedown', this._closer);
        }, 10);
    },

    exec(action, reportId) {
        this.close();
        switch (action) {
            case 'view': if (typeof previewReport === 'function') previewReport(reportId); break;
            case 'edit': if (typeof editReport === 'function') editReport(reportId); break;
            case 'compare': if (typeof toggleCompare === 'function') toggleCompare(reportId); break;
            case 'delete': if (typeof deleteReport === 'function') deleteReport(reportId); break;
        }
    },

    close() {
        const panel = document.getElementById('reportActionPanel');
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

window.ReportHUD = ReportHUD;
