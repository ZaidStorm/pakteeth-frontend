// ====== billing.js — Connected to MongoDB via REST API ======

// In-memory state (loaded from API on page load)
let invoices = [];
let patients = [];
let doctors = [];
let currentPatientId = null;

// Pagination State
let currentBillingPage = 1;
const billingPerPage = 5;
let filteredBillingList = [];

// Get patient ID from URL
function getPatientId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}



// ====== Load Patients into Dropdown ======
async function loadPatients() {
    try {
        const patientId = getPatientId();

        if (patientId) {
            // Load specific patient data
            const patient = await APP.api.get(`/patients/${patientId}`);
            patients = [patient];
            currentPatientId = patientId;

            // Standardize Profile UI (Align with Dental Chart)
            if (typeof populateProfile === 'function') {
                window.selectedPatient = patient;
                populateProfile();
            }
        } else {
            // Load all patients for dropdown (admin view)
            const res = await APP.api.get("/patients");
            patients = res.patients || res;
        }

        const select = document.getElementById("inv_patient");
        if (!select) return;
        select.innerHTML = '<option value="">Select Patient...</option>';
        patients.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.patientId || p._id;
            opt.textContent = `${p.firstName} ${p.lastName} (${p.patientId || p._id})`;
            select.appendChild(opt);
        });

        if (patientId) {
            select.value = patientId;
            select.disabled = true;
            select.dispatchEvent(new Event('change'));
        } else {
            select.disabled = false;
        }
    } catch (err) {
        console.error("Failed to load patients:", err);
    }
}

// ====== Load Doctors into Dropdown ======
async function loadDoctors() {
    try {
        const staff = await APP.api.get("/staff");
        // Filter only doctors
        doctors = staff.filter(s => s.role && s.role.toLowerCase().includes("doctor"));

        const select = document.getElementById("inv_doctor");
        if (!select) return;
        select.innerHTML = '<option value="">Select Doctor...</option>';
        doctors.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d.staffId || d._id;
            opt.textContent = d.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load doctors:", err);
    }
}

// ====== Load Invoices from API ======
async function loadInvoices() {
    try {
        const patientId = getPatientId();

        if (patientId) {
            // Load invoices for specific patient
            invoices = await APP.api.get(`/invoices/patient/${patientId}`);
        } else {
            // Load all invoices (admin view)
            invoices = await APP.api.get("/invoices");
        }

        // Sort invoices newest first (primarily by createdAt timestamp)
        invoices.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date || 0);
            const dateB = new Date(b.createdAt || b.date || 0);
            return dateB - dateA;
        });

        renderInvoices();
        updateFinancialOverview();
    } catch (err) {
        console.error("Failed to load invoices:", err);
    }
}

