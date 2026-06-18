// js/offline-queue.js
// Offline Request Queue for PakTeeth Multi-PC Sync
//
// When a Client PC loses connection to the Main Server, any POST/PUT/DELETE
// that fails with a network error is stored here in localStorage.
// When the socket reconnects, OfflineQueue.flush() is called automatically,
// which replays every queued request to the Main Server in order.
//
// Load this BEFORE core.js so the API wrapper can reference it.

(function () {
    'use strict';

    const STORAGE_KEY = 'pakteeth_offline_queue';

    const OfflineQueue = {

        // ── Public state ─────────────────────────────────────────────────────
        isFlushing: false,

        // ── Read/write queue ─────────────────────────────────────────────────

        /** Return the full queue array from localStorage. */
        getAll() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            } catch {
                return [];
            }
        },

        /** Persist the queue array to localStorage. */
        _save(queue) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
            } catch (e) {
                console.warn('[QUEUE] localStorage write failed:', e.message);
            }
        },

        /** Return the number of pending items in the queue. */
        count() {
            return this.getAll().length;
        },

        /** Check if there are any pending items. */
        hasPending() {
            return this.count() > 0;
        },

        // ── Add to queue ─────────────────────────────────────────────────────

        /**
         * Push a failed HTTP request into the queue.
         *
         * @param {string} method   'POST' | 'PUT' | 'DELETE'
         * @param {string} endpoint e.g. '/appointments'
         * @param {object|null} data  Request body (null for DELETE)
         * @param {string} [description]  Human-readable description for UI
         */
        push(method, endpoint, data, description) {
            const queue = this.getAll();
            const item = {
                id:          Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                method:      method.toUpperCase(),
                endpoint,
                data:        data || null,
                description: description || `${method} ${endpoint}`,
                queuedAt:    new Date().toISOString(),
                attempts:    0
            };
            queue.push(item);
            this._save(queue);
            console.log(`[QUEUE] Queued (total: ${queue.length}):`, item.description);
            this._updateBadge(queue.length);
            return item;
        },

        /** Remove a single item from the queue by id. */
        _remove(id) {
            const queue = this.getAll().filter(item => item.id !== id);
            this._save(queue);
            this._updateBadge(queue.length);
        },

        /** Clear the entire queue (used after successful flush). */
        clear() {
            localStorage.removeItem(STORAGE_KEY);
            this._updateBadge(0);
            console.log('[QUEUE] Cleared');
        },

        // ── Flush ─────────────────────────────────────────────────────────────

        /**
         * Replay all queued requests to the server.
         * Called automatically on socket reconnect.
         *
         * @param {string} serverBaseURL  e.g. 'http://192.168.1.5:3000'
         * @returns {Promise<{ succeeded: number, failed: number }>}
         */
        async flush(serverBaseURL) {
            if (this.isFlushing) return { succeeded: 0, failed: 0 };
            const queue = this.getAll();
            if (queue.length === 0) return { succeeded: 0, failed: 0 };

            this.isFlushing = true;
            console.log(`[QUEUE] Flushing ${queue.length} queued request(s) to ${serverBaseURL}…`);

            let succeeded = 0;
            let failed    = 0;

            for (const item of queue) {
                try {
                    item.attempts++;

                    const opts = {
                        method:  item.method,
                        headers: { 'Content-Type': 'application/json' }
                    };
                    if (item.data && item.method !== 'DELETE') {
                        opts.body = JSON.stringify(item.data);
                    }

                    const url = `${serverBaseURL}${item.endpoint}`;
                    const res = await fetch(url, opts);

                    if (res.ok) {
                        this._remove(item.id);
                        succeeded++;
                        console.log(`[QUEUE] ✓ Replayed: ${item.description}`);
                    } else {
                        // Server returned an error — keep in queue, log it
                        failed++;
                        console.warn(`[QUEUE] ✗ Server rejected (${res.status}): ${item.description}`);
                    }
                } catch (err) {
                    // Still offline — stop flushing, leave in queue
                    failed++;
                    console.warn(`[QUEUE] ✗ Network error replaying: ${item.description}`, err.message);
                    break;
                }
            }

            this.isFlushing = false;
            console.log(`[QUEUE] Flush complete — succeeded: ${succeeded}, failed: ${failed}`);
            return { succeeded, failed };
        },

        // ── UI helpers ─────────────────────────────────────────────────────────

        /**
         * Show a slim "Offline — saved locally" banner at the top of the page.
         * Auto-dismisses after 6 seconds.
         */
        showOfflineBanner(count) {
            // Remove existing banner
            const old = document.getElementById('pkt-offline-banner');
            if (old) old.remove();

            const banner = document.createElement('div');
            banner.id = 'pkt-offline-banner';
            banner.style.cssText = [
                'position:fixed', 'top:0', 'left:0', 'right:0',
                'padding:10px 20px', 'z-index:999999',
                'background:linear-gradient(90deg,#7c3aed,#4f46e5)',
                'color:#fff', 'font-size:13px', 'font-weight:500',
                'display:flex', 'align-items:center', 'justify-content:space-between',
                'gap:12px', 'box-shadow:0 2px 12px rgba(79,70,229,0.4)',
                'animation:pkt-slide-down 0.3s ease'
            ].join(';');

            // Inject animation if not present
            if (!document.getElementById('pkt-queue-styles')) {
                const style = document.createElement('style');
                style.id = 'pkt-queue-styles';
                style.textContent = `
                    @keyframes pkt-slide-down {
                        from { transform: translateY(-100%); opacity: 0; }
                        to   { transform: translateY(0);     opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }

            const msg = document.createElement('span');
            msg.innerHTML = `
                <svg style="vertical-align:middle;margin-right:8px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M1 6s4-2 11-2 11 2 11 2"/>
                    <path d="M1 12s4-2 11-2 11 2 11 2"/>
                    <line x1="1" y1="18" x2="23" y2="18"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <strong>Network offline.</strong> &nbsp;${count} change${count > 1 ? 's' : ''} saved locally — will sync when connection restores.`;

            const close = document.createElement('button');
            close.textContent = '✕';
            close.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-size:16px;opacity:0.7;padding:0 4px;';
            close.onclick = () => banner.remove();

            banner.appendChild(msg);
            banner.appendChild(close);
            document.body.prepend(banner);

            // Auto-dismiss after 6s
            setTimeout(() => { if (banner.parentNode) banner.remove(); }, 6000);
        },

        /** Update the pending-count badge on the network status bar (if shown). */
        _updateBadge(count) {
            if (typeof window.updateNetworkCenter === 'function') {
                if (count > 0) {
                    window.updateNetworkCenter(`${count} pending sync`, '#f59e0b');
                } else {
                    window.updateNetworkCenter('');
                }
            }
        }
    };

    // Expose globally
    window.OfflineQueue = OfflineQueue;

    // On page load — show badge if there are already pending items
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const n = OfflineQueue.count();
            if (n > 0) OfflineQueue._updateBadge(n);
        });
    } else {
        const n = OfflineQueue.count();
        if (n > 0) OfflineQueue._updateBadge(n);
    }

})();
