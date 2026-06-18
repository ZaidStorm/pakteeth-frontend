// ======== Reports DATA ========
let reports = [];

// Selected reports for compare
let compareReports = [];

// Pagination State
let currentReportPage = 1;
const reportsPerPage = 5;
let filteredReportList = [];

// Session-level file storage for Web Browser testing fallback
window.sessionFiles = window.sessionFiles || new Map();

// ======== DOM ELEMENTS ========
const reportCards = document.getElementById("reportCards");
const reportTable = document.getElementById("reportTableBody");
const compareArea = document.getElementById("compareArea");

// Get Patient ID
function getReportPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// ======== API LOAD ========
async function loadReports() {
    const patientId = getReportPatientId();
    if (!patientId) return;

    try {
        // Fetch patient data for standardized profile
        const patientRes = await fetch(`${API_BASE}/patients/${patientId}`);
        const patient = await patientRes.json();
        
        if (typeof populateProfile === 'function') {
            window.selectedPatient = patient;
            populateProfile();
        }

        // Fetch reports
        reports = await APP.api.get(`/reports/patient/${patientId}`);
        renderReports();
    } catch (err) {
        console.error("Failed to load reports or patient data:", err);
    }
}

// ======== FUNCTIONS ========
function renderReports() {
    filteredReportList = [...reports].sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0));

    // Reset page if out of bounds
    const totalPages = Math.ceil(filteredReportList.length / reportsPerPage);
    if (currentReportPage > totalPages) currentReportPage = totalPages || 1;

    // Slice for pagination
    const startIndex = (currentReportPage - 1) * reportsPerPage;
    const paginated = filteredReportList.slice(startIndex, startIndex + reportsPerPage);

    // Table
    if (reportTable) {
        reportTable.innerHTML = "";
        if (filteredReportList.length === 0) {
            reportTable.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No reports found</td></tr>`;
        } else {
            paginated.forEach(r => {
                const tr = document.createElement("tr");

                let thumbnail = "📄";
                const isImage = r.fileType && r.fileType.startsWith("image");
                if (isImage) {
                    thumbnail = `<div id="thumb-${r._id}" style="display:inline-block; vertical-align:middle; margin-right:5px; width:30px; text-align:center;">⌛</div>`;
                    generateThumbnail(r); // Load asynchronously
                }

                tr.innerHTML = `
                <td>${new Date(r.uploadDate).toLocaleDateString()}</td>
                <td><span class="badge">${r.category}</span></td>
                <td>${thumbnail} ${r.filename}</td>
                <td>${r.description || '-'}</td>
                <td>
                    <div class="report-hud-wrapper">
                        <button class="report-hud-trigger" onclick="ReportHUD.toggle(this, '${r._id}', ${compareReports.includes(r._id)})" title="Actions">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                    </div>
                </td>
            `;
                reportTable.appendChild(tr);
            });
        }
    }

    // Cards
    if (reportCards) {
        reportCards.innerHTML = "";
        paginated.forEach(r => {
            const card = document.createElement("div");
            card.className = "report-card";

            const isImage = r.fileType && r.fileType.startsWith("image");
            let preview = "";
            if (isImage) {
                preview = `<div style="height:150px; background:#e9ecef; display:flex; align-items:center; justify-content:center; border-radius:8px;">🖼️ Image</div>`;
            } else {
                preview = `<div style="height:150px; background:#e9ecef; display:flex; align-items:center; justify-content:center; border-radius:8px;">📄 Document</div>`;
            }

            card.innerHTML = `
                ${preview}
                <strong>${r.category}</strong>
                <span title="${r.filename}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9em;">${r.filename}</span>
                <div class="actions">
                    <button onclick="previewReport('${r._id}')">View</button>
                    <button onclick="editReport('${r._id}')">Edit</button>
                    <button onclick="toggleCompare('${r._id}')">${compareReports.includes(r._id) ? 'Remove Compare' : 'Compare'}</button>
                    <button class="remove" onclick="deleteReport('${r._id}')">Delete</button>
                </div>
            `;
            reportCards.appendChild(card);
        });
    }

    renderReportPagination(filteredReportList.length);
    renderCompare();
}

function renderReportPagination(totalItems) {
    const paginationContainer = document.getElementById("reportPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / reportsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changeReportPage(${currentReportPage - 1})" ${currentReportPage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    const delta = 1;
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentReportPage - delta && i <= currentReportPage + delta)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeReportPage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `<button class="pagination-number ${i === currentReportPage ? 'active' : ''}" onclick="changeReportPage(${i})">${i}</button>`;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeReportPage(${currentReportPage + 1})" ${currentReportPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

window.changeReportPage = function (page) {
    currentReportPage = page;
    renderReports();
};

function previewReport(id) {
    const r = reports.find(x => x._id === id);
    if (!r) return;

    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) { Toast.error("Popup blocked! Please allow popups for this site."); return; }

    win.document.write(`
        <html>
        <head>
            <title>View Report | ${r.filename}</title>
            <style>
                body { font-family: sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; flex-direction:column; background: #f4f7f6; }
                .report-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; flex-direction: column; align-items: center; max-width: 90%; max-height: 90%; }
                h3 { margin-top: 0; color: #333; }
                .img-wrapper { overflow: auto; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: center; align-items: center; background: #eee; width: 100%; height: 100%; }
                img { max-width: 100%; transition: transform 0.25s; }
                .controls { display: flex; gap: 10px; }
                button { padding: 8px 16px; border: none; border-radius: 6px; background: #2196f3; color: white; cursor: pointer; font-weight: 500; }
                button:hover { background: #1976d2; }
            </style>
        </head>
        <body>
            <div class="report-container">
                <h3>${r.filename}</h3>
                <div class="img-wrapper">
                    <img src="#" id="reportImg" alt="${r.filename}">
                </div>
                <div class="controls">
                    <button onclick="zoom(1.2)">Zoom In</button>
                    <button onclick="zoom(1)">Reset</button>
                    <button onclick="zoom(0.8)">Zoom Out</button>
                </div>
            </div>
            <script>
                let currentScale = 1;
                function zoom(s) {
                    if (s === 1) currentScale = 1; else currentScale *= s;
                    document.getElementById('reportImg').style.transform = 'scale(' + currentScale + ')';
                }
                
                const imgEl = document.getElementById('reportImg');
                const fileType = ${JSON.stringify(r.fileType || "")};
                const filePath = ${JSON.stringify(r.filePath || "")};
                const rId = "${r._id}";
                const filename = ${JSON.stringify(r.filename || "")};
                const isImage = fileType.startsWith('image');

                if (isImage) {
                    // Check if run in Electron
                    if (window.opener && window.opener.__pakteeth__ && filePath) {
                        window.opener.__pakteeth__.readReportFile(filePath).then(b64 => {
                            if (b64) imgEl.src = "data:" + fileType + ";base64," + b64;
                            else fail("Image missing from disk!");
                        }).catch(e => fail("Error loading image from disk"));
                    } 
                    // Fallback to Web Browser session
                    else if (window.opener && window.opener.sessionFiles && window.opener.sessionFiles.has(rId)) {
                        const file = window.opener.sessionFiles.get(rId);
                        const reader = new FileReader();
                        reader.onload = e => imgEl.src = e.target.result;
                        reader.readAsDataURL(file);
                    } else {
                        fail("Image missing from memory (Web mode resets on refresh)");
                    }
                } else {
                    fail("📄 Document: " + filename);
                }

                function fail(msg) {
                    imgEl.parentElement.innerHTML = '<div>' + msg + '</div>';
                    document.querySelector('.controls').style.display = 'none';
                }
            </script>
        </body>
        </html>
    `);
}

function editReport(id) {
    const r = reports.find(x => x._id === id);
    if (!r) return;

    const idInput = document.getElementById("editReportId");
    const catInput = document.getElementById("editReportCategory");
    const descInput = document.getElementById("editReportDescription");

    if (idInput && catInput && descInput) {
        idInput.value = id;
        catInput.value = r.category || "";
        descInput.value = r.description || "";
        if (window.Modal) Modal.open("editReportModal");
    }
}

async function deleteReport(id) {
    const ok = await Confirm.show("Delete this report?");
    if (!ok) return;
    try {
        await APP.api.delete(`/reports/${id}`);
        compareReports = compareReports.filter(x => x !== id);
        window.sessionFiles.delete(id); // Memory cleanup
        await loadReports();
    } catch (err) {
        console.error("Failed to delete report:", err);
    }
}

function toggleCompare(id) {
    if (compareReports.includes(id)) compareReports = compareReports.filter(x => x !== id);
    else {
        if (compareReports.length >= 2) { Toast.warning("The side-by-side comparison popup only supports 2 reports."); return; }
        compareReports.push(id);
    }
    renderReports();
    if (compareReports.length === 2) openCompareWindow();
}

function openCompareWindow() {
    if (compareReports.length !== 2) { Toast.warning("Select exactly 2 reports to compare!"); return; }

    const [leftId, rightId] = compareReports;
    const leftReport = reports.find(r => r._id === leftId);
    const rightReport = reports.find(r => r._id === rightId);
    const newWin = window.open("", "_blank", "width=1200,height=800");

    if (!newWin) { Toast.error("Popup blocked! Please allow popups to see the comparison."); return; }

    newWin.document.write(`
        <html>
        <head>
            <title>Compare Reports | PakTeeth</title>
            <style>
                body { font-family: sans-serif; background: #f4f7f6; margin: 0; padding: 20px; color: #333; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                .compare-container { display: flex; gap: 20px; height: calc(100vh - 250px); }
                .panel { flex: 1; background: white; border-radius: 12px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; overflow: hidden; }
                .panel-title { font-weight: bold; font-size: 1.1em; margin-bottom: 5px; color: #2196f3; }
                .panel-info { font-size: 0.85em; color: #666; margin-bottom: 15px; }
                .img-container { flex: 1; background: #eee; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: auto; border: 1px solid #ddd; }
                img { max-width: 100%; object-fit: contain; }
                .comment-area { margin-top: 20px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 12px; resize: vertical; min-height: 80px; box-sizing: border-box; }
                .actions { display: flex; justify-content: flex-end; margin-top: 15px; }
                button { padding: 10px 24px; border: none; border-radius: 6px; background: #2196f3; color: white; cursor: pointer; font-weight: 500; font-size: 1em; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Report Comparison Analysis</h2>
            </div>
            <div class="compare-container">
                <div class="panel">
                    <div class="panel-title">${leftReport.filename}</div>
                    <div class="panel-info">${leftReport.category} | ${new Date(leftReport.uploadDate).toLocaleDateString()}</div>
                    <div class="img-container" id="leftImgCont"><img src="#" id="leftImg"></div>
                </div>
                <div class="panel">
                    <div class="panel-title">${rightReport.filename}</div>
                    <div class="panel-info">${rightReport.category} | ${new Date(rightReport.uploadDate).toLocaleDateString()}</div>
                    <div class="img-container" id="rightImgCont"><img src="#" id="rightImg"></div>
                </div>
            </div>
            <div class="comment-area">
                <label><strong>Comparative Findings & analytical betterment notes:</strong></label>
                <textarea id="comparisonComment">${leftReport.comments || ""}</textarea>
                <div class="actions">
                    <button id="saveComparison">Save Analysis</button>
                </div>
            </div>

            <script>
                function loadPreview(imgId, contId, fileType, filename, filePath, rId) {
                    const img = document.getElementById(imgId);
                    if (fileType.startsWith("image")) {
                        if (window.opener && window.opener.__pakteeth__ && filePath) {
                            window.opener.__pakteeth__.readReportFile(filePath).then(b64 => {
                                if (b64) img.src = "data:" + fileType + ";base64," + b64;
                                else document.getElementById(contId).innerHTML = '<div style="color: #999;">⚠️ Image missing from disk</div>';
                            });
                        } else if (window.opener && window.opener.sessionFiles && window.opener.sessionFiles.has(rId)) {
                            const file = window.opener.sessionFiles.get(rId);
                            const reader = new FileReader();
                            reader.onload = e => img.src = e.target.result;
                            reader.readAsDataURL(file);
                        } else {
                            document.getElementById(contId).innerHTML = '<div style="color: #999;">⚠️ Image not loaded</div>';
                        }
                    } else {
                        document.getElementById(contId).innerHTML = '<div style="font-size: 3em;">📄</div><div style="margin-top:10px;">' + filename + '</div>';
                    }
                }
                
                loadPreview("leftImg", "leftImgCont", "${leftReport.fileType}", "${leftReport.filename}", "${leftReport.filePath ? leftReport.filePath.replace(/\\/g, '\\\\') : ''}", "${leftReport._id}");
                loadPreview("rightImg", "rightImgCont", "${rightReport.fileType}", "${rightReport.filename}", "${rightReport.filePath ? rightReport.filePath.replace(/\\/g, '\\\\') : ''}", "${rightReport._id}");

                document.getElementById('saveComparison').onclick = async function() {
                    const comment = document.getElementById('comparisonComment').value;
                    const btn = this;
                    btn.disabled = true;
                    btn.textContent = "Saving...";

                    try {
                        const response = await fetch('/reports/${leftReport._id}', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ comments: comment })
                        });
                        if (response.ok) {
                            alert("Analysis saved successfully!");
                            if (window.opener && !window.opener.closed) window.opener.loadReports();
                        } else throw new Error("Server error");
                    } catch (e) {
                        alert("Failed to save: " + e.message);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = "Save Analysis";
                    }
                };
            </script>
        </body>
        </html>
    `);
}

async function saveComment(id) {
    const r = reports.find(x => x._id === id);
    if (!r) return;

    const commentEl = document.getElementById(`comment-${id}`);
    if (!commentEl) return;

    try {
        await APP.api.put(`/reports/${id}`, { comments: commentEl.value });
        Toast.success("Comment saved successfully!");
        await loadReports();
    } catch (err) {
        console.error("Failed to save comment:", err);
    }
}

function renderCompare() {
    if (!compareArea) return;
    compareArea.innerHTML = "";

    if (compareReports.length === 0) {
        compareArea.innerHTML = `<p style="color:var(--text-muted); width: 100%; text-align: center;">Select "Compare" on reports to view them side-by-side.</p>`;
        return;
    }

    compareReports.forEach(id => {
        const r = reports.find(x => x._id === id);
        if (!r) return;

        const card = document.createElement("div");
        card.className = "compare-card";

        let preview = "";
        if (r.fileType && r.fileType.startsWith("image")) {
            preview = `<div id="comp-img-${r._id}" style="height:300px; background:#e9ecef; display:flex; align-items:center; justify-content:center; border-radius:8px; margin-bottom: 1rem;">⌛ Loading...</div>`;
            generateThumbnail(r); // fetch via IPC or FileReader
        } else {
            preview = `<div style="height:300px; background:#e9ecef; display:flex; align-items:center; justify-content:center; border-radius:8px; margin-bottom: 1rem;">📄 ${r.filename}</div>`;
        }

        card.innerHTML = `
            ${preview}
            <strong>${r.category}</strong>
            <p style="font-size: 0.85em; color: var(--text-muted);">${new Date(r.uploadDate).toLocaleDateString()}</p>
            <div class="comment-section">
                <label style="font-size: 0.9em; font-weight: 500;">Doctor Comments:</label>
                <div class="comment-input-area">
                    <textarea id="comment-${r._id}" class="form-control" rows="2" placeholder="Add analytical notes...">${r.comments || ''}</textarea>
                    <button class="btn btn-primary" onclick="saveComment('${r._id}')" style="align-self: flex-start;">Save</button>
                </div>
            </div>
        `;
        compareArea.appendChild(card);
    });
}

async function generateThumbnail(r) {
    try {
        const thumbEl = document.getElementById(`thumb-${r._id}`);
        const compEl = document.getElementById(`comp-img-${r._id}`);

        const setImg = (src) => {
            const imgHtml = `<img src="${src}" style="width:30px; height:30px; object-fit:cover; border-radius:4px; vertical-align:middle;">`;
            if (thumbEl) thumbEl.innerHTML = imgHtml;
            if (compEl) compEl.innerHTML = `<img src="${src}" style="max-width: 100%; max-height: 280px; object-fit: contain; padding: 4px;">`;
        };

        // 1. Desktop IPC Persistence Route
        if (window.__pakteeth__ && r.filePath) {
            // Use the fast thumbnail reader instead of loading the full 5MB+ image into RAM
            const b64 = await window.__pakteeth__.readReportThumbnail(r.filePath);
            if (b64) setImg(`data:${r.fileType};base64,${b64}`);
            else if (thumbEl) thumbEl.innerHTML = "⚠️";
        }
        // 2. Web Browser Session Fallback Route
        else if (window.sessionFiles && window.sessionFiles.has(r._id)) {
            const file = window.sessionFiles.get(r._id);
            const reader = new FileReader();
            reader.onload = e => setImg(e.target.result);
            reader.readAsDataURL(file);
        } else {
            if (thumbEl) thumbEl.innerHTML = "🖼️";
            if (compEl) compEl.innerHTML = "Image not in current RAM session";
        }
    } catch (e) {
        console.error("Thumbnail rendering failed", e);
    }
}

// ======= UPLOAD HANDLING =======

// ─── Folder Sync Handlers ───
window.handleLinkFolderClick = async function() {
    if (!window.__pakteeth__ || !window.__pakteeth__.linkSyncFolder) {
        Toast.warning("Folder Sync requires the Desktop App."); return;
    }
    const patientId = getReportPatientId();
    if (!patientId) { Toast.error("No patient context."); return; }

    try {
        const result = await window.__pakteeth__.linkSyncFolder(patientId);
        if (!result || !result.files) return;
        
        await processSyncResult(patientId, result.files);
    } catch(err) {
        console.error("Link Folder Error:", err);
        Toast.error("Failed to link folder.");
    }
};

window.handleSyncFolderClick = async function() {
    if (!window.__pakteeth__ || !window.__pakteeth__.getSyncFolder) {
        Toast.warning("Folder Sync requires the Desktop App."); return;
    }
    const patientId = getReportPatientId();
    if (!patientId) { Toast.error("No patient context."); return; }

    try {
        const result = await window.__pakteeth__.getSyncFolder(patientId);
        if (!result) {
            Toast.warning("No folder has been linked to this patient yet. Click '🔗 Link Folder' first."); return;
        }
        
        await processSyncResult(patientId, result.files);
    } catch(err) {
        console.error("Sync Folder Error:", err);
        Toast.error("Failed to sync folder.");
    }
};

async function processSyncResult(patientId, discoveredFiles) {
    if (discoveredFiles.length === 0) {
        if (window.Toast) Toast.info("Folder is empty. No images found.");
        else Toast.info("Folder is empty. No images found.");
        return;
    }

    // Filter out duplicates based on originalName
    const existingNames = reports.map(r => r.filename);
    const newFiles = discoveredFiles.filter(f => !existingNames.includes(f.originalName));

    if (newFiles.length === 0) {
        if (window.Toast) Toast.info("Folder is already fully synced!");
        else Toast.info("Folder is already fully synced!");
        return;
    }

    if (window.Toast) Toast.info(`Found ${newFiles.length} new files. Syncing...`);
    
    try {
        // Tell backend to physically copy the files over
        const savedFiles = await window.__pakteeth__.processSyncFiles(patientId, newFiles);
        
        // Save to DB
        for (const f of savedFiles) {
            const payload = {
                patientId: patientId,
                category: "Scanned Sync",
                filename: f.originalName,
                filePath: f.filePath,
                fileType: f.type,
                description: "Auto-synced from linked folder"
            };
            await APP.api.post("/reports", payload);
        }

        if (window.Toast) Toast.success(`Successfully synced ${savedFiles.length} new images!`);
        await loadReports();
    } catch(err) {
        console.error("Failed to process sync files:", err);
        Toast.error("Failed to save synced files to database.");
    }
}

// Main Entry: Decides IPC (Electron) or File Input (Web)
window.handleReportUploadClick = async function () {
    if (window.__pakteeth__ && window.__pakteeth__.selectReportFiles) {
        // Desktop Electron Flow
        const patientId = getReportPatientId();
        if (!patientId) { Toast.error("No patient context found."); return; }

        try {
            const savedFiles = await window.__pakteeth__.selectReportFiles(patientId);
            if (!savedFiles || savedFiles.length === 0) return;

            const category = "Uncategorized";

            for (const f of savedFiles) {
                const payload = {
                    patientId: patientId,
                    category: category,
                    filename: f.originalName,
                    filePath: f.filePath, // Persistent storage pointer
                    fileType: f.type,
                    description: ""
                };
                await APP.api.post("/reports", payload);
            }

            if (window.Toast) Toast.success("Reports uploaded safely.");
            await loadReports();
        } catch (err) {
            console.error("Upload error:", err);
            Toast.error("Failed to upload report. Details: " + (err.message || JSON.stringify(err)));
        }
    } else {
        // Web Browser Flow
        const fileInput = document.getElementById("webReportUpload");
        if (fileInput) fileInput.click();
    }
};

// Target for the hidden webReportUpload input
window.handleWebUpload = async function (input) {
    const patientId = getReportPatientId();
    if (!patientId) { Toast.error("No patient context found."); return; }

    const files = input.files;
    if (!files || files.length === 0) return;

    const category = "Uncategorized";

    try {
        for (const file of files) {
            const payload = {
                patientId: patientId,
                category: category,
                filename: file.name,
                filePath: "", // No persistent path in web mode
                fileType: file.type || "application/octet-stream",
                description: ""
            };

            const response = await APP.api.post("/reports", payload);
            // Save exactly as the user's manual changes expected
            if (response && response._id) {
                window.sessionFiles.set(response._id, file);
            }
        }

        if (window.Toast) Toast.success("Reports temporarily saved to memory.");
        input.value = ""; // clear input
        await loadReports();
    } catch (err) {
        console.error("Web Upload Error:", err);
        Toast.error("Failed to upload via web.");
    }
};

// ======= INITIAL RENDER =======
document.addEventListener("DOMContentLoaded", () => {
    loadReports();

    // Wire up Edit Report Modal
    const editForm = document.getElementById("editReportForm");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("editReportId").value;
            const cat = document.getElementById("editReportCategory").value || "Uncategorized";
            const desc = document.getElementById("editReportDescription").value;

            try {
                await APP.api.put(`/reports/${id}`, { category: cat, description: desc });
                if (window.Modal) Modal.close("editReportModal");
                if (window.Toast) Toast.success("Report updated successfully");
                await loadReports();
            } catch (err) {
                console.error("Failed to update report:", err);
                Toast.error("Failed to update report.");
            }
        });
    }
});
