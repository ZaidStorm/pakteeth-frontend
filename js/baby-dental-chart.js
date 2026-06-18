// ====== baby-dental-chart.js ======
// Baby Teeth Dental Chart + Treatment Flow

// ─── State ────────────────────────────────────────────────────────────────
let babySelectedTeeth = [];
let babyToothSurfaceMap = {};    // { toothNum: surface } — per-tooth individual surface
let babyActiveTooth = null;      // the last-clicked tooth (for surface btn targeting)
let babySelectedTreatment = null;
let babyAllTreatments = [];
let babyCurrentTab = 'fav'; // default to 'fav' as requested by user
let babyPendingProcedure = null; // (legacy)
let clinicStaff = [];
let assignedDoctor = '';
let currentProcedurePage = 1;
const proceduresPerPage = 5;

// Treatment Coloring Palette
const TREATMENT_COLORS = {
    // ── Adult ────────────────────────────────────────
    'D150': '#E53935', 'D155': '#C62828', 'D174': '#FF7043', 'D176': '#F4511E',
    'D190': '#FFB300', 'D191': '#FFA000', 'D137': '#43A047', 'D140': '#2E7D32',
    'D141': '#1B5E20', 'D160': '#00ACC1', 'D161': '#00838F', 'D210': '#5E35B1',
    'D166': '#AD1457', 'D225': '#AB47BC', 'D178': '#6D4C41', 'D220': '#F06292',
    'D240': '#26A69A', 'D200': '#1565C0', 'D100': '#00897B', 'D101': '#00695C',
    'D230': '#0288D1', 'OTH': '#9E9E9E',
    // ── Baby (Primary Set) ───────────────────────────
    'B101': '#e8f1fb', 'B102': '#eceffd', 'B110': '#f5ecfb', 'B115': '#f8eafa',
    'B120': '#e8f6f4', 'B125': '#eaf7f0', 'B130': '#fff2e8', 'B135': '#fdf6db',
    'B140': '#edf8f1', 'B145': '#eef7fb', 'B150': '#f3ecfb', 'B160': '#f1f5f9',
    // ── Baby (Secondary Set) ─────────────────────────
    'B201': '#dbeafe', 'B202': '#e0e7ff', 'B210': '#ede9fe', 'B215': '#f5d0fe',
    'B220': '#ccfbf1', 'B225': '#dcfce7', 'B230': '#ffedd5', 'B235': '#fef3c7',
    'B240': '#d1fae5', 'B245': '#e0f2fe', 'B250': '#ede9fe', 'B260': '#e2e8f0',
    'OTH':  '#f8fafc'
};


// Baby teeth layout: quadrant → teeth numbers (FDI primary)
const BABY_LAYOUT = {
    q1: [55, 54, 53, 52, 51], // Upper right
    q2: [61, 62, 63, 64, 65], // Upper left
    q4: [85, 84, 83, 82, 81], // Lower right
    q3: [71, 72, 73, 74, 75]  // Lower left
};

// Tooth condition colors
const BABY_CONDITION_COLORS = {
    'Healthy': { bg: '#e8f5e9', border: '#4caf50' },
    'Cavity': { bg: '#ffebee', border: '#f44336' },
    'Filling': { bg: '#e3f2fd', border: '#2196f3' },
    'Extraction': { bg: '#f3e5f5', border: '#9c27b0' },
    'Missing': { bg: '#fafafa', border: '#bdbdbd' }
};

