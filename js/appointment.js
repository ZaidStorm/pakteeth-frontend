// js/appointment.js - Appointments Management

let currentPageAppt = 1;
const rowsPerPageAppt = 5;

// Data arrays - loaded from API
let appointmentPatients = [];
let appointmentsData = [];
let filteredAppointmentsList = [];
var doctorsData = [];

/* ===============================
   Toast Notification
================================ */
function showToast(message, type = "info") {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '10px 20px';
    toast.style.color = '#fff';
    toast.style.borderRadius = '5px';
    toast.style.fontWeight = '500';
    toast.style.zIndex = 9999;
    toast.style.backgroundColor = type === "success" ? "green" :
        type === "error" ? "red" :
            "blue";
    toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";

    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => toast.style.opacity = "1", 10);

    // Auto remove after 2.5 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
// =======================
// Patient ID Generation
// =======================
function generatePatientId() {
    // Find the highest existing patient ID
    let maxId = 0;
    appointmentPatients.forEach(patient => {
        if (patient.patientId && patient.patientId.startsWith('P')) {
            const idNum = parseInt(patient.patientId.substring(1));
            if (!isNaN(idNum) && idNum > maxId) {
                maxId = idNum;
            }
        }
    });

    // Generate new ID
    const newId = maxId + 1;
    return `P${String(newId).padStart(3, '0')}`;
}

// Get patient ID from URL
function getPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/* ===============================
   Load Data from API
================================ */
async function loadAppointmentsData() {
    try {
        const patientId = getPatientId();

        // If patient ID is provided, load patient-specific appointments
        if (patientId) {
            // Load specific patient data
            const patientData = await APP.api.get(`/patients/${patientId}`);
            appointmentPatients = [patientData];

            if (typeof populateProfile === 'function') {
                window.selectedPatient = patientData;
                populateProfile();
            }

            // Load appointments for this specific patient
            appointmentsData = await APP.api.get(`/appointments/patient/${patientId}`);
        } else {
            // Load all patients (admin view) - handle paginated response
            const res = await APP.api.get("/patients?limit=1000");
            appointmentPatients = res.patients || res;

            // Load all appointments (admin view)
            appointmentsData = await APP.api.get("/appointments");
        }

        // Load doctors for dentist dropdowns
        doctorsData = await APP.api.get("/staff");

        renderAppointments();
        populateDentistDropdowns();
    } catch (err) {
        console.error("Failed to load appointments:", err);
    }
}

/* ===============================
   Populate Dentist Dropdowns
================================ */
function populateDentistDropdowns() {
    // Populate filter dropdown
    const filterDentist = document.getElementById("filterDentist");
    if (filterDentist) {
        filterDentist.innerHTML = '<option value="">All Dentists</option>';
        doctorsData.forEach(doctor => {
            if (doctor.role === 'Doctor') {
                filterDentist.innerHTML += `<option value="${doctor.name}">${doctor.name}</option>`;
            }
        });
    }

    // Populate modal dropdown
    const modalDentist = document.getElementById("apt_dentist");
    if (modalDentist) {
        modalDentist.innerHTML = '<option value="">Select Dentist</option>';
        doctorsData.forEach(doctor => {
            if (doctor.role === 'Doctor') {
                modalDentist.innerHTML += `<option value="${doctor.name}">${doctor.name}</option>`;
            }
        });
    }
}





async function loadAppointmentById(appointmentId) {
    try {
        const appt = await APP.api.get(`/appointments/${appointmentId}`);
        if (!appt) return;

        // Add it to local appointmentsData if not already present
        const exists = appointmentsData.find(a => (a._id || a.id) === appointmentId || a.appointmentId === appointmentId);
        if (!exists) appointmentsData.push(appt);

        console.log("Loaded appointment:", appt);
    } catch (err) {
        console.error("Failed to load appointment by ID:", err);
    }
}

function openPatientProfile(patientId) {
    window.location.href = `/pages/patients/patient-profile.html?id=${patientId}`;
}

/* ===============================
   Pagination
================================ */
window.changePageAppt = function (page) {
    currentPageAppt = page;
    renderAppointments();
};

