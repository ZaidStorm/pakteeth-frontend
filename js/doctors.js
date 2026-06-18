// =======================
// Doctor & Staff Management Script
// =======================

let staffData = [];
let staffGridContainer = null;

// =======================
// Load staff data from API
// =======================
async function loadStaff() {
    try {
        staffData = await APP.api.get("/staff");
        renderStaffTable();
    } catch (err) {
        console.error("Failed to load staff:", err);
        Toast.error("Failed to load staff data. Please check your server.");
    }
}

// =======================
// Render staff table
// =======================
function formatTo12Hour(time) {
    if (!time) return "";
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}

function renderStaffTable() {
    if (!staffGridContainer) return;
    staffGridContainer.innerHTML = "";

    // Sort staff to keep Developers at the very bottom
    const sortedStaff = [...staffData].sort((a, b) => {
        const isADev = a.role === "Developer" || a.role === "Software Developer";
        const isBDev = b.role === "Developer" || b.role === "Software Developer";
        if (isADev && !isBDev) return 1;
        if (!isADev && isBDev) return -1;
        return 0;
    });

    sortedStaff.forEach(staff => {
        const initial = (staff.name || "S")[0].toUpperCase();

        const staffIdAttr = staff._id;
        const sID = staff.staffId || "N/A";
        const fullName = staff.name || "Unknown Staff";
        const role = staff.role || "Staff";
        const phone = staff.phone || "-";
        const fees = staff.appointmentFees || 0;
        const spec = staff.spec || "-";

        let hoursRange = "N/A";
        if (staff.visitingHours) {
            const st = staff.visitingHours.startTime || "09:00";
            const et = staff.visitingHours.endTime || "20:00";
            hoursRange = `${formatTo12Hour(st)} - ${formatTo12Hour(et)}`;
        }

        const isDev = role === "Developer" || role === "Software Developer";

        // Unique ID for SVG gradients to prevent flickering/clashes
        const svgId = `staffbgsvg-${staffIdAttr}`;
        const gradId = `grad-${staffIdAttr}`;
        const glowId = `glow-${staffIdAttr}`;

        const card = document.createElement("div");
        card.className = "staff-card-wrap";
        card.id = `staff-hud-wrap-${staffIdAttr}`;

        const roleClass = role.toLowerCase().replace(/\s+/g, '-');

        const specParts = spec !== "-" ? spec.split(',').map(s => s.trim()).filter(s => s) : ["General Professional"];
        const specHtml = specParts.map(s => `<span class="sc-spec-pill">${s}</span>`).join('');

        card.innerHTML = `
            <div class="staff-card">
                <!-- SVG Background (Identical to Patient Card Theme) -->
                <div class="sc-bg-svg">
                    <svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 720" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <linearGradient id="bg-${staffIdAttr}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#e8f4fb"/><stop offset="55%" stop-color="#f0f8ff"/><stop offset="100%" stop-color="#dff0f8"/>
                            </linearGradient>
                            <linearGradient id="topfade-${staffIdAttr}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#b8ddf2" stop-opacity="0.45"/><stop offset="100%" stop-color="#b8ddf2" stop-opacity="0"/>
                            </linearGradient>
                            <linearGradient id="botfade-${staffIdAttr}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#cceaf7" stop-opacity="0"/><stop offset="100%" stop-color="#a8d4ec" stop-opacity="0.3"/>
                            </linearGradient>
                            <radialGradient id="centerglow-${staffIdAttr}" cx="50%" cy="42%" r="50%">
                                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                            </radialGradient>
                            <clipPath id="cc-${staffIdAttr}"><rect width="560" height="720" rx="18"/></clipPath>
                        </defs>

                        <g clip-path="url(#cc-${staffIdAttr})">
                            <rect width="560" height="720" fill="url(#bg-${staffIdAttr})"/>
                            <rect width="560" height="280" fill="url(#topfade-${staffIdAttr})"/>
                            <rect width="560" height="200" y="520" fill="url(#botfade-${staffIdAttr})"/>
                            <rect width="560" height="720" fill="url(#centerglow-${staffIdAttr})"/>

                            <g opacity="0.07" stroke="#1a6fa4" stroke-width="0.6" fill="none">
                                <line x1="0" y1="80"  x2="560" y2="80"/><line x1="0" y1="160" x2="560" y2="160"/><line x1="0" y1="240" x2="560" y2="240"/><line x1="0" y1="320" x2="560" y2="320"/>
                                <line x1="80"  y1="0" x2="80"  y2="720"/><line x1="160" y1="0" x2="160" y2="720"/><line x1="240" y1="0" x2="240" y2="720"/><line x1="320" y1="0" x2="320" y2="720"/>
                            </g>

                            <!-- Pulse Path -->
                            <g opacity="0.55" fill="none" stroke="#1a6fa4" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 0 360 L 30 360 L 45 310 L 60 360 L 90 360 L 105 300 L 120 410 L 135 360 L 160 360 L 175 330 L 190 360 L 220 360 L 235 345 L 250 360 L 280 360 L 295 290 L 310 430 L 325 360 L 355 360 L 370 340 L 385 360 L 420 360 L 435 315 L 450 360 L 480 360 L 495 350 L 510 360 L 560 360"/>
                            </g>

                            <g opacity="0.14" fill="none" stroke="#1a6fa4" stroke-width="1">
                                <circle cx="280" cy="270" r="110"/><circle cx="280" cy="270" r="85"/>
                            </g>
                        </g>
                    </svg>
                </div>

                <div class="sc-content">
                    <div class="sc-glass"></div>
                    
                    <!-- Corner brackets -->
                    <div class="sc-corner tl"></div>
                    <div class="sc-corner tr"></div>
                    <div class="sc-corner bl"></div>
                    <div class="sc-corner br"></div>

                    <div class="sc-avatar-wrap" style="position: relative; overflow: hidden; border-radius: 50%;">
                        <div class="sc-avatar-ring"></div>
                        <img src="${API_BASE}/staff-image/${encodeURIComponent(fullName)}" alt="${initial}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 2;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="sc-avatar-text" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; z-index: 1;">${initial}</div>
                    </div>

                    <div class="sc-name-container">
                        <div class="sc-name">${fullName}</div>
                        <div class="sc-badge role-${roleClass}">
                            <div class="sc-badge-dot"></div>
                            ${role}
                        </div>
                    </div>

                    <div class="sc-tags">
                        <div class="sc-tag sid">${sID}</div>
                        <div class="sc-tag fees">Fees: Rs. ${fees}</div>
                    </div>

                    <div class="sc-divider"></div>

                    <div class="sc-specialization">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.7a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0z"/><path d="m3.1 20.4 1.6 1.6a1 1 0 0 0 1.4 0l11.7-11.7a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0Z"/><path d="m14 7 3 3"/></svg>
                         ${specHtml}
                    </div>

                    <div class="sc-info-stack">
                        <div class="sc-info-row hours">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${hoursRange}
                        </div>
                        <div class="sc-info-row phone">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            ${phone}
                        </div>
                    </div>

                    <!-- Gear Trigger -->
                    <div class="sc-gear" onclick="window.toggleStaffHUD(event, '${staffIdAttr}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .4 1.8l.2.2a2 2 0 1 1-2.8 2.8l-.2-.2a1.65 1.65 0 0 0-1.8-.4 1.65 1.65 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.3a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.4l-.2.2a2 2 0 1 1-2.8-2.8l.2-.2a1.65 1.65 0 0 0 .4-1.8 1.65 1.65 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.3a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.4-1.8l-.2-.2a2 2 0 1 1 2.8-2.8l.2.2a1.65 1.65 0 0 0 1.8.4h.1A1.65 1.65 0 0 0 10 3.3V3a2 2 0 1 1 4 0v.3a1.65 1.65 0 0 0 1 1.5h.1a1.65 1.65 0 0 0 1.8-.4l.2-.2a2 2 0 1 1 2.8 2.8l-.2.2a1.65 1.65 0 0 0-.4 1.8v.1c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.3a1.65 1.65 0 0 0-1.5 1Z"/></svg>
                    </div>
                </div>

                <!-- HUD Buttons -->
                <button class="sc-hud-btn view" title="View Locked" aria-label="View Locked">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </button>
                <button class="sc-hud-btn edit" title="Edit Staff" aria-label="Edit Staff" onclick="window.editStaff('${staffIdAttr}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="sc-hud-btn delete" title="Delete Staff" aria-label="Delete Staff" onclick="${isDev ? "Toast.warning('Staff account protected.')" : `window.deleteStaff('${staffIdAttr}')`}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>

            </div>
        `;
        staffGridContainer.appendChild(card);
    });

    filterStaff();
}

