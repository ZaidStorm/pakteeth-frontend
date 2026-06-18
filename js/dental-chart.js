// ====== dental-chart.js ======
// Full FDI Dental Chart + Treatment Flow

// ─── State ────────────────────────────────────────────────────────────────
let currentPatientId = null;
let selectedTeeth = [];          // array of tooth numbers (strings)
let toothSurfaceMap = {};        // { toothNum: surface } — per-tooth individual surface
let activeTooth = null;          // the last-clicked tooth (for surface btn targeting)
let selectedTreatment = null;    // { _id, code, name, defaultFee, icon }
let allTreatments = [];
let allProcedures = [];
let currentTab = 'fav';          // 'fav' | 'all'
let pendingProcedure = null;     // (legacy) procedure being built before doctor confirm
let clinicStaff = [];            // Hold staff list for table selects
let assignedDoctor = '';
let currentProcedurePage = 1;
const proceduresPerPage = 5;

// FDI Tooth layout: quadrant → tooth numbers in display order (right→center for Q1/Q4)
const FDI_LAYOUT = {
    q1: [18, 17, 16, 15, 14, 13, 12, 11],  // upper right → midline
    q2: [21, 22, 23, 24, 25, 26, 27, 28],  // upper left  midline →
    q4: [48, 47, 46, 45, 44, 43, 42, 41],  // lower right → midline
    q3: [31, 32, 33, 34, 35, 36, 37, 38]   // lower left  midline →
};

// Treatment Coloring Palette
const TREATMENT_COLORS = {
    // ── Adult ────────────────────────────────────────
    'D137': '#eff6ff', // Composite
    'D140': '#eef2ff', // Amalgam
    'D141': '#f0f9ff', // White Filling
    'D150': '#fdf4ff', // Simple Extraction
    'D155': '#fae8ff', // Surgical Extraction
    'D160': '#f0fdfa', // Scaling
    'D161': '#ecfdf5', // Polishing
    'D240': '#f0fdf4', // Sealant
    'D166': '#fdf4ff', // Ortho
    'D174': '#fff7ed', // RCT Front
    'D176': '#fef3c7', // RCT Back
    'D178': '#fffbeb', // Fiber Post
    'D190': '#fefce8', // Crown PFM
    'D191': '#fef9c3', // Crown Zirconia
    'D200': '#fff1f2', // Bridge PFM
    'D100': '#fff7ed', // Acrylic Partial
    'D101': '#fef2f2', // Vertex Partial
    'D210': '#f0f9ff', // Implant
    'D220': '#fefce8', // Whitening
    'D225': '#f5f3ff', // Composite Veneer
    'D230': '#fdf2f8', // Denture
    'OTH': '#f8fafc'  // Others
};

const CONDITION_COLORS = {
    'Healthy': { bg: '#e8f5e9', border: '#4caf50' },
    'Cavity': { bg: '#ffebee', border: '#f44336' },
    'Filling': { bg: '#e3f2fd', border: '#2196f3' },
    'Extraction': { bg: '#f3e5f5', border: '#9c27b0' },
    'Root Canal': { bg: '#fff3e0', border: '#ff9800' },
    'Crown': { bg: '#eceff1', border: '#607d8b' },
    'Implant': { bg: '#fffde7', border: '#fbc02d' },
    'Missing': { bg: '#fafafa', border: '#bdbdbd' }
};

// Teeth that typically have cusps/wider shape
const MOLAR_TEETH = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48];