/* ===============================
   Render Appointments
================================ */
function renderAppointments() {
    const dateInput = document.getElementById("filterDate");
    const filterDate = dateInput && dateInput.value ? dateInput.value : "all";
    const filterDentist = document.getElementById("filterDentist")?.value || "";
    const filterStatus = document.getElementById("filterStatus")?.value || "";
    const query = document.getElementById("searchAppt")?.value.toLowerCase() || "";
    const type = document.getElementById("searchTypeAppt")?.value || "";

    let filtered = appointmentsData.filter(a => {
        if (filterDate !== "all" && a.date !== filterDate) return false;
        if (filterDentist && a.dentist !== filterDentist) return false;
        if (filterStatus && a.status !== filterStatus) return false;

        const pName = `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.toLowerCase();
        const aptId = (a.appointmentId || a._id || a.id || '').toLowerCase();
        const pId = (a.patientId?.patientId || a.patientId || '').toLowerCase();
        const pPhone = (a.patientId?.phone || '').toLowerCase();

        const idMatch = aptId.includes(query) || pId.includes(query);
        const nameMatch = pName.includes(query);
        const dateMatch = (a.date || '').includes(query);
        const phoneMatch = pPhone.includes(query);

        if (query) {
            if (type === "id") return idMatch;
            if (type === "name") return nameMatch;
            if (type === "date") return dateMatch;
            
            return idMatch || nameMatch || dateMatch || phoneMatch || (a.type || '').toLowerCase().includes(query) || (a.dentist || '').toLowerCase().includes(query);
        }

        return true;
    });

    filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        return dateB - dateA;
    });

    const totalPages = Math.ceil(filtered.length / rowsPerPageAppt);
    if (currentPageAppt > totalPages)
        currentPageAppt = totalPages || 1;

    const paginated = filtered.slice(
        (currentPageAppt - 1) * rowsPerPageAppt,
        currentPageAppt * rowsPerPageAppt
    );

    const tbody = document.querySelector("#appointmentsTable tbody");
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML =
            `<tr>
            <td colspan="6" style="text-align:center;color:var(--text-muted)">
            No appointments found
            </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = paginated.map(a => {
        let badgeClass = "badge-warning";
        if (a.status === "confirmed") badgeClass = "badge-success";
        if (a.status === "cancelled") badgeClass = "badge-danger";
        let timerHtml = "";
        if (a.status === "confirmed" && a.startTime) {
            timerHtml = `<div class="timer-active" data-start="${a.startTime}" style="font-size: 0.75rem; color: var(--success-600); font-weight: 600;">Elapsed: ...</div>`;
        } else if (a.status === "done" && a.duration) {
            const mins = Math.floor(a.duration / 60);
            const secs = a.duration % 60;
            timerHtml = `<div style="font-size: 0.75rem; color: var(--gray-500);">Duration: ${mins}m ${secs}s</div>`;
        }

        const aptId = a.appointmentId || a._id || a.id || '';
        const patientName = a.patientName || `${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}`.trim() || a.patientId;
        const patientId = a.patientId?.patientId || a.patientId || '';

        return `
<tr>
<td>
<div style="font-weight:600">${a.time || ''}</div>
<div style="font-size:0.75rem;color:var(--text-muted)">${a.date || ''}</div>
</td>
<td>
<div style="font-weight:500;cursor:pointer;color:var(--primary)" onclick="openPatientProfile('${patientId}')">${patientName}</div>
<div style="font-size:0.75rem;color:var(--text-muted)">ID: ${patientId}</div>
</td>
<td>${a.type || ''}</td>
<td>${a.dentist || ''}</td>
<td>
    <span class="badge ${badgeClass} badge-clickable" onclick="changeApptStatus('${aptId}', '${a.status}')">${a.status || ''}</span>
    ${timerHtml}
</td>
<td>
    <div class="appt-hud-wrapper">
        <button class="appt-hud-trigger" onclick="AppointmentHUD.toggle(this, '${aptId}', '${patientId}')" title="Actions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
    </div>
</td>
</tr>`;
    }).join("");

    renderAppointmentPagination(filtered.length);
}

function renderAppointmentPagination(totalItems) {
    const paginationContainer = document.getElementById("appointmentPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / rowsPerPageAppt);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changePageAppt(${currentPageAppt - 1})" ${currentPageAppt === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    const delta = 1;
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPageAppt - delta && i <= currentPageAppt + delta)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changePageAppt(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `<button class="pagination-number ${i === currentPageAppt ? 'active' : ''}" onclick="changePageAppt(${i})">${i}</button>`;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changePageAppt(${currentPageAppt + 1})" ${currentPageAppt === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

/* ===============================
   Delete Appointment
================================ */
async function deleteAppointment(id) {
    const ok = await Confirm.show("Delete appointment?");
    if (!ok) return;

    try {
        await APP.api.delete(`/appointments/${id}`);
        appointmentsData = appointmentsData.filter(a => (a._id || a.id) !== id);
        renderAppointments();
        Toast.success("Appointment deleted successfully");
        if (typeof APP.refreshAppointmentBadge === 'function') APP.refreshAppointmentBadge();
    } catch (err) {
        console.error("Failed to delete appointment:", err);
        Toast.error("Failed to delete appointment");
    }
}

/* ===============================
   WhatsApp Sender
================================ */
function sendWhatsApp(id) {
    // Find appointment by _id, id, or appointmentId
    const apt = findAppointmentForMessage(appointmentsData, id);
    if (!apt) {
        showToast("Appointment not found", "error");
        return;
    }

    // Get patient object from populated patientId
    const patient = typeof apt.patientId === 'object' ? apt.patientId : findPatientForMessage(appointmentPatients, apt.patientId);

    if (!patient || !patient.phone) {
        showToast("Patient phone not found", "error");
        return;
    }

    // Normalize phone number (Targeting 923xxxxxxxxx for WhatsApp)
    let phone = patient.phone.replace(/\D/g, "");
    if (phone.startsWith("92") && phone.length === 13) {
        // Already normalized
    } else if (phone.startsWith("0")) {
        phone = "92" + phone.substring(1);
    } else if (phone.length === 11) {
        phone = "92" + phone;
    }

    const message = `Hello ${patient.firstName || ''} ${patient.lastName || ''},\n\nYour dental appointment is scheduled.\n\nDoctor: ${apt.dentist || ''}\nDate: ${apt.date || ''}\nTime: ${apt.time || ''}\n\nPakTeeth Clinic`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    showToast(`WhatsApp message opened for ${patient.firstName || ''} ${patient.lastName || ''}`, "success");
}

// Calculate invoice balance
function calcAptBalance() {
    const amount = parseFloat(document.getElementById("inv_amount").value) || 0;
    const discount = parseFloat(document.getElementById("inv_discount").value) || 0;
    const paid = parseFloat(document.getElementById("inv_paid").value) || 0;

    const balance = amount - discount - paid;
    document.getElementById("inv_balance_label").textContent = balance.toFixed(2);
}

/* ===============================
   Add Appointment Modal
================================ */
function addAppointmentModal() {
    populatePatientDropdown();
    const form = document.getElementById("bookingForm");
    if (form) form.reset();

    // Set default date to today
    const dateInput = document.getElementById("apt_date");
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Fix Bug: Ensure modal UI lists are explicitly unhidden on fresh open
    if (typeof window.clearPatientSelection === 'function') window.clearPatientSelection();

    // Clear patient mode and set to existing
    document.getElementById('patient_mode').value = 'existing';

    // Clear new patient fields explicitly
    document.getElementById("p_firstName").value = '';
    document.getElementById("p_lastName").value = '';
    document.getElementById("p_dob").value = '';
    document.getElementById("p_gender").value = 'Male';
    document.getElementById("p_phone").value = '';
    document.getElementById("p_email").value = '';
    document.getElementById("p_address").value = '';

    // Clear existing patient dropdown
    const patientSelect = document.getElementById("apptPatient");
    const patientId = getPatientId();
    if (patientSelect) {
        if (patientId) {
            // Find option with this patientId
            let found = false;
            for (let i = 0; i < patientSelect.options.length; i++) {
                if (patientSelect.options[i].value === patientId) {
                    patientSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                patientSelect.selectedIndex = 0;
            } else {
                patientSelect.disabled = true;
                if (window.onPatientSelected) window.onPatientSelected();
            }
        } else {
            patientSelect.selectedIndex = 0;
            patientSelect.disabled = false;
        }
    }

    // Clear dentist dropdown
    const dentistSelect = document.getElementById("apt_dentist");
    if (dentistSelect) {
        dentistSelect.selectedIndex = 0;
    }

    // Default to Existing Patient tab
    switchPatientTab('existing');

    Modal.open("addAppointmentModal");
}

function populatePatientDropdown() {
    const select = document.getElementById("apptPatient");
    if (!select) return;

    select.innerHTML = '<option value="">Select Patient From the Following;</option>';
    appointmentPatients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.patientId;
        opt.textContent = `${p.patientId} - ${p.firstName || ''} ${p.lastName || ''}`;
        select.appendChild(opt);
    });

    // Reset search
    const search = document.getElementById("apptPatientSearch");
    if (search) search.value = '';

    const clearBtn = document.getElementById("apptPatientSearchClear");
    if (clearBtn) clearBtn.style.display = 'none';

    const countEl = document.getElementById("apptPatientCount");
    if (countEl) countEl.textContent = `${appointmentPatients.length} patients total`;
}

window.filterPatientDropdown = function () {
    const search = document.getElementById("apptPatientSearch");
    const select = document.getElementById("apptPatient");
    const clearBtn = document.getElementById("apptPatientSearchClear");
    const countEl = document.getElementById("apptPatientCount");
    if (!search || !select) return;

    const term = search.value.trim().toLowerCase();

    // Show/hide clear button
    if (clearBtn) clearBtn.style.display = term ? 'inline' : 'none';

    select.innerHTML = '<option value="">Select Patient From the Following;</option>';

    const matches = term
        ? appointmentPatients.filter(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            const pid = (p.patientId || '').toLowerCase();
            return fullName.includes(term) || pid.includes(term);
        })
        : appointmentPatients;

    matches.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.patientId;
        opt.textContent = `${p.patientId} - ${p.firstName || ''} ${p.lastName || ''}`;
        select.appendChild(opt);
    });

    // Auto-select if only one match
    if (matches.length === 1) {
        select.value = matches[0].patientId;
    }

    // Show count
    if (countEl) {
        if (term) {
            countEl.textContent = matches.length === 0
                ? 'No patients found'
                : `${matches.length} patient${matches.length > 1 ? 's' : ''} found`;
        } else {
            countEl.textContent = `${matches.length} patients total`;
        }
    }
};

window.onPatientSelected = function () {
    const select = document.getElementById("apptPatient");
    const searchGroup = document.getElementById("apptPatientSearchGroup");
    const listGroup = document.getElementById("apptPatientListGroup");
    const confirmCard = document.getElementById("apptPatientConfirm");
    const confirmName = document.getElementById("apptPatientConfirmName");

    if (!select || !select.value) return;

    // Find patient name
    const patientObj = appointmentPatients.find(p => p.patientId === select.value);
    const nameStr = patientObj
        ? `${patientObj.patientId} - ${patientObj.firstName || ''} ${patientObj.lastName || ''}`
        : select.options[select.selectedIndex].text;

    // Show confirmation UI
    if (confirmName) confirmName.textContent = nameStr;
    if (searchGroup) searchGroup.style.display = 'none';
    if (listGroup) listGroup.style.display = 'none';
    if (confirmCard) confirmCard.style.display = 'block';
};

window.clearPatientSelection = function () {
    const select = document.getElementById("apptPatient");
    const searchGroup = document.getElementById("apptPatientSearchGroup");
    const listGroup = document.getElementById("apptPatientListGroup");
    const confirmCard = document.getElementById("apptPatientConfirm");
    const searchInput = document.getElementById("apptPatientSearch");

    // Reset UI
    if (select) select.value = '';
    if (searchGroup) searchGroup.style.display = 'block';
    if (listGroup) listGroup.style.display = 'block';
    if (confirmCard) confirmCard.style.display = 'none';

    // Clear search filter
    if (searchInput) {
        searchInput.value = '';
        if (window.filterPatientDropdown) window.filterPatientDropdown();
    }
};

function switchPatientTab(tab) {
    const existingTab = document.getElementById('tab-existing');
    const newTab = document.getElementById('tab-new');
    const patientModeInput = document.getElementById('patient_mode');

    const tabButtons = document.querySelectorAll('.tabs .tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    if (tab === 'existing') {
        existingTab.style.display = 'block';
        newTab.style.display = 'none';
        patientModeInput.value = 'existing';
        document.querySelector('[data-tab="tab-existing"]').classList.add('active');

        // Clear ALL new patient fields when switching to existing
        clearNewPatientFields();

        // Reset existing patient dropdown to first option ONLY if not viewing a specific patient profile
        const patientSelect = document.getElementById("apptPatient");
        const patientId = getPatientId();
        if (patientSelect && !patientId) {
            patientSelect.selectedIndex = 0;
        }

        console.log("Switched to Existing Patient tab - cleared new patient data");

    } else if (tab === 'new') {
        existingTab.style.display = 'none';
        newTab.style.display = 'block';
        patientModeInput.value = 'new';
        document.querySelector('[data-tab="tab-new"]').classList.add('active');

        // Clear existing patient selection when switching to new
        const patientSelect = document.getElementById("apptPatient");
        if (patientSelect) {
            patientSelect.selectedIndex = 0;
        }

        console.log("Switched to New Patient tab - cleared existing patient selection");
    }

    // Keep appointment and invoice fields as they are (common to both tabs)
}

// Helper function to clear all new patient fields
function clearNewPatientFields() {
    const newPatientFields = [
        "p_firstName",
        "p_lastName",
        "p_dob",
        "p_gender",
        "p_phone",
        "p_email",
        "p_address"
    ];

    newPatientFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = field.type === 'select-one' ? 'Male' : '';
        }
    });
}

