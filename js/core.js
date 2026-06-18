// js/core.js - Core utilities shared across all modules

// API_BASE: dynamically set to the Main Server's URL.
// In server mode (or browser dev): http://localhost:3000
// In client mode: http://<MainServerIP>:3000 (injected by electron/main.js via PAKTEETH_CONFIG)
const API_BASE = (window.PAKTEETH_CONFIG && window.PAKTEETH_CONFIG.serverBaseURL)
    ? window.PAKTEETH_CONFIG.serverBaseURL
    : (localStorage.getItem("PAKTEETH_BACKEND_URL") || window.SERVER_BASE_URL || (window.location.protocol.startsWith('http') ? window.location.origin : "http://localhost:3000"));


// ===== Global APP Object =====
const APP = {
    // Current user object
    currentUser: null,

    // Initialize current user from localStorage
    initCurrentUser: function () {
        this.currentUser = this.getCurrentUser();
    },

    // Simple auth check
    ensureAuth: function () {
        this.initCurrentUser();
        const token = localStorage.getItem("authToken");
        const currentUser = this.currentUser;

        const isLoginPage = window.location.pathname.endsWith("index.html") ||
            window.location.pathname === "/" ||
            window.location.pathname.endsWith("/");

        if ((!token || !currentUser) && !isLoginPage) {
            console.warn("Auth check failed. Redirecting to login...");
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = "/index.html";
        }
    },

    logout: function () {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('kpisUnlocked');
        window.location.href = "/index.html";
    },

    // Navigation lock functionality
    updateNavigationLocks: function () {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return;

        // ✅ FIX 3A: Convert to Set ONCE — O(p) build, then O(1) has() per nav item
        // Previously used permissions.includes() which was O(p) per nav item
        const permSet = new Set(currentUser.permissions || []);
        const isAdmin = currentUser.email === 'developer@pakteeth.com' || currentUser.email === 'admin@pakteeth.com';

        // Get all navigation items
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (!href || href === '#') return;

            // Extract module name from href
            const moduleName = href.split('/').pop().replace('.html', '');

            // Check if user has permission for this module
            if (!isAdmin && !permSet.has(moduleName)) {
                // Add lock icon and disable click
                item.style.pointerEvents = 'none';
                item.style.opacity = '0.5';
                item.style.position = 'relative';

                // Add lock icon if not already present
                if (!item.querySelector('.lock-icon')) {
                    const lockIcon = document.createElement('span');
                    lockIcon.className = 'lock-icon';
                    lockIcon.innerHTML = '🔒';
                    lockIcon.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 10px;';
                    item.appendChild(lockIcon);
                }
            } else {
                // Remove lock if permission exists
                item.style.pointerEvents = '';
                item.style.opacity = '';
                const lockIcon = item.querySelector('.lock-icon');
                if (lockIcon) lockIcon.remove();
            }
        });
    },

    getCurrentUser: function () {
        const userStr = localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    },

    // === Appointment Badge Logic ===
    unreadCount: 0,
    lastKnownCount: 0,

    initAppointmentBadge: function () {
        this.refreshAppointmentBadge();

        // Refresh every 5 minutes to keep it relatively fresh without heavy polling
        setInterval(() => this.refreshAppointmentBadge(), 5 * 60 * 1000);

        // Listen for focus to mark as read and refresh
        window.addEventListener("focus", () => {
            this.unreadCount = 0;
            this.refreshAppointmentBadge();
        });
    },

    refreshAppointmentBadge: async function () {
        try {
            const appointments = await this.api.get("/appointments");
            if (!appointments) return;

            // Get today's date string (YYYY-MM-DD)
            const todayStr = new Date().toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD

            // Filter for today's appointments that are still 'pending'
            const activeAppointments = appointments.filter(a => a.date === todayStr && a.status === 'pending');
            const currentCount = activeAppointments.length;

            const badges = document.querySelectorAll('#appt-badge');
            badges.forEach(badge => {
                if (document.hidden) {
                    if (currentCount > this.lastKnownCount) {
                        this.unreadCount += (currentCount - this.lastKnownCount);
                    }
                }

                // Display the current count of appointments for today
                badge.textContent = currentCount > 0 ? currentCount : '';
                
                // If there are unread items, maybe add a special class or effect
                if (this.unreadCount > 0) {
                    badge.classList.add('has-unread');
                } else {
                    badge.classList.remove('has-unread');
                }
            });

            this.lastKnownCount = currentCount;
            this.updateBrowserBadge(currentCount);

        } catch (err) {
            console.error("Failed to refresh appointment badge:", err);
        }
    },

    updateBrowserBadge: function (count) {
        // Update document title with (count) prefix
        const originalTitle = document.title.replace(/^\(\d+\)\s+/, '');
        if (count > 0) {
            document.title = `(${count}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    },

    // API helper methods
    api: {
        // ── Utility: detect a true network failure (not a server error) ──────
        _isNetworkError(err) {
            return (err instanceof TypeError && err.message.includes('fetch')) ||
                   err.message === 'Failed to fetch' ||
                   err.message.includes('NetworkError') ||
                   err.message.includes('net::ERR');
        },

        async get(endpoint) {
            try {
                const res = await fetch(`${API_BASE}${endpoint}`);
                if (!res.ok) {
                    const errorBody = await res.json().catch(() => ({}));
                    throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
                }
                return await res.json();
            } catch (err) {
                console.error(`API GET ${endpoint} failed:`, err);
                throw err;
            }
        },

        async post(endpoint, data) {
            try {
                const res = await fetch(`${API_BASE}${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    const errorBody = await res.json().catch(() => ({}));
                    throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
                }
                return await res.json();
            } catch (err) {
                // ── Offline fallback: queue the write ────────────────────────
                if (this._isNetworkError(err) && window.OfflineQueue) {
                    const item = window.OfflineQueue.push('POST', endpoint, data, `POST ${endpoint}`);
                    const n = window.OfflineQueue.count();
                    window.OfflineQueue.showOfflineBanner(n);
                    console.warn(`[OFFLINE] POST ${endpoint} queued (id: ${item.id})`);
                    // Return a synthetic "pending" response so callers don't crash
                    return { __queued: true, message: 'Saved locally — will sync when online' };
                }
                console.error(`API POST ${endpoint} failed:`, err);
                throw err;
            }
        },

        async put(endpoint, data) {
            try {
                const res = await fetch(`${API_BASE}${endpoint}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    const errorBody = await res.json().catch(() => ({}));
                    throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
                }
                return await res.json();
            } catch (err) {
                // ── Offline fallback: queue the write ────────────────────────
                if (this._isNetworkError(err) && window.OfflineQueue) {
                    const item = window.OfflineQueue.push('PUT', endpoint, data, `PUT ${endpoint}`);
                    const n = window.OfflineQueue.count();
                    window.OfflineQueue.showOfflineBanner(n);
                    console.warn(`[OFFLINE] PUT ${endpoint} queued (id: ${item.id})`);
                    return { __queued: true, message: 'Saved locally — will sync when online' };
                }
                console.error(`API PUT ${endpoint} failed:`, err);
                throw err;
            }
        },

        async delete(endpoint) {
            try {
                const res = await fetch(`${API_BASE}${endpoint}`, {
                    method: "DELETE"
                });
                if (!res.ok) {
                    const errorBody = await res.json().catch(() => ({}));
                    throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
                }
                return await res.json();
            } catch (err) {
                // ── Offline fallback: queue the delete ───────────────────────
                if (this._isNetworkError(err) && window.OfflineQueue) {
                    const item = window.OfflineQueue.push('DELETE', endpoint, null, `DELETE ${endpoint}`);
                    const n = window.OfflineQueue.count();
                    window.OfflineQueue.showOfflineBanner(n);
                    console.warn(`[OFFLINE] DELETE ${endpoint} queued (id: ${item.id})`);
                    return { __queued: true, message: 'Deleted locally — will sync when online' };
                }
                console.error(`API DELETE ${endpoint} failed:`, err);
                throw err;
            }
        }
    },

    // Inject Browser-like Navigation Controls
    injectNavigationControls: function () {
        const topNav = document.getElementById('appTopNav') || document.querySelector('.top-nav');
        if (!topNav) return;

        // Don't inject if already exists
        if (document.querySelector('.nav-controls')) return;

        const brand = topNav.querySelector('.nav-brand');
        if (!brand) return;

        const controls = document.createElement('div');
        controls.className = 'nav-controls';
        controls.innerHTML = `
            <button class="nav-control-btn" id="btn-nav-back" title="Go Backward">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button class="nav-control-btn" id="btn-nav-forward" title="Go Forward">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
        `;

        // Insert after brand
        brand.after(controls);

        // Bind events
        document.getElementById('btn-nav-back').onclick = () => window.history.back();
        document.getElementById('btn-nav-forward').onclick = () => window.history.forward();
    },

    // Inject Electron minimize button globally
    injectWindowControls: function () {
        if (!window.__pakteeth__) return; // Restrict to Electron only

        const minBtn = document.createElement('button');
        minBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'; // Sleek minus icon
        minBtn.title = "Minimize App";

        // Exact user specs: Located top-left
        minBtn.style.cssText = 'position: fixed; top: 15px; left: 15px; width: 44px; height: 44px; border-radius: 12px; background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(8px); color: white; border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.3);';

        minBtn.onmouseover = () => { minBtn.style.background = 'rgba(15, 23, 42, 0.95)'; minBtn.style.transform = 'scale(1.05)'; };
        minBtn.onmouseout = () => { minBtn.style.background = 'rgba(30, 41, 59, 0.85)'; minBtn.style.transform = 'scale(1)'; };

        minBtn.onclick = () => {
            window.__pakteeth__.minimizeApp();
        };

        document.body.appendChild(minBtn);

        // Logic: Show when mouse is top-right OR top-left so it can actually be clicked without vanishing
        document.addEventListener('mousemove', (e) => {
            const inTopRight = (window.innerWidth - e.clientX < 150) && (e.clientY < 80);
            const inTopLeft = (e.clientX < 150) && (e.clientY < 80); // Ensure they can click it!

            if (inTopRight || inTopLeft) {
                minBtn.style.opacity = '1';
                minBtn.style.pointerEvents = 'auto'; // allow clicks
            } else {
                minBtn.style.opacity = '0';
                minBtn.style.pointerEvents = 'none'; // pass through
            }
        });
    }
};

// ===== Global Modal Object =====
const Modal = {
    open: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        } else {
            console.warn(`Modal with id '${modalId}' not found`);
        }
    },

    close: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        // Also reset forms if present
        const form = modal?.querySelector("form");
        if (form) form.reset();

        // Special handling for staff modal
        if (modalId === "staffModal") {
            const staffId = document.getElementById("staff_id");
            const modalTitle = document.getElementById("staffModalTitle");
            if (staffId) staffId.value = "";
            if (modalTitle) modalTitle.textContent = "Add Staff Member";
        }
    },

    // Close all modals
    closeAll: function () {
        document.querySelectorAll(".modal-overlay").forEach(m => {
            m.classList.remove('active');
        });
    }
};

// ===== Global Toast Object =====
const Toast = {
    show: function (message, type = 'info', duration = 3000) {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.textContent = message;

        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                toast.style.background = '#28a745';
                break;
            case 'error':
                toast.style.background = '#dc3545';
                break;
            case 'warning':
                toast.style.background = '#ffc107';
                toast.style.color = '#212529';
                break;
            default:
                toast.style.background = '#17a2b8';
        }

        // Add to document
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Remove after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success: function (message, duration) {
        this.show(message, 'success', duration);
    },

    error: function (message, duration) {
        this.show(message, 'error', duration);
    },

    warning: function (message, duration) {
        this.show(message, 'warning', duration);
    },

    info: function (message, duration) {
        this.show(message, 'info', duration);
    }
};

// ===== Global Confirm Dialog =====
const Confirm = {
    show: function (message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            // Remove existing confirm dialog if any
            const existing = document.querySelector('.confirm-overlay');
            if (existing) existing.remove();

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '99999'
            });

            // Create dialog box
            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                background: '#1e1e2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '24px 28px',
                maxWidth: '420px',
                width: '90%',
                color: '#e0e0e0',
                fontFamily: 'inherit',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            });

            // Title
            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            Object.assign(titleEl.style, {
                margin: '0 0 12px 0',
                fontSize: '1.1rem',
                color: '#fff',
                fontWeight: '600'
            });

            // Message
            const msgEl = document.createElement('p');
            msgEl.textContent = message;
            Object.assign(msgEl.style, {
                margin: '0 0 20px 0',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                color: '#ccc'
            });

            // Buttons container
            const btnContainer = document.createElement('div');
            Object.assign(btnContainer.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
            });

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            Object.assign(cancelBtn.style, {
                padding: '8px 20px',
                border: '1px solid #555',
                borderRadius: '6px',
                background: 'transparent',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
            });
            cancelBtn.onmouseover = () => { cancelBtn.style.background = '#333'; };
            cancelBtn.onmouseout = () => { cancelBtn.style.background = 'transparent'; };

            // Confirm button
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Confirm';
            Object.assign(confirmBtn.style, {
                padding: '8px 20px',
                border: 'none',
                borderRadius: '6px',
                background: '#dc3545',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
            });
            confirmBtn.onmouseover = () => { confirmBtn.style.background = '#c82333'; };
            confirmBtn.onmouseout = () => { confirmBtn.style.background = '#dc3545'; };

            // Wire up events
            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            cancelBtn.addEventListener('click', () => cleanup(false));
            confirmBtn.addEventListener('click', () => cleanup(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });

            // Assemble
            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);
            dialog.appendChild(titleEl);
            dialog.appendChild(msgEl);
            dialog.appendChild(btnContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Focus confirm button for keyboard users
            confirmBtn.focus();
        });
    }
};

// ===== Date Utility Object =====
const DateUtil = {
    today: function () {
        const today = new Date();
        return today.toISOString().split('T')[0];
    },

    format: function (date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }
};

// ===== Utility Functions =====
const Utils = {
    // Format date to YYYY-MM-DD
    formatDate: function (date) {
        if (!date) return "";
        const d = new Date(date);
        return d.toISOString().split("T")[0];
    },

    // Generate unique ID
    generateId: function (prefix = "ID") {
        return `${prefix}${Date.now()}`;
    },

    // Show loading spinner
    showLoading: function (elementId) {
        const el = document.getElementById(elementId);
        if (el) el.innerHTML = '<div class="loading">Loading...</div>';
    },

    // Formats pagination HTML with smart truncation
    generatePaginationHTML: function (currentPage, totalPages, functionName) {
        if (totalPages <= 1) return "";

        let html = '<div class="pagination-controls" style="display:flex; justify-content:center; align-items:center; gap:5px; margin-top:20px;">';

        // Prev button
        html += `<button class="pagination-btn" onclick="${functionName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Back</button>`;
        html += '<div class="pagination-numbers" style="display:flex; gap:5px;">';

        const delta = 1;
        const range = [];
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - delta && i <= currentPage + delta)
            ) {
                range.push(i);
            }
        }

        let l;
        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    html += `<button class="pagination-btn" onclick="${functionName}(${l + 1})">${l + 1}</button>`;
                } else if (i - l !== 1) {
                    html += `<span class="pagination-dots">...</span>`;
                }
            }
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${functionName}(${i})">${i}</button>`;
            l = i;
        }

        html += '</div>'; // End numbers

        // Next button
        html += `<button class="pagination-btn" onclick="${functionName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

        html += '</div>';
        return html;
    },

    // Format patient ID (pads number to 3 digits, e.g., P1 -> P001)
    formatPatientId: function (id) {
        if (!id) return "-";
        const strId = String(id).trim();
        const match = strId.match(/^P?(\d+)$/i);
        if (match) {
            return `P${match[1].padStart(3, '0')}`;
        }
        return strId;
    },

    // Show error message
    showError: function (elementId, message) {
        const el = document.getElementById(elementId);
        if (el) el.innerHTML = `<div class="error">Error: ${message}</div>`;
    },

    // Export data to CSV
    exportToCSV: function (filename, headers, rows) {
        const processCell = (cell, colIndex) => {
            if (cell === null || cell === undefined) return '';
            let str = String(cell);
            
            // If it's a date column, force Excel to treat it as text to prevent the '########' width issue
            const headerName = headers[colIndex] ? headers[colIndex].toLowerCase() : '';
            if (headerName.includes('date')) {
                return `="${str}"`;
            }
            
            // Standard CSV escaping for commas, quotes, and newlines
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headerRow = headers.map(h => {
            let str = String(h);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(",");

        const csvContent = [headerRow, ...rows.map(row => row.map((cell, i) => processCell(cell, i)).join(","))].join("\n");
        const blob = new Blob(["\\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // Add BOM for Excel UTF-8 support
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// ===== Initialize on DOM Ready =====
document.addEventListener("DOMContentLoaded", () => {
    // Initialize current user and navigation locks
    APP.initCurrentUser();
    APP.updateNavigationLocks();
    APP.injectNavigationControls();
    APP.injectWindowControls();
    APP.initAppointmentBadge();

    // Setup modal close buttons
    document.querySelectorAll(".modal-close, .modal-close-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal-overlay");
            if (modal) modal.classList.remove('active');
        });
    });

    // Close modal when clicking outside
    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Initialize dropdown functionality for all pages
    const dropdowns = document.querySelectorAll('.nav-dropdown');

    dropdowns.forEach(dropdown => {
        // Attach to the dropdown container itself, not just the inner nav-item anchor
        dropdown.addEventListener('click', function (e) {
            // Only toggle if clicking the toggle button area (not a dropdown link)
            const clickedLink = e.target.closest('.nav-dropdown-content a');
            if (clickedLink) return; // let dropdown links navigate normally

            e.preventDefault();
            e.stopPropagation();

            // Close all other dropdowns
            dropdowns.forEach(otherDropdown => {
                if (otherDropdown !== dropdown) {
                    otherDropdown.classList.remove('active');
                }
            });

            // Toggle current dropdown
            dropdown.classList.toggle('active');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

    });
});


// Make available globally
window.APP = APP;
window.Modal = Modal;
window.Toast = Toast;
window.Confirm = Confirm;
window.DateUtil = DateUtil;
window.Utils = Utils;
window.API_BASE = API_BASE;

// ===== Share / PDF via Email =====
window.Share = {
    openEmailModal: function (title, filename, htmlContent) {
        if (!document.getElementById("emailShareModal")) {
            const m = document.createElement("div");
            m.className = "modal-overlay";
            m.id = "emailShareModal";
            m.innerHTML = `
            <div class="modal-content" style="max-width: 500px; padding: 25px; border-radius: 12px; background: white; z-index: 99999;">
                <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
                    <h3 style="margin:0; font-size: 20px; color: #2766ba;">Share via Email</h3>
                    <button class="modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer;" onclick="Modal.close('emailShareModal')">&times;</button>
                </div>
                <div class="modal-body" style="padding-top: 15px;">
                    <p style="margin-bottom: 20px; color: #555; font-size: 14px;">Enter the recipient's email address to instantly send <strong>${title}</strong>.</p>
                    <div class="form-group">
                        <label style="font-weight: 600; color: #333; margin-bottom: 8px; display: block;">Recipient Email</label>
                        <input type="email" id="share_email_input" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;" placeholder="patient@example.com" />
                    </div>
                    <div id="share_email_status" style="margin-top: 10px; font-size: 13px; font-weight: 600;"></div>
                </div>
                <div class="modal-footer" style="border-top: none; padding-top: 10px; display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn btn-secondary" onclick="Modal.close('emailShareModal')" style="padding: 10px 18px; border-radius: 8px; border: none; background: #e0e0e0; color: #333; cursor: pointer;">Cancel</button>
                    <button class="btn btn-primary" id="share_email_send_btn" style="padding: 10px 18px; border-radius: 8px; border: none; background: #2766ba; color: white; cursor: pointer;">Send PDF</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        }

        document.getElementById("share_email_input").value = "";
        const statusEl = document.getElementById("share_email_status");
        statusEl.textContent = "";
        const btn = document.getElementById("share_email_send_btn");

        // Remove existing listeners
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);

        newBtn.onclick = async function () {
            const email = document.getElementById("share_email_input").value;
            if (!email) return Toast.error("Email is required");

            newBtn.textContent = "Generating PDF...";
            newBtn.disabled = true;
            newBtn.style.opacity = "0.7";

            try {
                if (typeof window.html2pdf === "undefined") {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = htmlContent;
                tempDiv.style.padding = "20px";
                document.body.appendChild(tempDiv);

                tempDiv.style.position = "absolute";
                tempDiv.style.left = "-9999px";

                const opt = {
                    margin: 10,
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBase64 = await html2pdf().set(opt).from(tempDiv).outputPdf('datauristring');
                document.body.removeChild(tempDiv);

                newBtn.textContent = "Sending Email...";

                await APP.api.post("/share/email", {
                    toEmail: email,
                    subject: `PakTeeth Clinic: ${title}`,
                    text: "Please find your document attached.\n\nThank you for choosing PakTeeth!",
                    pdfBase64: pdfBase64,
                    filename: filename
                });

                statusEl.style.color = "green";
                statusEl.textContent = "Email sent successfully!";
                Toast.success("Email sent successfully!");
                setTimeout(() => Modal.close("emailShareModal"), 1500);

            } catch (err) {
                console.error(err);
                statusEl.style.color = "red";
                statusEl.textContent = err.message || "Failed to send email. See console.";
                Toast.error("Failed to send email.");
            } finally {
                newBtn.textContent = "Send PDF";
                newBtn.disabled = false;
                newBtn.style.opacity = "1";
            }
        };

        Modal.open("emailShareModal");
    },

    openWhatsAppPDF: async function (title, filename, htmlContent, phoneNumberRaw, patientName) {
        if (!phoneNumberRaw) {
            Toast.error("Patient has no phone number attached.");
            return;
        }

        const cleanPhone = phoneNumberRaw.replace(/\D/g, '');
        Toast.info("Downloading PDF... WhatsApp will open shortly.");

        try {
            if (typeof window.html2pdf === "undefined") {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            tempDiv.style.padding = "20px";
            document.body.appendChild(tempDiv);

            tempDiv.style.position = "absolute";
            tempDiv.style.left = "-9999px";

            const opt = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Download the PDF automatically to their machine
            await html2pdf().set(opt).from(tempDiv).save();
            document.body.removeChild(tempDiv);

            // Open WhatsApp with a prepopulated message instructing them to attach the downloaded file
            const msg = `Hi ${patientName}, please find your ${title} attached as a PDF.`;
            const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;

            setTimeout(() => {
                window.open(waUrl, "_blank");
            }, 500);

        } catch (err) {
            console.error("WhatsApp PDF prep failed:", err);
            Toast.error("Failed to generate PDF for WhatsApp.");
        }
    },

    openWhatsAppText: function (phoneNumberRaw, message) {
        if (!phoneNumberRaw) {
            Toast.error("Patient has no phone number attached.");
            return;
        }
        const cleanPhone = phoneNumberRaw.replace(/\D/g, '');
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
    },

    sendSMS: async function (phoneNumber, message) {
        if (!phoneNumber) {
            Toast.error("Patient has no phone number.");
            return false;
        }
        try {
            await APP.api.post("/share/sms", { toPhone: phoneNumber, message });
            Toast.success("SMS sent successfully!");
            return true;
        } catch (err) {
            console.error("SMS failed:", err);
            // Friendly error for missing credentials
            if (err.message && err.message.includes("not configured")) {
                Toast.error("Twilio credentials not set. Go to Settings → Messaging to configure.");
            } else {
                Toast.error("Failed to send SMS: " + (err.message || "Unknown error"));
            }
            return false;
        }
    },

    sendWhatsAppAutomated: async function (phoneNumber, message) {
        if (!phoneNumber) {
            Toast.error("Patient has no phone number.");
            return false;
        }
        try {
            await APP.api.post("/share/whatsapp-automated", { toPhone: phoneNumber, message });
            Toast.success("Automated WhatsApp sent successfully!");
            return true;
        } catch (err) {
            console.error("Automated WhatsApp failed:", err);
            if (err.message && err.message.includes("not configured")) {
                Toast.error("Twilio WhatsApp settings not set. Go to Settings → Messaging to configure.");
            } else {
                Toast.error("Failed to send WhatsApp: " + (err.message || "Unknown error"));
            }
            return false;
        }
    }
};