// =======================
// Save staff (add/update)
// =======================
async function saveStaff() {
    const id = document.getElementById("staff_id").value || null;
    const name = document.getElementById("staff_name").value.trim();
    const role = document.getElementById("staff_role").value;
    const phone = document.getElementById("staff_phone").value.trim();
    const email = document.getElementById("staff_email").value.trim();
    const spec = document.getElementById("staff_spec").value.trim();
    const appointmentFees = parseFloat(document.getElementById("staff_fees").value) || 0;

    if (!name || !role || !phone) {
        Toast.error("Please fill all required fields.");
        return;
    }

    try {
        const payload = { name, role, phone, email, spec, appointmentFees };
        if (id) {
            await APP.api.put(`/staff/${id}`, payload);
            Toast.success("Staff updated successfully.");
        } else {
            await APP.api.post("/staff", payload);
            Toast.success("Staff added successfully.");
        }

        loadStaff();
        Modal.close("staffModal");
    } catch (err) {
        console.error("Failed to save staff:", err);
        Toast.error(err.message || "Failed to save staff. Check your server.");
    }
}

// =======================
// Edit staff
// =======================
function editStaff(id) {
    const staff = staffData.find(s => s._id === id);
    if (!staff) return;

    document.getElementById("staff_id").value = staff._id;
    document.getElementById("staffModalTitle").textContent = `Edit Staff Member - ${staff.staffId}`;
    document.getElementById("staff_name").value = staff.name;
    document.getElementById("staff_role").value = staff.role;
    document.getElementById("staff_phone").value = staff.phone;
    document.getElementById("staff_email").value = staff.email || "";
    document.getElementById("staff_spec").value = staff.spec || "";
    document.getElementById("staff_fees").value = staff.appointmentFees || 0;

    Modal.open("staffModal");
}