async function saveAppointment() {
    const appointmentId = document.getElementById("apt_id")?.value || null;
    const patientMode = document.getElementById("patient_mode").value;
    console.log("Saving appointment with patient mode:", patientMode);

    let patientId;
    if (patientMode === 'existing') {
        patientId = document.getElementById("apptPatient")?.value;
        if (!patientId) {
            // Check if we are in a patient profile where patientId is in URL
            const urlPid = getPatientId();
            if (urlPid) {
                patientId = urlPid;
            } else {
                Toast.error("Please select an existing patient");
                return;
            }
        }

        // Only block if fields were MANUALLY filled (to avoid Browser Auto-fill issues)
        // Check if the tab 'tab-new' is actively being displayed or if fields have significant data
        const firstName = document.getElementById("p_firstName")?.value.trim();
        const lastName = document.getElementById("p_lastName")?.value.trim();
        if (firstName && lastName) {
             console.warn("New patient fields detected in existing patient mode. Proceeding unless active tab is New Patient.");
        }
    } else if (patientMode === 'new') {
        // Collect new patient data
        const firstName = document.getElementById("p_firstName").value.trim();
        const lastName = document.getElementById("p_lastName").value.trim();
        const phone = document.getElementById("p_phone").value.trim();

        if (!firstName || !lastName || !phone) {
            Toast.error("Please fill all required new patient fields (First Name, Last Name, Phone)");
            return;
        }

        // Create patient first
        const newPatient = {
            patientId: generatePatientId(),
            firstName,
            lastName,
            dob: document.getElementById("p_dob").value,
            gender: document.getElementById("p_gender").value,
            phone,
            email: document.getElementById("p_email").value,
            address: document.getElementById("p_address").value
        };

        try {
            const result = await APP.api.post("/patients", newPatient);
            patientId = result.patient?.patientId || result.patientId;
            appointmentPatients.push(result.patient || result);
        } catch (err) {
            console.error("Failed to create patient:", err);
            Toast.error("Failed to create new patient");
            return;
        }
    }

    // Collect appointment data
    const date = document.getElementById("apt_date")?.value;
    const time = document.getElementById("apt_time")?.value;
    const type = document.getElementById("apt_type")?.value;
    const dentist = document.getElementById("apt_dentist")?.value;

    if (!date || !time || !type || !dentist) {
        Toast.error("Please fill all required appointment fields (Date, Time, Type, Dentist)");
        return;
    }

    // Collect invoice data
    const services = document.getElementById("inv_services")?.value;
    const amount = document.getElementById("inv_amount")?.value;
    const discount = document.getElementById("inv_discount")?.value || 0;
    const paid = document.getElementById("inv_paid")?.value || 0;

    if (!services || !amount) {
        Toast.error("Please fill all required invoice fields (Services, Amount)");
        return;
    }

    const balance = parseFloat(amount) - parseFloat(discount) - parseFloat(paid);

    // Get the actual patientId and patientName
    let actualPatientId = patientId;
    let actualPatientName;
    
    if (patientMode === 'existing') {
        const pObj = Array.isArray(appointmentPatients) ? appointmentPatients.find(p => String(p.patientId) === String(patientId)) : null;
        actualPatientName = pObj ? `${pObj.firstName || ''} ${pObj.lastName || ''}`.trim() : patientId;
    } else {
        const fn = document.getElementById("p_firstName").value.trim();
        const ln = document.getElementById("p_lastName").value.trim();
        actualPatientName = `${fn} ${ln}`.trim();
    }

    try {
        const patientIdInUrl = getPatientId();
        const finalPatientId = (patientMode === 'existing' ? (document.getElementById("apptPatient")?.value || patientIdInUrl) : actualPatientId);

        console.log("[saveAppointment] Final patient ID:", finalPatientId);

        const newAppt = {
            patientId: finalPatientId,
            patientName: actualPatientName,
            date,
            time,
            type,
            dentist,
            status: "pending",
            invoice: {
                services,
                amount: parseFloat(amount) || 0,
                discount: parseFloat(discount) || 0,
                paid: parseFloat(paid) || 0,
                balance: balance || 0
            }
        };

        let result;
        if (appointmentId) {
            result = await APP.api.put(`/appointments/${appointmentId}`, newAppt);
            Toast.success("Appointment updated successfully");
        } else {
            result = await APP.api.post("/appointments", newAppt);
            Toast.success("Appointment booked successfully");
        }

        // Save invoice separately via API if amount > 0
        if (parseFloat(amount) > 0) {
            try {
                const amtNum = parseFloat(amount) || 0;
                const discNum = parseFloat(discount) || 0;
                const paidNum = parseFloat(paid) || 0;

                const invoiceData = {
                    date: date || new Date().toISOString().split('T')[0],
                    patientId: finalPatientId,
                    patientName: actualPatientName,
                    doctorId: dentist,
                    doctorName: dentist,
                    services: services.split(",").map(s => s.trim()),
                    items: [{
                        description: services || "Dental Procedure",
                        quantity: 1,
                        unitPrice: amtNum,
                        total: amtNum
                    }],
                    subtotal: amtNum,
                    totalAmount: amtNum,
                    discount: discNum,
                    total: amtNum - discNum,
                    paid: paidNum,
                    balance: Math.max(0, amtNum - discNum - paidNum),
                    status: (amtNum - discNum - paidNum) > 0 ? "Pending" : "Paid",
                    notes: `Appointment on ${date} at ${time}`
                };
                await APP.api.post("/invoices", invoiceData);
                console.log("[saveAppointment] Invoice saved successfully");
            } catch (err) {
                console.error("Failed to save corresponding invoice:", err);
                // We don't block the appointment save if invoice fails
            }
        }

        Modal.close("addAppointmentModal");
        
        // Refresh local data
        if (typeof loadAppointmentsData === 'function') await loadAppointmentsData();
        if (typeof renderAppointments === 'function') renderAppointments();
        
        // Refresh global dashboard if available
        if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
        if (typeof window.fetchCalendarAppointments === 'function') window.fetchCalendarAppointments();

        // Refresh navigation badge
        if (typeof APP.refreshAppointmentBadge === 'function') {
            APP.refreshAppointmentBadge();
        }


        // Reset form
        const form = document.getElementById('bookingForm');
        if (form) form.reset();
        switchPatientTab('existing');

    } catch (err) {
        console.error("Failed to save appointment:", err);
        Toast.error(err.message || "Failed to save appointment");
    }
}