// FDI Primary molars
const BABY_MOLARS = [55, 54, 65, 64, 85, 84, 75, 74];

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    generateBabyChart();
    await loadBabyTreatments();
    switchBabyTreatmentTab(babyCurrentTab); // Ensure buttons and filter match the default 'fav' state

    // Full mouth checkbox
    document.getElementById('fullMouthCheck')?.addEventListener('change', (e) => {
        if (e.target.checked) selectAllBabyTeeth();
        else clearBabySelection();
    });

    // Surface Dial integration is handled via syncBabySurfaceButtons

    // Global functions
    window.babyOnTreatmentClick = babyOnTreatmentClick;
    window.deleteBabyProcedure = deleteBabyProcedure;
    window.deleteUnsavedBabyProcedure = deleteUnsavedBabyProcedure;
    window.printBabyProcedureInvoice = printBabyProcedureInvoice;
    window.savePendingChanges = savePendingChanges;
    window.switchBabyTreatmentTab = switchBabyTreatmentTab;
    window.toggleBabyFav = toggleBabyFav;
    window.updateBabyRowPayable = updateBabyRowPayable;
    window.changeProcedurePage = changeProcedurePage;

    const switchBtn = document.querySelector('.dc-chart-topbar button');
    if (switchBtn) {
        switchBtn.onclick = () => {
            window.location.href = `dental-chart.html?id=${currentPatientId}&manual=true`;
        };
    }
});

// ─── Generate Baby Teeth Chart ──────────────────────────────────────────────
function generateBabyChart() {
    Object.entries(BABY_LAYOUT).forEach(([quad, teeth]) => {
        const container = document.getElementById(quad);
        if (!container) return;
        container.innerHTML = '';
        teeth.forEach(num => container.appendChild(createBabyToothEl(num, quad)));
    });
}

function createBabyToothEl(num, quadrant) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tooth-wrapper';

    const tooth = document.createElement('div');
    tooth.className = 'tooth-btn';
    tooth.id = `baby-tooth-${num}`;
    tooth.dataset.tooth = num;

    const isUpper = quadrant === 'q1' || quadrant === 'q2';
    const pos = parseInt(String(num)[1]); // 1-5 inside quadrant

    // Image mapping 1-5 for primary dentition, using adult equivalents
    const toothMap = {
        1: '11 – Central Incisor.png',
        2: '12 – Lateral Incisor.png',
        3: '13 – Canine (Cuspid).png',
        4: '16 – First Molar.png', // Map adult 1st molar to baby 1st molar
        5: '17 – Second Molar.png' // Map adult 2nd molar to baby 2nd molar
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

    // Removed .lower string interpolation as transformCss handles orientation fully
    tooth.innerHTML = `<div class="tooth-icon" style="position: relative; width: 100%; height: 100%;">${toothContent}</div>`;
    tooth.addEventListener('click', () => babyOnToothClick(String(num)));

    const label = document.createElement('div');
    label.className = 'tooth-num-label';
    label.textContent = num;

    // Upper: label below crown; Lower: label above crown
    if (quadrant === 'q1' || quadrant === 'q2') {
        wrapper.appendChild(tooth);
        wrapper.appendChild(label);
    } else {
        wrapper.appendChild(label);
        wrapper.appendChild(tooth);
    }

    return wrapper;
}

// ─── Tooth Selection ───────────────────────────────────────────────────────
function babyOnToothClick(num) {
    const fullMouth = document.getElementById('babyFullMouthCheck')?.checked;
    if (fullMouth) return;

    if (babySelectedTeeth.includes(num)) {
        // Deselect — remove from selection and clear its surface
        babySelectedTeeth = babySelectedTeeth.filter(t => t !== num);
        delete babyToothSurfaceMap[num];
        document.getElementById(`baby-tooth-${num}`)?.classList.remove('selected');
        // If deselected tooth was the active one, switch focus to last remaining tooth
        if (babyActiveTooth === num) {
            babyActiveTooth = babySelectedTeeth.length > 0 ? babySelectedTeeth[babySelectedTeeth.length - 1] : null;
        }
    } else {
        // Select — add to selection and set as active focus
        babySelectedTeeth.push(num);
        document.getElementById(`baby-tooth-${num}`)?.classList.add('selected');
        babyActiveTooth = num;
        if (!babyToothSurfaceMap[num]) babyToothSurfaceMap[num] = '';
    }

    if (babySelectedTeeth.includes(num)) {
        const toothEl = document.getElementById(`baby-tooth-${num}`);
        SurfaceDial.open(toothEl, num, babyToothSurfaceMap[num], true, (s) => {
            let current = babyToothSurfaceMap[babyActiveTooth] || '';
            if (current.includes(s)) {
                current = current.replace(s, '');
            } else {
                current += s;
            }
            babyToothSurfaceMap[babyActiveTooth] = current;
            syncBabySurfaceButtons();
        });
    } else {
        SurfaceDial.close();
    }

    updateBabyToothLabel();
}