// ─── Init ──────────────────────────────────────────────────────────────────
function getPatientId() {
    return new URLSearchParams(window.location.search).get('id');
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentPatientId = urlParams.get('id');
    const isManual = urlParams.get('manual') === 'true';

    if (currentPatientId) {
        try {
            const patient = await APP.api.get(`/patients/${currentPatientId}`);
            if (patient) {
                assignedDoctor = patient.assignedDoctor || patient.doctor || '';
                if (!isManual && patient.age !== null && patient.age !== undefined && patient.age < 12) {
                    window.location.replace(`baby-dental-chart.html?id=${currentPatientId}`);
                    return;
                }
            }
        } catch (err) {
            console.error("Age check/patient load failed:", err);
        }
    }

    try {
        clinicStaff = await APP.api.get('/staff');
    } catch (err) {
        console.error("Failed to load doctor list:", err);
    }

    generateFDIChart();
    await loadTreatments();
    if (currentPatientId) {
        await loadPatientProcedures();
    }

    const switchBtn = document.querySelector('.dc-chart-topbar button');
    if (switchBtn) {
        switchBtn.onclick = () => {
            window.location.href = `baby-dental-chart.html?id=${currentPatientId}&manual=true`;
        };
    }

    // Full mouth checkbox
    document.getElementById('fullMouthCheck').addEventListener('change', (e) => {
        if (e.target.checked) {
            selectAllTeeth();
        } else {
            clearToothSelection();
        }
    });

    // Surface Dial integration is handled via syncSurfaceButtons

    // Make global
    window.switchTreatmentTab = switchTreatmentTab;
    window.onTreatmentClick = onTreatmentClick;
    window.deleteProcedure = deleteProcedure;
    window.deleteUnsavedProcedure = deleteUnsavedProcedure;
    window.printProcedureInvoice = printProcedureInvoice;
    window.savePendingChanges = savePendingChanges;
    window.openProgressNote = openProgressNote;
    window.toggleHistoryView = toggleHistoryView;
    window.updateRowPayable = updateRowPayable;
    window.changeProcedurePage = changeProcedurePage;
});

// ─── FDI Chart Generation ──────────────────────────────────────────────────
function generateFDIChart() {
    Object.entries(FDI_LAYOUT).forEach(([quadrant, teeth]) => {
        const container = document.getElementById(quadrant);
        if (!container) return;
        container.innerHTML = '';
        teeth.forEach(num => {
            container.appendChild(createToothEl(num, quadrant));
        });
    });
}

function createToothEl(num, quadrant) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tooth-wrapper';

    const tooth = document.createElement('div');
    tooth.className = 'tooth-btn';
    tooth.id = `tooth-${num}`;
    tooth.dataset.tooth = num;

    const isUpper = quadrant === 'q1' || quadrant === 'q2';
    const pos = parseInt(String(num)[1]); // 1-8 inside quadrant

    // Image mapping 1-8
    const toothMap = {
        1: '11 – Central Incisor.png',
        2: '12 – Lateral Incisor.png',
        3: '13 – Canine (Cuspid).png',
        4: '14 – First Premolar.png',
        5: '15 – Second Premolar.png',
        6: '16 – First Molar.png',
        7: '17 – Second Molar.png',
        8: '18 – Third Molar (Wisdom Tooth).png'
    };

    const toothSrc = `../../assets/images/teeth/${toothMap[pos]}`;

    // Transform logic based on user's instruction that base images are for Upper Left (q2)
    let transformCss = '';
    if (quadrant === 'q2') {
        transformCss = ''; // Base is Upper Left
    } else if (quadrant === 'q1') {
        transformCss = 'scaleX(-1)'; // Mirror for Upper Right
    } else if (quadrant === 'q3') {
        transformCss = 'scaleY(-1)'; // Mirror vertically for Lower Left
    } else if (quadrant === 'q4') {
        transformCss = 'scale(-1, -1)'; // Mirror horizontally & vertically for Lower Right
    }

    const toothContent = `
        <img src="${toothSrc}" class="real-tooth-img" style="transform: ${transformCss}; width: 100%; height: 100%; object-fit: contain; display: block; position: absolute;" />
        
        <!-- Implant Screw (Hidden by default, shown via CSS) -->
        <svg viewBox="0 0 100 120" class="implant-screw-svg" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index: 2;">
            <path class="implant-screw" d="M35,60 L35,15 C35,5 65,5 65,15 L65,60 Z M30,15 L70,15 M30,25 L70,25 M30,35 L70,35 M30,45 L70,45 M30,55 L70,55" stroke="#909497" stroke-width="3" fill="#bdc3c7" />
        </svg>
    `;

    // No need for 'lower' or 'molar' rotation since the transformCss handles exact orientation of the user images!
    tooth.innerHTML = `<div class="tooth-icon" style="position: relative; width: 100%; height: 100%;">${toothContent}</div>`;
    tooth.addEventListener('click', () => onToothClick(String(num)));

    const label = document.createElement('div');
    label.className = 'tooth-num-label';
    label.textContent = num;

    // Upper: label below crown; Lower: label above crown
    if (isUpper) {
        wrapper.appendChild(tooth);
        wrapper.appendChild(label);
    } else {
        wrapper.appendChild(label);
        wrapper.appendChild(tooth);
    }

    return wrapper;
}

