// js/patient-dashboard.js - Patient Management Module

// Patient data — holds ONLY the current page (latest 20 by default)
let patientsData = [];
let totalPatientsCount = 0;  // full count from server
let pDashAppointmentsData = [];
let pDashDoctorsData = [];
let currentView = getSavedViewMode();
let currentProcedureFilter = 'all';

// Pagination state
let currentPatientPage = 1;
const patientsPerPage = 12;
let currentSearchText = '';   // managed here, not read from DOM on each render
let currentSearchType = 'all';

// Get patient ID from URL (for navigation to specific patient)
function getPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// =======================
// View State Management
// =======================
function getSavedViewMode() {
    return localStorage.getItem('patientViewMode') || 'grid';
}

function saveViewMode(mode) {
    localStorage.setItem('patientViewMode', mode);
}

// =======================
// Patient ID Generation — server-side
// Calls GET /patients/next-id which scans for max P001/AP001 number
// =======================
async function generatePatientId() {
    try {
        const result = await APP.api.get("/patients/next-id");
        return result.nextId; // e.g. "P042"
    } catch (err) {
        console.error("Failed to get next patient ID:", err);
        // Local fallback: count existing rows + 1
        const n = (totalPatientsCount || patientsData.length) + 1;
        return `P${String(n).padStart(3, '0')}`;
    }
}

// =======================
// Load Patients from API
// =======================
async function handleStatusAutoUpdate() {
    const idField = document.getElementById('editPatientId').value;
    const status = document.getElementById('p_status').value;

    // Only auto-update if we are editing an existing patient
    if (!idField) return;

    try {
        // Find existing data to preserve other fields, or just send the status update
        // The API route handles partial updates via findOneAndUpdate and req.body
        await APP.api.put(`/patients/${idField}`, { status });
        Toast.success(`Status updated to ${status}`);

        // Refresh the lists to reflect the change in cards and KPIs
        await loadPatients();
    } catch (err) {
        console.error("Auto-update status failed:", err);
        Toast.error("Failed to auto-update status");
    }
}

// =======================
// Load Patients from API — Server-side pagination + search
// =======================
async function loadPatients(page = 1) {
    currentPatientPage = page;

    const params = new URLSearchParams({
        page,
        limit: patientsPerPage,
        ...(currentSearchText ? { search: currentSearchText, type: currentSearchType } : {}),
        ...(currentProcedureFilter !== 'all' ? { procedure: currentProcedureFilter } : {})
    });

    try {
        const [result, appointments] = await Promise.all([
            APP.api.get(`/patients?${params}`),
            page === 1 ? APP.api.get("/appointments") : Promise.resolve(pDashAppointmentsData)
        ]);

        // Server returns { patients: [...], pagination: {...} }
        patientsData = result.patients || result;
        totalPatientsCount = result.pagination?.total ?? patientsData.length;

        if (page === 1) {
            pDashAppointmentsData = appointments;
            updateDashboardStats(appointments);
            if (window.populateCityDropdown) window.populateCityDropdown();
        }

        renderPatients();
        renderServerPagination(result.pagination);
    } catch (err) {
        console.error("Failed to load patients:", err);
        Toast.error("Failed to load data from database");
    }
}

// Renders pagination using the server's pagination object
function renderServerPagination(pagination) {
    if (!pagination) return;
    const container = document.getElementById('patientPagination');
    if (!container) return;
    container.innerHTML = Utils.generatePaginationHTML(
        pagination.page,
        pagination.totalPages,
        'changePatientPage'
    );
}

// =======================
// Load Doctors from API
// =======================
async function loadDoctors() {
    try {
        const staff = await APP.api.get("/staff");
        // Filter for doctors
        pDashDoctorsData = staff.filter(s => s.role === "Doctor");
        populateDoctorDropdown();
    } catch (err) {
        console.error("Failed to load doctors:", err);
    }
}

function populateDoctorDropdown() {
    const dropdown = document.getElementById('p_assignedDoctor');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select Doctor</option>';
    pDashDoctorsData.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.name;
        option.textContent = doc.name;
        dropdown.appendChild(option);
    });
}

// =======================
// Add / Edit Patient
// =======================
let isSavingPatient = false;

async function savePatient() {
    if (isSavingPatient) return;
    isSavingPatient = true;

    try {
        const idField = document.getElementById('editPatientId').value;
        const firstName = document.getElementById('p_firstName').value.trim();
        const lastName = document.getElementById('p_lastName').value.trim();
        const dob = document.getElementById('p_dob').value;
        const age = document.getElementById('p_age').value;
        const gender = document.getElementById('p_gender').value;
        const phone = document.getElementById('p_phone').value.trim();
        const email = document.getElementById('p_email').value.trim();
        const city = document.getElementById('p_city').value.trim();
        const address = document.getElementById('p_address').value.trim();
        const assignedDoctor = document.getElementById('p_assignedDoctor').value;
        const registrationDate = document.getElementById('p_registrationDate').value;
        const status = document.getElementById('p_status').value;

        if (!firstName || !lastName || !phone) {
            Toast.error('Please fill in required fields: First Name, Last Name, Phone');
            return;
        }

        await processPatient(idField, firstName, lastName, dob, age, gender, phone, email, city, address, assignedDoctor, registrationDate, status);
    } finally {
        isSavingPatient = false;
    }
}

async function processPatient(idField, firstName, lastName, dob, age, gender, phone, email, city, address, assignedDoctor, registrationDate, status) {
    const patientData = {
        firstName,
        lastName,
        dob: dob || null,
        age: age || null,
        gender: gender || null,
        phone,
        email: email || null,
        city: city || null,
        address: address || null,
        assignedDoctor: assignedDoctor || null,
        registrationDate: registrationDate || null,
        status: status || 'Active',
        source: 'dashboard'
    };

    console.log(`[Frontend] Saving Patient ${idField ? '(Update)' : '(New)'}:`, patientData);

    // patientId is auto-generated by server (P001, P002, ...)
    // No client-side ID needed for new patients

    try {
        if (idField) {
            await APP.api.put(`/patients/${idField}`, patientData);
            Toast.success('Patient updated successfully');
        } else {
            await APP.api.post("/patients", patientData);
            Toast.success('Patient added successfully');
        }
        Modal.close('addPatientModal');
        await loadPatients();
    } catch (err) {
        console.error("Failed to save patient:", err);
        Toast.error(err.message || "Failed to save patient. Please check for duplicate phone/email.");
    }
}