// Sync baby surface dial to reflect the babyActiveTooth's stored surface
function syncBabySurfaceButtons() {
    if (!babyActiveTooth) return;
    const currentSurface = babyToothSurfaceMap[babyActiveTooth] || '';
    SurfaceDial.refresh(currentSurface, true);
}

function selectAllBabyTeeth() {
    babySelectedTeeth = [];
    babyToothSurfaceMap = {};
    babyActiveTooth = null;
    Object.values(BABY_LAYOUT).flat().forEach(n => {
        babySelectedTeeth.push(String(n));
        document.getElementById(`baby-tooth-${n}`)?.classList.add('selected');
    });
    updateBabyToothLabel();
    document.getElementById('babySurfaceSelector').style.display = 'flex';
}

function clearBabySelection() {
    babySelectedTeeth.forEach(n => document.getElementById(`baby-tooth-${n}`)?.classList.remove('selected'));
    babySelectedTeeth = [];
    babyToothSurfaceMap = {};
    babyActiveTooth = null;
    document.querySelectorAll('.baby-surface-btn').forEach(b => b.classList.remove('active'));
    updateBabyToothLabel();
    const surfSel = document.getElementById('babySurfaceSelector');
    if (surfSel) surfSel.style.display = 'none';
}

function updateBabyToothLabel() {
    const label = document.getElementById('babySelectedToothLabel');
    if (!label) return;
    if (babySelectedTeeth.length === 0) {
        label.textContent = 'No tooth selected';
        label.style.color = '#999';
    } else {
        const fullMouth = document.getElementById('fullMouthCheck')?.checked;
        label.textContent = fullMouth ? 'Full Mouth' : `Tooth: ${babySelectedTeeth.join(', ')}`;
        label.style.color = '#2766ba';
    }
}

// ─── Load Treatments ───────────────────────────────────────────────────────
async function loadBabyTreatments() {
    // Load favorites from localStorage
    const savedFavs = JSON.parse(localStorage.getItem('babyTreatmentFavs')) || [];

    // Hardcoded primary dentition treatments requested by user
    babyAllTreatments = [
        { _id: 'b1', icon: '🦷', code: 'B101', name: 'Filling - Composite', defaultFee: 5000 },
        { _id: 'b2', icon: '🩶', code: 'B102', name: 'Filling - Amalgam', defaultFee: 4000 },
        { _id: 'b3', icon: '❌', code: 'B110', name: 'Extraction - Simple', defaultFee: 5000 },
        { _id: 'b4', icon: '✂️', code: 'B115', name: 'Extraction - Surgical', defaultFee: 120 },
        { _id: 'b5', icon: '✨', code: 'B120', name: 'Cleaning & Polishing', defaultFee: 30 },
        { _id: 'b6', icon: '🩹', code: 'B130', name: 'Pulpotomy', defaultFee: 150 },
        { _id: 'b7', icon: '🧪', code: 'B135', name: 'Pulpectomy', defaultFee: 200 },
        { _id: 'b8', icon: '🛡️', code: 'B140', name: 'Fluoride / Sealant', defaultFee: 25 },
        { _id: 'b9', icon: '🦷🖌️', code: 'B150', name: 'Space Maintainer', defaultFee: 180 },
        { _id: 'b10', icon: '😁', code: 'B160', name: 'Minor Orthodontic Appliance', defaultFee: 300 }
    ].map(t => ({
        ...t,
        isFavorite: savedFavs.includes(t._id)
    }));

    babyAllTreatments.push({
        _id: 'OTH',
        code: 'OTH',
        name: 'Others',
        defaultFee: 0,
        icon: '✏️',
        isFavorite: true
    });

    renderBabyTreatmentGrid();
}