// ─── Tooth Selection ───────────────────────────────────────────────────────
function onToothClick(num) {
    const fullMouth = document.getElementById('fullMouthCheck').checked;
    if (fullMouth) return; // managed by checkbox

    if (selectedTeeth.includes(num)) {
        // Deselect — remove from selection and clear its surface
        selectedTeeth = selectedTeeth.filter(t => t !== num);
        delete toothSurfaceMap[num];
        document.getElementById(`tooth-${num}`)?.classList.remove('selected');
        // If deselected tooth was the active one, switch focus to the last remaining tooth
        if (activeTooth === num) {
            activeTooth = selectedTeeth.length > 0 ? selectedTeeth[selectedTeeth.length - 1] : null;
        }
    } else {
        // Select — add to selection and set as active focus
        selectedTeeth.push(num);
        document.getElementById(`tooth-${num}`)?.classList.add('selected');
        activeTooth = num;
        // Initialize surface for this tooth if not already set
        if (!toothSurfaceMap[num]) toothSurfaceMap[num] = '';
    }

    if (selectedTeeth.includes(num)) {
        const toothEl = document.getElementById(`tooth-${num}`);
        SurfaceDial.open(toothEl, num, toothSurfaceMap[num], false, (s) => {
            let current = toothSurfaceMap[activeTooth] || '';
            if (current.includes(s)) {
                current = current.replace(s, '');
            } else {
                current += s;
            }
            toothSurfaceMap[activeTooth] = current;
            syncSurfaceButtons();
        });
    } else {
        SurfaceDial.close();
    }

    updateToothLabel();
}

// Sync surface dial to reflect the activeTooth's stored surface
function syncSurfaceButtons() {
    if (!activeTooth) return;
    const currentSurface = toothSurfaceMap[activeTooth] || '';
    SurfaceDial.refresh(currentSurface, false);
}

function selectAllTeeth() {
    selectedTeeth = [];
    Object.values(FDI_LAYOUT).flat().forEach(n => {
        const id = `tooth-${n}`;
        selectedTeeth.push(String(n));
        document.getElementById(id)?.classList.add('selected');
    });
    updateToothLabel();
    const surfSel = document.getElementById('surfaceSelector');
    if (surfSel) surfSel.style.display = 'flex';
}

function clearToothSelection() {
    selectedTeeth.forEach(n => {
        document.getElementById(`tooth-${n}`)?.classList.remove('selected');
    });
    selectedTeeth = [];
    toothSurfaceMap = {};
    activeTooth = null;
    document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('active'));
    updateToothLabel();
    const surfSel = document.getElementById('surfaceSelector');
    if (surfSel) surfSel.style.display = 'none';
}

function updateToothLabel() {
    const label = document.getElementById('selectedToothLabel');
    if (!label) return;
    if (selectedTeeth.length === 0) {
        label.textContent = 'No tooth selected';
        label.style.color = '#999';
    } else {
        const fullMouth = document.getElementById('fullMouthCheck')?.checked;
        label.textContent = fullMouth ? 'Full Mouth' : `Tooth: ${selectedTeeth.join(', ')}`;
        label.style.color = '#2766ba';
    }
}

// ─── Load Treatments ───────────────────────────────────────────────────────
async function loadTreatments() {
    try {
        // Auto-seed if empty
        await APP.api.get('/treatments/seed').catch(() => { });
        allTreatments = await APP.api.get('/treatments');
        allTreatments.push({
            _id: 'OTH',
            code: 'OTH',
            name: 'Others',
            defaultFee: 0,
            icon: '✏️',
            isFavorite: true
        });
        renderTreatmentGrid();
    } catch (err) {
        console.error('Failed to load treatments:', err);
        document.getElementById('treatmentGrid').innerHTML = '<div class="treatment-loading">Failed to load treatments.</div>';
    }
}

function renderTreatmentGrid() {
    const grid = document.getElementById('treatmentGrid');
    if (!grid) return;

    let list = currentTab === 'fav'
        ? allTreatments.filter(t => t.isFavorite)
        : allTreatments;

    if (list.length === 0) {
        grid.innerHTML = `<div class="treatment-loading">${currentTab === 'fav' ? 'No favourites. Switch to All tab.' : 'No treatments found.'}</div>`;
        return;
    }

    grid.innerHTML = list.map(t => `
        <div class="treatment-card ${selectedTreatment?._id === t._id ? 'active' : ''}"
             onclick="onTreatmentClick('${t._id}')"
             title="${t.code} — ${t.name}">
            <div class="tc-icon">${t.icon || '🦷'}</div>
            <div class="tc-code">${t.code}</div>
            <div class="tc-name">${t.name}</div>
            <div class="treatment-card-color-line" style="background: ${TREATMENT_COLORS[t.code] || '#ccc'};"></div>
            <button class="tc-fav-btn ${t.isFavorite ? 'faved' : ''}"
                    onclick="toggleFav(event,'${t._id}')">★</button>
        </div>
    `).join('');
}