// ====== Open Invoice Modal ======
function openNewInvoiceModal() {
    document.getElementById("invoiceForm").reset();
    document.getElementById("inv_balance_label").textContent = "0";
    document.getElementById("inv_available_credit").value = "0";
    document.getElementById("inv_credit").value = "0";
    loadPatients();
    loadDoctors();

    // Set default date to today
    const dateInput = document.getElementById("inv_date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    Modal.open("newInvoiceModal");
}

// ====== Calculate Balance ======
function calcBalance() {
    const amount = parseFloat(document.getElementById("inv_amount").value) || 0;
    const discount = parseFloat(document.getElementById("inv_discount").value) || 0;
    const paid = parseFloat(document.getElementById("inv_paid").value) || 0;
    const availableCredit = parseFloat(document.getElementById("inv_available_credit").value) || 0;

    // Total owed after discounts and applied credit
    const subtotal = amount - discount - availableCredit;

    // Balance to pay (or new overpay credit)
    const rawBalance = subtotal - paid;
    const balance = Math.max(0, rawBalance);

    document.getElementById("inv_balance_label").textContent = balance.toFixed(2);

    let generatedCredit = 0;
    if (paid > subtotal) {
        generatedCredit = paid - subtotal;
        document.getElementById("inv_credit").value = generatedCredit.toFixed(2);
        document.getElementById("inv_balance_label").textContent = "0.00 (Generated Credit: " + generatedCredit.toFixed(2) + ")";

        // UI Feedback for overpayment
        if (typeof showToast === "function") {
            // Optional: debounce or only show once
        }
    } else {
        document.getElementById("inv_credit").value = "0";
    }

    // Dynamic Status Update
    const status = (balance <= 0) ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');

    return { paid, credit: parseFloat(generatedCredit.toFixed(2)), balance: parseFloat(balance.toFixed(2)), status };
}

// ====== Patient Selection Change Event ======
// This calculates the total credit available for a patient when they are selected.
document.addEventListener("DOMContentLoaded", () => {
    const patientSelect = document.getElementById("inv_patient");
    if (patientSelect) {
        patientSelect.addEventListener("change", (e) => {
            const patientId = e.target.value; // Define patientId from event
            if (!patientId) {
                const availableEl = document.getElementById("inv_available_credit");
                if (availableEl) availableEl.value = "0";
                calcBalance();
                return;
            }

            let totalCred = 0;
            let totalUsed = 0;

            invoices.forEach(inv => {
                if (inv.patientId === patientId) {
                    totalCred += (parseFloat(inv.credit) || 0);
                    totalUsed += (parseFloat(inv.usedCredit) || 0);
                }
            });

            const available = Math.max(0, totalCred - totalUsed);
            const availableEl = document.getElementById("inv_available_credit");
            if (availableEl) {
                availableEl.value = available.toFixed(2);
                // Trigger calculation to update balance with newly applied credit
                calcBalance();
            }
        });
    }
});

// ====== Save Invoice ======
async function saveInvoice() {
    const { paid, credit, balance, status } = calcBalance(); // Capture status
    const patientValue = document.getElementById("inv_patient").value;
    const patientObj = patients.find(p => (p.patientId || p._id) === patientValue);

    const doctorValue = document.getElementById("inv_doctor").value;
    const doctorObj = doctors.find(d => (d.staffId || d._id) === doctorValue);

    const availableCredit = parseFloat(document.getElementById("inv_available_credit").value) || 0;

    const invoice = {
        date: document.getElementById("inv_date").value,
        patientId: patientValue,
        patientName: patientObj ? `${patientObj.firstName} ${patientObj.lastName}` : patientValue,
        doctorId: doctorValue,
        doctorName: doctorObj ? doctorObj.name : doctorValue,
        services: document.getElementById("inv_services").value.split(",").map(s => s.trim()),
        totalAmount: parseFloat(document.getElementById("inv_amount").value) || 0,
        discount: parseFloat(document.getElementById("inv_discount").value) || 0,
        paid,
        credit,
        usedCredit: availableCredit,
        balance,
        status
    };

    if (!invoice.date || !invoice.patientId) {
        Toast.error("Please fill in all required fields (Patient and Date).");
        return;
    }

    // Attempt to clear out the used availableCredit if it was consumed. Since credits are sum of past invoices, this logic assumes we just record the invoice correctly.
    // In a fuller implementation, we'd deduct the master Patient DB record. For now, tracking generated invoice Credit is sufficient map.

    try {
        const res = await fetch(`${API_BASE}/invoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invoice)
        });
        if (!res.ok) throw new Error("Server error");
        await loadInvoices();
        Modal.close("newInvoiceModal");
    } catch (err) {
        console.error("Failed to save invoice:", err);
        Toast.error("Failed to save invoice. Please try again.");
    }
}

// ====== Render Invoices Table ======
function renderInvoices(data) {
    const list = data || invoices;
    filteredBillingList = list;

    // Reset page if data changed and current page is out of bounds
    const totalPages = Math.ceil(filteredBillingList.length / billingPerPage);
    if (currentBillingPage > totalPages) currentBillingPage = totalPages || 1;

    const tbody = document.querySelector("#invoiceTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (filteredBillingList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted)">No invoices found</td></tr>`;
        const paginationContainer = document.getElementById("billingPagination");
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    // Slice for pagination
    const startIndex = (currentBillingPage - 1) * billingPerPage;
    const paginated = filteredBillingList.slice(startIndex, startIndex + billingPerPage);

    paginated.forEach(inv => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${inv.date || ""}</td>
            <td>${inv.invoiceNumber || inv._id || ""}</td>
            <td>${inv.patientName || inv.patientId || ""}</td>
            <td>${inv.doctorName || "N/A"}</td>
            <td>${(inv.totalAmount || 0).toFixed(2)}</td>
            <td>${(inv.discount || 0).toFixed(2)}</td>
            <td>${(inv.paid || 0).toFixed(2)}</td>
            <td>${(inv.balance || 0).toFixed(2)}</td>
            <td>${(inv.credit || 0).toFixed(2)}</td>
            <td><span class="badge badge-${inv.status === 'Paid' ? 'success' : inv.status === 'Partial' ? 'warning' : 'danger'}">${inv.status || "Pending"}</span></td>
            <td>
                <div class="bill-hud-wrapper">
                    <button class="bill-hud-trigger" onclick="BillingHUD.toggle(this, '${inv._id}', ${inv.status === 'Paid'})" title="Actions">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderBillingPagination(filteredBillingList.length);
}

function renderBillingPagination(totalItems) {
    const paginationContainer = document.getElementById("billingPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / billingPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `
        <button class="pagination-btn" onclick="changeBillingPage(${currentBillingPage - 1})" ${currentBillingPage === 1 ? 'disabled' : ''}>
            Back
        </button>
        <div class="pagination-numbers">
    `;

    const delta = 1;
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentBillingPage - delta && i <= currentBillingPage + delta)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                html += `<button class="pagination-number" onclick="changeBillingPage(${l + 1})">${l + 1}</button>`;
            } else if (i - l !== 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        html += `<button class="pagination-number ${i === currentBillingPage ? 'active' : ''}" onclick="changeBillingPage(${i})">${i}</button>`;
        l = i;
    }

    html += `
        </div>
        <button class="pagination-btn" onclick="changeBillingPage(${currentBillingPage + 1})" ${currentBillingPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;
}

window.changeBillingPage = function (page) {
    currentBillingPage = page;
    renderInvoices(filteredBillingList);
};

// ====== Delete Invoice ======
async function deleteInvoice(id) {
    const ok = await Confirm.show("Are you sure you want to delete this invoice?");
    if (!ok) return;
    try {
        const res = await fetch(`${API_BASE}/invoices/${id}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Failed to delete invoice");
        await loadInvoices();
    } catch (err) {
        console.error("Delete failed:", err);
        Toast.error("Failed to delete invoice.");
    }
}

// ====== Filter Invoices ======
function filterInvoices() {
    currentBillingPage = 1;
    const type = document.getElementById("searchTypeInvoice").value;
    const keyword = (document.getElementById("searchInvoice").value || "").toLowerCase();
    const statusFilter = document.getElementById("filterStatus").value;

    let filtered = invoices.filter(inv => {
        const invId = (inv.invoiceNumber || inv._id || "").toLowerCase();
        const pId = (inv.patientId || "").toLowerCase();
        const name = (inv.patientName || "").toLowerCase();
        const date = (inv.date || "").toLowerCase();
        let match = true;

        if (keyword) {
            if (type === "id") {
                if (!invId.includes(keyword) && !pId.includes(keyword)) match = false;
            } else if (type === "name") {
                if (!name.includes(keyword)) match = false;
            } else if (type === "date") {
                if (!date.includes(keyword)) match = false;
            } else { // "all"
                if (!invId.includes(keyword) && !pId.includes(keyword) && !name.includes(keyword) && !date.includes(keyword)) match = false;
            }
        }

        if (statusFilter && (inv.status || "").toLowerCase() !== statusFilter.toLowerCase()) match = false;

        return match;
    });

    renderInvoices(filtered);
}

// ====== Financial Overview ======
function updateFinancialOverview() {
    const totalRev = invoices.reduce((acc, i) => acc + (parseFloat(i.paid) || 0), 0);
    const totalOut = invoices.reduce((acc, i) => acc + (parseFloat(i.balance) || 0), 0);
    const totalCred = invoices.reduce((acc, i) => acc + ((parseFloat(i.credit) || 0) - (parseFloat(i.usedCredit) || 0)), 0);

    const revEl = document.getElementById("totalRev");
    const outEl = document.getElementById("totalOut");
    const credEl = document.getElementById("totalCredit");

    if (revEl) revEl.textContent = `Rs ${totalRev.toFixed(2)}`;
    if (outEl) outEl.textContent = `Rs ${totalOut.toFixed(2)}`;
    if (credEl) credEl.textContent = `Rs ${totalCred.toFixed(2)}`;
}

// ====== Payment Modal ======
function openPaymentModal(invId) {
    const invoice = invoices.find(i => i._id === invId);
    if (!invoice) { Toast.error("Invoice not found"); return; }
    document.getElementById("pay_inv_id").value = invId;
    document.getElementById("pay_inv_balance").textContent = (invoice.balance || 0).toFixed(2);
    document.getElementById("pay_amount").value = (invoice.balance || 0).toFixed(2);
    Modal.open("recordPaymentModal");
}

// ====== Process Payment ======
async function processPayment() {
    const invId = document.getElementById("pay_inv_id").value;
    const payAmount = parseFloat(document.getElementById("pay_amount").value) || 0;
    const invoice = invoices.find(i => i._id === invId);
    if (!invoice) { Toast.error("Invoice not found"); return; }

    let newPaid = parseFloat(invoice.paid) || 0;
    let newBalance = parseFloat(invoice.balance) || 0;
    let newCredit = parseFloat(invoice.credit) || 0;

    if (payAmount > newBalance) {
        newCredit += payAmount - newBalance;
        newPaid += newBalance;
        newBalance = 0;
    } else {
        newPaid += payAmount;
        newBalance -= payAmount;
    }

    const newStatus = newBalance === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Pending";

    try {
        const res = await fetch(`${API_BASE}/invoices/${invId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paid: newPaid, balance: newBalance, credit: newCredit, status: newStatus })
        });
        if (!res.ok) throw new Error("Server error");
        await loadInvoices();
        Modal.close("recordPaymentModal");
    } catch (err) {
        console.error("Failed to record payment:", err);
        Toast.error("Failed to record payment. Please try again.");
    }
}

// ====== Print Invoice ======
window.printInvoice = function (invId) {
    const inv = invoices.find(i => i._id === invId);
    if (!inv) {
        Toast.error("Invoice not found.");
        return;
    }

    const pName = document.getElementById("heroName")?.textContent || inv.patientName || "Unknown Patient";
    const pId = document.getElementById("heroId")?.textContent?.replace('Patient ID: ', '') || inv.patientId || "-";
    const dName = inv.doctorName || "N/A";
    const invDate = inv.date ? inv.date.split('T')[0] : "-";

    const printHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Invoice - ${inv.invoiceNumber || inv._id}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
            .header p { margin: 5px 0 0 0; color: #7f8c8d; }
            .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details span { font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; color: #2766ba; font-weight: 600; }
            .totals-container { float: right; margin-top: 30px; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f1f1; }
            .totals-row.grand { font-weight: bold; font-size: 18px; color: #2766ba; border-bottom: none; border-top: 2px solid #333; padding-top: 15px; margin-top: 5px; }
            .footer { margin-top: 100px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; clear: both; }
            @media print {
                body { padding: 20px; }
                .totals-container { width: 40%; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PakTeeth Dental Clinic</h1>
            <p>Official Payment Receipt</p>
        </div>
        
        <div class="row">
            <div class="details">
                <p><span>Invoiced To:</span> ${pName}</p>
                <p><span>Patient ID:</span> ${pId}</p>
                <p><span>Doctor:</span> ${dName}</p>
            </div>
            <div class="details" style="text-align: right;">
                <p><span>Invoice #:</span> ${inv.invoiceNumber || inv._id}</p>
                <p><span>Date:</span> ${invDate}</p>
                <p><span>Status:</span> ${inv.status || "Pending"}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description / Services</th>
                    <th style="text-align: right;">Amount (PKR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div style="font-weight: 500;">Dental Services Rendered:</div>
                        ${(inv.services || []).map(s => `<div style="margin-left: 10px; color: #666; font-size: 14px;">• ${s}</div>`).join("")}
                    </td>
                    <td style="text-align: right; vertical-align: top; font-weight: 500;">
                        ${(inv.totalAmount || 0).toFixed(2)}
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="totals-container">
            <div class="totals-row">
                <span>Subtotal:</span>
                <span>Rs ${(inv.totalAmount || 0).toFixed(2)}</span>
            </div>
            ${inv.discount > 0 ? `
            <div class="totals-row">
                <span>Discount:</span>
                <span>- Rs ${(inv.discount || 0).toFixed(2)}</span>
            </div>
            ` : ""}
            <div class="totals-row">
                <span>Amount Paid:</span>
                <span>Rs ${(inv.paid || 0).toFixed(2)}</span>
            </div>
            <div class="totals-row grand">
                <span>Balance Due:</span>
                <span>Rs ${(inv.balance || 0).toFixed(2)}</span>
            </div>
            ${inv.credit > 0 ? `
            <div class="totals-row" style="color: #28a745; font-size: 14px;">
                <span>Available Credit:</span>
                <span>Rs ${(inv.credit || 0).toFixed(2)}</span>
            </div>
            ` : ""}
        </div>

        <div class="footer">
            <p>Payment is due upon receipt. Thank you for your business!</p>
            <p><strong>PakTeeth Dental Clinic</strong> — Excellence in Dental Care</p>
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

    // Browser-optimized print trigger
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}

// ====== Share Invoice ======
window.shareInvoiceEmail = function (id) {
    const inv = invoices.find(i => i._id === id);
    if (!inv) { Toast.error("Invoice not found"); return; }

    const pName = document.getElementById("heroName")?.textContent || inv.patientName || "Unknown Patient";
    const pId = document.getElementById("heroId")?.textContent?.replace('Patient ID: ', '') || inv.patientId || "-";
    const dName = inv.doctorName || "N/A";
    const invDate = inv.date ? inv.date.split('T')[0] : "-";
    const title = `Invoice ${inv.invoiceNumber || inv._id}`;
    const filename = `Invoice_${inv.invoiceNumber || inv._id}_${pName.replace(/\\s+/g, '_')}.pdf`;

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
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; color: #2766ba; font-weight: 600; }
            .totals-container { float: right; margin-top: 30px; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f1f1; }
            .totals-row.grand { font-weight: bold; font-size: 18px; color: #2766ba; border-bottom: none; border-top: 2px solid #333; padding-top: 15px; margin-top: 5px; }
            .footer { margin-top: 100px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; clear: both; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PakTeeth Dental Clinic</h1>
            <p>Official Payment Receipt</p>
        </div>
        
        <div class="row">
            <div class="details">
                <p><span>Invoiced To:</span> ${pName}</p>
                <p><span>Patient ID:</span> ${pId}</p>
                <p><span>Doctor:</span> ${dName}</p>
            </div>
            <div class="details" style="text-align: right;">
                <p><span>Invoice #:</span> ${inv.invoiceNumber || inv._id}</p>
                <p><span>Date:</span> ${invDate}</p>
                <p><span>Status:</span> ${inv.status || "Pending"}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description / Services</th>
                    <th style="text-align: right;">Amount (PKR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div style="font-weight: 500;">Dental Services Rendered:</div>
                        ${(inv.services || []).map(s => `<div style="margin-left: 10px; color: #666; font-size: 14px;">• ${s}</div>`).join("")}
                    </td>
                    <td style="text-align: right; vertical-align: top; font-weight: 500;">
                        ${(inv.totalAmount || 0).toFixed(2)}
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="totals-container">
            <div class="totals-row">
                <span>Subtotal:</span>
                <span>Rs ${(inv.totalAmount || 0).toFixed(2)}</span>
            </div>
            ${inv.discount > 0 ? `
            <div class="totals-row">
                <span>Discount:</span>
                <span>- Rs ${(inv.discount || 0).toFixed(2)}</span>
            </div>
            ` : ""}
            <div class="totals-row">
                <span>Amount Paid:</span>
                <span>Rs ${(inv.paid || 0).toFixed(2)}</span>
            </div>
            <div class="totals-row grand">
                <span>Balance Due:</span>
                <span>Rs ${(inv.balance || 0).toFixed(2)}</span>
            </div>
            ${inv.credit > 0 ? `
            <div class="totals-row" style="color: #28a745; font-size: 14px;">
                <span>Available Credit:</span>
                <span>Rs ${(inv.credit || 0).toFixed(2)}</span>
            </div>
            ` : ""}
        </div>

        <div class="footer">
            <p>Payment is due upon receipt. Thank you for your business!</p>
            <p><strong>PakTeeth Dental Clinic</strong> — Excellence in Dental Care</p>
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

// ====== Share Invoice via WhatsApp ======
window.shareInvoiceWhatsApp = function (id) {
    const inv = invoices.find(i => i._id === id);
    if (!inv) { Toast.error("Invoice not found"); return; }

    const patient = patients.find(p => (p.patientId || p._id?.toString()) === inv.patientId?.toString() || p.patientId === inv.patientId);
    const phone = patient?.phone || inv.patientPhone;
    const pName = inv.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : "Patient");
    const invDate = inv.date ? inv.date.split('T')[0] : "-";
    const title = `Invoice ${inv.invoiceNumber || inv._id}`;
    const filename = `Invoice_${inv.invoiceNumber || inv._id}_${pName.replace(/\s+/g, '_')}.pdf`;

    const printHtml = `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2766ba; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #2766ba; font-size: 28px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .details span { font-weight: bold; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
        th { background: #f8f9fa; color: #2766ba; }
        .totals-container { float: right; margin-top: 30px; width: 300px; }
        .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f1f1; }
        .totals-row.grand { font-weight: bold; font-size: 18px; color: #2766ba; border-top: 2px solid #333; }
        .footer { margin-top: 100px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px; clear: both; }
    </style></head><body>
    <div class="header"><h1>PakTeeth Dental Clinic</h1><p>Official Payment Receipt</p></div>
    <div class="row">
        <div class="details">
            <p><span>To:</span> ${pName}</p>
            <p><span>Doctor:</span> ${inv.doctorName || "N/A"}</p>
        </div>
        <div class="details" style="text-align:right">
            <p><span>Invoice #:</span> ${inv.invoiceNumber || inv._id}</p>
            <p><span>Date:</span> ${invDate}</p>
            <p><span>Status:</span> ${inv.status || "Pending"}</p>
        </div>
    </div>
    <table><thead><tr><th>Services</th><th style="text-align:right">Amount (PKR)</th></tr></thead>
    <tbody><tr>
        <td>${(inv.services || []).map(s => `• ${s}`).join('<br>')}</td>
        <td style="text-align:right;font-weight:500">${(inv.totalAmount || 0).toFixed(2)}</td>
    </tr></tbody></table>
    <div class="totals-container">
        <div class="totals-row"><span>Subtotal:</span><span>Rs ${(inv.totalAmount || 0).toFixed(2)}</span></div>
        ${inv.discount > 0 ? `<div class="totals-row"><span>Discount:</span><span>- Rs ${(inv.discount || 0).toFixed(2)}</span></div>` : ""}
        <div class="totals-row"><span>Paid:</span><span>Rs ${(inv.paid || 0).toFixed(2)}</span></div>
        <div class="totals-row grand"><span>Balance Due:</span><span>Rs ${(inv.balance || 0).toFixed(2)}</span></div>
    </div>
    <div class="footer"><p>Thank you for your business! — PakTeeth Dental Clinic</p></div>
    </body></html>`;

    if (window.Share?.openWhatsAppPDF) {
        window.Share.openWhatsAppPDF(title, filename, printHtml, phone, pName);
    } else {
        Toast.error("WhatsApp sharing is not available.");
    }
};


// ====== Share Invoice via WhatsApp (Automated) ======
window.shareInvoiceWhatsAppAuto = async function (id) {
    const inv = invoices.find(i => i._id === id);
    if (!inv) { Toast.error("Invoice not found"); return; }

    const patient = patients.find(p => (p.patientId || p._id?.toString()) === inv.patientId?.toString() || p.patientId === inv.patientId);
    const phone = patient?.phone || inv.patientPhone;
    if (!phone) { Toast.error("Patient has no phone number."); return; }

    const pName = inv.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : "Patient");
    const total = (inv.totalAmount || 0).toFixed(2);
    const balance = (inv.balance || 0).toFixed(2);
    const invNum = inv.invoiceNumber || inv._id;

    const message = `Hello ${pName}, here is your billing summary from PakTeeth Clinic:\nInvoice #: ${invNum}\nTotal: PKR ${total}\nBalance Due: PKR ${balance}\n\nThank you!`;

    await Share.sendWhatsAppAutomated(phone, message);
};


// ====== Share Invoice via SMS ======
window.shareInvoiceSMS = function (id) {
    const inv = invoices.find(i => i._id === id);
    if (!inv) { Toast.error("Invoice not found"); return; }

    const patient = patients.find(p => (p.patientId || p._id?.toString()) === inv.patientId?.toString() || p.patientId === inv.patientId);
    const phone = patient?.phone || inv.patientPhone;
    if (!phone) { Toast.error("Patient has no phone number."); return; }

    const pName = inv.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : "Patient");
    const invDate = inv.date ? inv.date.split('T')[0] : "-";
    const total = (inv.totalAmount || 0).toFixed(2);
    const balance = (inv.balance || 0).toFixed(2);
    const invNum = inv.invoiceNumber || inv._id;

    // Create a concise SMS message
    const message = `PakTeeth Clinic\nInvoice #: ${invNum}\nDate: ${invDate}\nPatient: ${pName}\nTotal Amnt: PKR ${total}\nBal Due: PKR ${balance}\n\nThank you for choosing PakTeeth!`;

    if (window.Share?.sendSMS) {
        window.Share.sendSMS(phone, message);
    } else {
        Toast.error("SMS sharing is not available.");
    }
};

// ====== Export CSV ======
function exportBilling() {
    if (invoices.length === 0) { Toast.warning("No invoices to export"); return; }

    const headers = ["Date", "Invoice #", "Patient", "Total Amount", "Discount", "Paid", "Due Balance", "Credit", "Status"];

    const csvRows = [];
    // Add headers with proper quoting
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));

    invoices.forEach(inv => {
        const row = [
            inv.date || "",
            inv.invoiceNumber || inv._id || "",
            inv.patientName || "",
            (inv.totalAmount || 0).toFixed(2),
            (inv.discount || 0).toFixed(2),
            (inv.paid || 0).toFixed(2),
            (inv.balance || 0).toFixed(2),
            (inv.credit || 0).toFixed(2),
            inv.status || ""
        ];
        // Quote each value to prevent comma-breakage and formatting issues
        // Special trick for Date: Prefix with \t (tab) to force Excel to treat it as string
        csvRows.push(row.map((val, idx) => {
            let processedVal = val.toString().replace(/"/g, '""');
            // Index 0 is the "Date" column
            if (idx === 0 && processedVal) {
                return `"\t${processedVal}"`;
            }
            return `"${processedVal}"`;
        }).join(","));
    });

    // Use BOM for UTF-8 to help Excel detect encoding and formatting
    const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ====== Initialize ======
document.addEventListener("DOMContentLoaded", () => {
    loadInvoices();
    loadPatients();
    loadDoctors();

    // Event listener for New Invoice Button
    const newInvoiceBtn = document.getElementById("newInvoiceBtn");
    if (newInvoiceBtn) {
        newInvoiceBtn.addEventListener("click", () => {
            window.openNewInvoiceModal();
        });
    }

    // Close modals on backdrop click
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) Modal.close(overlay.id);
        });
    });
});