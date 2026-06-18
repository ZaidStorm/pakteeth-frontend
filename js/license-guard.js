/**
 * PakTeeth License Guard — Frontend Overlay
 * ─────────────────────────────────────────────────────────────────────────────
 * Injected into every HTML page. Polls /license/status every 60 seconds.
 *
 * States:
 *   isNormal  (days < 105) → nothing shown, full access
 *   isWarning (105–119)    → amber banner, no restriction
 *   isLocked  (days ≥ 120) → full-screen overlay, all controls disabled
 *
 * Owner: CH M Zaid  |  +92 300 8904153
 */
(function () {
    "use strict";

    const OWNER   = { name: "CH M Zaid", phone: "+92 300 8904153" };
    const POLL_MS = 60_000; // check every 60 seconds

    let overlayEl = null;
    let bannerEl  = null;

    // ─── STATUS CHECK ────────────────────────────────────────────────────────
    async function checkStatus() {
        // In web/Vercel mode with no backend configured, skip silently.
        const _hasBackend = !!window.PAKTEETH_CONFIG ||
            !!localStorage.getItem("PAKTEETH_BACKEND_URL") ||
            window.location.protocol === 'file:';
        if (!_hasBackend) return false;

        try {
            const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : (localStorage.getItem("PAKTEETH_BACKEND_URL") || '');
            const r = await fetch(`${baseUrl}/license/status`);
            if (!r.ok) return false; // server unreachable — leave current state
            const s = await r.json();

            if (s.isLocked)       showLockScreen(s);
            else if (s.isWarning) showWarningBanner(s);
            else                  clearAll();

            // First run check - show welcome banner only once if the system has never used a password
            if (!s.isLocked && s.periodsUsed === 0 && !localStorage.getItem("lk_first_run_shown")) {
                localStorage.setItem("lk_first_run_shown", "1");
                showWelcomeOverlay(
                    "Welcome to PakTeeth", 
                    `Software activated on ${s.activatedAt}`
                );
            }
            return true;
        } catch {
            /* Network error — leave current UI state, don't crash */
            return false;
        }
    }

    // ─── LOCK SCREEN ─────────────────────────────────────────────────────────
    function showLockScreen(status) {
        clearBanner();
        disableInteractions(true);
        if (overlayEl) {
            // Already showing — just refresh the day count if visible
            const daysEl = overlayEl.querySelector("#lk-days-overdue");
            if (daysEl) daysEl.textContent = Math.abs(status.daysLeft);
            return;
        }

        overlayEl = document.createElement("div");
        overlayEl.id = "license-lock-overlay";

        // Prevent any interaction with the page underneath
        Object.assign(overlayEl.style, {
            position:    "fixed",
            inset:       "0",
            zIndex:      "999999",
            display:     "flex",
            alignItems:  "center",
            justifyContent: "center",
            background:  "rgba(8, 8, 20, 0.93)",
            backdropFilter: "blur(6px)",
            fontFamily:  "Inter, system-ui, sans-serif",
        });

        overlayEl.innerHTML = `
            <div style="
                background:#fff;
                border-radius:20px;
                padding:48px 52px;
                max-width:460px;
                width:92%;
                text-align:center;
                box-shadow:0 32px 80px rgba(0,0,0,0.45);
                border:1px solid rgba(255,255,255,0.12);
            ">
                <!-- Lock Icon -->
                <div style="
                    width:72px; height:72px; margin:0 auto 20px;
                    background:linear-gradient(135deg,#1a1a2e,#16213e);
                    border-radius:50%;
                    display:flex; align-items:center; justify-content:center;
                    box-shadow:0 8px 24px rgba(24,95,165,0.35);
                ">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                        stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>

                <!-- Title -->
                <h2 style="margin:0 0 8px; font-size:22px; font-weight:600;
                    color:#0d0d1a; letter-spacing:-0.3px;">
                    Maintenance Required
                </h2>
                <p style="margin:0 0 28px; color:#4a4a6a; font-size:14px; line-height:1.6;">
                    This system has reached its 1&#8209;month maintenance limit.<br>
                    All actions are suspended until the developer unlocks the system.
                </p>

                <!-- Developer Contact Card -->
                <div style="
                    background:linear-gradient(135deg,#f4f7fb,#edf1f8);
                    border:1px solid #d1dbe8;
                    border-radius:12px;
                    padding:18px 20px;
                    margin-bottom:28px;
                    text-align:left;
                ">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                        <div style="
                            width:36px; height:36px; border-radius:50%;
                            background:linear-gradient(135deg,#185FA5,#0d3d6e);
                            display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div>
                            <div style="font-weight:600; font-size:15px; color:#0d0d1a;">
                                ${OWNER.name}
                            </div>
                            <div style="font-size:12px; color:#6b7280;">Developer &amp; System Engineer</div>
                        </div>
                    </div>
                    <div style="
                        display:flex; align-items:center; gap:8px;
                        padding:8px 10px; background:#fff;
                        border:1px solid #d1dbe8; border-radius:8px; margin-top:10px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="#185FA5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07
                                     19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3
                                     a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91
                                     a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7
                                     A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span style="font-size:14px; font-weight:500; color:#0d0d1a;
                            letter-spacing:0.5px; font-family:monospace;">
                            ${OWNER.phone}
                        </span>
                    </div>
                </div>

                <!-- Password Input -->
                <div style="text-align:left; margin-bottom:6px;">
                    <label style="font-size:13px; font-weight:500; color:#374151;
                        display:block; margin-bottom:6px;">
                        Maintenance Password
                    </label>
                    <input id="lk-pw-input"
                        type="password"
                        placeholder="xxxx-xxxx-xxxx-xxxx-PakTeeth"
                        autocomplete="off"
                        style="
                            width:100%; box-sizing:border-box;
                            padding:11px 14px;
                            border:1.5px solid #d1d5db;
                            border-radius:9px;
                            font-size:13.5px;
                            font-family:monospace;
                            color:#0d0d1a;
                            background:#fafafa;
                            outline:none;
                            transition:border-color 0.2s;
                        "
                        onfocus="this.style.borderColor='#185FA5'"
                        onblur="this.style.borderColor='#d1d5db'"
                        onkeydown="if(event.key==='Enter') document.getElementById('lk-pw-btn').click()"
                    />
                </div>

                <!-- Unlock Button -->
                <button id="lk-pw-btn"
                    style="
                        width:100%;
                        padding:12px;
                        background:linear-gradient(135deg,#185FA5,#0d4a83);
                        color:#fff;
                        border:none;
                        border-radius:9px;
                        font-size:14px;
                        font-weight:600;
                        cursor:pointer;
                        margin-top:4px;
                        letter-spacing:0.3px;
                        transition:opacity 0.2s;
                    "
                    onmouseover="this.style.opacity='0.9'"
                    onmouseout="this.style.opacity='1'"
                >
                    Unlock System
                </button>

                <!-- Status Message -->
                <p id="lk-pw-msg" style="
                    margin:10px 0 0;
                    font-size:13px;
                    min-height:18px;
                    color:#c0392b;
                    text-align:center;
                "></p>

                <!-- Footer -->
                <p style="margin:18px 0 0; font-size:11.5px; color:#9ca3af; line-height:1.5;">
                    PakTeeth is in read-only mode.<br>
                    Data is safe. No records can be edited until unlocked.
                </p>
            </div>`;

        document.body.appendChild(overlayEl);

        // ── Unlock button handler ──
        document.getElementById("lk-pw-btn").addEventListener("click", async () => {
            const btn = document.getElementById("lk-pw-btn");
            const pw  = document.getElementById("lk-pw-input").value.trim();
            const msg = document.getElementById("lk-pw-msg");

            if (!pw) {
                msg.style.color = "#c0392b";
                msg.textContent = "Please enter the maintenance password.";
                return;
            }

            btn.disabled    = true;
            btn.textContent = "Verifying…";
            msg.textContent = "";

            try {
                const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
                const res  = await fetch(`${baseUrl}/license/unlock`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ password: pw }),
                });
                const data = await res.json();

                if (data.success) {
                    msg.style.color  = "#16a34a";
                    msg.textContent  = `✓ System unlocked. Reloading…`;
                    btn.textContent  = "Unlocked!";
                    
                    showWelcomeOverlay(
                        "License Activated",
                        `Activated using Period ${data.period}. Welcome back to PakTeeth!`
                    );
                    
                    // Reload the page shortly after the success overlay fades in
                    setTimeout(() => location.reload(), 3600);
                } else if (data.reason === "already_used") {
                    msg.style.color  = "#b45309";
                    msg.textContent  = "This password has already been used. Please request a new one.";
                    btn.disabled     = false;
                    btn.textContent  = "Unlock System";
                    document.getElementById("lk-pw-input").value = "";
                } else {
                    msg.style.color  = "#c0392b";
                    msg.textContent  = "Incorrect password. Please check and try again.";
                    btn.disabled     = false;
                    btn.textContent  = "Unlock System";
                    document.getElementById("lk-pw-input").value = "";
                    document.getElementById("lk-pw-input").focus();
                }
            } catch {
                msg.style.color  = "#c0392b";
                msg.textContent  = "Connection error. Please try again.";
                btn.disabled     = false;
                btn.textContent  = "Unlock System";
            }
        });
    }

    // ─── WARNING BANNER ───────────────────────────────────────────────────────
    function showWarningBanner(status) {
        if (bannerEl) {
            // Update day count in existing banner
            const daysEl = bannerEl.querySelector("#lk-days-left");
            if (daysEl) daysEl.textContent = status.daysLeft;
            return;
        }

        bannerEl = document.createElement("div");
        bannerEl.id = "license-warning-banner";

        Object.assign(bannerEl.style, {
            position:    "sticky",
            top:         "0",
            zIndex:      "99998",
            background:  "linear-gradient(90deg,#fef3c7,#fde68a)",
            borderBottom: "1px solid #f59e0b",
            padding:     "10px 20px",
            display:     "flex",
            alignItems:  "center",
            justifyContent: "space-between",
            fontFamily:  "Inter, system-ui, sans-serif",
            fontSize:    "13px",
            color:       "#78350f",
        });

        bannerEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#b45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>
                    <strong>Maintenance due in <span id="lk-days-left">${status.daysLeft}</span> day(s).</strong>
                    &nbsp;Contact <strong>${OWNER.name}</strong> — ${OWNER.phone} to renew before the system locks.
                </span>
            </div>
            <button id="lk-banner-close"
                style="
                    background:none; border:none; cursor:pointer;
                    font-size:18px; color:#78350f; line-height:1;
                    padding:0 4px; flex-shrink:0;
                "
                title="Dismiss (reappears on next page load)"
            >&#x2715;</button>`;

        document.body.prepend(bannerEl);

        document.getElementById("lk-banner-close").addEventListener("click", () => {
            if (bannerEl) { bannerEl.remove(); bannerEl = null; }
        });
    }

    // ─── READ-ONLY MODE ───────────────────────────────────────────────────────
    function disableInteractions(disabled) {
        // Disable everything except the lock overlay's own inputs and buttons
        const sel = [
            "button:not(#lk-pw-btn):not(#lk-banner-close)",
            "input:not(#lk-pw-input)",
            "select",
            "textarea",
            "a[href]",
        ].join(",");

        document.querySelectorAll(sel).forEach(el => {
            if (disabled) {
                el.setAttribute("data-lk-disabled", "1");
                el.disabled         = true;
                el.style.pointerEvents = "none";
                el.style.opacity    = "0.45";
            } else {
                if (el.getAttribute("data-lk-disabled") === "1") {
                    el.removeAttribute("data-lk-disabled");
                    el.disabled         = false;
                    el.style.pointerEvents = "";
                    el.style.opacity    = "";
                }
            }
        });
    }

    // ─── WELCOME OVERLAYS ─────────────────────────────────────────────────────
    function showWelcomeOverlay(title, subtitle) {
        if (overlayEl) {
            // If the lock screen is currently shown, transform it beautifully into the welcome screen
            overlayEl.innerHTML = `
                <div style="text-align:center; color:#fff; transition: opacity 0.5s; animation: fadein 0.5s;">
                    <div style="font-size: 54px; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(255,255,255,0.2));">🎉</div>
                    <h2 style="font-size:26px; font-weight:600; margin-bottom:8px; color:#fff; letter-spacing:-0.5px;">${title}</h2>
                    <p style="font-size:15px; color:#b0b0c0; line-height:1.6;">${subtitle}</p>
                </div>
            `;
            return;
        }

        // If no lock screen, create a momentary welcome overlay floating on the UI
        const wel = document.createElement("div");
        Object.assign(wel.style, {
            position: "fixed", inset: "0", zIndex: "999999",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(8, 8, 20, 0.95)", backdropFilter: "blur(8px)",
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: "0", transition: "opacity 0.6s ease"
        });

        wel.innerHTML = `
            <div style="text-align:center; color:#fff; padding: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                <div style="font-size: 54px; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(255,255,255,0.2));">✨</div>
                <h2 style="font-size:26px; font-weight:600; margin-bottom:8px; color:#fff; letter-spacing:-0.5px;">${title}</h2>
                <p style="font-size:15px; color:#b0b0c0; line-height:1.6;">${subtitle}</p>
            </div>
        `;
        document.body.appendChild(wel);

        // Smooth fade-in
        requestAnimationFrame(() => { wel.style.opacity = "1"; });

        // Smooth fade-out after 3.2 seconds
        setTimeout(() => {
            wel.style.opacity = "0";
            setTimeout(() => wel.remove(), 600);
        }, 3200);
    }

    // ─── CLEANUP ──────────────────────────────────────────────────────────────
    function clearBanner() {
        if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    }

    function clearAll() {
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
        clearBanner();
        disableInteractions(false);
    }

    // ─── BOOT ─────────────────────────────────────────────────────────────────
    let startupRetries = 0;
    
    async function bootCheck() {
        const connected = await checkStatus();
        if (!connected && window.location.protocol === 'file:' && startupRetries < 8) {
            // Electron backend server might be taking a moment to boot. Retry aggressively.
            startupRetries++;
            setTimeout(bootCheck, 1500); 
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            bootCheck();
            setInterval(checkStatus, POLL_MS);
        });
    } else {
        bootCheck();
        setInterval(checkStatus, POLL_MS);
    }

})();