// =======================
// Delete staff
// =======================
async function deleteStaff(id) {
    const ok = await Confirm.show("Are you sure you want to delete this staff member?");
    if (!ok) return;
    try {
        await APP.api.delete(`/staff/${id}`);
        loadStaff();
    } catch (err) {
        console.error("Failed to delete staff:", err);
        Toast.error("Failed to delete staff.");
    }
}

// =======================
// Filter staff table
// =======================
function filterStaff() {
    if (!staffGridContainer) return;

    const searchType = document.getElementById("searchTypeStaff").value;
    const searchValue = document.getElementById("searchStaff").value.toLowerCase();
    const roleFilter = document.getElementById("filterRole").value;

    Array.from(staffGridContainer.children).forEach(card => {
        if (card.classList.contains('no-results')) return;

        // Extract text content from the card to filter
        const name = card.querySelector('.sc-name')?.textContent.toLowerCase() || "";

        // Find role from badge
        const staffRole = card.querySelector('.sc-badge')?.textContent.trim() || "";
 
        // Find meta info or tags
        const staffId = card.querySelector('.sc-tag.sid')?.textContent.trim() || "";

        // Find Phone from info rows
        const infoRows = Array.from(card.querySelectorAll('.sc-info-row'));
        // Phone is the second sc-info-row in our new template
        const staffPhone = infoRows[1]?.textContent.trim() || "";

        let visible = true;

        if (roleFilter && staffRole !== roleFilter) visible = false;

        if (visible && searchValue) {
            if (searchType === "all") {
                visible = name.includes(searchValue) ||
                    staffId.toLowerCase().includes(searchValue) ||
                    staffRole.toLowerCase().includes(searchValue) ||
                    staffPhone.toLowerCase().includes(searchValue);
            } else if (searchType === "name") {
                visible = name.includes(searchValue);
            } else if (searchType === "id") {
                visible = staffId.toLowerCase().includes(searchValue);
            } else if (searchType === "phone") {
                visible = staffPhone.toLowerCase().includes(searchValue);
            }
        }
        card.style.display = visible ? "" : "none";
    });

    // Show "No Results" if all cards are hidden
    const visibleCards = Array.from(staffGridContainer.children).filter(c => c.style.display !== "none" && !c.classList.contains('no-results'));
    const existingMsg = staffGridContainer.querySelector('.no-results');

    if (visibleCards.length === 0) {
        if (!existingMsg) {
            const msg = document.createElement('div');
            msg.className = 'no-results';
            msg.style.width = '100%';
            msg.style.textAlign = 'center';
            msg.style.padding = '20px';
            msg.textContent = 'No matching staff found';
            staffGridContainer.appendChild(msg);
        }
    } else {
        if (existingMsg) existingMsg.remove();
    }
}