// =======================
// Delete Patient
// =======================
async function deletePatient(id) {
    const ok = await Confirm.show('Are you sure you want to delete this patient?');
    if (!ok) return;
    try {
        await APP.api.delete(`/patients/${id}`);
        await loadPatients();
        Toast.success('Patient deleted successfully');
    } catch (err) {
        console.error("Failed to delete patient:", err);
        Toast.error("Failed to delete patient. Please try again.");
    }
}

// =======================
// View Patient
// =======================
function viewPatient(id) {
    window.location.href = `patient-profile.html?id=${id}`;
}

// =======================
// Edit Patient
// =======================
function editPatient(id) {
    const patient = patientsData.find(p => (p.patientId && p.patientId === id) || (p._id && p._id === id));
    if (patient) {
        document.getElementById('editPatientId').value = patient.patientId || patient._id;
        document.getElementById('p_firstName').value = patient.firstName || '';
        document.getElementById('p_lastName').value = patient.lastName || '';
        document.getElementById('p_dob').value = patient.dob ? Utils.formatDate(patient.dob) : '';
        document.getElementById('p_age').value = patient.age || '';
        document.getElementById('p_gender').value = patient.gender || '';
        document.getElementById('p_phone').value = patient.phone || '';
        document.getElementById('p_email').value = patient.email || '';
        document.getElementById('p_city').value = patient.city || '';
        document.getElementById('p_address').value = patient.address || '';
        document.getElementById('p_assignedDoctor').value = patient.assignedDoctor || '';
        document.getElementById('p_status').value = patient.status || 'Active';
        document.getElementById('p_registrationDate').value = patient.registrationDate ? patient.registrationDate.split('T')[0] : (patient.createdAt ? patient.createdAt.split('T')[0] : '');
        document.getElementById('patientModalTitle').innerText = 'Edit Patient';
        const subtitle = document.getElementById('patientModalSubtitle');
        if (subtitle) {
            const regDate = patient.registrationDate ? Utils.formatDate(patient.registrationDate) : (patient.createdAt ? Utils.formatDate(patient.createdAt).split('T')[0] : 'N/A');
            subtitle.innerText = `Editing: ${patient.firstName} ${patient.lastName} | Registered: ${regDate}`;
            subtitle.style.display = 'block';
        }
        Modal.open('addPatientModal');
    }
}

// =======================
// Render Patients
// =======================
function setViewMode(mode) {
    currentView = mode;


    // Update container class
    const container = document.getElementById('patientsContainer');
    if (container) {
        container.className = mode === 'list' ? 'list-mode' : 'grid-mode';
    }

    // Highlight active button
    document.getElementById('btn-list-view')?.classList.toggle('active', mode === 'list');
    document.getElementById('btn-grid-view')?.classList.toggle('active', mode === 'grid');

    renderPatients();
}

async function updateDashboardStats(appointments = []) {
    // ✅ Get counts from /patients/stats — no iteration over patientsData needed
    try {
        const stats = await APP.api.get("/patients/stats");
        const statsTotalEl = document.getElementById('statsTotalPatients');
        if (statsTotalEl) statsTotalEl.textContent = stats.total;
        totalPatientsCount = stats.total;

        const todayEl = document.getElementById('statsRegisteredToday');
        if (todayEl) todayEl.textContent = stats.registeredToday;
        const todayPill = document.querySelector('.stat-pill.green');
        if (todayPill) todayPill.textContent = `+${stats.registeredToday} today`;

        const citiesEl = document.getElementById('statsCitiesCovered');
        if (citiesEl) citiesEl.textContent = stats.citiesCount;
    } catch (err) {
        console.warn("Stats endpoint unavailable, using local count", err);
        const statsTotalEl = document.getElementById('statsTotalPatients');
        if (statsTotalEl) statsTotalEl.textContent = totalPatientsCount;
    }

    // Appointments stats — still computed locally (appointments were separately fetched)
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const upcomingCount = appointments.filter(a =>
        a.status !== 'done' && a.status !== 'cancelled' && a.date >= todayStr
    ).length;
    const upcomingEl = document.getElementById('statsUpcomingAppointments');
    if (upcomingEl) upcomingEl.textContent = upcomingCount;

    // Top city — from /patients/by-city (aggregation, no local iteration)
    try {
        const byCityData = await APP.api.get("/patients/by-city");
        const topCity = byCityData[0]?.city || 'N/A';
        const topCityPill = document.getElementById('statsTopCity');
        if (topCityPill) {
            topCityPill.innerHTML = topCity !== 'N/A'
                ? `<span class="top-city-label">Maximum patients from</span> <span class="top-city-emphasis">${topCity}</span>`
                : 'N/A';
        }
    } catch (err) {
        console.warn("by-city endpoint unavailable", err);
    }
}

function getInitials(firstName, lastName) {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || 'P';
}

// =======================
// Procedure Filter
// =======================
window.filterByProcedure = function (procedure) {
    currentProcedureFilter = procedure;
    currentPatientPage = 1; // Reset to page 1

    // Update active pill UI
    document.querySelectorAll('.procedure-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.innerText.toLowerCase() === procedure.toLowerCase() ||
            (procedure === 'all' && pill.innerText === 'Show All')) {
            pill.classList.add('active');
        }
    });

    loadPatients(1);
};