function renderBabyTreatmentGrid() {
    const grid = document.getElementById('babyTreatmentGrid');
    if (!grid) return;

    let list = babyCurrentTab === 'fav'
        ? babyAllTreatments.filter(t => t.isFavorite)
        : babyAllTreatments;

    if (list.length === 0) {
        grid.innerHTML = `<div class="treatment-loading">${babyCurrentTab === 'fav' ? 'No favourites. Switch to All tab.' : 'No treatments found.'}</div>`;
        return;
    }

    grid.innerHTML = list.map(t => `
        <div class="treatment-card ${babySelectedTreatment?._id === t._id ? 'active' : ''}"
             onclick="babyOnTreatmentClick('${t._id}')"
             title="${t.code} — ${t.name}">
            <div class="tc-icon">${t.icon || '🦷'}</div>
            <div class="tc-code">${t.code}</div>
            <div class="tc-name">${t.name}</div>
            <div class="treatment-card-color-line" style="background: ${TREATMENT_COLORS[t.code] || '#ccc'};"></div>
            <button class="tc-fav-btn ${t.isFavorite ? 'faved' : ''}"
                    onclick="toggleBabyFav(event,'${t._id}')">★</button>
        </div>
    `).join('');
}

function switchBabyTreatmentTab(tab) {
    babyCurrentTab = tab;
    // We select the buttons by looking at their onclick handler to avoid needing IDs
    const btns = document.querySelectorAll('.treatment-tab-btn');
    if (btns.length >= 2) {
        btns[0].classList.toggle('active', tab === 'fav');
        btns[1].classList.toggle('active', tab === 'all');
    }
    renderBabyTreatmentGrid();
}

function toggleBabyFav(e, id) {
    e.stopPropagation();
    const t = babyAllTreatments.find(x => x._id === id);
    if (!t) return;

    t.isFavorite = !t.isFavorite;

    // Save to localStorage
    let savedFavs = JSON.parse(localStorage.getItem('babyTreatmentFavs')) || [];
    if (t.isFavorite && !savedFavs.includes(id)) {
        savedFavs.push(id);
    } else if (!t.isFavorite) {
        savedFavs = savedFavs.filter(favId => favId !== id);
    }
    localStorage.setItem('babyTreatmentFavs', JSON.stringify(savedFavs));

    renderBabyTreatmentGrid();
}