// Helper function to check if new patient fields have data
function hasNewPatientData() {
    const fields = ["p_firstName", "p_lastName", "p_phone"];
    return fields.some(fieldId => {
        const field = document.getElementById(fieldId);
        return field && field.value.trim() !== '';
    });
}
/* ===============================
   Export CSV
================================ */
function exportAppointments() {
    if (appointmentsData.length === 0) {
        Toast.warning("No appointments to export");
        return;
    }

    const headers = ["Date", "Time", "First Name", "Last Name", "Type", "Dentist", "Status"];
    const rows = appointmentsData.map(a => [
        a.date || '',
        a.time || '',
        a.patientId?.firstName || '',
        a.patientId?.lastName || '',
        a.type || '',
        a.dentist || '',
        a.status || ''
    ]);

    Utils.exportToCSV("appointments.csv", headers, rows);
}

/* ===============================
   Filters
================================ */
function filterAppointments() {
    currentPageAppt = 1;
    renderAppointments();
}

/* ===============================
   Initialize
================================ */
document.addEventListener("DOMContentLoaded", async () => {
    // Load data
    await loadAppointmentsData();

    window.deleteAppointment = deleteAppointment;
    window.sendWhatsApp = sendWhatsApp;
    window.filterAppointments = filterAppointments;
    window.addAppointmentModal = addAppointmentModal;
    window.exportAppointments = exportAppointments;
    window.saveAppointment = saveAppointment;
    window.calcAptBalance = calcAptBalance;
    window.loadAppointmentById = loadAppointmentById;
    window.changeApptStatus = changeApptStatus;
});