function renderPatients() {
    const container = document.getElementById('patientsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Reset HUD dial instances on each re-render to avoid dead DOM references
    if (window.activePatientHUDs) window.activePatientHUDs.clear();

    // patientsData is already the current page from the server — render it all
    if (patientsData.length === 0) {
        container.innerHTML = '<div class="no-results">No patients found</div>';
        const paginationContainer = document.getElementById('patientPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // ✅ Use DocumentFragment — single DOM write for all cards
    const fragment = document.createDocumentFragment();
    patientsData.forEach(p => {
        const patientEl = document.createElement('div');
        patientEl.className = currentView === 'list' ? 'patient-list-item' : 'patient-grid-item';

        const firstName = p.firstName || '';
        const lastName = p.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const initials = getInitials(firstName, lastName);
        const patientId = p.patientId || p._id;
        const displayId = Utils.formatPatientId(patientId);
        const regDate = p.registrationDate ? Utils.formatDate(p.registrationDate) : (p.createdAt ? Utils.formatDate(p.createdAt).split('T')[0] : 'N/A');

        // Avatar: try image by full name, fall back to initials
        const encodedName = encodeURIComponent(fullName);
        const avatarHtml = `
            <img 
                src="${API_BASE}/patient-image/${encodedName}" 
                alt="${fullName}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                style="width:100%; height:100%; object-fit:cover; border-radius:50%;">
            <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${initials}</span>`;

        if (currentView === 'grid') {
            // HUD Grid View Structure with Premium SVG Background
            const svgId = `bgsvg-${patientId}`;
            patientEl.innerHTML = `
                <div class="patient-card-wrap" id="hud-wrap-${patientId}">
                    <div class="patient-card">
                        <div class="pc-bg-svg">
                            <svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 720" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                                <defs>
                                    <linearGradient id="bg-${patientId}" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#e8f4fb"/><stop offset="55%" stop-color="#f0f8ff"/><stop offset="100%" stop-color="#dff0f8"/>
                                    </linearGradient>
                                    <linearGradient id="topfade-${patientId}" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#b8ddf2" stop-opacity="0.45"/><stop offset="100%" stop-color="#b8ddf2" stop-opacity="0"/>
                                    </linearGradient>
                                    <linearGradient id="botfade-${patientId}" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#cceaf7" stop-opacity="0"/><stop offset="100%" stop-color="#a8d4ec" stop-opacity="0.3"/>
                                    </linearGradient>
                                    <radialGradient id="centerglow-${patientId}" cx="50%" cy="42%" r="50%">
                                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                                    </radialGradient>
                                    <clipPath id="cc-${patientId}"><rect width="560" height="720" rx="18"/></clipPath>
                                </defs>

                                <g clip-path="url(#cc-${patientId})">
                                    <rect width="560" height="720" fill="url(#bg-${patientId})"/>
                                    <rect width="560" height="280" fill="url(#topfade-${patientId})"/>
                                    <rect width="560" height="200" y="520" fill="url(#botfade-${patientId})"/>
                                    <rect width="560" height="720" fill="url(#centerglow-${patientId})"/>

                                    <g opacity="0.07" stroke="#1a6fa4" stroke-width="0.6" fill="none">
                                        <line x1="0" y1="80"  x2="560" y2="80"/><line x1="0" y1="160" x2="560" y2="160"/><line x1="0" y1="240" x2="560" y2="240"/><line x1="0" y1="320" x2="560" y2="320"/>
                                        <line x1="80"  y1="0" x2="80"  y2="720"/><line x1="160" y1="0" x2="160" y2="720"/><line x1="240" y1="0" x2="240" y2="720"/><line x1="320" y1="0" x2="320" y2="720"/>
                                    </g>

                                    <!-- EKG Pulse Path -->
                                    <g opacity="0.55" fill="none" stroke="#1a6fa4" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M 0 360 L 30 360 L 45 310 L 60 360 L 90 360 L 105 300 L 120 410 L 135 360 L 160 360 L 175 330 L 190 360 L 220 360 L 235 345 L 250 360 L 280 360 L 295 290 L 310 430 L 325 360 L 355 360 L 370 340 L 385 360 L 420 360 L 435 315 L 450 360 L 480 360 L 495 350 L 510 360 L 560 360"/>
                                    </g>

                                    <!-- HUD Elements (Icons, Circles) -->
                                    <g opacity="0.1" fill="none" stroke="#1a6fa4" stroke-width="0.8">
                                        <!-- Stethoscope -->
                                        <circle cx="130" cy="220" r="12"/>
                                        <line x1="130" y1="210" x2="130" y2="180"/><line x1="120" y1="220" x2="90" y2="220"/>
                                        <!-- Clipboard -->
                                        <rect x="380" y="160" width="60" height="80" rx="6"/><rect x="395" y="148" width="30" height="14" rx="3"/>
                                        <!-- Medication -->
                                        <rect x="90" y="480" width="55" height="70" rx="4"/><line x1="103" y1="500" x2="131" y2="500"/>
                                    </g>

                                    <g opacity="0.14" fill="none" stroke="#1a6fa4" stroke-width="1">
                                        <circle cx="280" cy="270" r="110"/><circle cx="280" cy="270" r="85"/>
                                    </g>

                                    <!-- Corner Brackets in SVG -->
                                    <path d="M0 0 L22 0 L22 4 L4 4 L4 22 L0 22 Z" fill="#1a6fa4" opacity="0.25"/>
                                    <path d="M560 0 L538 0 L538 4 L556 4 L556 22 L560 22 Z" fill="#1a6fa4" opacity="0.25"/>
                                    <path d="M0 720 L22 720 L22 716 L4 716 L4 698 L0 698 Z" fill="#1a6fa4" opacity="0.25"/>
                                    <path d="M560 720 L538 720 L538 716 L556 716 L556 698 L560 698 Z" fill="#1a6fa4" opacity="0.25"/>
                                </g>
                            </svg>
                        </div>

                        <div class="pc-content">
                            <div class="pc-glass"></div>
                            
                            <!-- Corner brackets -->
                            <div class="pc-corner tl"></div>
                            <div class="pc-corner tr"></div>
                            <div class="pc-corner bl"></div>
                            <div class="pc-corner br"></div>

                            <div class="pc-avatar">
                                <div class="pc-avatar-ring"></div>
                                ${avatarHtml}
                            </div>

                            <div class="pc-name-container">
                                <div class="pc-name">${fullName}</div>
                                <div class="pc-badge ${(p.status || 'Active').toLowerCase()}">
                                    <div class="pc-badge-dot"></div>
                                    ${p.status || 'Active'}
                                </div>
                            </div>

                            <div class="pc-tags">
                                <div class="pc-tag pid">${displayId}</div>
                                <div class="pc-tag gender">${p.gender || 'N/A'}</div>
                                <div class="pc-tag age">${p.age || '-'} Yrs</div>
                            </div>

                            <div class="pc-divider"></div>

                            <div class="pc-info-stack">
                                <div class="pc-info-row reg-date">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    Reg: ${regDate}
                                </div>
                                <div class="pc-info-row phone">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    ${p.phone || '-'}
                                </div>
                            </div>

                            <!-- Gear Trigger -->
                            <div class="pc-gear" onclick="window.togglePatientHUD(event, '${patientId}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .4 1.8l.2.2a2 2 0 1 1-2.8 2.8l-.2-.2a1.65 1.65 0 0 0-1.8-.4 1.65 1.65 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.3a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.4l-.2.2a2 2 0 1 1-2.8-2.8l.2-.2a1.65 1.65 0 0 0 .4-1.8 1.65 1.65 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.3a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.4-1.8l-.2-.2a2 2 0 1 1 2.8-2.8l.2.2a1.65 1.65 0 0 0 1.8.4h.1A1.65 1.65 0 0 0 10 3.3V3a2 2 0 1 1 4 0v.3a1.65 1.65 0 0 0 1 1.5h.1a1.65 1.65 0 0 0 1.8-.4l.2-.2a2 2 0 1 1 2.8 2.8l-.2.2a1.65 1.65 0 0 0-.4 1.8v.1c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.3a1.65 1.65 0 0 0-1.5 1Z"/></svg>
                            </div>
                        </div>
                    </div>

                    <!-- HUD Buttons -->
                    <button class="pc-hud-btn view" title="View Profile" aria-label="View Profile" onclick="viewPatient('${patientId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="pc-hud-btn edit" title="Edit Patient" aria-label="Edit Patient" onclick="editPatient('${patientId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="pc-hud-btn delete" title="Delete Patient" aria-label="Delete Patient" onclick="deletePatient('${patientId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            `;
        } else {
            // Simple List View Structure
            patientEl.innerHTML = `
                <div class="patient-identity">
                    <div class="patient-avatar">${avatarHtml}</div>
                    <div class="patient-main-info">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
                            <h3 class="patient-name" style="margin: 0;">${fullName}</h3>
                            <span class="status-badge ${(p.status || 'Active').toLowerCase()}">${p.status || 'Active'}</span>
                        </div>
                        
                        <div class="patient-details-row">
                            <span class="data-pill id">${displayId}</span>
                            <span class="data-pill gender">${p.gender || 'N/A'}</span>
                            <span class="data-pill age">${p.age || '-'} Yrs</span>
                        </div>

                        <div class="patient-info-stack">
                            <div class="data-pill registration">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Reg: ${regDate}
                            </div>
                            <div class="data-pill phone">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                ${p.phone || '-'}
                            </div>
                            <div class="data-pill city">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                ${p.city || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="patient-actions">
                    <button class="btn btn-sm btn-info-outline" onclick="viewPatient('${patientId}')">View</button>
                    <button class="btn btn-sm btn-warning-outline" onclick="editPatient('${patientId}')">Edit</button>
                    <button class="btn btn-sm btn-danger-outline" onclick="deletePatient('${patientId}')">Delete</button>
                </div>
            `;
        }
        fragment.appendChild(patientEl);
    });
    container.appendChild(fragment);
}

window.changePatientPage = function (page) {
    if (page < 1) return;
    loadPatients(page);
    document.querySelector('.page-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// =======================
// Filter Patients — reads from inputs, resets to page 1, calls server
// =======================
function filterPatients() {
    const searchInput = document.getElementById('searchPatient');
    const typeSelect  = document.getElementById('searchTypePatient');
    currentSearchText = (searchInput?.value || '').trim();
    currentSearchType = typeSelect?.value || 'all';
    loadPatients(1); // always back to page 1 on new search
}

// =======================
// Export CSV
// =======================
function exportPatients() {
    if (patientsData.length === 0) {
        Toast.warning('No patients to export');
        return;
    }
    let csvContent = 'ID,First Name,Last Name,DOB,Age,Gender,Phone,Email,City,Address\n';
    patientsData.forEach(p => {
        csvContent += `${p.patientId || p._id || ''},${p.firstName || ''},${p.lastName || ''},${p.dob || ''},${p.age || ''},${p.gender || ''},${p.phone || ''},${p.email || ''},${p.city || ''},${p.address || ''}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'patients.csv');
    link.click();
}

// =======================
// View Log Functions
// =======================
async function viewLog(id) {
    const patient = patientsData.find(p => p._id === id);
    if (!patient) { Toast.error('Patient not found'); return; }

    const clinicName = "PakTeeth Dental Clinic";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        let y = 10;

        doc.setFontSize(18);
        doc.text(clinicName, 105, y, { align: 'center' });
        y += 10;
        doc.setFontSize(12);
        doc.text(`Patient Log Report`, 105, y, { align: 'center' });
        y += 10;

        doc.setFontSize(12);
        const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
        doc.text(`Name: ${fullName}`, 10, y); y += 6;
        doc.text(`ID: ${patient._id || '-'}`, 10, y); y += 6;
        doc.text(`DOB: ${patient.dob ? Utils.formatDate(patient.dob) : '-'} | Phone: ${patient.phone || '-'}`, 10, y); y += 6;
        doc.text(`Email: ${patient.email || '-'}`, 10, y); y += 6;
        doc.text(`City: ${patient.city || '-'}`, 10, y); y += 10;

        doc.text("No logs available for this patient.", 10, y);

        const pdfBlob = doc.output('bloburl');
        window.open(pdfBlob);
        doc.save(`${fullName || 'Patient'}_log.pdf`);
    } catch (err) {
        console.error("Failed to generate PDF:", err);
        Toast.error("Failed to generate PDF. Please try again.");
    }
}

// =======================
// Open Add Patient Modal
// =======================
function openAddPatientModal() {
    document.getElementById('editPatientId').value = '';
    document.getElementById('patientForm').reset();

    // Set default registration date to today and status to Active
    const dateInput = document.getElementById('p_registrationDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    const statusInput = document.getElementById('p_status');
    if (statusInput) {
        statusInput.value = 'Active';
    }

    document.getElementById('patientModalTitle').innerText = 'Add New Patient';
    const subtitle = document.getElementById('patientModalSubtitle');
    if (subtitle) {
        subtitle.style.display = 'none';
        subtitle.innerText = '';
    }
    Modal.open('addPatientModal');
}

// =======================
// DOMContentLoaded
// =======================
document.addEventListener('DOMContentLoaded', () => {
    loadPatients();
    loadDoctors();

    // Initialize view mode with saved state
    setViewMode(currentView);

    // Event listener for Add New Patient Button
    const addNewBtn = document.getElementById("addNewPatientBtn");
    if (addNewBtn) {
        addNewBtn.addEventListener("click", () => {
            openAddPatientModal();
        });
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            Modal.close('addPatientModal');
        });
    });

    // ✅ Debounce search input — fires server request 300ms after user stops typing
    const searchInput = document.getElementById('searchPatient');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterPatients, 300));
    }
    // Type dropdown triggers immediate search
    const typeSelect = document.getElementById('searchTypePatient');
    if (typeSelect) {
        typeSelect.addEventListener('change', filterPatients);
    }

    window.savePatient = savePatient;
    window.deletePatient = deletePatient;
    window.viewPatient = viewPatient;
    window.editPatient = editPatient;
    window.setViewMode = setViewMode;
    window.filterPatients = filterPatients;
    window.exportPatients = exportPatients;
    window.viewLog = viewLog;
    window.openAddPatientModal = openAddPatientModal;

    setupDashboardAgeCalculation();

    // Handle view query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam === 'all-records') {
        window.showPatientSearchAllRecords();
    } else if (viewParam === 'by-city') {
        window.showPatientSearchByCity();
    }
});

function setupDashboardAgeCalculation() {
    const dobInput = document.getElementById('p_dob');
    const ageInput = document.getElementById('p_age');
    if (dobInput && ageInput) {
        dobInput.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const birthDate = new Date(e.target.value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            ageInput.value = age > 0 ? age : 0;
        });
    }
}

// =======================
// PATIENT SEARCH FEATURE
// =======================

// Dropdown Toggle
window.togglePatientSearchDropdown = function () {
    const dropdown = document.getElementById('patientSearchDropdownContainer');
    dropdown.classList.toggle('active');
};

// Close dropdown if clicked outside
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('patientSearchDropdownContainer');
    const btn = document.getElementById('patientSearchDropdownBtn');
    if (dropdown && btn && !btn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

// View switching
window.showPatientSearchByCity = function () {
    document.getElementById('patientSearchDropdownContainer').classList.remove('active');
    document.getElementById('standardPatientsView').style.display = 'none';
    document.getElementById('patientRecordExportSection').style.display = 'none';
    const dateSection = document.getElementById('patientsByDateSection');
    if (dateSection) dateSection.style.display = 'none';
    const appSection = document.getElementById('patientsByAppointmentsSection');
    if (appSection) appSection.style.display = 'none';
    document.getElementById('patientsByCitySection').style.display = 'block';
    if (window.populateCityDropdown) window.populateCityDropdown();
    window.displayPatientsByCity();
};

window.showPatientSearchByDate = function () {
    document.getElementById('patientSearchDropdownContainer').classList.remove('active');
    document.getElementById('standardPatientsView').style.display = 'none';
    document.getElementById('patientRecordExportSection').style.display = 'none';
    document.getElementById('patientsByCitySection').style.display = 'none';
    const appSection = document.getElementById('patientsByAppointmentsSection');
    if (appSection) appSection.style.display = 'none';
    const dateSection = document.getElementById('patientsByDateSection');
    if (dateSection) dateSection.style.display = 'block';
    window.displayPatientsByDate();
};

window.showPatientSearchAllRecords = function () {
    document.getElementById('patientSearchDropdownContainer').classList.remove('active');
    document.getElementById('standardPatientsView').style.display = 'none';
    document.getElementById('patientsByCitySection').style.display = 'none';
    const dateSection = document.getElementById('patientsByDateSection');
    if (dateSection) dateSection.style.display = 'none';
    const appSection = document.getElementById('patientsByAppointmentsSection');
    if (appSection) appSection.style.display = 'none';
    document.getElementById('patientRecordExportSection').style.display = 'block';
};

window.showPatientSearchByAppointments = function () {
    document.getElementById('patientSearchDropdownContainer').classList.remove('active');
    document.getElementById('standardPatientsView').style.display = 'none';
    document.getElementById('patientRecordExportSection').style.display = 'none';
    document.getElementById('patientsByCitySection').style.display = 'none';
    const dateSection = document.getElementById('patientsByDateSection');
    if (dateSection) dateSection.style.display = 'none';
    const appSection = document.getElementById('patientsByAppointmentsSection');
    if (appSection) appSection.style.display = 'block';
    window.displayPatientsByAppointments();
};

window.closeAdvancedSearch = function () {
    document.getElementById('patientsByCitySection').style.display = 'none';
    document.getElementById('patientRecordExportSection').style.display = 'none';
    const dateSection = document.getElementById('patientsByDateSection');
    if (dateSection) dateSection.style.display = 'none';
    const appSection = document.getElementById('patientsByAppointmentsSection');
    if (appSection) appSection.style.display = 'none';
    document.getElementById('standardPatientsView').style.display = 'block';
};

// =======================
// PATIENTS BY CITY
// =======================
let cityPatientsGrouped = {};
let selectedCityFilter = '';

window.populateCityDropdown = function () {
    const citySelect = document.getElementById('citySearchSelect');
    if (!citySelect) return;

    // Get unique cities avoiding empty/null
    let cities = [...new Set(patientsData.map(p => (p.city || 'Unknown').trim()))];
    cities = cities.filter(c => c && c !== 'Unknown').sort();

    // Add 'Unknown' at the end if it exists
    if (patientsData.some(p => !(p.city || '').trim())) {
        cities.push('Unknown');
    }

    // Preserve selection
    const currentVal = citySelect.value;

    citySelect.innerHTML = '<option value="">All Cities</option>';
    cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
    });

    if (cities.includes(currentVal)) {
        citySelect.value = currentVal;
    }

    citySelect.addEventListener('change', window.displayPatientsByCity);
};

window.displayPatientsByCity = function () {
    const citySelect = document.getElementById('citySearchSelect');
    selectedCityFilter = citySelect?.value || '';

    // Group patients by city
    cityPatientsGrouped = {};

    patientsData.forEach(p => {
        const city = (p.city || '').trim() || 'Unknown';
        if (selectedCityFilter && city !== selectedCityFilter) return;

        if (!cityPatientsGrouped[city]) {
            cityPatientsGrouped[city] = [];
        }
        cityPatientsGrouped[city].push(p);
    });

    // Sort patients alphabetically by name within each city
    for (let city in cityPatientsGrouped) {
        cityPatientsGrouped[city].sort((a, b) => {
            const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
            const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    window.renderPatientsByCity();
};

window.renderPatientsByCity = function () {
    const container = document.getElementById('patientsCityContainer');
    if (!container) return;

    container.innerHTML = '';

    const pagination = document.getElementById('cityPatientsPagination');
    if (pagination) pagination.innerHTML = '';

    const sortedCities = Object.keys(cityPatientsGrouped).sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return a.localeCompare(b);
    });

    if (sortedCities.length === 0) {
        container.innerHTML = '<p style="padding: 20px;">No patients found.</p>';
        return;
    }

    sortedCities.forEach(city => {
        const cityPatients = cityPatientsGrouped[city];

        const citySection = document.createElement('div');
        citySection.style.marginBottom = '25px';

        const cityHeader = document.createElement('h4');
        cityHeader.textContent = `${city} (${cityPatients.length} Patients)`;
        cityHeader.style.marginBottom = '10px';
        cityHeader.style.paddingBottom = '5px';
        cityHeader.style.borderBottom = '2px solid var(--border-color)';
        citySection.appendChild(cityHeader);

        const table = document.createElement('table');
        table.className = 'table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${cityPatients.map(p => `
                    <tr>
                        <td style="padding:8px;border:1px solid var(--border-color);">${Utils.formatPatientId(p.patientId || p._id)}</td>
                        <td style="padding:8px;border:1px solid var(--border-color);">${p.firstName || ''} ${p.lastName || ''}</td>
                        <td style="padding:8px;border:1px solid var(--border-color);">${p.phone || '-'}</td>
                        <td style="padding:8px;border:1px solid var(--border-color);">${p.email || '-'}</td>
                        <td style="padding:8px;border:1px solid var(--border-color);text-align:center">${p.status || 'Active'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        citySection.appendChild(table);
        container.appendChild(citySection);
    });
};

window.downloadPatientsByCityPDF = function () {
    let printContent = '<h3>Patients by City</h3>';

    const sortedCities = Object.keys(cityPatientsGrouped).sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return a.localeCompare(b);
    });

    sortedCities.forEach(city => {
        printContent += `<h4 style="margin-top:20px;">${city}</h4>`;
        printContent += '<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;"><tr><th>Patient ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Status</th></tr>';

        cityPatientsGrouped[city].forEach(p => {
            printContent += `<tr>
                <td>${Utils.formatPatientId(p.patientId || p._id)}</td>
                <td>${p.firstName || ''} ${p.lastName || ''}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${p.status || 'Active'}</td>
            </tr>`;
        });
        printContent += '</table>';
    });

    const w = window.open('', '', 'width=900,height=700');
    w.document.write(printContent);
    w.document.close();
    w.print();
};

// =======================
// PATIENTS BY DATE
// =======================
let dateRowsPerPage = 5;
let dateCurrentPage = 1;
let filteredDatePatients = [];

window.renderPatientsByDate = function (page = 1) {
    const dateTableBody = document.getElementById('patientsByDateTableBody');
    if (!dateTableBody) return;
    dateCurrentPage = page;
    const start = (page - 1) * dateRowsPerPage;
    const end = start + dateRowsPerPage;
    dateTableBody.innerHTML = '';

    filteredDatePatients.slice(start, end).forEach(p => {
        const tr = document.createElement('tr');
        const regDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-';
        tr.innerHTML = `
            <td style="padding:8px;border:1px solid #ccc">${Utils.formatPatientId(p.patientId)}</td>
            <td style="padding:8px;border:1px solid #ccc">${p.firstName || ''} ${p.lastName || ''}</td>
            <td style="padding:8px;border:1px solid #ccc">${p.city || '-'}</td>
            <td style="padding:8px;border:1px solid #ccc">${p.gender || '-'}</td>
            <td style="padding:8px;border:1px solid #ccc">${regDate}</td>
        `;
        dateTableBody.appendChild(tr);
    });

    const totalCountEl = document.getElementById('totalPatientsByDateCount');
    if (totalCountEl) totalCountEl.textContent = filteredDatePatients.length;

    window.renderDatePagination();
};

window.renderDatePagination = function () {
    const totalPages = Math.ceil(filteredDatePatients.length / dateRowsPerPage);
    const pagination = document.getElementById('datePatientsPagination');
    if (!pagination) return;

    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === dateCurrentPage ? 'btn btn-primary' : 'btn btn-secondary';
        btn.style.margin = '0 2px';
        btn.addEventListener('click', () => window.renderPatientsByDate(i));
        pagination.appendChild(btn);
    }
};

window.displayPatientsByDate = function () {
    const fromDateStr = document.getElementById('dateSearchFrom')?.value;
    const toDateStr = document.getElementById('dateSearchTo')?.value;

    filteredDatePatients = patientsData.filter(p => {
        if (!p.createdAt && !p.dob) return false; // Fallback to dob if createdAt is missing but usually it's there
        const patientDateStr = p.createdAt || p.dob;
        if (!patientDateStr) return true;

        const patientDate = new Date(patientDateStr);
        patientDate.setHours(0, 0, 0, 0);

        if (fromDateStr) {
            const fromDate = new Date(fromDateStr);
            fromDate.setHours(0, 0, 0, 0);
            if (patientDate < fromDate) return false;
        }
        if (toDateStr) {
            const toDate = new Date(toDateStr);
            toDate.setHours(23, 59, 59, 999);
            if (patientDate > toDate) return false;
        }
        return true;
    });

    // Sort descending by date (newest first)
    filteredDatePatients.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.dob || 0);
        const dateB = new Date(b.createdAt || b.dob || 0);
        return dateB - dateA;
    });

    window.renderPatientsByDate(1);
};