// ─── Treatment Click → Direct Table Insertion ──────────────────────────────
function babyOnTreatmentClick(id) {
    babySelectedTreatment = babyAllTreatments.find(t => t._id === id);
    if (!babySelectedTreatment) return;

    const isFullMouth = document.getElementById('fullMouthCheck')?.checked;

    if (!isFullMouth && babySelectedTeeth.length === 0) {
        Toast.error('Please select tooth/teeth first.');
        return;
    }

    // Build tooth string: each tooth gets its own surface appended (e.g. "51-M, 52-P")
    let toothStr;
    if (isFullMouth) {
        toothStr = 'Full Mouth';
    } else {
        toothStr = babySelectedTeeth.map(t => {
            const surf = babyToothSurfaceMap[t] || '';
            return surf ? `${t}-${surf}` : t;
        }).join(', ');
    }

    const baseFee = babySelectedTreatment.defaultFee || 0;
    const isSingleUnit = document.getElementById('singleUnitCheck')?.checked;
    const toothCount = isFullMouth ? 1 : (isSingleUnit ? 1 : babySelectedTeeth.length || 1);
    const fee = baseFee * toothCount;

    const newProc = {
        _tempId: 'temp_b_' + Date.now(),
        patientId: currentPatientId,
        chartType: 'child',
        procedureDate: new Date().toISOString().split('T')[0],
        toothNumber: toothStr,
        surface: '',  // surface is now embedded per-tooth in toothNumber
        isFullMouth: !!isFullMouth,
        diagnosis: '',
        treatmentCode: babySelectedTreatment.code,
        treatmentName: `${babySelectedTreatment.code} ${babySelectedTreatment.name}`,
        steps: 'NA',
        fee: fee,
        discount: 0,
        payable: fee,
        clinicalNotes: 'TYPE OF ANESTHESIA: \nAMOUNT OF ANESTHESIA: \nPROGNOSIS: \nPOSTOP INTRUCTIONS AND FOLLOW UP INSTRUCTIONS GIVEN',
        doctor: assignedDoctor,
        status: 'Unsaved'
    };

    babyAllProcedures.unshift(newProc);
    renderBabyProceduresTable();
    
    // Clear selection
    clearBabySelection();
    let fmc = document.getElementById('fullMouthCheck');
    if (fmc) fmc.checked = false;
    babySelectedTreatment = null;
    renderBabyTreatmentGrid();
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
        totalFee  += parseFloat(tr.querySelector('.inline-fee')?.value)      || 0;
        totalDisc += parseFloat(tr.querySelector('.inline-discount')?.value)  || 0;
        totalPay  += parseFloat(tr.querySelector('.payable-cell')?.textContent) || 0;
    });
    const tf = document.getElementById('totalFee');
    const td = document.getElementById('totalDiscount');
    const tp = document.getElementById('totalPayable');
    if (tf) tf.textContent = totalFee.toFixed(2);
    if (td) td.textContent = totalDisc.toFixed(2);
    if (tp) tp.textContent = totalPay.toFixed(2);
}

function updateBabyRowPayable(inputEl) {
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const fee = parseFloat(tr.querySelector('.inline-fee')?.value) || 0;
    const disc = parseFloat(tr.querySelector('.inline-discount')?.value) || 0;
    const payable = Math.max(0, fee - disc);
    const payCell = tr.querySelector('.payable-cell');
    if (payCell) payCell.textContent = payable.toFixed(2);

    recalcFooterTotals();
}

function deleteUnsavedBabyProcedure(tempId) {
    babyAllProcedures = babyAllProcedures.filter(p => p._tempId !== tempId);
    renderBabyProceduresTable();
}

// ─── Fee → Doctor → Save Procedure ─────────────────────────────────────────
async function babyProceedToDoctor() {
    const fee = parseFloat(document.getElementById('babyFeeFee')?.value) || 0;
    const discount = parseFloat(document.getElementById('babyFeeDiscount')?.value) || 0;
    const payable = Math.max(0, fee - discount);
    const isFullMouth = document.getElementById('fullMouthCheck')?.checked;

    if (!babySelectedTreatment) return;

    babyPendingProcedure = {
        patientId: currentPatientId,
        chartType: 'child',
        procedureDate: document.getElementById('babyFeeDate').value,
        toothNumber: isFullMouth ? 'Full Mouth' : babySelectedTeeth.join(', '),
        surface: document.getElementById('babyFeeSurface').value,
        isFullMouth: !!isFullMouth,
        diagnosis: document.getElementById('babyFeeDiagnosis')?.value || '',
        treatmentCode: babySelectedTreatment.code,
        treatmentName: `${babySelectedTreatment.code} ${babySelectedTreatment.name}`,
        steps: document.getElementById('babyFeeSteps')?.value || 'NA',
        fee,
        discount,
        payable,
        clinicalNotes: document.getElementById('babyFeeClinicalNotes')?.value || '',
        status: 'Completed'
    };

    Modal.close('babyFeeModal');
    await loadDoctorsIntoSelect('babyDoctorSelect');
    Modal.open('babyDoctorModal');
}

