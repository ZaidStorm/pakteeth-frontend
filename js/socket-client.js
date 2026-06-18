// js/socket-client.js
// Socket.IO client — connects every PakTeeth page to the sync server.
// Load this AFTER network-status.js and BEFORE the page-specific JS file.
// The socket.io client library must be loaded before this file:
//   <script src="/js/lib/socket.io.min.js"></script>

(function () {
    'use strict';

    // ── Config injected by Electron main process ─────────────────────────────
    const cfg = window.PAKTEETH_CONFIG || {
        isServerMode: false,
        serverBaseURL: localStorage.getItem("PAKTEETH_BACKEND_URL") || window.location.origin || 'http://localhost:3000',
        serverIP: '127.0.0.1',
        serverPort: 3000,
        clinicName: 'PakTeeth'
    };

    // ── Web mode guard ───────────────────────────────────────────────────────
    // If running in a plain browser (no Electron config injected) and no
    // explicit backend URL has been saved, there is no server to connect to.
    // Skip socket entirely — the standby overlay must NOT block the UI.
    const _hasExplicitBackend = !!window.PAKTEETH_CONFIG ||
        !!localStorage.getItem("PAKTEETH_BACKEND_URL");
    if (!_hasExplicitBackend) {
        console.info('[SOCKET] No backend configured — real-time sync disabled in web mode.');
        // Still expose SERVER_BASE_URL so fetch calls resolve to correct origin
        window.SERVER_BASE_URL = window.location.origin;
        return; // exit IIFE — no socket, no standby overlay
    }

    // ── Is this a CLIENT PC (not the server)? ────────────────────────────────
    // Only client PCs show the standby screen; the server itself never needs it.
    const IS_CLIENT_MODE = (cfg.isServerMode === false);

    // Track whether the standby is currently showing so we don't double-call.
    let _standbyVisible = false;
    let _kicked = false;

    const SERVER_URL = cfg.serverBaseURL;

    // Expose globally so all fetch() calls can use it
    window.SERVER_BASE_URL = SERVER_URL;

    // ── Connect ──────────────────────────────────────────────────────────────
    let socket;

    function connect() {
        // io() is provided by socket.io.min.js
        if (typeof io === 'undefined') {
            console.warn('[SOCKET] socket.io client library not loaded — real-time sync disabled');
            return;
        }

        // Read the currently logged-in user's email to pass to the server
        let _currentUserEmail = 'unknown';
        try {
            const _cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
            _currentUserEmail = _cu.email || 'unknown';
        } catch (e) {}

        socket = io(SERVER_URL, {
            transports:            ['websocket', 'polling'],
            reconnection:          true,
            reconnectionAttempts:  Infinity,
            reconnectionDelay:     2000,
            reconnectionDelayMax:  10000,
            query: {
                role:      cfg.isServerMode ? 'server-pc' : 'client-pc',
                pcName:    navigator.userAgent.includes('Windows') ? 'Windows PC' : 'PC',
                userEmail: _currentUserEmail
            }
        });

        // ── Connection lifecycle ─────────────────────────────────────────────
        socket.on('connect', () => {
            console.log('[SOCKET] Connected to sync server:', SERVER_URL);
            if (window.updateNetworkBar) {
                window.updateNetworkBar(
                    cfg.isServerMode ? 'server-connected' : 'client-connected',
                    { serverIP: cfg.serverIP, port: cfg.serverPort, ip: cfg.serverIP }
                );
            }
            if (window.updateNetworkCenter) window.updateNetworkCenter('');
        });

        socket.on('disconnect', (reason) => {
            console.warn('[SOCKET] Disconnected:', reason);
            if (window.updateNetworkBar) window.updateNetworkBar('disconnected');

            // Show standby on client PCs (not on the server itself, not if kicked)
            if (IS_CLIENT_MODE && !_kicked && window.ServerStandby) {
                _standbyVisible = true;
                window.ServerStandby.show(2000);
            }
        });

        socket.on('connect_error', () => {
            if (window.updateNetworkBar) window.updateNetworkBar('reconnecting');

            // Show standby if not already visible
            if (IS_CLIENT_MODE && !_kicked && window.ServerStandby && !_standbyVisible) {
                _standbyVisible = true;
                window.ServerStandby.show(2000);
            }
        });

        socket.on('reconnect_attempt', () => {
            // Update countdown on each retry
            if (IS_CLIENT_MODE && !_kicked && window.ServerStandby && _standbyVisible) {
                window.ServerStandby.resetCountdown(socket.io.opts.reconnectionDelay || 2000);
            }
        });

        // ── Server-initiated kick ────────────────────────────────────────────
        socket.on('server:kick', (payload) => {
            console.warn('[SOCKET] Kicked by server:', payload?.reason);
            _kicked = true;

            // Stop Socket.IO from attempting to reconnect
            socket.disconnect();

            // Hide normal standby, show kicked screen
            if (window.ServerStandby) {
                window.ServerStandby.showKicked();
            }

            if (window.updateNetworkBar) window.updateNetworkBar('disconnected');
        });

        socket.on('reconnect', async () => {
            console.log('[SOCKET] Reconnected to sync server');

            // Hide the standby screen now that the server is back
            if (IS_CLIENT_MODE && _standbyVisible && window.ServerStandby) {
                _standbyVisible = false;
                window.ServerStandby.hide();
            }

            if (window.updateNetworkBar) {
                window.updateNetworkBar(
                    cfg.isServerMode ? 'server-connected' : 'client-connected',
                    { serverIP: cfg.serverIP, port: cfg.serverPort, ip: cfg.serverIP }
                );
            }

            // ── Phase 2+3: Flush offline queue on reconnect ──────────────────
            if (window.OfflineQueue && window.OfflineQueue.hasPending()) {
                const count = window.OfflineQueue.count();
                console.log(`[SOCKET] ${count} queued item(s) found — starting flush…`);

                // Tell server to show blocking overlay on ALL PCs
                socket.emit('sync:start-flush', { count });

                // Small delay so overlay appears first on all PCs
                await new Promise(r => setTimeout(r, 600));

                // Show local overlay progress
                if (window.SyncOverlay) {
                    window.SyncOverlay.update(
                        `Replaying ${count} offline change${count > 1 ? 's' : ''}…`,
                        20,
                        `0 / ${count} applied`
                    );
                }

                // Execute the flush
                const serverURL = cfg.serverBaseURL || SERVER_URL;
                const result = await window.OfflineQueue.flush(serverURL);

                // Update progress to show completion
                if (window.SyncOverlay) {
                    window.SyncOverlay.update('Finalising sync…', 90, `${result.succeeded} / ${count} applied`);
                }

                // Tell server we are done — it will unblock all PCs
                socket.emit('sync:flush-done', result);

            } else {
                // No queue — just refresh the current page data normally
                reloadCurrentPageData();
            }
        });

        // ── Phase 3: Overlay events broadcast by server to ALL PCs ──────────

        // Another PC started a sync flush — block our UI
        socket.on('sync:blocking', (payload) => {
            console.log('[SOCKET] sync:blocking received —', payload.message);
            if (window.SyncOverlay) {
                window.SyncOverlay.show(payload.message || 'Syncing offline data… Please hold.');
            }
            if (window.updateNetworkBar) window.updateNetworkBar('reconnecting');
        });

        // Sync is done — unblock our UI
        socket.on('sync:unblock', (payload) => {
            console.log('[SOCKET] sync:unblock received —', payload.message);
            if (window.SyncOverlay) {
                window.SyncOverlay.hide(payload.message || 'Sync complete.');
            }
            if (window.updateNetworkBar) {
                window.updateNetworkBar(
                    cfg.isServerMode ? 'server-connected' : 'client-connected',
                    { serverIP: cfg.serverIP, port: cfg.serverPort, ip: cfg.serverIP }
                );
            }
            // Show result as a toast if available
            if (payload.failed === 0 && typeof Toast !== 'undefined') {
                Toast.success(`Sync complete — ${payload.succeeded} change${payload.succeeded !== 1 ? 's' : ''} applied.`, 4000);
            } else if (payload.failed > 0 && typeof Toast !== 'undefined') {
                Toast.warning(`Sync done — ${payload.succeeded} applied, ${payload.failed} failed.`, 6000);
            }
        });

        // After a successful flush — all PCs reload their page data
        socket.on('sync:refresh-all', () => {
            console.log('[SOCKET] sync:refresh-all — reloading page data');
            reloadCurrentPageData();
        });

        // ── Server metadata events ───────────────────────────────────────────
        socket.on('sync:welcome', (data) => {
            console.log('[SOCKET] Welcome:', data.message);
        });

        socket.on('sync:client-joined', (data) => {
            console.log(`[SOCKET] ${data.pcName} joined`);
            if (window.updateNetworkClients) window.updateNetworkClients(data.totalClients - 1);
            if (window.updateNetworkCenter) {
                window.updateNetworkCenter(`${data.pcName} connected`, '#22c55e');
                setTimeout(() => window.updateNetworkCenter(''), 3000);
            }
        });

        socket.on('sync:client-left', (data) => {
            console.log(`[SOCKET] ${data.pcName} left`);
            if (window.updateNetworkClients) window.updateNetworkClients(data.totalClients - 1);
        });

        // ── Data-change events ───────────────────────────────────────────────
        // Each event triggers a safe re-call of the relevant page's load function.
        // Pages that don't have the function simply ignore the event silently.

        socket.on('appointments:changed', (p) => {
            console.log('[SOCKET] appointments:changed', p.action);
            safeCall('loadAppointmentsData');
            safeCall('fetchCalendarAppointments');
            safeCall('loadDashboardData');
        });

        socket.on('patients:changed', (p) => {
            console.log('[SOCKET] patients:changed', p.action);
            safeCall('loadPatients');
            safeCall('loadPatientData');
        });

        socket.on('prescriptions:changed', (p) => {
            console.log('[SOCKET] prescriptions:changed', p.action);
            safeCall('loadData');
        });

        socket.on('invoices:changed', (p) => {
            console.log('[SOCKET] invoices:changed', p.action);
            safeCall('loadInvoices');
            safeCall('loadDashboardData');
        });

        socket.on('dental-charts:changed', (p) => {
            console.log('[SOCKET] dental-charts:changed', p.action);
            safeCall('loadPatientProcedures');
            safeCall('loadBabyPatientProcedures');
        });

        socket.on('reports:changed', (p) => {
            console.log('[SOCKET] reports:changed', p.action);
            safeCall('loadReports');
        });

        socket.on('staff:changed', (p) => {
            console.log('[SOCKET] staff:changed', p.action);
            safeCall('loadStaff');
        });

        socket.on('treatments:changed', (p) => {
            console.log('[SOCKET] treatments:changed', p.action);
            safeCall('loadPatientData');
        });

        socket.on('encounters:changed', (p) => {
            console.log('[SOCKET] encounters:changed', p.action);
            safeCall('loadPatientData');
        });

        socket.on('followups:changed', (p) => {
            console.log('[SOCKET] followups:changed', p.action);
            safeCall('loadPatientData');
        });

        socket.on('settings:changed', (p) => {
            console.log('[SOCKET] settings:changed', p.action);
            safeCall('loadSystemSettings');
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Call window[fnName]() if it exists on this page. Silently skip if not. */
    function safeCall(fnName, ...args) {
        if (typeof window[fnName] === 'function') {
            try { window[fnName](...args); }
            catch (err) { console.warn(`[SOCKET] Error in ${fnName}:`, err.message); }
        }
    }

    /** After a reconnect, reload the data for whatever page is currently open. */
    function reloadCurrentPageData() {
        const page = window.location.pathname.split('/').pop();
        const map = {
            'index.html':              null,
            'appointment.html':        'loadAppointmentsData',
            'patient-dashboard.html':  'loadPatients',
            'billing.html':            'loadInvoices',
            'prescriptions.html':      'loadData',
            'report.html':             'loadReports',
            'doctors.html':            'loadStaff',
            'dashboard.html':          'loadDashboardData',
            'settings.html':           'loadSystemSettings',
            'calender.html':           'fetchCalendarAppointments'
        };
        const fn = map[page];
        if (fn) safeCall(fn);
    }

    // Start connection after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // Expose socket globally in case page scripts need it
    Object.defineProperty(window, 'pakteethSocket', {
        get: () => socket,
        configurable: true
    });

})();