window.downloadPatientsByDatePDF = function () {
    let printContent = '<h3>Patients by Date</h3>';

    const fromDateStr = document.getElementById('dateSearchFrom')?.value;
    const toDateStr = document.getElementById('dateSearchTo')?.value;
    if (fromDateStr || toDateStr) {
        printContent += `<p>Date Range: ${fromDateStr || 'Any'} to ${toDateStr || 'Any'}</p>`;
    }
    printContent += `<p><b>Total Patients:</b> ${filteredDatePatients.length}</p>`;

    printContent += '<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;"><tr><th>Patient ID</th><th>Name</th><th>City</th><th>Gender</th><th>Registration Date</th></tr>';

    filteredDatePatients.forEach(p => {
        const regDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-';
        printContent += `<tr>
            <td>${Utils.formatPatientId(p.patientId)}</td>
            <td>${p.firstName || ''} ${p.lastName || ''}</td>
            <td>${p.city || '-'}</td>
            <td>${p.gender || '-'}</td>
            <td>${regDate}</td>
        </tr>`;
    });
    printContent += '</table>';
    const w = window.open('', '', 'width=900,height=700');
    w.document.write(printContent);
    w.document.close();
    w.print();
};

// =======================
// PATIENTS BY APPOINTMENTS
// =======================
let apptRowsPerPage = 5;
let apptCurrentPage = 1;
let allAppointmentsData = [];
let filteredApptPatients = [];