function switchTreatmentTab(tab) {
    currentTab = tab;
    document.getElementById('tabFav').classList.toggle('active', tab === 'fav');
    document.getElementById('tabAll').classList.toggle('active', tab === 'all');
    renderTreatmentGrid();
}

async function toggleFav(e, id) {
    e.stopPropagation();
    const t = allTreatments.find(x => x._id === id);
    if (!t) return;
    try {
        await APP.api.put(`/treatments/${id}`, { isFavorite: !t.isFavorite });
        t.isFavorite = !t.isFavorite;
        renderTreatmentGrid();
    } catch (err) {
        console.error('Failed to toggle favourite:', err);
    }
}

// ─── Treatment Click → Direct Table Insertion ─────────────────────────────────
function onTreatmentClick(id) {
    selectedTreatment = allTreatments.find(t => t._id === id);
    if (!selectedTreatment) return;

    const isFullMouth = document.getElementById('fullMouthCheck')?.checked;

    if (!isFullMouth && selectedTeeth.length === 0) {
        Toast.error('Please select tooth/teeth first.');
        return;
    }

    // Build tooth string: each tooth gets its own surface appended (e.g. "32-M, 33-P")
    // If a tooth has no surface selected, it appears without suffix (e.g. "32, 33-P")
    let toothStr;
    if (isFullMouth) {
        toothStr = 'OO';
    } else {
        toothStr = selectedTeeth.map(t => {
            const surf = toothSurfaceMap[t] || '';
            return surf ? `${t}-${surf}` : t;
        }).join(', ');
    }

    const baseFee = selectedTreatment.defaultFee || 0;
    const isSingleUnit = document.getElementById('singleUnitCheck')?.checked;
    const toothCount = isFullMouth ? 1 : (isSingleUnit ? 1 : selectedTeeth.length || 1);
    const fee = baseFee * toothCount;

    const newProc = {
        _tempId: 'temp_' + Date.now(),
        patientId: currentPatientId,
        chartType: 'adult',
        procedureDate: new Date().toISOString().split('T')[0],
        toothNumber: toothStr,
        surface: '',  // surface is now embedded per-tooth in toothNumber
        isFullMouth: !!isFullMouth,
        diagnosis: '',
        treatmentCode: selectedTreatment.code,
        treatmentName: `${selectedTreatment.code} ${selectedTreatment.name}`,
        steps: 'NA',
        fee: fee,
        discount: 0,
        payable: fee,
        clinicalNotes: 'TYPE OF ANESTHESIA: \nAMOUNT OF ANESTHESIA: \nPROGNOSIS: \nPOSTOP INTRUCTIONS AND FOLLOW UP INSTRUCTIONS GIVEN',
        doctor: assignedDoctor,
        status: 'Unsaved'
    };

    allProcedures.unshift(newProc);
    renderProceduresTable();

    // Clear selection
    clearToothSelection();
    let fmc = document.getElementById('fullMouthCheck');
    if (fmc) fmc.checked = false;
    selectedTreatment = null;
    renderTreatmentGrid();
}

function adjustDoctorFont(selectEl) {
    const name = selectEl.options[selectEl.selectedIndex]?.text || '';
    if (name.length > 18) selectEl.style.fontSize = '9px';
    else if (name.length > 13) selectEl.style.fontSize = '10px';
    else selectEl.style.fontSize = '12px';
}

function recalcFooterTotals() {
    let totalFee = 0, totalDisc = 0, totalPay = 0;
    document.querySelectorAll('#proceduresBody .editable-procedure-row').forEach(tr => {
        totalFee += parseFloat(tr.querySelector('.inline-fee')?.value) || 0;
        totalDisc += parseFloat(tr.querySelector('.inline-discount')?.value) || 0;
        totalPay += parseFloat(tr.querySelector('.payable-cell')?.textContent) || 0;
    });
    const tf = document.getElementById('totalFee');
    const td = document.getElementById('totalDiscount');
    const tp = document.getElementById('totalPayable');
    if (tf) tf.textContent = totalFee.toFixed(2);
    if (td) td.textContent = totalDisc.toFixed(2);
    if (tp) tp.textContent = totalPay.toFixed(2);
}