// =======================
// Export staff CSV
// =======================
function exportStaff() {
    if (!staffData.length) {
        Toast.warning("No staff data to export!");
        return;
    }
    const csvRows = [["Staff ID", "Name", "Role", "Phone", "Email", "Specialization/Notes"]];
    staffData.forEach(s => {
        csvRows.push([s.staffId, s.name, s.role, s.phone, s.email, s.spec]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "staff_directory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// =======================
// Refresh staff table
// =======================
function refreshStaff() {
    loadStaff();
}

// =======================
// Open staff modal
// =======================
function openStaffModal() {
    document.getElementById("staffForm").reset();
    document.getElementById("staff_id").value = "";
    document.getElementById("staff_fees").value = "0";
    document.getElementById("staffModalTitle").textContent = "Add Staff Member";
    Modal.open("staffModal");
}

// =======================
// Image Preview & Handling
// =======================
function previewStaffImage(event) {
    // This function is kept but no longer used for saving — images are now file-based.
    // It just shows a preview in the modal for visual reference.
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const previewDiv = document.getElementById("modalStaffAvatar");
        if (previewDiv) {
            previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        }
    };
    reader.readAsDataURL(file);
}

// =======================
// Modal object is already defined in core.js
// =======================

async function openStaffAssetsFolder() {
    if (window.__pakteeth__ && window.__pakteeth__.openAssetsFolder) {
        try {
            await window.__pakteeth__.openAssetsFolder('staff');
            Toast.info("Opened staff image folder. Paste a .jpg or .png with the exact staff name here, then reload.");
        } catch (err) {
            console.error("Failed to open folder:", err);
            Toast.error("Failed to open folder.");
        }
    } else {
        Toast.warning("This feature is only available in the desktop application.");
    }
}

// =======================
// DOMContentLoaded
// =======================
document.addEventListener("DOMContentLoaded", () => {
    staffGridContainer = document.getElementById("staffGridContainer");

    // Modal close buttons
    document.querySelectorAll(".modal-close, .modal-close-btn").forEach(btn => {
        btn.addEventListener("click", () => Modal.close("staffModal"));
    });

    window.saveStaff = saveStaff;
    window.editStaff = editStaff;
    window.deleteStaff = deleteStaff;
    window.filterStaff = filterStaff;
    window.exportStaff = exportStaff;
    window.openStaffModal = openStaffModal;
    window.refreshStaff = refreshStaff;
    window.previewStaffImage = previewStaffImage;
    window.openStaffAssetsFolder = openStaffAssetsFolder;
    window.Modal = Modal;

    loadStaff();
});