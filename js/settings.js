/* =====================================================
   SLOT SETTINGS – settings.js
==================================================== */

// Define on window FIRST so onclick works even if auth redirects
window.saveSlotSettings = async function () {
    const startTime = document.getElementById("sys_startTime")?.value;
    const endTime = document.getElementById("sys_endTime")?.value;
    const slotInterval = parseInt(document.getElementById("sys_slotInterval")?.value);
    const msgEl = document.getElementById("slotSettingsMsg");

    if (!startTime || !endTime || !slotInterval || slotInterval < 1) {
        showSlotMsg(msgEl, "Please fill all fields with valid values.", "error");
        return;
    }
    if (startTime >= endTime) {
        showSlotMsg(msgEl, "Close time must be after open time.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/system-settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime, endTime, slotInterval })
        });
        if (!res.ok) throw new Error("Server error");
        showSlotMsg(msgEl, "✓ Settings saved successfully!", "success");
    } catch (err) {
        console.error("Failed to save slot settings:", err);
        showSlotMsg(msgEl, "Failed to save settings. Is the server running?", "error");
    }
};

window.saveCalendarSettings = async function () {
    const calendarStartTime = document.getElementById("sys_calendarStartTime")?.value;
    const calendarEndTime = document.getElementById("sys_calendarEndTime")?.value;
    const slotInterval = parseInt(document.getElementById("sys_calendarSlotInterval")?.value);
    const msgEl = document.getElementById("calendarSettingsMsg");

    if (!calendarStartTime || !calendarEndTime || isNaN(slotInterval)) {
        showSlotMsg(msgEl, "Please fill all fields with valid numbers.", "error");
        return;
    }

    const payload = { calendarStartTime, calendarEndTime, slotInterval };
    console.log("Saving Calendar Settings Payload:", payload);

    try {
        const res = await fetch(`${API_BASE}/calendar-settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Server error");
        showSlotMsg(msgEl, "✓ Calendar display settings saved!", "success");
    } catch (err) {
        console.error("Failed to save calendar settings:", err);
        showSlotMsg(msgEl, "Failed to save settings. Is the server running?", "error");
    }
};

function showSlotMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    el.style.padding = "0.5rem 0.8rem";
    el.style.borderRadius = "6px";
    el.style.fontSize = "0.875rem";
    if (type === "success") {
        el.style.background = "#dcfce7";
        el.style.color = "#166534";
        el.style.border = "1px solid #bbf7d0";
    } else {
        el.style.background = "#fee2e2";
        el.style.color = "#991b1b";
        el.style.border = "1px solid #fecaca";
    }
    setTimeout(() => { el.style.display = "none"; }, 4000);
}

// Auth check + load saved values once DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
    if (window.APP && APP.ensureAuth) APP.ensureAuth();

    try {
        const resSettings = await fetch(`${API_BASE}/system-settings`);
        if (resSettings.ok) {
            const data = await resSettings.json();
            const st = document.getElementById("sys_startTime");
            const et = document.getElementById("sys_endTime");
            const iv = document.getElementById("sys_slotInterval");
            if (st) st.value = data.startTime || "09:00";
            if (et) et.value = data.endTime || "20:00";
            if (iv) iv.value = data.slotInterval || 30;
        }

        const resCal = await fetch(`${API_BASE}/calendar-settings?t=${Date.now()}`);
        if (resCal.ok) {
            const calData = await resCal.json();
            const cst = document.getElementById("sys_calendarStartTime");
            const cet = document.getElementById("sys_calendarEndTime");
            const civ = document.getElementById("sys_calendarSlotInterval");
            if (cst) cst.value = calData.calendarStartTime || "08:00";
            if (cet) cet.value = calData.calendarEndTime || "20:00";
            if (civ) civ.value = calData.slotInterval || 30;
        }

        // Quick Count for Staff Management
        const resUsers = await fetch(`${API_BASE}/users`);
        if (resUsers.ok) {
            const users = await resUsers.json();
            const countEl = document.getElementById("admin_userCount");
            if (countEl) countEl.textContent = users.length;
        }

        // Load Twilio/SMS credentials - Using previously fetched 'data' from line 89
        const sid = document.getElementById("twilio_sid");
        const token = document.getElementById("twilio_token");
        const from = document.getElementById("twilio_from");
        const waFrom = document.getElementById("twilio_whatsapp");
        if (sid) sid.value = data.twilioAccountSid || "";
        if (token) token.value = data.twilioAuthToken || "";
        if (from) from.value = data.twilioFromNumber || "+923008904153";
        if (waFrom) waFrom.value = data.twilioWhatsappNumber || "whatsapp:+14155238886";

        // Load Web Backend URL inputs
        const webBackendInput = document.getElementById("web_backend_url");
        const currentBackendDisplay = document.getElementById("current_backend_display");
        if (webBackendInput) {
            webBackendInput.value = localStorage.getItem("PAKTEETH_BACKEND_URL") || "";
        }
        if (currentBackendDisplay) {
            currentBackendDisplay.textContent = API_BASE;
        }

    } catch (err) {
        console.warn("Could not load settings data:", err.message);
    }

    if (document.getElementById("doctorHoursList")) {
        loadDoctorHours();
    }

    if (document.getElementById("citiesTableBody")) {
        loadCitiesList();
    }
});

/* =====================================================
   TWILIO / SMS SETTINGS
===================================================== */
window.saveTwilioSettings = async function () {
    const sid = document.getElementById("twilio_sid")?.value?.trim();
    const token = document.getElementById("twilio_token")?.value?.trim();
    const from = document.getElementById("twilio_from")?.value?.trim();
    const waFrom = document.getElementById("twilio_whatsapp")?.value?.trim();
    const msgEl = document.getElementById("twilioSettingsMsg");

    if (!sid || !token || !from) {
        showSlotMsg(msgEl, "Please fill in all Twilio fields.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/system-settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                twilioAccountSid: sid,
                twilioAuthToken: token,
                twilioFromNumber: from,
                twilioWhatsappNumber: waFrom
            })
        });
        if (!res.ok) throw new Error("Server error");
        showSlotMsg(msgEl, "✓ Messaging settings saved!", "success");
    } catch (err) {
        console.error("Failed to save Twilio settings:", err);
        showSlotMsg(msgEl, "Failed to save. Is the server running?", "error");
    }
};

window.testSMS = async function () {
    const testPhone = document.getElementById("twilio_test_phone")?.value?.trim();
    const msgEl = document.getElementById("twilioSettingsMsg");
    if (!testPhone) {
        showSlotMsg(msgEl, "Enter a test phone number first.", "error");
        return;
    }
    try {
        const btn = document.getElementById("twilio_test_btn");
        if (btn) { btn.textContent = "Sending..."; btn.disabled = true; }
        await Share.sendSMS(testPhone, "Test SMS from PakTeeth Dental Clinic. Your messaging is configured correctly!");
        showSlotMsg(msgEl, "✓ Test SMS sent! Check your phone.", "success");
        if (btn) { btn.textContent = "Send Test SMS"; btn.disabled = false; }
    } catch (err) {
        showSlotMsg(msgEl, "Test failed: " + err.message, "error");
    }
};

/* =====================================================
   DOCTOR VISITING HOURS SETTINGS
==================================================== */

window.loadedDoctors = [];
let docCurrentPage = 1;
let docRowsPerPage = 2;

async function loadDoctorHours() {
    const listEl = document.getElementById("doctorHoursList");
    if (!listEl) return;

    listEl.innerHTML = "<p>Loading doctors...</p>";

    try {
        const res = await fetch(`${API_BASE}/staff`);
        if (!res.ok) throw new Error("Failed to load staff");
        const staff = await res.json();

        window.loadedDoctors = staff.filter(s => s.role === "Doctor");
        docCurrentPage = 1; // Reset to page 1 on load
        renderDoctorHours();
    } catch (err) {
        console.error("Error loading doctors:", err);
        listEl.innerHTML = "<p>Error loading doctors.</p>";
    }
}

function renderDoctorHours() {
    const listEl = document.getElementById("doctorHoursList");
    if (!listEl) return;

    if (window.loadedDoctors.length === 0) {
        listEl.innerHTML = "<p>No doctors found in the system.</p>";
        const paginationContainer = document.getElementById("docPagination");
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    listEl.innerHTML = "";

    // Pagination Logic: Slice the list
    const startIndex = (docCurrentPage - 1) * docRowsPerPage;
    const endIndex = startIndex + docRowsPerPage;
    const paginatedItems = window.loadedDoctors.slice(startIndex, endIndex);

    paginatedItems.forEach(doc => {
        const card = document.createElement("div");
        card.className = "doctor-row-card";

        card.innerHTML = `
            <div class="doctor-name">
                ${doc.name}
            </div>
            <div class="doctor-times-list">
                <div class="time-input-group">
                    <label>Start</label>
                    <input type="time" id="doc_start_${doc._id}" class="form-control" value="${doc.visitingHours?.startTime || '09:00'}">
                </div>
                <div class="time-input-group">
                    <label>End</label>
                    <input type="time" id="doc_end_${doc._id}" class="form-control" value="${doc.visitingHours?.endTime || '20:00'}">
                </div>
            </div>
            <div style="text-align: right;">
                <button class="btn btn-primary btn-sm" onclick="saveDoctorHour('${doc._id}', '${doc.name}')" style="width: 120px;">
                    💾 Save Hour
                </button>
                <div id="msg_${doc._id}" style="display:none; font-size:0.75rem; margin-top:0.3rem;"></div>
            </div>
        `;
        listEl.appendChild(card);
    });

    renderDoctorPagination(window.loadedDoctors.length);
}

function renderDoctorPagination(totalItems) {
    const paginationContainer = document.getElementById("docPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / docRowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changeDocPage(${docCurrentPage - 1})" ${docCurrentPage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    // Smart Truncation Logic
    const delta = 1; 
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || 
            i === totalPages || 
            (i >= docCurrentPage - delta && i <= docCurrentPage + delta)
        ) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeDocPage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `
            <button class="pagination-number ${i === docCurrentPage ? 'active' : ''}" onclick="changeDocPage(${i})">
                ${i}
            </button>
        `;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeDocPage(${docCurrentPage + 1})" ${docCurrentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

function changeDocPage(page) {
    docCurrentPage = page;
    renderDoctorHours();
}

window.changeDocPage = changeDocPage;

window.saveDoctorHour = async function (docId, docName) {
    const startEl = document.getElementById(`doc_start_${docId}`);
    const endEl = document.getElementById(`doc_end_${docId}`);
    const msgEl = document.getElementById(`msg_${docId}`);

    if (!startEl || !endEl) return;

    const startTime = startEl.value;
    const endTime = endEl.value;

    if (startTime >= endTime) {
        showSlotMsg(msgEl, "Close time must be after open time.", "error");
        return;
    }

    try {
        // Exclude _id to prevent Mongoose immutable field error
        const doc = window.loadedDoctors.find(d => d._id === docId);
        const { _id, ...rest } = doc;

        const payload = {
            ...rest,
            visitingHours: { startTime, endTime }
        };

        const updateRes = await fetch(`${API_BASE}/staff/${docId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!updateRes.ok) throw new Error("Server error");

        showSlotMsg(msgEl, "✓ Saved!", "success");
    } catch (err) {
        console.error("Failed to update doctor:", err);
        showSlotMsg(msgEl, "Failed to save.", "error");
    }
};

/* =====================================================
   LOCATION (CITY) MANAGEMENT
==================================================== */
let allCities = [];
let cityCurrentPage = 1;
let cityRowsPerPage = 5;
let currentFilteredCities = [];

async function loadCitiesList() {
    const tableBody = document.getElementById("citiesTableBody");
    const countInfo = document.getElementById("cityCountInfo");
    if (!tableBody) return;

    tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Loading cities...</td></tr>";

    try {
        const res = await fetch(`${API_BASE}/cities`);
        if (!res.ok) throw new Error("Failed to load cities");
        allCities = await res.json();
        currentFilteredCities = [...allCities];
        cityCurrentPage = 1; // Reset to first page on load
        renderCitiesTable(currentFilteredCities);
    } catch (err) {
        console.error("Error loading cities:", err);
        tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center; color:red;'>Error loading cities.</td></tr>";
    }
}

function renderCitiesTable(cities) {
    currentFilteredCities = cities;
    const tableBody = document.getElementById("citiesTableBody");
    const countInfo = document.getElementById("cityCountInfo");
    if (!tableBody) return;

    if (cities.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No cities found.</td></tr>";
        countInfo.textContent = "Showing 0 cities";
        const paginationContainer = document.getElementById("cityPagination");
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    // Pagination Logic: Slice the list
    const startIndex = (cityCurrentPage - 1) * cityRowsPerPage;
    const endIndex = startIndex + cityRowsPerPage;
    const paginatedItems = cities.slice(startIndex, endIndex);

    tableBody.innerHTML = paginatedItems.map(city => `
        <tr id="city_row_${city._id}">
            <td><input type="text" id="city_name_${city._id}" class="form-control-plain" value="${city.name}" onchange="updateCityInline('${city._id}')" style="background:transparent; border:none; width:100%; padding:4px;"></td>
            <td><input type="text" id="city_prov_${city._id}" class="form-control-plain" value="${city.province || ''}" onchange="updateCityInline('${city._id}')" style="background:transparent; border:none; width:100%; padding:4px; opacity:0.8;"></td>
            <td style="text-align: right;">
                <button class="btn btn-danger btn-sm" onclick="deleteCity('${city._id}')" title="Delete City" style="padding: 4px 8px; font-size: 10px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </td>
        </tr>
    `).join("");

    countInfo.textContent = `Showing ${cities.length} cities`;
    renderCityPagination(cities.length);
}

function renderCityPagination(totalItems) {
    const paginationContainer = document.getElementById("cityPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / cityRowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changeCityPage(${cityCurrentPage - 1})" ${cityCurrentPage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    // Smart Truncation Logic
    const delta = 1; // Number of pages to show around current page
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || 
            i === totalPages || 
            (i >= cityCurrentPage - delta && i <= cityCurrentPage + delta)
        ) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeCityPage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `
            <button class="pagination-number ${i === cityCurrentPage ? 'active' : ''}" onclick="changeCityPage(${i})">
                ${i}
            </button>
        `;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeCityPage(${cityCurrentPage + 1})" ${cityCurrentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

function changeCityPage(page) {
    cityCurrentPage = page;
    renderCitiesTable(currentFilteredCities);
}

window.changeCityPage = changeCityPage;

window.addNewCity = async function () {
    const nameEl = document.getElementById("newCityName");
    const provEl = document.getElementById("newCityProvince");
    const name = nameEl.value.trim();
    const province = provEl.value.trim();

    if (!name) {
        alert("Please enter a city name.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/cities`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, province })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "Failed to add city");
        }

        nameEl.value = "";
        provEl.value = "";
        await loadCitiesList();
        // Notify other components to refresh datalists
        if (window.CityManager) window.CityManager.refresh();
        document.dispatchEvent(new CustomEvent('cityCollectionUpdated'));
    } catch (err) {
        console.error("Error adding city:", err);
        alert(err.message);
    }
};

window.updateCityInline = async function (id) {
    const name = document.getElementById(`city_name_${id}`).value.trim();
    const province = document.getElementById(`city_prov_${id}`).value.trim();

    if (!name) {
        alert("City name cannot be empty.");
        loadCitiesList(); // Revert
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/cities/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, province })
        });
        if (!res.ok) throw new Error("Failed to update city");

        console.log(`City ${id} updated.`);
        if (window.CityManager) window.CityManager.refresh();
        document.dispatchEvent(new CustomEvent('cityCollectionUpdated'));
    } catch (err) {
        console.error("Error updating city:", err);
        alert("Failed to update city.");
        loadCitiesList(); // Revert
    }
};