async function babyConfirmSaveProcedure() {
    const doctor = document.getElementById('babyDoctorSelect').value;
    if (!doctor) {
        Toast.error('Please select a doctor.');
        return;
    }
    if (!babyPendingProcedure) return;

    babyPendingProcedure.doctor = doctor;

    try {
        if (!currentPatientId) {
            Toast.error('No patient ID. Cannot save procedure.');
            return;
        }

        const result = await APP.api.post('/procedures', babyPendingProcedure);

        // Add to local array and re-render
        babyAllProcedures.unshift(result.procedure || babyPendingProcedure);
        renderBabyProceduresTable();

        Modal.close('babyDoctorModal');

        // Reset selection
        clearBabySelection();
        const fmc = document.getElementById('fullMouthCheck');
        if (fmc) fmc.checked = false;
        babySelectedTreatment = null;
        babyPendingProcedure = null;
        renderBabyTreatmentGrid();

        Toast.success('Procedure saved successfully!');
    } catch (err) {
        console.error('Failed to save procedure:', err);
        Toast.error('Failed to save procedure.');
    }
}

// Initialize variables
let currentPatientId = null;
let babyAllProcedures = [];

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentPatientId = params.get('id');
    const isManual = params.get('manual') === 'true';

    if (currentPatientId && !isManual) {
        try {
            const patient = await APP.api.get(`/patients/${currentPatientId}`);
            if (patient && patient.age !== null && patient.age !== undefined && patient.age > 12) {
                window.location.replace(`dental-chart.html?id=${currentPatientId}`);
                return;
            }
        } catch (err) {
            console.error("Age check failed:", err);
        }
    }

    try {
        clinicStaff = await APP.api.get('/staff');
    } catch(err) {
        console.error("Failed to load doctor list:", err);
    }

    if (currentPatientId) {
        loadBabyPatientProfile(currentPatientId);
    } else {
        console.warn('No Patient ID provided!');
    }
});

async function loadBabyPatientProfile(id) {
    try {
        const patient = await APP.api.get(`/patients/${id}`);
        assignedDoctor = patient.assignedDoctor || patient.doctor || '';
        // Populate standard profile hero
        document.getElementById('heroName').textContent = `${patient.firstName} ${patient.lastName}`;
        document.getElementById('heroId').textContent = `Patient ID: ${patient.patientId}`;

        // Initialize Baby procedures
        await loadBabyPatientProcedures();
    } catch (err) {
        console.error('Failed to load patient:', err);
    }
}

// ─── Load Procedures ───────────────────────────────────────────────────────
async function loadBabyPatientProcedures() {
    try {
        babyAllProcedures = await APP.api.get(`/procedures/patient/${currentPatientId}`);
        renderBabyProceduresTable();
    } catch (err) {
        console.error('Failed to load procedures:', err);
    }
}