window.renderPatientsByAppointments = function (page = 1) {
    const apptTableBody = document.getElementById('patientsByAppointmentsTableBody');
    if (!apptTableBody) return;
    apptCurrentPage = page;
    const start = (page - 1) * apptRowsPerPage;
    const end = start + apptRowsPerPage;
    apptTableBody.innerHTML = '';

    filteredApptPatients.slice(start, end).forEach(a => {
        const tr = document.createElement('tr');
        const pName = a.patientName || `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.trim() || a.patientId || '-';
        const phone = a.patientId?.phone || a.phone || '-';
        tr.innerHTML = `
            <td style="padding:8px;border:1px solid #ccc">
                <strong>${pName}</strong><br>
                <small style="color:#666">ID: ${Utils.formatPatientId(a.patientId?.patientId || a.patientId)}</small>
            </td>
            <td style="padding:8px;border:1px solid #ccc">${phone}</td>
            <td style="padding:8px;border:1px solid #ccc">${a.dentist || '-'}</td>
            <td style="padding:8px;border:1px solid #ccc">${a.date || '-'} <br> <small>${a.time || ''}</small></td>
            <td style="padding:8px;border:1px solid #ccc">${a.status || '-'}</td>
        `;
        apptTableBody.appendChild(tr);
    });

    const totalCountEl = document.getElementById('totalPatientsByAppointmentsCount');
    if (totalCountEl) totalCountEl.textContent = filteredApptPatients.length;

    window.renderAppointmentsPagination();
};

window.renderAppointmentsPagination = function () {
    const totalPages = Math.ceil(filteredApptPatients.length / apptRowsPerPage);
    const pagination = document.getElementById('appointmentsPatientsPagination');
    if (!pagination) return;

    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === apptCurrentPage ? 'btn btn-primary' : 'btn btn-secondary';
        btn.style.margin = '0 2px';
        btn.addEventListener('click', () => window.renderPatientsByAppointments(i));
        pagination.appendChild(btn);
    }
};

window.displayPatientsByAppointments = async function () {
    if (allAppointmentsData.length === 0) {
        try {
            allAppointmentsData = await APP.api.get("/appointments");
        } catch (err) {
            console.error("Failed to fetch appointments:", err);
            return;
        }
    }

    const searchInput = document.getElementById('appointmentSearchInput')?.value.toLowerCase() || '';
    const fromDateStr = document.getElementById('appDateSearchFrom')?.value;
    const toDateStr = document.getElementById('appDateSearchTo')?.value;

    filteredApptPatients = allAppointmentsData.filter(a => {
        // Text Match
        const pName = `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.toLowerCase();
        const phone = (a.patientId?.phone || a.phone || '').toLowerCase();
        const dentist = (a.dentist || '').toLowerCase();

        let textMatch = true;
        if (searchInput) {
            textMatch = pName.includes(searchInput) || phone.includes(searchInput) || dentist.includes(searchInput);
        }

        // Date Match
        let dateMatch = true;
        if (a.date && (fromDateStr || toDateStr)) {
            const aptDate = new Date(a.date);
            aptDate.setHours(0, 0, 0, 0);

            if (fromDateStr) {
                const fromDate = new Date(fromDateStr);
                fromDate.setHours(0, 0, 0, 0);
                if (aptDate < fromDate) dateMatch = false;
            }
            if (toDateStr) {
                const toDate = new Date(toDateStr);
                toDate.setHours(23, 59, 59, 999);
                if (aptDate > toDate) dateMatch = false;
            }
        }

        return textMatch && dateMatch;
    });

    // Sort descending by date (newest first)
    filteredApptPatients.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });

    window.renderPatientsByAppointments(1);
};