window.deleteCity = async function (id) {
    if (!confirm("Are you sure you want to delete this city? This will not affect existing patient records but will remove it from dynamic suggestions.")) return;

    try {
        const res = await fetch(`${API_BASE}/cities/${id}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Failed to delete city");

        await loadCitiesList();
        if (window.CityManager) window.CityManager.refresh();
        document.dispatchEvent(new CustomEvent('cityCollectionUpdated'));
    } catch (err) {
        console.error("Error deleting city:", err);
        alert("Failed to delete city.");
    }
};

window.filterCitiesTable = function () {
    const query = document.getElementById("cityListSearch").value.toLowerCase();
    cityCurrentPage = 1; // Reset to first page when filtering
    if (!query) {
        renderCitiesTable(allCities);
        return;
    }
    const filtered = allCities.filter(c =>
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.province && c.province.toLowerCase().includes(query))
    );
    renderCitiesTable(filtered);
};

/* =====================================================
   DATA MANAGEMENT (BACKUP & RESTORE)
==================================================== */
window.triggerDataBackup = async function () {
    if (!window.__pakteeth__ || !window.__pakteeth__.backupData) {
        Toast.warning("Data Management is only available in the Desktop App.");
        return;
    }
    try {
        // We will show a loader while it copies, since it could take seconds
        const loader = document.getElementById("page-loader");
        const loaderSub = document.querySelector(".loader-subtext");
        if (loader) {
            if(loaderSub) loaderSub.textContent = "Creating Full System Backup...";
            loader.style.visibility = "visible";
            loader.style.opacity = "1";
        }

        const res = await window.__pakteeth__.backupData();
        
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => { loader.style.visibility = "hidden"; }, 400);
        }

        if (res.success) {
            Confirm.show(`Backup created successfully at:\n${res.destination}`, 'Backup Complete');
        } else if (!res.canceled) {
            Toast.error("Failed to create backup: " + res.error);
        }
    } catch (err) {
        console.error(err);
        Toast.error("An error occurred during backup.");
        const loader = document.getElementById("page-loader");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => { loader.style.visibility = "hidden"; }, 400);
        }
    }
};

window.triggerDataRestore = async function () {
    if (!window.__pakteeth__ || !window.__pakteeth__.restoreData) {
        Toast.warning("Data Management is only available in the Desktop App.");
        return;
    }

    const ok = await Confirm.show("WARNING: Syncing data will OVERWRITE your current database, patients, and images with the data from the backup folder.\n\nThe application will restart automatically if successful.\n\nAre you sure you want to proceed?", "Confirm Data Sync");
    if (!ok) return;

    try {
        const res = await window.__pakteeth__.restoreData();
        
        if (!res.success && !res.canceled) {
            Toast.error("Failed to restore data: " + res.error);
        }
        // If success, the app restarts via IPC, so we don't need to do anything else.
    } catch (err) {
        console.error(err);
        Toast.error("An error occurred during sync.");
    }
};

/* =====================================================
   NETWORK & SESSIONS PANEL
===================================================== */

// Auto-refresh interval handle
let _netPanelInterval = null;

/**
 * Load (or reload) the Network & Sessions card.
 * Called on page load AND from the Refresh button.
 */
window.loadNetworkPanel = async function () {
    const isServer = window.PAKTEETH_CONFIG && window.PAKTEETH_CONFIG.isServerMode;

    // Show mode badge
    const srvBadge = document.getElementById('net-server-mode-badge');
    const clisBadge = document.getElementById('net-client-mode-badge');
    const clientNote = document.getElementById('net-client-mode-note');
    if (srvBadge)  srvBadge.style.display  = isServer ? '' : 'none';
    if (clisBadge) clisBadge.style.display  = isServer ? 'none' : '';

    try {
        const res  = await fetch(`${API_BASE}/network/clients`);
        if (!res.ok) throw new Error('Could not reach /network/clients');
        const data = await res.json();

        _renderUsersTable(data.users || [], data.onlineCount || 0);
        _renderClientsPanel(data.clients || [], isServer);
    } catch (err) {
        console.warn('[Settings] loadNetworkPanel error:', err.message);
        _renderUsersTableError();
        _renderClientsPanelError(isServer);
    }

    // Show "client mode" note on the workstations panel if not server
    if (clientNote) clientNote.style.display = isServer ? 'none' : '';
};

/* ── Users Table ─────────────────────────────────────────────────────── */
function _renderUsersTable(users, onlineCount) {
    const tbody   = document.getElementById('net-users-tbody');
    const counter = document.getElementById('net-online-count');
    if (!tbody) return;

    if (counter) {
        counter.textContent = `${onlineCount} online`;
        counter.style.background = onlineCount > 0 ? '#dcfce7' : '#f1f5f9';
        counter.style.color      = onlineCount > 0 ? '#166534' : '#64748b';
        counter.style.border     = `1px solid ${onlineCount > 0 ? '#bbf7d0' : '#e2e8f0'}`;
    }

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:#94a3b8;">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const onlineBadge = u.online
            ? `<span style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:20px;padding:2px 10px;font-size:0.72rem;font-weight:600;">● Online</span>`
            : `<span style="background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;border-radius:20px;padding:2px 10px;font-size:0.72rem;font-weight:600;">○ Offline</span>`;

        const roleColor = {
            admin:     '#7c3aed',
            doctor:    '#0284c7',
            reception: '#0891b2',
        }[u.role?.toLowerCase()] || '#64748b';

        return `
        <tr style="border-top:1px solid rgba(0,0,0,0.05);">
            <td style="padding:10px 14px;">
                <div style="font-weight:600;color:#1e293b;font-size:0.85rem;">${_esc(u.name || '—')}</div>
                <div style="font-size:0.75rem;color:#94a3b8;margin-top:1px;">${_esc(u.email || '')}</div>
            </td>
            <td style="padding:10px 14px;">
                <span style="background:${roleColor}18;color:${roleColor};border:1px solid ${roleColor}33;border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:600;text-transform:capitalize;">
                    ${_esc(u.role || 'unknown')}
                </span>
            </td>
            <td style="padding:10px 14px;text-align:center;">${onlineBadge}</td>
        </tr>`;
    }).join('');
}

