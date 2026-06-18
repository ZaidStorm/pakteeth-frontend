// js/network-status.js
// Renders a slim status bar at the bottom of every PakTeeth page.
// Shows whether this PC is the Main Server or a Client, and the live connection state.
// Must be loaded BEFORE socket-client.js.

(function () {
    'use strict';

    // ── Create the bar ──────────────────────────────────────────────────────
    function createBar() {
        const bar = document.createElement('div');
        bar.id = 'pakteeth-network-bar';
        bar.style.cssText = [
            'position:fixed', 'bottom:0', 'left:0', 'right:0',
            'height:26px', 'display:flex', 'align-items:center',
            'justify-content:space-between', 'padding:0 16px',
            'font-size:11px', 'font-family:inherit',
            'z-index:99999', 'background:#0e1117',
            'border-top:1px solid #1e2433', 'color:#6b7280',
            'transition:background 0.4s,border-color 0.4s',
            'user-select:none'
        ].join(';');

        bar.innerHTML = `
            <span id="pkt-net-left" style="display:flex;align-items:center;gap:7px;">
                <span id="pkt-net-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#374151;flex-shrink:0;transition:background 0.4s;"></span>
                <span id="pkt-net-mode" style="transition:color 0.4s;">Connecting…</span>
            </span>
            <span id="pkt-net-center" style="color:#374151;transition:color 0.4s;"></span>
            <span id="pkt-net-right" style="color:#374151;">
                <span id="pkt-net-clients"></span>
            </span>`;

        document.body.appendChild(bar);

        // Prevent content from being hidden behind the bar
        document.body.style.paddingBottom =
            (parseInt(document.body.style.paddingBottom) || 0) + 26 + 'px';

        return bar;
    }

    // Wait for DOM before attaching
    function init() {
        if (document.getElementById('pakteeth-network-bar')) return; // already exists
        createBar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Public API used by socket-client.js ─────────────────────────────────

    /**
     * Update the connection status indicator.
     * @param {'server-connected'|'client-connected'|'disconnected'|'reconnecting'} status
     * @param {object} [info]
     */
    window.updateNetworkBar = function (status, info = {}) {
        const dot    = document.getElementById('pkt-net-dot');
        const modeEl = document.getElementById('pkt-net-mode');
        const bar    = document.getElementById('pakteeth-network-bar');
        if (!dot || !modeEl || !bar) return;

        switch (status) {
            case 'server-connected':
                dot.style.background   = '#22c55e';
                bar.style.borderColor  = '#14532d44';
                modeEl.textContent     = `SERVER — ${info.ip || 'localhost'}:${info.port || 3000}`;
                modeEl.style.color     = '#22c55e';
                break;

            case 'client-connected':
                dot.style.background   = '#3b82f6';
                bar.style.borderColor  = '#1e3a5f44';
                modeEl.textContent     = `CLIENT — ${info.serverIP}:${info.port || 3000}`;
                modeEl.style.color     = '#3b82f6';
                break;

            case 'disconnected':
                dot.style.background   = '#ef4444';
                bar.style.background   = '#1a0a0a';
                bar.style.borderColor  = '#3b1111';
                modeEl.textContent     = 'DISCONNECTED — server unreachable';
                modeEl.style.color     = '#ef4444';
                window.updateNetworkCenter('Retrying…', '#ef4444');
                break;

            case 'reconnecting':
                dot.style.background   = '#f59e0b';
                modeEl.textContent     = 'Reconnecting to server…';
                modeEl.style.color     = '#f59e0b';
                break;
        }
    };

    window.updateNetworkClients = function (count) {
        const el = document.getElementById('pkt-net-clients');
        if (!el) return;
        el.textContent = (count !== undefined && count > 0)
            ? `${count} other PC${count > 1 ? 's' : ''} connected`
            : '';
    };

    window.updateNetworkCenter = function (text, color) {
        const el = document.getElementById('pkt-net-center');
        if (!el) return;
        el.textContent  = text || '';
        el.style.color  = color || '#374151';
    };
})();