// ─── Render Procedures Table ───────────────────────────────────────────────
function renderBabyProceduresTable() {
    const tbody = document.getElementById('proceduresBody');
    const paginationContainer = document.getElementById('procedurePagination');
    if (!tbody) return;

    if (babyAllProcedures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="empty-state">No procedures recorded yet.</td></tr>`;
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(babyAllProcedures.length / proceduresPerPage);
    if (currentProcedurePage > totalPages) currentProcedurePage = totalPages || 1;

    // Sort by procedureDate (descending)
    babyAllProcedures.sort((a, b) => {
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
    const paginatedProcedures = babyAllProcedures.slice(startIndex, endIndex);

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
            <td><input type="number" class="form-control inline-fee" style="padding:2px 4px;font-size:12px;width:70px;" data-field="fee" value="${(p.fee || 0)}" min="0" oninput="updateBabyRowPayable(this)"></td>
            <td><input type="number" class="form-control inline-discount" style="padding:2px 4px;font-size:12px;width:70px;" data-field="discount" value="${(p.discount || 0)}" min="0" oninput="updateBabyRowPayable(this)"></td>
            <td class="num-cell payable-cell" style="font-weight:600;">${(p.payable || 0).toFixed(2)}</td>
            <td class="editable-cell notes-cell" contenteditable="true" data-field="clinicalNotes"><div style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(p.clinicalNotes||'').replace(/"/g, '&quot;')}">${p.clinicalNotes || ''}</div></td>
            <td>
                <select class="form-control" style="padding:2px 4px;font-size:12px;width:100px;" data-field="doctor" onchange="adjustDoctorFont(this)">
                    <option value="">Select...</option>
                    ${clinicStaff.map(s => `<option value="${s.name}" ${(p.doctor===s.name)?'selected':''}>${s.name}</option>`).join('')}
                </select>
            </td>
            <td><span class="status-badge ${statusCls}">${p.status || 'Completed'}</span></td>
        </tr>
        `;
    }).join('');

    // Billing totals
    const feeList = babyAllProcedures.map(p => parseFloat(p.fee) || 0);
    const discList = babyAllProcedures.map(p => parseFloat(p.discount) || 0);
    const payList = babyAllProcedures.map(p => parseFloat(p.payable) || 0);
    renderBillingTotals(feeList, discList, payList);

    // Update fonts
    document.querySelectorAll('[data-field="doctor"]').forEach(adjustDoctorFont);

    // Update visual chart
    renderBabyTeethConditions();

    // Update Pagination UI
    renderProcedurePagination(babyAllProcedures.length);
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
    const totalPages = Math.ceil(babyAllProcedures.length / proceduresPerPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentProcedurePage = page;
    renderBabyProceduresTable();
}