window.downloadPatientsByAppointmentsPDF = function () {
    let printContent = '<h3>Patients by Appointments</h3>';

    const searchInput = document.getElementById('appointmentSearchInput')?.value;
    const fromDateStr = document.getElementById('appDateSearchFrom')?.value;
    const toDateStr = document.getElementById('appDateSearchTo')?.value;

    if (searchInput) printContent += `<p>Search: "${searchInput}"</p>`;
    if (fromDateStr || toDateStr) {
        printContent += `<p>Date Range: ${fromDateStr || 'Any'} to ${toDateStr || 'Any'}</p>`;
    }
    printContent += `<p><b>Total Appointments:</b> ${filteredApptPatients.length}</p>`;

    printContent += '<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;"><tr><th>Patient ID</th><th>Name</th><th>Phone</th><th>Doctor</th><th>Appointment Date</th><th>Status</th></tr>';

    filteredApptPatients.forEach(a => {
        const pName = a.patientName || `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.trim() || '-';
        const pId = a.patientId?.patientId || a.patientId || '-';
        const phone = a.patientId?.phone || a.phone || '-';

        printContent += `<tr>
            <td>${pId}</td>
            <td>${pName}</td>
            <td>${phone}</td>
            <td>${a.dentist || '-'}</td>
            <td>${a.date || '-'} ${a.time || ''}</td>
            <td>${a.status || '-'}</td>
        </tr>`;
    });
    printContent += '</table>';
    const w = window.open('', '', 'width=900,height=700');
    w.document.write(printContent);
    w.document.close();
    w.print();
};

// =======================
// PATIENT RECORD EXPORT
// =======================
let currentPatientExportData = null;

window.searchPatientRecord = async function () {
    const query = document.getElementById("patientSearchInput").value.trim();

    if (!query) {
        Toast.warning("Enter Patient ID, phone or name");
        return;
    }

    try {
        const data = await APP.api.get(`/settings/patient-record?query=${encodeURIComponent(query)}`);
        currentPatientExportData = data;
        window.renderPatientRecord(data);
        Toast.success("Patient record loaded");
    } catch (err) {
        Toast.error("Patient not found");
        console.error(err);
    }
};

window.renderPatientRecord = function (data) {
    const patient = data.patient;
    const encounters = data.encounters || [];
    const prescriptions = data.prescriptions || [];
    const billing = data.billing || {};
    const doctors = data.doctors || [];

    /* PATIENT INFO */
    // Helper to format date if DateUtil doesn't exist globally
    const formatDateObj = (dateStr) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString();
    };

    const formatDateVal = window.DateUtil ? window.DateUtil.format : formatDateObj;

    document.getElementById("patientInfoTable").innerHTML = `
        <tr><td style="width: 30%; font-weight: bold;">Patient ID</td><td>${patient.patientId}</td></tr>
        <tr><td style="font-weight: bold;">Name</td><td>${patient.firstName} ${patient.lastName}</td></tr>
        <tr><td style="font-weight: bold;">Phone</td><td>${patient.phone}</td></tr>
    `;

    /* TREATMENTS & DOCTORS */
    let treatmentRows = "";
    encounters.forEach(e => {
        treatmentRows += `
        <tr>
            <td>${formatDateVal(e.date)}</td>
            <td>${e.staffId?.name || "N/A"}</td>
            <td>${e.treatment || "N/A"}</td>
            <td>${e.cost || 0}</td>
        </tr>
        `;
    });
    document.getElementById("treatmentTable").innerHTML = treatmentRows || '<tr><td colspan="4" style="text-align:center">No treatments found</td></tr>';

    /* PRESCRIPTIONS */
    let presRows = "";
    prescriptions.forEach(p => {
        const doc = doctors.find(d => d.staffId === p.staffId);
        presRows += `
        <tr>
            <td>${formatDateVal(p.date)}</td>
            <td>${doc ? doc.name : "N/A"}</td>
            <td>${p.medicines || "N/A"}</td>
        </tr>
        `;
    });
    document.getElementById("prescriptionTable").innerHTML = presRows || '<tr><td colspan="3" style="text-align:center">No prescriptions found</td></tr>';

    /* BILLING */
    document.getElementById("totalAmount").innerText = (billing.totalPaid + billing.totalBalance) || 0;
    document.getElementById("paidAmount").innerText = billing.totalPaid || 0;
    document.getElementById("creditAmount").innerText = billing.totalCredits || 0;
    document.getElementById("balanceAmount").innerText = billing.totalBalance || 0;
};

/* DOWNLOAD */
window.downloadPatientRecord = function () {
    if (!currentPatientExportData) {
        Toast.warning("Search a patient first");
        return;
    }

    const content = JSON.stringify(currentPatientExportData, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient_record_${currentPatientExportData.patient.patientId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success("Record downloaded");
};

// =======================
// Asset Management
// =======================
window.openPatientAssetsFolder = async function () {
    if (window.__pakteeth__ && window.__pakteeth__.openAssetsFolder) {
        try {
            await window.__pakteeth__.openAssetsFolder('patients');
            Toast.info("Opened patients image folder. Paste a .jpg or .png with the exact patient name here, then reload.");
        } catch (err) {
            console.error("Failed to open folder:", err);
            Toast.error("Failed to open folder.");
        }
    } else {
        Toast.warning("This feature is only available in the desktop application.");
    }
};