function updateRowPayable(inputEl) {
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const fee = parseFloat(tr.querySelector('.inline-fee')?.value) || 0;
    const disc = parseFloat(tr.querySelector('.inline-discount')?.value) || 0;
    const payable = Math.max(0, fee - disc);
    const payCell = tr.querySelector('.payable-cell');
    if (payCell) payCell.textContent = payable.toFixed(2);

    recalcFooterTotals();
}

function deleteUnsavedProcedure(tempId) {
    allProcedures = allProcedures.filter(p => p._tempId !== tempId);
    renderProceduresTable();
}

// ─── Load Procedures ───────────────────────────────────────────────────────
async function loadPatientProcedures() {
    try {
        allProcedures = await APP.api.get(`/procedures/patient/${currentPatientId}`);
        renderProceduresTable();
    } catch (err) {
        console.error('Failed to load procedures:', err);
    }
}

// ─── Render Procedures Table ───────────────────────────────────────────────
function renderProceduresTable() {
    const tbody = document.getElementById('proceduresBody');
    const paginationContainer = document.getElementById('procedurePagination');
    if (!tbody) return;

    if (allProcedures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="empty-state">No procedures recorded yet.</td></tr>`;
        if (paginationContainer) paginationContainer.style.display = 'none';
        renderBillingTotals([], [], []);
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(allProcedures.length / proceduresPerPage);
    if (currentProcedurePage > totalPages) currentProcedurePage = totalPages || 1;

    // Sort by procedureDate (descending)
    allProcedures.sort((a, b) => {
        const dateA = new Date(a.procedureDate || a.createdAt || 0);
        const dateB = new Date(b.procedureDate || b.createdAt || 0);
        if (dateB - dateA !== 0) return dateB - dateA;

        // Tie-breaker: newest first (handles both saved and unsaved items)
        const idA = a._id || a.id || a._tempId || "";
        const idB = b._id || b.id || b._tempId || "";
        return idB.localeCompare(idA);
    });

    const startIndex = (currentProcedurePage - 1) * proceduresPerPage;
    const endIndex = startIndex + proceduresPerPage;
    const paginatedProcedures = allProcedures.slice(startIndex, endIndex);

    tbody.innerHTML = paginatedProcedures.map((p, i) => {
        let toothSurface = p.toothNumber || '';
        if (p.surface && p.toothNumber && p.toothNumber !== 'OO' && p.toothNumber !== 'Full Mouth') {
            toothSurface = p.toothNumber.split(',').map(t => `${t.trim()}-${p.surface}`).join(', ');
        } else if (p.surface) {
            toothSurface = [p.toothNumber, p.surface].filter(Boolean).join('-');
        }
        const isUnsaved = p.status === 'Unsaved';
        const statusCls = p.status === 'Completed' ? 'badge-completed' : (isUnsaved ? 'badge-pending' : 'badge-cancelled');
        const rowCls = isUnsaved ? 'row-pending' : '';
        const idAttr = isUnsaved ? `data-tempid="${p._tempId}"` : `data-id="${p._id}"`;

        return `
        <tr class="${rowCls} editable-procedure-row" ${idAttr}>
            <td>
                ${getProcedureHUDMarkup(isUnsaved ? p._tempId : p._id, isUnsaved)}
            </td>
            <td><input type="date" class="form-control" style="padding:2px 4px;font-size:12px;width:105px;" data-field="procedureDate" value="${(p.procedureDate || '').split('T')[0]}"></td>
            <td class="teeth-cell">${toothSurface || '—'}</td>
            <td class="editable-cell" contenteditable="true" data-field="diagnosis">${p.diagnosis || ''}</td>
            <td><div style="font-size:13px;">${p.treatmentName || '—'}</div></td>
            <td class="editable-cell" contenteditable="true" data-field="steps">${p.steps || 'NA'}</td>
            <td><input type="number" class="form-control inline-fee" style="padding:2px 4px;font-size:12px;width:70px;" data-field="fee" value="${(p.fee || 0)}" min="0" oninput="updateRowPayable(this)"></td>
            <td><input type="number" class="form-control inline-discount" style="padding:2px 4px;font-size:12px;width:70px;" data-field="discount" value="${(p.discount || 0)}" min="0" oninput="updateRowPayable(this)"></td>
            <td class="num-cell payable-cell" style="font-weight:600;">${(p.payable || 0).toFixed(2)}</td>
            <td class="editable-cell notes-cell" contenteditable="true" data-field="clinicalNotes"><div style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(p.clinicalNotes || '').replace(/"/g, '&quot;')}">${p.clinicalNotes || ''}</div></td>
            <td>
                <select class="form-control" style="padding:2px 4px;font-size:12px;width:100px;" data-field="doctor" onchange="adjustDoctorFont(this)">
                    <option value="">Select...</option>
                    ${clinicStaff.map(s => `<option value="${s.name}" ${(p.doctor === s.name) ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </td>
            <td><span class="status-badge ${statusCls}">${p.status || 'Completed'}</span></td>
        </tr>
        `;
    }).join('');

    // Billing totals
    const feeList = allProcedures.map(p => parseFloat(p.fee) || 0);
    const discList = allProcedures.map(p => parseFloat(p.discount) || 0);
    const payList = allProcedures.map(p => parseFloat(p.payable) || 0);
    renderBillingTotals(feeList, discList, payList);

    // Update fonts
    document.querySelectorAll('[data-field="doctor"]').forEach(adjustDoctorFont);

    // Update visual chart
    renderTeethConditions();

    // Update Pagination UI
    renderProcedurePagination(allProcedures.length);
}

function renderProcedurePagination(totalItems) {
    const paginationContainer = document.getElementById('procedurePagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / proceduresPerPage);
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.style.display = 'flex';

    let html = `
        <button class="pagination-btn" onclick="changeProcedurePage(${currentProcedurePage - 1})" ${currentProcedurePage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    // Smart Truncation Logic
    const delta = 1;
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentProcedurePage - delta && i <= currentProcedurePage + delta)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeProcedurePage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `
            <button class="pagination-number ${i === currentProcedurePage ? 'active' : ''}" onclick="changeProcedurePage(${i})">
                ${i}
            </button>
        `;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeProcedurePage(${currentProcedurePage + 1})" ${currentProcedurePage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

function changeProcedurePage(page) {
    const totalPages = Math.ceil(allProcedures.length / proceduresPerPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentProcedurePage = page;
    renderProceduresTable();
}

// ─── Render Visual Teeth Conditions ────────────────────────────────────────
function renderTeethConditions() {
    // Clear previous color overlays
    const possibleClasses = Object.keys(TREATMENT_COLORS).concat(['cavity', 'filling', 'extraction', 'root-canal', 'crown', 'implant', 'sealant']);
    document.querySelectorAll('.tooth-btn').forEach(el => {
        el.classList.remove(...possibleClasses);
    });

    // Oldest first so newest procedure wins (it paints last)
    const reversed = [...allProcedures].reverse();

    reversed.forEach(p => {
        if (!p.toothNumber || p.toothNumber === 'OO') return;

        // Ensure there is color defined, indicating a valid treatment
        if (!TREATMENT_COLORS[p.treatmentCode]) return;

        // Strip surface suffix (e.g. "32-M" → "32") before DOM lookup
        const teeth = p.toothNumber.split(',').map(t => t.trim().split('-')[0]);
        teeth.forEach(t => {
            const el = document.getElementById(`tooth-${t}`);
            if (!el) return;
            el.classList.add(p.treatmentCode);
        });
    });
}

function renderBillingTotals(fees, discounts, payables) {
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const tf = document.getElementById('totalFee');
    const td = document.getElementById('totalDiscount');
    const tp = document.getElementById('totalPayable');
    if (tf) tf.textContent = sum(fees).toFixed(2);
    if (td) td.textContent = sum(discounts).toFixed(2);
    if (tp) tp.textContent = sum(payables).toFixed(2);
}

// ─── Delete Procedure ──────────────────────────────────────────────────────
async function deleteProcedure(id) {
    const ok = await Confirm.show('Delete this procedure?');
    if (!ok) return;
    try {
        await APP.api.delete(`/procedures/${id}`);
        allProcedures = allProcedures.filter(p => p._id !== id);
        renderProceduresTable();
        Toast.success('Procedure deleted.');
    } catch (err) {
        console.error('Failed to delete procedure:', err);
        Toast.error('Failed to delete procedure.');
    }
}

// ─── Inline Edit Diagnosis ─────────────────────────────────────────────────
async function updateProcedureField(id, field, value) {
    try {
        await APP.api.put(`/procedures/${id}`, { [field]: value.trim() });
        const proc = allProcedures.find(p => p._id === id);
        if (proc) proc[field] = value.trim();
    } catch (err) {
        console.error(`Failed to update ${field}:`, err);
    }
}

// ─── Save Changes ──────────────────────────────────────────────────────────
async function savePendingChanges() {
    const rows = document.querySelectorAll('#proceduresBody .editable-procedure-row');
    let hasChanges = false;
    let ops = []; // Promises for saving

    const pName = document.getElementById("heroName")?.textContent || "Unknown Patient";

    for (let row of rows) {
        const isUnsaved = row.hasAttribute('data-tempid');
        const id = isUnsaved ? row.getAttribute('data-tempid') : row.getAttribute('data-id');

        let p = isUnsaved ? allProcedures.find(x => x._tempId === id) : allProcedures.find(x => x._id === id);
        if (!p) continue;

        // Scrape current row data
        const dateInput = row.querySelector('[data-field="procedureDate"]');
        const diagCell = row.querySelector('[data-field="diagnosis"]');
        const stepsCell = row.querySelector('[data-field="steps"]');
        const feeInput = row.querySelector('[data-field="fee"]');
        const discInput = row.querySelector('[data-field="discount"]');
        const notesCell = row.querySelector('[data-field="clinicalNotes"]');
        const docSelect = row.querySelector('[data-field="doctor"]');

        const scrapedFee = parseFloat(feeInput?.value) || 0;
        const scrapedDisc = parseFloat(discInput?.value) || 0;
        const scrapedPayable = Math.max(0, scrapedFee - scrapedDisc);

        const updatedData = {
            procedureDate: dateInput?.value || p.procedureDate,
            diagnosis: diagCell?.textContent?.trim(),
            steps: stepsCell?.textContent?.trim(),
            fee: scrapedFee,
            discount: scrapedDisc,
            payable: scrapedPayable,
            clinicalNotes: notesCell?.textContent?.trim(),
            doctor: docSelect?.value || p.doctor
        };

        if (isUnsaved) {
            // Validate required
            if (!updatedData.doctor && !p.doctor) {
                Toast.error(`Doctor missing for "${p.treatmentName}". Please select one.`);
                return;
            }

            // Build full payload for creation
            const payload = {
                ...p,
                ...updatedData,
                status: 'Completed' // Solidify
            };
            delete payload._tempId;

            // Define the save operation for this individual row
            const saveOperation = async () => {
                // 1. Save the procedure
                const procResult = await APP.api.post('/procedures', payload);
                const savedProc = procResult.procedure || procResult;

                // 2. Create a separate invoice for this procedure
                const invoiceData = {
                    date: updatedData.procedureDate,
                    patientId: currentPatientId,
                    patientName: pName,
                    doctorId: updatedData.doctor,
                    doctorName: updatedData.doctor,
                    services: [p.treatmentName],
                    items: [{
                        description: p.treatmentName,
                        quantity: 1,
                        unitPrice: scrapedFee,
                        total: scrapedFee
                    }],
                    subtotal: scrapedFee,
                    totalAmount: scrapedFee,
                    discount: scrapedDisc,
                    total: scrapedPayable,
                    paid: 0,
                    balance: scrapedPayable,
                    status: scrapedPayable > 0 ? "Pending" : "Paid",
                    notes: `Procedure: ${p.treatmentName} (Tooth: ${p.toothNumber})`
                };

                await APP.api.post('/invoices', invoiceData);
                return savedProc;
            };

            ops.push(saveOperation());
            hasChanges = true;
        } else {
            const updateOp = async () => {
                await APP.api.put(`/procedures/${p._id}`, updatedData);
                // Sync with invoice if possible
                try {
                    const invoices = await APP.api.get(`/invoices/patient/${currentPatientId}`);
                    const expectedNotes = `Procedure: ${p.treatmentName} (Tooth: ${p.toothNumber})`;
                    const matchedInvoice = invoices.find(inv => inv.notes === expectedNotes);
                    
                    if (matchedInvoice) {
                        const newPaid = matchedInvoice.paid || 0;
                        const newBalance = Math.max(0, scrapedPayable - newPaid);
                        let newStatus = newBalance <= 0 ? "Paid" : (newPaid > 0 ? "Partial" : "Pending");
                        
                        await APP.api.put(`/invoices/${matchedInvoice._id}`, {
                            subtotal: scrapedFee,
                            totalAmount: scrapedFee,
                            discount: scrapedDisc,
                            total: scrapedPayable,
                            balance: newBalance,
                            status: newStatus
                        });
                    }
                } catch(e) {
                    console.error("Failed to sync invoice update", e);
                }
            };
            ops.push(updateOp());
            hasChanges = true;
        }
    }

    if (!hasChanges) {
        Toast.info('Nothing to save.');
        return;
    }

    // Lock UI optionally
    const saveBtn = document.getElementById('saveChangesBtn');
    if (saveBtn) saveBtn.disabled = true;

    try {
        await Promise.all(ops);
        Toast.success('Changes saved successfully! Data synced with billing.');
        await loadPatientProcedures(); // reload fresh from DB
    } catch (err) {
        console.error('Failed to save batch:', err);
        Toast.error('Some changes failed to save.');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// ─── Utility ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}

function openProgressNote() {
    Toast.info('Progress Note — coming soon.');
}

function toggleHistoryView() {
    loadPatientProcedures();
}

// ─── Print Invoice ─────────────────────────────────────────────────────────
window.printProcedureInvoice = function (id, isUnsaved) {
    let p = isUnsaved ? allProcedures.find(x => x._tempId === id) : allProcedures.find(x => x._id === id);
    if (!p) {
        Toast.error("Procedure not found.");
        return;
    }

    const pName = document.getElementById("heroName")?.textContent || "Unknown Patient";
    const pId = document.getElementById("heroId")?.textContent?.replace('Patient ID: ', '') || p.patientId;

    // Scrape latest values from table row if unsaved/edited
    const row = document.querySelector(`tr[data-tempid="${id}"]`) || document.querySelector(`tr[data-id="${id}"]`);
    let printedFee = p.fee || 0;
    let printedDiscount = p.discount || 0;
    let printedPayable = p.payable || 0;

    if (row) {
        printedFee = parseFloat(row.querySelector('[data-field="fee"]')?.value) || printedFee;
        printedDiscount = parseFloat(row.querySelector('[data-field="discount"]')?.value) || printedDiscount;
        printedPayable = Math.max(0, printedFee - printedDiscount);
    }

    const printHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Invoice - ${pName}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
            .header p { margin: 5px 0 0 0; color: #7f8c8d; }
            .row { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .details { line-height: 1.6; }
            .details span { font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #2766ba; color: white; }
            .totals { float: right; margin-top: 20px; width: 300px;}
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .totals-row.grand { font-weight: bold; font-size: 18px; color: #2766ba; border-bottom: none; border-top: 2px solid #333; padding-top: 12px;}
            .footer { margin-top: 80px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PakTeeth Dental Clinic</h1>
            <p>Invoice / Procedure Receipt</p>
        </div>
        
        <div class="row">
            <div class="details">
                <p><span>Patient Name:</span> ${pName}</p>
                <p><span>Patient ID:</span> ${pId}</p>
                <p><span>Doctor:</span> ${p.doctor || 'Not assigned'}</p>
            </div>
            <div class="details" style="text-align: right;">
                <p><span>Date:</span> ${formatDate(p.procedureDate)}</p>
                <p><span>Status:</span> ${isUnsaved ? 'DRAFT ESTIMATE' : (p.status || 'Completed')}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Treatment</th>
                    <th>Tooth/Surface</th>
                    <th>Diagnosis</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${p.treatmentName || '—'}</td>
                    <td>${[p.toothNumber, p.surface].filter(Boolean).join(' - ') || '—'}</td>
                    <td>${p.diagnosis || '—'}</td>
                </tr>
            </tbody>
        </table>

        <div class="totals">
            <div class="totals-row">
                <span>Fee:</span>
                <span>Rs ${printedFee.toFixed(2)}</span>
            </div>
            <div class="totals-row">
                <span>Discount:</span>
                <span>- Rs ${printedDiscount.toFixed(2)}</span>
            </div>
            <div class="totals-row grand">
                <span>Net Payable:</span>
                <span>Rs ${printedPayable.toFixed(2)}</span>
            </div>
        </div>
        <div style="clear: both;"></div>

        <div class="footer">
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
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(printHtml);
    iframe.contentWindow.document.close();

    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 2000);
};