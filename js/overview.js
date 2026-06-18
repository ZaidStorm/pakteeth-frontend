//Overview page script

// Get patient ID from URL
function getPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Reports data - will be loaded from API for specific patient
let reports = [];
let currentPatientId = null;

const overviewCards = document.getElementById("overviewCards");

// Load patient-specific reports
async function loadPatientReports() {
    currentPatientId = getPatientId();
    if (!currentPatientId) {
        console.warn('No patient ID provided');
        return;
    }

    try {
        // Load reports for specific patient
        reports = await APP.api.get(`/reports/patient/${currentPatientId}`);
        renderOverview();
    } catch (err) {
        console.error("Failed to load patient reports:", err);
        // Fallback to dummy data if API fails
        reports = [
            {id:1, patient:"Current Patient", category:"X-Ray", filename:"xray1.png", type:"image/png"},
            {id:2, patient:"Current Patient", category:"CT Scan", filename:"ct1.pdf", type:"application/pdf"},
            {id:3, patient:"Current Patient", category:"Photo", filename:"photo1.jpeg", type:"image/jpeg"},
        ];
        renderOverview();
    }
}

function renderOverview(){
    if (!overviewCards) return;
    
    overviewCards.innerHTML="";
    reports.forEach(r=>{
        const card = document.createElement("div");
        card.className="report-card";
        let preview="";
        if(r.type.startsWith("image")) preview=`<img src="dummy/${r.filename}">`;
        else preview=`<iframe src="dummy/${r.filename}"></iframe>`;
        card.innerHTML=`
            ${preview}
            <strong>${r.category}</strong>
            <span>${r.filename}</span>
            <div class="actions">
                <button onclick="previewReport(${r.id})">Preview</button>
            </div>
        `;
        overviewCards.appendChild(card);
    });
}

function previewReport(id){
    const r = reports.find(x=>x.id===id);
    if (r) {
        window.open(`dummy/${r.filename}`,"_blank");
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    loadPatientReports();
});