function _renderUsersTableError() {
    const tbody = document.getElementById('net-users-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:#ef4444;font-size:0.85rem;">⚠ Could not load users.</td></tr>`;
}

/* ── Connected Clients Panel ─────────────────────────────────────────── */
function _renderClientsPanel(clients, isServer) {
    const container = document.getElementById('net-clients-list');
    const counter   = document.getElementById('net-clients-count');
    if (!container) return;

    // Update counter badge
    if (counter) {
        counter.textContent = `${clients.length} PC${clients.length !== 1 ? 's' : ''}`;
    }

    if (!clients.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:28px 16px;color:#94a3b8;font-size:0.85rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                    style="margin-bottom:8px;opacity:0.4;display:block;margin-inline:auto;">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                No workstations connected
            </div>`;
        return;
    }

    container.innerHTML = clients.map((c, idx) => {
        const connectedAgo = _timeAgo(c.connectedAt);
        const roleIcon = c.role === 'server-pc' ? '⚡' : '📡';
        const ipDisplay = c.ip ? c.ip.replace('::ffff:', '') : '—';

        const kickBtn = (isServer && c.role !== 'server-pc') ? `
            <button onclick="kickClient('${_esc(c.id)}')"
                style="padding:4px 12px;border-radius:7px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.2s;"
                onmouseover="this.style.background='rgba(239,68,68,0.2)'"
                onmouseout="this.style.background='rgba(239,68,68,0.1)'"
                title="Disconnect this workstation">
                ✕ Kick
            </button>` : '';

        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;${idx > 0 ? 'border-top:1px solid rgba(0,0,0,0.05);' : ''}">
            <div style="width:36px;height:36px;border-radius:10px;background:${c.role === 'server-pc' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
                ${roleIcon}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:#1e293b;font-size:0.85rem;display:flex;align-items:center;gap:6px;">
                    ${_esc(c.pcName || 'Unknown PC')}
                    ${c.role === 'server-pc' ? '<span style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:1px 6px;font-size:0.65rem;font-weight:700;">SERVER</span>' : ''}
                </div>
                <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">
                    <span style="font-family:monospace;">${ipDisplay}</span>
                    &nbsp;·&nbsp; ${_esc(c.userEmail || 'unknown')}
                    &nbsp;·&nbsp; connected ${connectedAgo}
                </div>
            </div>
            ${kickBtn}
        </div>`;
    }).join('');
}