// ─── Render Visual Teeth Conditions ────────────────────────────────────────
function renderBabyTeethConditions() {
    // Clear previous color overlays
    const possibleClasses = Object.keys(TREATMENT_COLORS).concat(['cavity', 'filling', 'extraction', 'root-canal', 'crown', 'implant', 'sealant']);
    document.querySelectorAll('.tooth-btn').forEach(el => {
        el.classList.remove(...possibleClasses);
    });

    // Oldest first so newest procedure wins (it paints last)
    const reversed = [...babyAllProcedures].reverse();

    reversed.forEach(p => {
        if (!p.toothNumber || p.toothNumber === 'OO' || p.toothNumber === 'Full Mouth') return;

        // Ensure there is color defined, indicating a valid treatment
        if (!TREATMENT_COLORS[p.treatmentCode]) return;

        const teeth = p.toothNumber.split(',').map(t => t.trim());
        teeth.forEach(t => {
            const el = document.getElementById(`baby-tooth-${t}`);
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
async function deleteBabyProcedure(id) {
    const ok = await Confirm.show('Delete this procedure?');
    if (!ok) return;
    try {
        await APP.api.delete(`/procedures/${id}`);
        babyAllProcedures = babyAllProcedures.filter(p => p._id !== id);
        renderBabyProceduresTable();
        Toast.success('Procedure deleted.');
    } catch (err) {
        console.error('Failed to delete procedure:', err);
        Toast.error('Failed to delete procedure.');
    }
}

// ─── Inline Edit Diagnosis ─────────────────────────────────────────────────
async function updateBabyProcedureField(id, field, value) {
    try {
        await APP.api.put(`/procedures/${id}`, { [field]: value.trim() });
        const proc = babyAllProcedures.find(p => p._id === id);
        if (proc) proc[field] = value.trim();
    } catch (err) {
        console.error(`Failed to update ${field}:`, err);
    }
}

// ─── Save Changes ──────────────────────────────────────────────────────────
window.savePendingChanges = async function () {
    const rows = document.querySelectorAll('#proceduresBody .editable-procedure-row');
    let hasChanges = false;
    let ops = [];

    for (let row of rows) {
        const isUnsaved = row.hasAttribute('data-tempid');
        const id = isUnsaved ? row.getAttribute('data-tempid') : row.getAttribute('data-id');
        
        let p = isUnsaved ? babyAllProcedures.find(x => x._tempId === id) : babyAllProcedures.find(x => x._id === id);
        if (!p) continue;

        const dateInput = row.querySelector('[data-field="procedureDate"]');
        const diagCell = row.querySelector('[data-field="diagnosis"]');
        const stepsCell = row.querySelector('[data-field="steps"]');
        const feeInput = row.querySelector('[data-field="fee"]');
        const discInput = row.querySelector('[data-field="discount"]');
        const notesCell = row.querySelector('[data-field="clinicalNotes"]');
        const docSelect = row.querySelector('[data-field="doctor"]');

        const scrapedFee = parseFloat(feeInput?.value) || 0;
        const scrapedDisc = parseFloat(discInput?.value) || 0;

        const updatedData = {
            procedureDate: dateInput?.value || p.procedureDate,
            diagnosis: diagCell?.textContent?.trim(),
            steps: stepsCell?.textContent?.trim(),
            fee: scrapedFee,
            discount: scrapedDisc,
            payable: Math.max(0, scrapedFee - scrapedDisc),
            clinicalNotes: notesCell?.textContent?.trim(),
            doctor: docSelect?.value || p.doctor
        };

        if (isUnsaved) {
            if (!updatedData.doctor && !p.doctor) {
                Toast.error(`Doctor missing for "${p.treatmentName}". Please select one.`);
                return;
            }
            
            const payload = {
                ...p,
                ...updatedData,
                status: 'Completed'
            };
            delete payload._tempId;

            const pName = document.getElementById("heroName")?.textContent || "Unknown Patient";

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
                        unitPrice: updatedData.fee,
                        total: updatedData.fee
                    }],
                    subtotal: updatedData.fee,
                    totalAmount: updatedData.fee,
                    discount: updatedData.discount,
                    total: updatedData.payable,
                    paid: 0,
                    balance: updatedData.payable,
                    status: updatedData.payable > 0 ? "Pending" : "Paid",
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
                        const newBalance = Math.max(0, updatedData.payable - newPaid);
                        let newStatus = newBalance <= 0 ? "Paid" : (newPaid > 0 ? "Partial" : "Pending");
                        
                        await APP.api.put(`/invoices/${matchedInvoice._id}`, {
                            subtotal: updatedData.fee,
                            totalAmount: updatedData.fee,
                            discount: updatedData.discount,
                            total: updatedData.payable,
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

    const btn = document.getElementById('saveChangesBtn');
    if (btn) btn.disabled = true;
    try {
        await Promise.all(ops);
        Toast.success('Changes saved successfully!');
        await loadBabyPatientProcedures();
    } catch (err) {
        console.error('Failed to save batch:', err);
        Toast.error('Some changes failed to save.');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.toggleHistoryView = function () {
    loadBabyPatientProcedures();
};

window.openProgressNote = function () {
    Toast.info('Progress Note — coming soon.');
};

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

// ─── Print Invoice ─────────────────────────────────────────────────────────
window.printBabyProcedureInvoice = function(id, isUnsaved) {
    let p = isUnsaved ? babyAllProcedures.find(x => x._tempId === id) : babyAllProcedures.find(x => x._id === id);
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
            .totals-row.grand { font-weight: bold; font-size: 18px; color: #f89a20; border-bottom: none; border-top: 2px solid #333; padding-top: 12px;}
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

// HUD Aliases
window.deleteProcedure = deleteBabyProcedure;
window.deleteUnsavedProcedure = deleteUnsavedBabyProcedure;
window.printProcedureInvoice = printBabyProcedureInvoice;