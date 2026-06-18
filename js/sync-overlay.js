// js/sync-overlay.js
// Full-screen blocking overlay shown on ALL connected PCs during offline-queue sync.
// Phase 3 implementation — triggered by Socket.IO events from the server.
//
// Usage (automatic — socket-client.js triggers these):
//   SyncOverlay.show()   — blocks the UI
//   SyncOverlay.update(text, progress) — updates progress text
//   SyncOverlay.hide()   — unblocks the UI
//
// Load this BEFORE socket-client.js.

(function () {
    'use strict';

    // ── Build the overlay element once ────────────────────────────────────────
    let overlay = null;
    let progressBar = null;
    let statusText = null;
    let countText = null;

    function buildOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'pkt-sync-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999999',
            'display:none', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'background:rgba(10,12,22,0.93)',
            'backdrop-filter:blur(8px)',
            '-webkit-backdrop-filter:blur(8px)',
            'font-family:inherit', 'color:#fff',
            'text-align:center', 'padding:32px'
        ].join(';');

        overlay.innerHTML = `
            <!-- animated rings -->
            <div id="pkt-sync-rings" style="position:relative;width:100px;height:100px;margin-bottom:28px;">
                <div style="
                    position:absolute;inset:0;border-radius:50%;
                    border:3px solid transparent;
                    border-top-color:#6366f1;
                    animation:pkt-spin 1.2s linear infinite;
                "></div>
                <div style="
                    position:absolute;inset:8px;border-radius:50%;
                    border:3px solid transparent;
                    border-top-color:#8b5cf6;
                    animation:pkt-spin 1.8s linear infinite reverse;
                "></div>
                <div style="
                    position:absolute;inset:18px;border-radius:50%;
                    border:3px solid transparent;
                    border-top-color:#a78bfa;
                    animation:pkt-spin 2.4s linear infinite;
                "></div>
                <!-- tooth icon in centre -->
                <div style="
                    position:absolute;inset:0;display:flex;align-items:center;
                    justify-content:center;font-size:26px;
                ">🦷</div>
            </div>

            <h2 id="pkt-sync-title" style="
                font-size:1.5rem;font-weight:700;margin:0 0 8px 0;
                background:linear-gradient(135deg,#818cf8,#c4b5fd);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                background-clip:text;
            ">Syncing Data…</h2>

            <p id="pkt-sync-status" style="
                font-size:0.9rem;color:#94a3b8;margin:0 0 24px 0;
                max-width:380px;line-height:1.5;
            ">Please hold — offline changes are being pushed to the Main Server.</p>

            <p id="pkt-sync-count" style="
                font-size:0.8rem;color:#6366f1;margin:0 0 20px 0;
                font-weight:600;letter-spacing:0.5px;
            "></p>

            <!-- progress bar -->
            <div style="
                width:100%;max-width:360px;height:4px;
                background:rgba(99,102,241,0.2);border-radius:2px;overflow:hidden;
            ">
                <div id="pkt-sync-bar" style="
                    height:100%;width:0%;
                    background:linear-gradient(90deg,#6366f1,#8b5cf6);
                    border-radius:2px;transition:width 0.4s ease;
                "></div>
            </div>

            <p style="
                font-size:0.75rem;color:#475569;margin:20px 0 0 0;
            ">Do not close the application or make changes during sync.</p>
        `;

        // Inject keyframes
        if (!document.getElementById('pkt-sync-styles')) {
            const style = document.createElement('style');
            style.id = 'pkt-sync-styles';
            style.textContent = `
                @keyframes pkt-spin {
                    to { transform: rotate(360deg); }
                }
                #pkt-sync-overlay * {
                    box-sizing: border-box;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);

        progressBar = document.getElementById('pkt-sync-bar');
        statusText  = document.getElementById('pkt-sync-status');
        countText   = document.getElementById('pkt-sync-count');
    }

    // ── Public API ────────────────────────────────────────────────────────────

    const SyncOverlay = {

        /**
         * Show the blocking overlay on this PC.
         * Called when the server broadcasts 'sync:blocking'.
         *
         * @param {string} [message]  Optional custom status message
         */
        show(message) {
            buildOverlay();
            overlay.style.display = 'flex';
            if (message && statusText) statusText.textContent = message;
            if (progressBar) progressBar.style.width = '5%';
            console.log('[SYNC-OVERLAY] Shown');
        },

        /**
         * Update the status text and progress bar.
         *
         * @param {string} text       Status message
         * @param {number} [pct=0]   Progress percentage 0-100
         * @param {string} [count]   e.g. "Replaying 3 / 7"
         */
        update(text, pct, count) {
            buildOverlay();
            if (statusText && text) statusText.textContent = text;
            if (progressBar && pct !== undefined) {
                progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
            }
            if (countText && count !== undefined) {
                countText.textContent = count;
            }
        },

        /**
         * Hide the overlay and refresh the page data.
         * Called when the server broadcasts 'sync:unblock'.
         */
        hide(message) {
            if (!overlay) return;

            // Show 100% completion briefly before hiding
            if (progressBar) progressBar.style.width = '100%';
            if (statusText && message) statusText.textContent = message;

            setTimeout(() => {
                overlay.style.display = 'none';
                if (progressBar) progressBar.style.width = '0%';
                console.log('[SYNC-OVERLAY] Hidden — refreshing page data');
                // Trigger a data refresh on whatever page is open
                _refreshCurrentPage();
            }, 800);
        },

        /** Is the overlay currently visible? */
        isVisible() {
            return overlay ? overlay.style.display !== 'none' : false;
        }
    };

    function _refreshCurrentPage() {
        // Call common page reload functions if they exist on this page
        const candidates = [
            'loadAppointmentsData', 'loadPatients', 'loadInvoices',
            'loadData', 'loadReports', 'loadStaff', 'loadDashboardData',
            'loadSystemSettings', 'fetchCalendarAppointments',
            'loadPatientData', 'loadAnalyticsData'
        ];
        let called = false;
        for (const fn of candidates) {
            if (typeof window[fn] === 'function') {
                try { window[fn](); called = true; } catch (e) {}
            }
        }
        if (!called) {
            // Fallback: scroll to top to visually signal refresh
            window.scrollTo(0, 0);
        }
    }

    window.SyncOverlay = SyncOverlay;

    // Build overlay DOM when body is ready (lazy)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildOverlay);
    } else {
        buildOverlay();
    }

})();
