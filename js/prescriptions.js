// ====== prescriptions.js — Connected to MongoDB via REST API ======

// In-memory state (loaded from API on page load)
let prescriptions = [];
let patients = [];
let doctors = [];
let systemMedicines = []; // Added for permanent medication library
let editingRx = null;
let currentPatientId = null;

// Pagination State
let currentRxPage = 1;
const rxPerPage = 5;
let filteredRxList = [];

// Get patient ID from URL
function getPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}



// ====== Load Data from API ======
async function loadData() {
    try {
        const patientId = getPatientId();

        if (patientId) {
            const patient = await APP.api.get(`/patients/${patientId}`);
            patients = [patient];
            currentPatientId = patientId;

            // Standardize Profile UI (Align with Dental Chart)
            if (typeof populateProfile === 'function') {
                window.selectedPatient = patient;
                populateProfile();
            }

            // Load prescriptions for this specific patient
            prescriptions = await APP.api.get(`/prescriptions/patient/${patientId}`);
        } else {
            // Load all patients for dropdown (admin view)
            const pRes = await APP.api.get("/patients");
            patients = pRes.patients || pRes;

            // Load all prescriptions (admin view)
            prescriptions = await APP.api.get("/prescriptions");
        }

        // Load doctors for dropdown
        doctors = await APP.api.get("/staff");

        // Load permanent medication library
        try {
            systemMedicines = await APP.api.get("/medications");
            renderQuickAddSection();
        } catch (mErr) {
            console.error("Failed to load medication library:", mErr);
            systemMedicines = [];
        }

        populatePatientDropdown();
        populateDoctorDropdown();
        renderRxTable();
    } catch (err) {
        console.error("Failed to load prescription data:", err);
    }
}

// ====== Populate Dropdowns ======
function populatePatientDropdown() {
    const sel = document.getElementById("rx_patientId");
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Patient...</option>';
    patients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.patientId || p._id;
        opt.textContent = `${p.firstName} ${p.lastName} (${Utils.formatPatientId(p.patientId || p._id)})`;
        sel.appendChild(opt);
    });
}

function populateDoctorDropdown() {
    const sel = document.getElementById("rx_doctor");
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Doctor...</option>';
    doctors.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.staffId || d._id;
        opt.textContent = d.name;
        sel.appendChild(opt);
    });
}