/* ===============================
   Update Appointment Status
================================ */
async function changeApptStatus(apptId, currentStatus) {
    // Create status picker modal if it doesn't exist
    let picker = document.getElementById('statusPickerModal');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'statusPickerModal';
        picker.className = 'status-picker-modal';
        document.body.appendChild(picker);

        // Add overlay if it doesn't exist
        if (!document.getElementById('pickerOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'pickerOverlay';
            overlay.className = 'modal-overlay';
            overlay.onclick = () => {
                picker.classList.remove('active');
                overlay.classList.remove('active');
            };
            document.body.appendChild(overlay);
        }
    }

    const overlay = document.getElementById('pickerOverlay');
    const statuses = ["pending", "confirmed", "cancelled", "done"];

    picker.innerHTML = `
        <div class="status-picker-header">Update Status</div>
        <div class="status-options">
            ${statuses.map(s => `
                <div class="status-option ${s === currentStatus ? 'selected' : ''}" 
                     onclick="submitStatusChange('${apptId}', '${s}')">
                    ${s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
            `).join('')}
        </div>
    `;

    picker.classList.add('active');
    overlay.classList.add('active');
}

window.submitStatusChange = async function (apptId, newStatus) {
    const picker = document.getElementById('statusPickerModal');
    const overlay = document.getElementById('pickerOverlay');

    try {
        await APP.api.put(`/appointments/${apptId}`, { status: newStatus });

        // Update local data
        const appt = findAppointmentForMessage(appointmentsData, apptId);
        if (appt) appt.status = newStatus;

        renderAppointments();
        Toast.success(`Status updated to ${newStatus}`);
        if (typeof APP.refreshAppointmentBadge === 'function') APP.refreshAppointmentBadge();
    } catch (err) {
        console.error("Failed to update status:", err);
        Toast.error("Failed to update appointment status");
    } finally {
        picker.classList.remove('active');
        overlay.classList.remove('active');
    }
}

