// js/daily-report.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if running inside an iframe (Overlay Mode)
    if (window.self !== window.top) {
        const topNav = document.getElementById('appTopNav');
        if (topNav) topNav.style.display = 'none';

        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.marginLeft = '0';
            appContainer.style.padding = '0';
        }

        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.padding = '20px';
        }
    }

    // Hide loader
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 500);

    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterStartDate').value = today;
    document.getElementById('filterEndDate').value = today;

    // Load Doctors
    fetchDoctors();

    // Initial Load
    loadReport();
});

async function fetchDoctors() {
    try {
        const staff = await APP.api.get('/staff');
        const select = document.getElementById('filterDoctor');
        if (staff && staff.length > 0) {
            const doctors = staff.filter(s => s.role === 'Doctor');
            doctors.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.name;
                opt.textContent = doc.name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error fetching doctors:", e);
    }
}

let currentReportData = [];

async function loadReport() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const doctorId = document.getElementById('filterDoctor').value;

    if (!startDate || !endDate) {
        alert("Please select both start and end dates.");
        return;
    }

    try {
        const url = `/daily-closing?startDate=${startDate}&endDate=${endDate}&doctorId=${encodeURIComponent(doctorId)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            updateKPIs(data.summary);
            renderTable(data.appointments, data.invoices);
        } else {
            console.error("Failed to load report:", data.message);
        }
    } catch (e) {
        console.error("Error loading report:", e);
    }
}

function updateKPIs(summary) {
    document.getElementById('kpi-new-patients').textContent = summary.newPatients || 0;
    document.getElementById('kpi-appointments').textContent = summary.totalAppointments || 0;

    // Format currency
    const formatRS = (val) => `Rs ${Number(val).toLocaleString()}`;
    document.getElementById('kpi-paid').textContent = formatRS(summary.totalPaid);
    document.getElementById('kpi-pending').textContent = formatRS(summary.totalPending);
    document.getElementById('kpi-discount').textContent = formatRS(summary.totalDiscount);
}

function renderTable(appointments, invoices) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    currentReportData = []; // Clear for CSV

    // Group by patient to avoid duplicating financial data if there are multiple appointments
    const encounters = {};

    appointments.forEach(appt => {
        if (!encounters[appt.patientId]) {
            encounters[appt.patientId] = {
                date: appt.date,
                time: [appt.time],
                patientName: appt.patientName || appt.patientId,
                doctor: [appt.dentist],
                treatments: [appt.type],
                statuses: [appt.status],
                charged: 0,
                apptFee: 0,
                treatmentFee: 0,
                discount: 0,
                paid: 0,
                pending: 0
            };
        } else {
            if (appt.time) encounters[appt.patientId].time.push(appt.time);
            if (appt.dentist && !encounters[appt.patientId].doctor.includes(appt.dentist)) {
                encounters[appt.patientId].doctor.push(appt.dentist);
            }
            if (appt.type && !encounters[appt.patientId].treatments.includes(appt.type)) {
                encounters[appt.patientId].treatments.push(appt.type);
            }
            if (appt.status && !encounters[appt.patientId].statuses.includes(appt.status)) {
                encounters[appt.patientId].statuses.push(appt.status);
            }
        }
    });

    invoices.forEach(inv => {
        if (!encounters[inv.patientId]) {
            encounters[inv.patientId] = {
                date: new Date(inv.createdAt || inv.date).toLocaleDateString(),
                time: ['-'],
                patientName: inv.patientName || inv.patientId,
                doctor: [inv.doctorName || '-'],
                treatments: inv.services && inv.services.length > 0 ? inv.services : ['Payment/Invoice'],
                statuses: [inv.status],
                charged: 0,
                apptFee: 0,
                treatmentFee: 0,
                discount: 0,
                paid: 0,
                pending: 0
            };
        }

        // Add financial data
        let amt = (Number(inv.totalAmount) || Number(inv.total) || 0);
        encounters[inv.patientId].charged += amt;

        if (inv.notes && inv.notes.toLowerCase().includes('appointment')) {
            encounters[inv.patientId].apptFee += amt;
        } else {
            encounters[inv.patientId].treatmentFee += amt;
        }

        encounters[inv.patientId].discount += (Number(inv.discount) || 0);
        encounters[inv.patientId].paid += (Number(inv.paid) || 0);
        encounters[inv.patientId].pending += (Number(inv.balance) || 0);
    });

    let sumAppt = 0;
    let sumTreatment = 0;
    let sumDiscount = 0;
    let sumPaid = 0;
    let sumPending = 0;

    Object.values(encounters).forEach(row => {
        // Aggregate totals for the table footer
        sumAppt += row.apptFee;
        sumTreatment += row.treatmentFee;
        sumDiscount += row.discount;
        sumPaid += row.paid;
        sumPending += row.pending;

        // Save for CSV Export
        currentReportData.push(row);

        const tr = document.createElement('tr');

        // Date/Time
        const tdTime = document.createElement('td');
        tdTime.innerHTML = `<strong>${row.date}</strong><br><span style="font-size:0.8rem; color:#64748b;">${row.time.join(', ')}</span>`;
        tr.appendChild(tdTime);

        // Patient
        const tdPat = document.createElement('td');
        tdPat.innerHTML = `<strong>${row.patientName}</strong>`;
        tr.appendChild(tdPat);

        // Doctor
        const tdDoc = document.createElement('td');
        tdDoc.textContent = row.doctor.join(', ');
        tr.appendChild(tdDoc);

        // Treatment
        const tdTreat = document.createElement('td');
        tdTreat.textContent = row.treatments.join(', ');
        tr.appendChild(tdTreat);

        // Status
        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = row.statuses.map(s => {
            let sClass = 'badge-pending';
            if (s.toLowerCase() === 'confirmed' || s.toLowerCase() === 'paid') sClass = 'badge-confirmed';
            if (s.toLowerCase() === 'done') sClass = 'badge-done';
            if (s.toLowerCase() === 'cancelled') sClass = 'badge-cancelled';
            return `<span class="badge ${sClass}">${s}</span>`;
        }).join(' ');
        tr.appendChild(tdStatus);

        // Finances
        const formatMoney = (v) => v === 0 ? '-' : Number(v).toLocaleString();

        tr.innerHTML += `
            <td style="text-align:right;">${formatMoney(row.apptFee)}</td>
            <td style="text-align:right;">${formatMoney(row.treatmentFee)}</td>
            <td style="text-align:right;">${formatMoney(row.discount)}</td>
            <td style="text-align:right; font-weight:600; color:#16a34a;">${formatMoney(row.paid)}</td>
            <td style="text-align:right; font-weight:600; color:#dc2626;">${formatMoney(row.pending)}</td>
        `;

        tbody.appendChild(tr);
    });

    if (Object.keys(encounters).length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#64748b;">No data found for the selected range.</td></tr>`;
    }

    // Update Totals
    const formatMoneyTotal = (v) => Number(v).toLocaleString();
    document.getElementById('totalApptCell').textContent = formatMoneyTotal(sumAppt);
    document.getElementById('totalTreatmentCell').textContent = formatMoneyTotal(sumTreatment);
    document.getElementById('totalDiscountCell').textContent = formatMoneyTotal(sumDiscount);
    document.getElementById('totalPaidCell').textContent = formatMoney(sumPaid);
    document.getElementById('totalPendingCell').textContent = formatMoney(sumPending);
}

function exportToCSV() {
    if (currentReportData.length === 0) {
        alert("No data to export.");
        return;
    }

    const headers = ["Date", "Time", "Patient Name", "Doctor", "Treatments", "Appt Status", "Appt Fee", "Treatment Fee", "Discount", "Paid", "Pending"];

    const rows = currentReportData.map(row => {
        return [
            `="${row.date}"`,
            `"${row.time.join(', ')}"`,
            `"${row.patientName}"`,
            `"${row.doctor.join(', ')}"`,
            `"${row.treatments.join(', ')}"`,
            `"${row.statuses.join(', ')}"`,
            row.apptFee,
            row.treatmentFee,
            row.discount,
            row.paid,
            row.pending
        ].join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    link.setAttribute("download", `Daily_Closing_${startDate}_to_${endDate}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
