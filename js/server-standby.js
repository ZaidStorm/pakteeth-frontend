// js/server-standby.js
// Full-screen standby / kicked overlay for PakTeeth client PCs.
// Must be loaded BEFORE socket-client.js.
// Public API:
//   ServerStandby.show()          — server went offline, show "waiting" screen
//   ServerStandby.showKicked()    — kicked by server admin
//   ServerStandby.hide()          — server came back, hide and resume

(function () {
    'use strict';

    let overlay = null;
    let countdownInterval = null;
    let retrySeconds = 0;

    // ── Build the overlay DOM ──────────────────────────────────────────────
    function buildOverlay() {
        if (document.getElementById('pkt-standby-overlay')) return;

        const el = document.createElement('div');
        el.id = 'pkt-standby-overlay';
        el.style.cssText = [
            'display:none',
            'position:fixed', 'inset:0',
            'z-index:9999999',
            'background:linear-gradient(135deg, #080f1a 0%, #0d1b2e 50%, #111827 100%)',
            'display:none',
            'align-items:center',
            'justify-content:center',
            'flex-direction:column',
            'gap:0px',
            'font-family:inherit',
            'user-select:none',
            'backdrop-filter:blur(0px)',
        ].join(';');

        el.innerHTML = `
            <style>
                @keyframes pkt-pulse-ring {
                    0%   { transform: scale(0.9); opacity: 0.7; }
                    50%  { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.9); opacity: 0.7; }
                }
                @keyframes pkt-dot-bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40%           { transform: translateY(-10px); opacity: 1; }
                }
                @keyframes pkt-slide-up {
                    from { opacity: 0; transform: translateY(30px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                #pkt-standby-overlay .pkt-sb-card {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px;
                    padding: 52px 60px;
                    text-align: center;
                    max-width: 480px;
                    width: 90%;
                    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
                    animation: pkt-slide-up 0.5s ease both;
                    backdrop-filter: blur(20px);
                }
                #pkt-standby-overlay .pkt-sb-icon-ring {
                    width: 90px; height: 90px;
                    border-radius: 50%;
                    background: rgba(239,68,68,0.15);
                    border: 2px solid rgba(239,68,68,0.4);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 28px;
                    animation: pkt-pulse-ring 2.5s ease-in-out infinite;
                }
                #pkt-standby-overlay .pkt-sb-icon-ring.kicked {
                    background: rgba(245,158,11,0.15);
                    border-color: rgba(245,158,11,0.4);
                    animation: none;
                }
                #pkt-standby-overlay .pkt-sb-title {
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #f1f5f9;
                    margin-bottom: 10px;
                    letter-spacing: -0.02em;
                }
                #pkt-standby-overlay .pkt-sb-subtitle {
                    font-size: 0.95rem;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin-bottom: 32px;
                }
                #pkt-standby-overlay .pkt-sb-server-ip {
                    display: inline-block;
                    background: rgba(59,130,246,0.12);
                    border: 1px solid rgba(59,130,246,0.3);
                    color: #60a5fa;
                    border-radius: 8px;
                    padding: 6px 14px;
                    font-size: 0.85rem;
                    font-family: monospace;
                    margin-bottom: 32px;
                }
                #pkt-standby-overlay .pkt-sb-dots {
                    display: flex; gap: 8px;
                    justify-content: center;
                    margin-bottom: 28px;
                }
                #pkt-standby-overlay .pkt-sb-dots span {
                    width: 10px; height: 10px;
                    border-radius: 50%;
                    background: #ef4444;
                    animation: pkt-dot-bounce 1.4s ease-in-out infinite both;
                }
                #pkt-standby-overlay .pkt-sb-dots.kicked span { background: #f59e0b; }
                #pkt-standby-overlay .pkt-sb-dots span:nth-child(2) { animation-delay: 0.2s; }
                #pkt-standby-overlay .pkt-sb-dots span:nth-child(3) { animation-delay: 0.4s; }
                #pkt-standby-overlay .pkt-sb-retry {
                    font-size: 0.8rem;
                    color: #475569;
                }
                #pkt-standby-overlay .pkt-sb-retry strong { color: #64748b; }
                #pkt-standby-overlay .pkt-sb-dismissed-btn {
                    margin-top: 24px;
                    padding: 10px 28px;
                    border-radius: 10px;
                    background: rgba(245,158,11,0.15);
                    border: 1px solid rgba(245,158,11,0.4);
                    color: #fbbf24;
                    font-size: 0.9rem;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                    display: none;
                }
                #pkt-standby-overlay .pkt-sb-dismissed-btn:hover {
                    background: rgba(245,158,11,0.25);
                }
                #pkt-standby-overlay .pkt-sb-config-btn {
                    margin-top: 16px;
                    padding: 10px 28px;
                    border-radius: 10px;
                    background: rgba(16, 185, 129, 0.15);
                    border: 1px solid rgba(16, 185, 129, 0.4);
                    color: #34d399;
                    font-size: 0.9rem;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                    display: inline-block;
                    margin-left: 8px;
                }
                #pkt-standby-overlay .pkt-sb-config-btn:hover {
                    background: rgba(16, 185, 129, 0.25);
                }
            </style>

            <div class="pkt-sb-card">
                <div class="pkt-sb-icon-ring" id="pkt-sb-ring">
                    <!-- Icon swapped per mode -->
                    <svg id="pkt-sb-icon-offline" xmlns="http://www.w3.org/2000/svg" width="38" height="38"
                        viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
                        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                        <line x1="12" y1="20" x2="12.01" y2="20"/>
                    </svg>
                    <svg id="pkt-sb-icon-kicked" xmlns="http://www.w3.org/2000/svg" width="38" height="38"
                        viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" style="display:none">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>

                <div class="pkt-sb-title" id="pkt-sb-title">Server Offline</div>
                <div class="pkt-sb-subtitle" id="pkt-sb-subtitle">
                    The Main Server is unreachable.<br>
                    This screen will automatically unlock when the server comes back online.
                </div>

                <div class="pkt-sb-server-ip" id="pkt-sb-ip">Loading server address…</div>

                <div class="pkt-sb-dots" id="pkt-sb-dots">
                    <span></span><span></span><span></span>
                </div>

                <div class="pkt-sb-retry" id="pkt-sb-retry-text">
                    Next reconnect attempt in <strong id="pkt-sb-countdown">—</strong>s
                </div>

                <div style="margin-top: 24px;">
                    <button class="pkt-sb-dismissed-btn" id="pkt-sb-dismiss-btn"
                        onclick="window.location.reload()" style="display:inline-block; margin-top:0;">
                        Refresh Page
                    </button>
                    <button class="pkt-sb-config-btn" id="pkt-sb-config-btn"
                        onclick="pktPromptBackendURL()">
                        Configure Server URL
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(el);
        overlay = el;

        // Fill server IP from config
        _updateServerIP();
    }

    function _updateServerIP() {
        const ipEl = document.getElementById('pkt-sb-ip');
        if (!ipEl) return;
        const cfg = window.PAKTEETH_CONFIG;
        if (cfg && !cfg.isServerMode && cfg.serverIP) {
            ipEl.textContent = `${cfg.serverIP}:${cfg.serverPort || 3000}`;
        } else if (cfg && cfg.serverBaseURL) {
            ipEl.textContent = cfg.serverBaseURL;
        } else {
            ipEl.textContent = window.API_BASE || window.location.origin;
        }
    }

    function _setOfflineMode() {
        const ring  = document.getElementById('pkt-sb-ring');
        const dots  = document.getElementById('pkt-sb-dots');
        const retry = document.getElementById('pkt-sb-retry-text');
        const btn   = document.getElementById('pkt-sb-dismissed-btn');
        const title = document.getElementById('pkt-sb-title');
        const sub   = document.getElementById('pkt-sb-subtitle');
        const iconOff    = document.getElementById('pkt-sb-icon-offline');
        const iconKicked = document.getElementById('pkt-sb-icon-kicked');

        if (ring)       { ring.classList.remove('kicked'); }
        if (dots)       { dots.classList.remove('kicked'); }
        if (iconOff)    iconOff.style.display = '';
        if (iconKicked) iconKicked.style.display = 'none';
        if (title)      title.textContent = 'Server Offline';
        if (sub)        sub.innerHTML = 'The Main Server is unreachable.<br>This screen will automatically unlock when the server comes back online.';
        if (retry)      retry.style.display = '';
        if (btn)        btn.style.display = 'none';
    }

    function _setKickedMode() {
        const ring  = document.getElementById('pkt-sb-ring');
        const dots  = document.getElementById('pkt-sb-dots');
        const retry = document.getElementById('pkt-sb-retry-text');
        const btn   = document.getElementById('pkt-sb-dismissed-btn');
        const title = document.getElementById('pkt-sb-title');
        const sub   = document.getElementById('pkt-sb-subtitle');
        const iconOff    = document.getElementById('pkt-sb-icon-offline');
        const iconKicked = document.getElementById('pkt-sb-icon-kicked');

        if (ring)       { ring.classList.add('kicked'); }
        if (dots)       { dots.classList.add('kicked'); }
        if (iconOff)    iconOff.style.display = 'none';
        if (iconKicked) iconKicked.style.display = '';
        if (title)      title.textContent = 'Access Removed';
        if (sub)        sub.innerHTML = 'You have been disconnected by the Main Server administrator.<br><br>Please contact your admin to regain access.';
        if (retry)      retry.style.display = 'none';
        if (btn)        btn.style.display = '';
    }

    // ── Countdown timer ────────────────────────────────────────────────────
    function _startCountdown(seconds) {
        _clearCountdown();
        retrySeconds = seconds || 10;
        const el = document.getElementById('pkt-sb-countdown');
        if (el) el.textContent = retrySeconds;

        countdownInterval = setInterval(() => {
            retrySeconds--;
            if (el) el.textContent = Math.max(0, retrySeconds);
            if (retrySeconds <= 0) _clearCountdown();
        }, 1000);
    }

    function _clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────
    window.ServerStandby = {

        /**
         * Show the standby overlay (server went offline).
         * @param {number} [nextRetryMs] - milliseconds until next socket reconnect attempt
         */
        show(nextRetryMs) {
            buildOverlay();
            _setOfflineMode();
            _updateServerIP();
            overlay.style.display = 'flex';
            _startCountdown(nextRetryMs ? Math.round(nextRetryMs / 1000) : 5);
        },

        /** Reset countdown when a reconnect attempt fires. */
        resetCountdown(nextRetryMs) {
            _startCountdown(nextRetryMs ? Math.round(nextRetryMs / 1000) : 5);
        },

        /**
         * Show the "kicked by admin" variant of the overlay.
         * Does NOT auto-hide on reconnect — the socket should also be prevented from reconnecting.
         */
        showKicked() {
            buildOverlay();
            _setKickedMode();
            _updateServerIP();
            overlay.style.display = 'flex';
            _clearCountdown();
        },

        /** Hide the overlay — server is back online. */
        hide() {
            _clearCountdown();
            if (overlay) overlay.style.display = 'none';
        }
    };

    // Prompt for custom backend URL when offline/standby
    window.pktPromptBackendURL = function() {
        const current = localStorage.getItem("PAKTEETH_BACKEND_URL") || "";
        const res = prompt("Enter PakTeeth Backend Server URL (e.g. https://pakteeth-backend.onrender.com):\nLeave empty to reset to default origin.", current);
        if (res === null) return; // Cancelled
        const url = res.trim();
        if (!url) {
            localStorage.removeItem("PAKTEETH_BACKEND_URL");
            alert("Reset to default backend URL. Reloading...");
            window.location.reload();
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            alert("URL must start with http:// or https://");
            return;
        }
        const finalUrl = url.endsWith("/") ? url.slice(0, -1) : url;
        localStorage.setItem("PAKTEETH_BACKEND_URL", finalUrl);
        alert("Backend URL updated to: " + finalUrl + "\nReloading page...");
        window.location.reload();
    };

})();