function _renderClientsPanelError(isServer) {
    const container = document.getElementById('net-clients-list');
    if (!container) return;
    if (!isServer) {
        container.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85rem;">Only visible on the Main Server PC.</div>`;
    } else {
        container.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;font-size:0.85rem;">⚠ Could not load connected clients.</div>`;
    }
}

/* ── Kick a client ────────────────────────────────────────────────────── */
window.kickClient = async function (socketId) {
    const ok = await Confirm.show(
        'This will immediately disconnect that workstation and show them a "Removed by Server" message. Continue?',
        'Disconnect Workstation'
    );
    if (!ok) return;

    try {
        const res = await fetch(`${API_BASE}/network/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ socketId })
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        Toast.success('Workstation disconnected.');
        // Small delay then refresh so the list updates
        setTimeout(() => loadNetworkPanel(), 800);
    } catch (err) {
        console.error('[Settings] kickClient error:', err);
        Toast.error('Failed to disconnect: ' + err.message);
    }
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _timeAgo(isoString) {
    if (!isoString) return '—';
    const ms = Date.now() - new Date(isoString).getTime();
    const s  = Math.floor(ms / 1000);
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
}

/* ── Wire up real-time refresh via socket events ─────────────────────── */
// Wait for the socket to be available (socket-client.js loads after this file)
window.addEventListener('load', () => {
    // Initial load
    if (document.getElementById('networkSessionsCard')) {
        loadNetworkPanel();

        // Refresh every 15 seconds as a fallback
        _netPanelInterval = setInterval(loadNetworkPanel, 15000);

        // Also refresh instantly when a client joins or leaves
        // (socket-client.js exposes pakteethSocket after connection)
        const tryAttachSocket = setInterval(() => {
            const sock = window.pakteethSocket;
            if (!sock) return;
            clearInterval(tryAttachSocket);
            sock.on('sync:client-joined', () => setTimeout(loadNetworkPanel, 500));
            sock.on('sync:client-left',   () => setTimeout(loadNetworkPanel, 500));
        }, 500);
    }
});

/* ── Save Web Backend URL Connection ────────────────────────────────────── */
window.saveWebBackendURL = function () {
    const urlInput = document.getElementById("web_backend_url");
    if (!urlInput) return;
    let url = urlInput.value.trim();
    if (!url) {
        localStorage.removeItem("PAKTEETH_BACKEND_URL");
        if (typeof Toast !== 'undefined') {
            Toast.success("Reset to default backend URL.", 3000);
        } else {
            alert("Reset to default backend URL.");
        }
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    // Remove trailing slash if present
    if (url.endsWith("/")) {
        url = url.slice(0, -1);
    }
    // Simple validation
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        if (typeof Toast !== 'undefined') {
            Toast.error("URL must start with http:// or https://", 3000);
        } else {
            alert("URL must start with http:// or https://");
        }
        return;
    }
    localStorage.setItem("PAKTEETH_BACKEND_URL", url);
    if (typeof Toast !== 'undefined') {
        Toast.success("Backend URL updated successfully! Reloading...", 3000);
    } else {
        alert("Backend URL updated successfully! Reloading...");
    }
    setTimeout(() => window.location.reload(), 1000);
};