// ====== Render Prescriptions Table ======
function renderRxTable(data) {
    let list = [...(data || prescriptions)];

    // Reverse-chronological sort: newest first
    list.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        if (dateB - dateA !== 0) return dateB - dateA;

        // If dates are same, sort by Rx_id (descending)
        const idA = a.Rx_id || "";
        const idB = b.Rx_id || "";
        return idB.localeCompare(idA);
    });

    filteredRxList = list;

    // Reset page if data changed and current page is out of bounds
    const totalPages = Math.ceil(filteredRxList.length / rxPerPage);
    if (currentRxPage > totalPages) currentRxPage = totalPages || 1;

    const tbody = document.querySelector("#rxTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (filteredRxList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No prescriptions found</td></tr>`;
        const paginationContainer = document.getElementById("rxPagination");
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    // Slice for pagination
    const startIndex = (currentRxPage - 1) * rxPerPage;
    const paginated = filteredRxList.slice(startIndex, startIndex + rxPerPage);

    paginated.forEach(rx => {
        const patientName = getPatientName(rx.patientId);
        const doctorName = getDoctorName(rx.staffId);
        const rxDate = (rx.date && rx.date.includes('T')) ? rx.date.split('T')[0] : (rx.date || "");
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${rxDate}</td>
            <td>${rx.Rx_id || "Rx---"}</td>
            <td>${patientName}</td>
            <td>${doctorName}</td>
            <td>${rx.diagnosis || "-"}</td>
            <td><span class="badge badge-${rx.status === 'locked' ? 'success' : 'warning'}">${rx.status || "draft"}</span></td>
            <td>
                <div class="rx-hud-wrapper">
                    <button class="rx-hud-trigger" onclick="PrescriptionHUD.toggle(this, '${rx._id}', ${rx.status === 'locked'})" title="Actions">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderRxPagination(filteredRxList.length);
}

function renderRxPagination(totalItems) {
    const paginationContainer = document.getElementById("rxPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / rxPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changeRxPage(${currentRxPage - 1})" ${currentRxPage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    const delta = 1;
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentRxPage - delta && i <= currentRxPage + delta)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeRxPage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `<button class="pagination-number ${i === currentRxPage ? 'active' : ''}" onclick="changeRxPage(${i})">${i}</button>`;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeRxPage(${currentRxPage + 1})" ${currentRxPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

window.changeRxPage = function (page) {
    currentRxPage = page;
    renderRxTable(filteredRxList);
};

function getPatientName(patientId) {
    const p = patients.find(p => (p.patientId || p._id) === patientId);
    return p ? `${p.firstName} ${p.lastName}` : (patientId || "-");
}

function getDoctorName(staffId) {
    const d = doctors.find(d => (d.staffId || d._id) === staffId);
    return d ? d.name : (staffId || "-");
}

// ====== Filter Prescriptions ======
window.filterRx = function () {
    currentRxPage = 1;
    const type = document.getElementById("searchTypeRx").value;
    const query = (document.getElementById("searchRx").value || "").toLowerCase();
    const filtered = prescriptions.filter(rx => {
        const name = getPatientName(rx.patientId).toLowerCase();
        const rxId = (rx.Rx_id || rx._id || "").toLowerCase();
        const pId = (rx.patientId || "").toLowerCase();
        const date = (rx.date || "").toLowerCase();
        const diagnosis = (rx.diagnosis || "").toLowerCase();
        
        const idMatch = rxId.includes(query) || pId.includes(query);
        
        if (type === "all") return idMatch || name.includes(query) || date.includes(query) || diagnosis.includes(query);
        if (type === "id") return idMatch;
        if (type === "name") return name.includes(query);
        if (type === "date") return date.includes(query);
        if (type === "diagnosis") return diagnosis.includes(query);
        return true;
    });
    renderRxTable(filtered);
};

window.openNewRxModal = function () {
    editingRx = null;
    const form = document.getElementById("rxInitForm");
    if (form) form.reset();
    
    const container = document.getElementById("medicinesContainer");
    if (container) container.innerHTML = "";
    addMedicineRow();

    // Set default date to today
    const dateInput = document.getElementById("rx_date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Auto-select patient if in patient profile
    const patientId = getPatientId();
    if (form && form.rx_patientId) {
        if (patientId) {
            form.rx_patientId.value = patientId;
            form.rx_patientId.disabled = true;
            updateMedicalContext(patientId);
        } else {
            form.rx_patientId.disabled = false;
            document.getElementById("rx_medical_context").style.display = "none";
        }
    }

    Modal.open("prescriptionModal");
};

// Update Medical Context Summary in Modal
window.updateMedicalContext = function(patientId) {
    const contextEl = document.getElementById("rx_medical_context");
    const historyEl = document.getElementById("rx_history_summary");
    const notesEl = document.getElementById("rx_notes_summary");
    
    if (!contextEl || !historyEl || !notesEl) return;

    const patient = patients.find(p => (p.patientId || p._id) === patientId);
    if (!patient) {
        contextEl.style.display = "none";
        return;
    }

    // Medical History Summary
    const mh = patient.medicalHistory || {};
    const labels = {
        hypertension: 'Hypertension',
        diabetes: 'Diabetes',
        cardiacIllness: 'Cardiac illness',
        cardiacStunt: 'Cardiac Stunt',
        hepatitisB: 'Hepatitis B',
        hepatitisC: 'Hepatitis C',
        syphilis: 'Syphilis',
        hiv: 'HIV',
        aids: 'AIDS',
        dengue: 'Dengue',
        hyperthyroidism: 'Hyperthyroidism',
        hypothyroidism: 'Hypothyroidism'
    };
    const checked = Object.keys(labels).filter(key => mh[key]).map(key => labels[key]);
    
    const historyText = checked.length > 0 ? `History: ${checked.join(", ")}` : "No specific medical history marked.";
    historyEl.textContent = historyText;

    // Patient Notes Summary
    const notes = patient.medicalHistoryNotes || "";
    notesEl.textContent = notes ? `Clinical Notes: ${notes}` : "No clinical notes available.";

    contextEl.style.display = (checked.length > 0 || notes) ? "block" : "none";
};

// ====== Dynamic Medication Library ======
function renderQuickAddSection() {
    const container = document.getElementById("quickAddContainer");
    if (!container) return;

    container.innerHTML = '<div class="quick-label">Quick Add — Clinical Medications</div>';
    systemMedicines.forEach(med => {
        const span = document.createElement("span");
        span.className = "q-chip";
        span.textContent = med.name;
        // Escape quotes if needed, though usually med properties are simple strings
        const dosage = (med.defaultDosage || "").replace(/'/g, "\\'");
        const freq = (med.defaultFrequency || "").replace(/'/g, "\\'");
        const duration = (med.defaultDuration || "").replace(/'/g, "\\'");
        span.setAttribute("onclick", `quickAdd('${med.name.replace(/'/g, "\\'")}', '${dosage}', '${freq}', '${duration}')`);
        container.appendChild(span);
    });
}

window.quickAdd = function (name, dosage, freq, duration) {
    addMedicineRow({ name, dosage, frequency: freq, duration });
};

window.setDiagnosis = function (el, text) {
    document.getElementById('rx_diagnosis').value = text;
    document.querySelectorAll('.d-badge').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
};

function updateCount() {
    const rows = document.querySelectorAll('.rx-med-row').length;
    const countEl = document.getElementById('med-count');
    const emptyEl = document.getElementById('empty-state');
    if (countEl) countEl.textContent = rows;
    if (emptyEl) {
        if (rows === 0) emptyEl.classList.add('show');
        else emptyEl.classList.remove('show');
    }
}

// ====== Add Medicine Row ======
window.addMedicineRow = function (med = {}) {
    const container = document.getElementById("medicinesContainer");
    if (!container) return;
    const id = 'med_' + Date.now() + Math.random().toString().substring(2, 6);
    const row = document.createElement("div");
    row.classList.add("rx-med-row");
    row.id = id;
    row.innerHTML = `
        <input type="text" placeholder="Medicine Name" class="med-name" value="${med.name || ""}" required>
        <input type="text" placeholder="Dosage" value="${med.dosage || ""}" required>
        <input type="text" placeholder="Frequency" value="${med.frequency || ""}" required>
        <input type="text" placeholder="Duration" value="${med.duration || ""}" required>
        <button type="button" class="rx-remove-btn" onclick="removeRow('${id}')">Remove</button>
    `;
    container.appendChild(row);
    updateCount();
    // Focus first empty field
    if (!med.name) {
        const emptyInput = row.querySelector('input[value=""]');
        if (emptyInput) emptyInput.focus();
    }
};

window.removeRow = function (id) {
    const row = document.getElementById(id);
    if (row) {
        row.style.transition = 'opacity 0.15s, transform 0.15s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(12px)';
        setTimeout(() => {
            row.remove();
            updateCount();
        }, 150);
    }
};


// ====== Save Prescription ======
window.saveRx = async function (status) {
    const form = document.getElementById("rxInitForm");
    const patientId = form.rx_patientId.value;
    const staffId = form.rx_doctor.value;
    const date = form.rx_date.value;
    const diagnosis = document.getElementById("rx_diagnosis").value;
    const allergies = document.getElementById("rx_allergies") ? document.getElementById("rx_allergies").value : "";

    const newMedsToLearn = [];
    const medications = Array.from(document.querySelectorAll(".rx-med-row")).map(row => {
        const inputs = row.querySelectorAll("input");
        const name = inputs[0].value.trim();
        const dosage = inputs[1].value.trim();
        const frequency = inputs[2].value.trim();
        const duration = inputs[3].value.trim();

        // Dynamic learning check
        if (name && !systemMedicines.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            newMedsToLearn.push({ name, defaultDosage: dosage, defaultFrequency: frequency, defaultDuration: duration });
        }

        return { name, dosage, frequency, duration };
    });

    if (!patientId || !staffId || !date || medications.length === 0) {
        Toast.error("Please fill all required fields and add at least one medicine.");
        return;
    }

    const rxData = { patientId, staffId, date, diagnosis, allergies, medications, status };

    try {
        if (editingRx) {
            await fetch(`${API_BASE}/prescriptions/${editingRx._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rxData)
            });
        } else {
            await fetch(`${API_BASE}/prescriptions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rxData)
            });
        }

        // Post new medicines to library
        if (newMedsToLearn.length > 0) {
            for (const m of newMedsToLearn) {
                try {
                    await fetch(`${API_BASE}/medications`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(m)
                    });
                } catch (err) { console.error("Failed to learn medicine:", err); }
            }
        }

        await loadData();
        Modal.close("prescriptionModal");
        if (status === "locked") {
            const rx = prescriptions[prescriptions.length - 1];
            if (rx) printRx(rx._id);
        }
    } catch (err) {
        console.error("Failed to save prescription:", err);
        Toast.error("Failed to save prescription.");
    }
};

// ====== Edit Prescription ======
window.editRx = function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx || rx.status === "locked") return;
    editingRx = rx;
    const form = document.getElementById("rxInitForm");
    form.rx_patientId.value = rx.patientId;
    form.rx_doctor.value = rx.staffId;
    form.rx_date.value = rx.date;
    form.rx_diagnosis.value = rx.diagnosis || "";
    if (document.getElementById("rx_allergies")) document.getElementById("rx_allergies").value = rx.allergies || "";
    
    // Update Medical Context
    updateMedicalContext(rx.patientId);

    const container = document.getElementById("medicinesContainer");
    container.innerHTML = "";
    (rx.medications || []).forEach(m => addMedicineRow(m));
    updateCount();
    Modal.open("prescriptionModal");
};

// ====== Delete Prescription ======
window.deleteRx = async function (rxId) {
    const ok = await Confirm.show("Delete this prescription?");
    if (!ok) return;
    try {
        await fetch(`${API_BASE}/prescriptions/${rxId}`, { method: "DELETE" });
        await loadData();
    } catch (err) {
        console.error("Failed to delete prescription:", err);
        Toast.error("Failed to delete prescription.");
    }
};

// ====== Print Prescription ======
window.printRx = function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx) {
        Toast.error("Prescription not found.");
        return;
    }

    const pName = document.getElementById("heroName")?.textContent || getPatientName(rx.patientId);
    const pId = document.getElementById("heroId")?.textContent?.replace('Patient ID: ', '') || rx.patientId || "-";
    const dName = getDoctorName(rx.staffId);
    const rxDate = rx.date ? rx.date.split('T')[0] : "-";

    const printHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Prescription - ${pName}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
            .header p { margin: 5px 0 0 0; color: #7f8c8d; }
            .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details span { font-weight: bold; color: #555; }
            .section-title { font-size: 18px; font-weight: bold; color: #2766ba; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .rx-content { margin-top: 20px; }
            .med-item { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2766ba; }
            .med-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .med-details { color: #666; font-size: 14px; }
            .footer { margin-top: 80px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; }
            @media print {
                body { padding: 20px; }
                .med-item { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PakTeeth Dental Clinic</h1>
            <p>Medical Prescription</p>
        </div>
        
        <div class="row">
            <div class="details">
                <p><span>Patient Name:</span> ${pName}</p>
                <p><span>Patient ID:</span> ${pId}</p>
            </div>
            <div class="details" style="text-align: right;">
                <p><span>Date:</span> ${rxDate}</p>
                <p><span>Doctor:</span> ${dName}</p>
            </div>
        </div>

        <div class="rx-content">
            <div class="section-title">Diagnosis</div>
            <p>${rx.diagnosis || "No diagnosis provided."}</p>

            <div class="section-title" style="margin-top: 25px;">Medications</div>
            ${(rx.medications || []).map(m => `
                <div class="med-item">
                    <div class="med-name">${m.name}</div>
                    <div class="med-details">${m.dosage} — ${m.frequency} — ${m.duration}</div>
                </div>
            `).join("")}
        </div>

        ${rx.allergies ? `
            <div class="section-title" style="margin-top:25px; color: #dc3545; border-bottom-color: #dc3545;">Allergies / Precautions</div>
            <p>${rx.allergies}</p>
        ` : ""}

        <div class="footer">
            <p>This is a computer-generated prescription. Valid without physical signature.</p>
            <p>Thank you for choosing PakTeeth!</p>
        </div>
        <script>
            window.onload = function() {
                window.print();
            }
        </script>
    </body>
    </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    document.body.appendChild(iframe);

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(printHtml);
    iframe.contentWindow.document.close();

    // Use a slightly longer delay for browser print dialog initialization
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
};

// ====== Share Prescription via Email ======
window.shareRxEmail = function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx) {
        Toast.error("Prescription not found.");
        return;
    }

    const pName = document.getElementById("heroName")?.textContent || getPatientName(rx.patientId);
    const pId = document.getElementById("heroId")?.textContent?.replace('Patient ID: ', '') || rx.patientId || "-";
    const dName = getDoctorName(rx.staffId);
    const rxDate = rx.date ? rx.date.split('T')[0] : "-";
    const title = `Prescription for ${pName}`;
    const filename = `Prescription_${pName.replace(/\\s+/g, '_')}_${rxDate}.pdf`;

    const printHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
            .header p { margin: 5px 0 0 0; color: #7f8c8d; }
            .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details span { font-weight: bold; color: #555; }
            .section-title { font-size: 18px; font-weight: bold; color: #2766ba; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .rx-content { margin-top: 20px; }
            .med-item { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2766ba; }
            .med-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .med-details { color: #666; font-size: 14px; }
            .footer { margin-top: 80px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PakTeeth Dental Clinic</h1>
            <p>Medical Prescription</p>
        </div>
        
        <div class="row">
            <div class="details">
                <p><span>Patient Name:</span> ${pName}</p>
                <p><span>Patient ID:</span> ${pId}</p>
            </div>
            <div class="details" style="text-align: right;">
                <p><span>Date:</span> ${rxDate}</p>
                <p><span>Doctor:</span> ${dName}</p>
            </div>
        </div>

        <div class="rx-content">
            <div class="section-title">Diagnosis</div>
            <p>${rx.diagnosis || "No diagnosis provided."}</p>

            <div class="section-title" style="margin-top: 25px;">Medications</div>
            ${(rx.medications || []).map(m => `
                <div class="med-item">
                    <div class="med-name">${m.name}</div>
                    <div class="med-details">${m.dosage} — ${m.frequency} — ${m.duration}</div>
                </div>
            `).join("")}
        </div>

        ${rx.allergies ? `
            <div class="section-title" style="margin-top:25px; color: #dc3545; border-bottom-color: #dc3545;">Allergies / Precautions</div>
            <p>${rx.allergies}</p>
        ` : ""}

        <div class="footer">
            <p>This is a computer-generated prescription. Valid without physical signature.</p>
            <p>Thank you for choosing PakTeeth!</p>
        </div>
    </body>
    </html>
    `;

    if (window.Share && window.Share.openEmailModal) {
        window.Share.openEmailModal(title, filename, printHtml);
    } else {
        Toast.error("Email sharing system is not available.");
    }
};

// ====== Share Prescription via WhatsApp ======
window.shareRxWhatsApp = function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx) { Toast.error("Prescription not found."); return; }

    const patient = patients.find(p => (p.patientId || p._id) === (rx.patientId || rx.patientId));
    const phone = patient?.phone;
    const pName = patient ? `${patient.firstName} ${patient.lastName}` : getPatientName(rx.patientId);
    const rxDate = rx.date ? rx.date.split('T')[0] : "-";
    const dName = getDoctorName(rx.staffId);
    const title = `Prescription for ${pName}`;
    const filename = `Prescription_${pName.replace(/\s+/g, '_')}_${rxDate}.pdf`;
    const medsList = (rx.medications || []).map(m => `  • ${m.name} — ${m.dosage} — ${m.frequency} — ${m.duration}`).join('\n');

    const printHtml = `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .details span { font-weight: bold; color: #555; }
        .section-title { font-size: 18px; font-weight: bold; color: #2766ba; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .med-item { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2766ba; }
        .med-name { font-weight: bold; font-size: 16px; }
        .med-details { color: #666; font-size: 14px; }
        .footer { margin-top: 80px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; }
    </style></head><body>
    <div class="header"><h1>PakTeeth Dental Clinic</h1><p>Medical Prescription</p></div>
    <div class="row">
        <div class="details"><p><span>Patient:</span> ${pName}</p><p><span>Doctor:</span> ${dName}</p></div>
        <div class="details" style="text-align:right"><p><span>Date:</span> ${rxDate}</p></div>
    </div>
    <div class="section-title">Diagnosis</div><p>${rx.diagnosis || "No diagnosis provided."}</p>
    <div class="section-title" style="margin-top:25px">Medications</div>
    ${(rx.medications || []).map(m => `<div class="med-item"><div class="med-name">${m.name}</div><div class="med-details">${m.dosage} — ${m.frequency} — ${m.duration}</div></div>`).join("")}
    ${rx.allergies ? `<div class="section-title" style="margin-top:25px;color:#dc3545">Allergies</div><p>${rx.allergies}</p>` : ""}
    <div class="footer"><p>Thank you for choosing PakTeeth!</p></div>
    </body></html>`;

    if (window.Share?.openWhatsAppPDF) {
        window.Share.openWhatsAppPDF(title, filename, printHtml, phone, pName);
    } else {
        Toast.error("WhatsApp sharing is not available.");
    }
};

// ====== Share Prescription via WhatsApp (Automated) ======
window.shareRxWhatsAppAuto = async function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx) { Toast.error("Prescription not found."); return; }

    const patient = patients.find(p => (p.patientId || p._id) === rx.patientId);
    const phone = patient?.phone;
    if (!phone) { Toast.error("Patient has no phone number."); return; }

    const pName = patient ? `${patient.firstName} ${patient.lastName}` : getPatientName(rx.patientId);
    const rxDate = rx.date ? rx.date.split('T')[0] : "-";
    const dName = getDoctorName(rx.staffId);

    const message = `Halo ${pName}, your prescription from PakTeeth Dental Clinic has been issued by Dr. ${dName} on ${rxDate}.\n\nMedications:\n${(rx.medications || []).map(m => `• ${m.name} (${m.dosage})`).join('\n')}\n\nGet well soon!`;

    await Share.sendWhatsAppAutomated(phone, message);
};


// ====== Share Prescription via SMS ======
window.shareRxSMS = function (rxId) {
    const rx = prescriptions.find(r => r._id === rxId);
    if (!rx) { Toast.error("Prescription not found."); return; }

    const patient = patients.find(p => (p.patientId || p._id) === (rx.patientId || rx.patientId));
    const phone = patient?.phone;
    if (!phone) { Toast.error("Patient has no phone number."); return; }

    const pName = patient ? `${patient.firstName} ${patient.lastName}` : getPatientName(rx.patientId);
    const rxDate = rx.date ? rx.date.split('T')[0] : "-";
    const dName = getDoctorName(rx.staffId);

    // Create a concise SMS message
    const meds = (rx.medications || []).map(m => `• ${m.name} (${m.dosage})`).join('\n');
    const message = `PakTeeth Clinic\nPrescription for ${pName}\nDate: ${rxDate}\nDr. ${dName}\n\nMedications:\n${meds}\n\nGet well soon!`;

    if (window.Share?.sendSMS) {
        window.Share.sendSMS(phone, message);
    } else {
        Toast.error("SMS sharing is not available.");
    }
};

// ====== Export CSV ======
window.exportRx = function () {
    if (prescriptions.length === 0) { Toast.warning("No prescriptions to export"); return; }
    const headers = ["Date", "Rx ID", "Patient", "Doctor", "Diagnosis", "Status", "Medicines"];
    const csvRows = [headers.join(",")];
    prescriptions.forEach(rx => {
        const meds = (rx.medications || []).map(m => `${m.name}(${m.dosage},${m.frequency},${m.duration})`).join("|");
        const row = [
            rx.date || "",
            rx.Rx_id || rx._id || "",
            getPatientName(rx.patientId),
            getDoctorName(rx.staffId),
            rx.diagnosis || "",
            rx.status || "draft",
            `"${meds}"`
        ];
        csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prescriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
};

// ====== Initialize (Encounter module is on the same page) ======
document.addEventListener("DOMContentLoaded", () => {
    loadData();

    // Event listener for New Prescription Button (as requested)
    const newRxBtn = document.getElementById("newPrescriptionBtn");
    if (newRxBtn) {
        newRxBtn.addEventListener("click", () => {
            const pid = currentPatientId || getPatientId() || '';
            window.location.href = `../prescription/dental_rehab_prescription.html?patientId=${pid}`;
        });
    }

    // Add listener to patient dropdown for medical context updates
    const patientSel = document.getElementById("rx_patientId");
    if (patientSel) {
        patientSel.addEventListener("change", (e) => {
            updateMedicalContext(e.target.value);
        });
    }

    // Close modals on backdrop click
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) Modal.close(overlay.id);
        });
    });
});