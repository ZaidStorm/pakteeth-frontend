// js/dashboard.js - Dashboard Module

document.addEventListener("DOMContentLoaded", () => {
    // Check authentication
    if (window.APP && APP.ensureAuth) {
        APP.ensureAuth();
    }

    // Sign out button listener
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
        btnSignOut.addEventListener('click', () => {
            if (window.APP && APP.logout) {
                APP.logout();
            }
        });
    }

    let patientsList = [];
    let todayAppointments = [];
    let todayApptCurrentPage = 1;
    let todayApptRowsPerPage = 5; // 5 appointments per page on dashboard

    // Load data from API
    async function loadDashboardData() {
        try {
            console.log('Loading dashboard data...');

            // Check authentication first
            const token = localStorage.getItem('authToken');
            console.log('Auth token:', token);

            const [patientsRes, patientsStats, appointments, invoices, staff, lowStock] = await Promise.all([
                APP.api.get("/patients?limit=100&page=1"),  // Up to 100 for local operations
                APP.api.get("/patients/stats"),             // Accurate total for KPI
                APP.api.get("/appointments"),
                APP.api.get("/invoices"),
                APP.api.get("/staff").catch(() => []),
                APP.api.get("/inventory/status/low-stock").catch(() => [])
            ]);

            // Extract flat arrays from potentially paginated responses
            const patients = Array.isArray(patientsRes) ? patientsRes : (patientsRes.patients || []);
            const patientsTotal = patientsStats?.total || patients.length;
            const allAppointments = Array.isArray(appointments) ? appointments : (appointments.appointments || []);
            const allInvoices = Array.isArray(invoices) ? invoices : (invoices.invoices || []);

            // Cache for updateKPIs — no extra network calls needed
            window.dashboardStaff = staff;
            window.dashboardLowStock = lowStock;

            console.log('Patients loaded:', patientsTotal);
            console.log('Appointments loaded:', allAppointments.length);
            console.log('Invoices loaded:', allInvoices.length);

            patientsList = patients;
            patientsList._total = patientsTotal; // Store true total for KPI
            window.patientsList = patients; // Expose for 3D Globe
            window.dashboardInvoices = allInvoices;
            window.dashboardApptsExportData = allAppointments; // for exports

            // Filter appointments for today (using local date) and attach patient objects
            const now = new Date();
            const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

            console.log('Detected Today Date:', today);
            console.log('Filtered Today Appts Count:', allAppointments.filter(a => a.date === today && a.status !== 'cancelled').length);

            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(now.getDate() - 1);
            const yesterday = yesterdayDate.getFullYear() + '-' + String(yesterdayDate.getMonth() + 1).padStart(2, '0') + '-' + String(yesterdayDate.getDate()).padStart(2, '0');

            // ✅ FIX 1B: Build patient index Map ONCE — O(m) — then lookup is O(1) per appointment
            // Previously used .find() inside .map() which was O(n × m)
            const patientIndex = new Map(patientsList.map(p => [p.patientId, p]));

            todayAppointments = allAppointments
                .filter(a => a.date === today && a.status !== 'cancelled')
                .map(a => {
                    const patientObj = (typeof a.patientId === 'object' && a.patientId !== null)
                        ? a.patientId
                        : patientIndex.get(a.patientId) || null;
                    return { ...a, patient: patientObj };
                });

            const yesterdayAppointments = allAppointments.filter(a => a.date === yesterday && a.status !== 'cancelled');
            window.dashboardStats = {
                todayCount: todayAppointments.length,
                yesterdayCount: yesterdayAppointments.length
            };

            todayApptCurrentPage = 1; // Reset to page 1 on load
            updateKPIs();
            renderTodayAppointments();
            initRevenueChart(allInvoices);
            renderActivityLog();
        } catch (err) {
            console.error("Failed to load dashboard data:", err);

            // Show error on page
            const cityTableBody = document.getElementById('patientsByCityTableBody');
            if (cityTableBody) {
                cityTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">
                    Error loading data: ${err.message}<br>
                    Please check console for details
                </td></tr>`;
            }
        }
    }

    // Update KPIs
    function updateKPIs() {
        const kpiTodayAppts = document.getElementById('kpi-today-appts');
        const kpiTotalPat = document.getElementById('kpi-total-pat');
        const kpiTotalDocs = document.getElementById('kpi-total-docs');
        const kpiTodayRev = document.getElementById('kpi-today-rev');

        if (kpiTodayAppts) kpiTodayAppts.textContent = todayAppointments.length;
        if (kpiTotalPat) kpiTotalPat.textContent = patientsList._total || patientsList.length;

        // Update Trend for Appointments
        const trendEl = document.querySelector('#kpi-today-appts + .kpi-trend');
        if (trendEl && window.dashboardStats) {
            const { todayCount, yesterdayCount } = window.dashboardStats;
            if (yesterdayCount > 0) {
                const diff = todayCount - yesterdayCount;
                const pct = Math.round((diff / yesterdayCount) * 100);
                if (pct >= 0) {
                    trendEl.className = 'kpi-trend positive';
                    trendEl.textContent = `↑ ${pct}% vs yesterday`;
                } else {
                    trendEl.className = 'kpi-trend negative';
                    trendEl.textContent = `↓ ${Math.abs(pct)}% vs yesterday`;
                }
            } else if (todayCount > 0) {
                trendEl.className = 'kpi-trend positive';
                trendEl.textContent = `+${todayCount} today`;
            } else {
                trendEl.textContent = 'No appts today';
            }
        }

        // ✅ FIX 1C: Use pre-fetched data from initial Promise.all — no extra network round-trips
        const staff = window.dashboardStaff || [];
        const doctors = staff.filter(s => s.role && s.role.toLowerCase() === 'doctor');
        if (kpiTotalDocs) kpiTotalDocs.textContent = doctors.length;

        const kpiLowStock = document.getElementById('kpi-low-stock');
        if (kpiLowStock) kpiLowStock.textContent = (window.dashboardLowStock || []).length;

        // Revenue is now calculated inside initRevenueChart based on selected range.

        // ------------ DASHBOARD KPI CHARTS & EXPORTS ------------
        if (window.KPICards) {
            // Appts Chart (Last 7 Days)
            const apptByDay = {};
            const nowD = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(nowD); d.setDate(nowD.getDate() - i);
                apptByDay[d.toLocaleDateString()] = 0;
            }
            if (window.dashboardApptsExportData) {
                window.dashboardApptsExportData.forEach(a => {
                    const dLocal = new Date(a.date).toLocaleDateString();
                    if (apptByDay[dLocal] !== undefined) apptByDay[dLocal]++;
                });
                window.KPICards.renderChart('dash-appts-chart', 'bar', Object.keys(apptByDay), Object.values(apptByDay), 'Appts', '42, 157, 244');
            }

            // Patients Chart (Cumulative Total Patients)
            const patByDay = {};
            const datesPat = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(nowD); d.setDate(nowD.getDate() - i);
                const dStr = d.toLocaleDateString();
                patByDay[dStr] = 0;
                datesPat.push(dStr);
            }
            
            let recentAdded = 0;
            const windowStart = new Date(nowD);
            windowStart.setDate(nowD.getDate() - 6);
            windowStart.setHours(0,0,0,0);

            if (window.patientsList) {
                window.patientsList.forEach(p => {
                    // Try registrationDate first, then createdAt
                    const dRaw = p.registrationDate || p.createdAt;
                    if (dRaw) {
                        const pDate = new Date(dRaw);
                        if (pDate >= windowStart) {
                            const dLocal = pDate.toLocaleDateString();
                            if (patByDay[dLocal] !== undefined) {
                                patByDay[dLocal]++;
                                recentAdded++;
                            }
                        }
                    }
                });
            }
            
            const totalPatientsCount = window.patientsList._total || window.patientsList.length || 0;
            let runningTotal = totalPatientsCount - recentAdded;
            
            const cumulativePatByDay = {};
            datesPat.forEach(dStr => {
                runningTotal += patByDay[dStr];
                cumulativePatByDay[dStr] = runningTotal;
            });

            window.KPICards.renderChart('dash-patients-chart', 'line', Object.keys(cumulativePatByDay), Object.values(cumulativePatByDay), 'Total Patients', '155, 81, 224');

            // Doctors Chart (Static basically)

            // Revenue Chart
            const revByDay = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(nowD); d.setDate(nowD.getDate() - i);
                revByDay[d.toLocaleDateString()] = 0;
            }
            (window.dashboardInvoices || []).forEach(inv => {
                const dLocal = new Date(inv.date).toLocaleDateString();
                if (revByDay[dLocal] !== undefined) {
                    revByDay[dLocal] += (parseFloat(inv.paid) || 0);
                }
            });
            window.KPICards.renderChart('dash-revenue-chart', 'bar', Object.keys(revByDay), Object.values(revByDay), 'Revenue', '242, 153, 74');
        }

        window.exportDashAppts = function () {
            const rows = (window.dashboardApptsExportData || []).map(a => [a.date, a.patientName || '', a.dentist || '', a.status]);
            window.KPICards.exportData('Dashboard_Appts.csv', ['Date', 'Patient', 'Doctor', 'Status'], rows);
        };
        window.exportDashPatients = function () {
            const rows = (window.patientsList || []).map(p => [p.patientId, p.firstName + ' ' + p.lastName, p.phone || '']);
            window.KPICards.exportData('Dashboard_Patients.csv', ['ID', 'Name', 'Phone'], rows);
        };
        window.exportDashRevenue = function () {
            const rows = (window.dashboardInvoices || []).map(i => [i.date, i.patientName || '', i.paid || 0]);
            window.KPICards.exportData('Dashboard_Revenue.csv', ['Date', 'Patient', 'Paid (PKR)'], rows);
        };

    }

    // Initialize Revenue Chart with real data
    let revenueChart = null;
    function initRevenueChart(invoices) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const rangeSelect = document.getElementById('revenueRange');
        const range = rangeSelect ? rangeSelect.value : 'Last 7 Days';
        let days = 7;
        let isToday = false;

        if (range === 'Last 30 Days') {
            days = 30;
        } else if (range === 'Today') {
            days = 1;
            isToday = true;
        }

        const revenueByDate = new Map();
        for (const inv of invoices) {
            if (!inv.date) continue;
            revenueByDate.set(inv.date, (revenueByDate.get(inv.date) || 0) + (parseFloat(inv.paid) || 0));
        }

        const labels = [];
        const data = [];
        const now = new Date();
        let totalRevenueForRange = 0;

        if (isToday) {
            const d = now;
            const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const labelStr = 'Today';
            labels.push(labelStr);
            const val = revenueByDate.get(dateStr) || 0;
            data.push(val);
            totalRevenueForRange = val;
        } else {
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                const labelStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                labels.push(labelStr);
                const val = revenueByDate.get(dateStr) || 0;
                data.push(val);
                totalRevenueForRange += val;
            }
        }

        // Update the KPI card text to reflect the selected range's total revenue
        const kpiTodayRev = document.getElementById('kpi-today-rev');
        if (kpiTodayRev) {
            kpiTodayRev.textContent = `PKR ${totalRevenueForRange.toLocaleString()}`;
        }

        if (revenueChart) {
            revenueChart.destroy();
        }

        revenueChart = new Chart(ctx, {
            type: isToday ? 'bar' : 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (PKR)',
                    data: data,
                    borderColor: '#2766ba',
                    backgroundColor: (context) => {
                        if (isToday) return '#2766ba'; // Solid color for single bar
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(39, 102, 186, 0)');
                        gradient.addColorStop(1, 'rgba(39, 102, 186, 0.2)');
                        return gradient;
                    },
                    fill: !isToday,
                    tension: 0.4,
                    borderWidth: isToday ? 0 : 3,
                    borderRadius: isToday ? 8 : 0,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#2766ba',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleFont: { size: 14, weight: '600' },
                        bodyFont: { size: 13 },
                        displayColors: false,
                        callbacks: {
                            label: function (context) {
                                return 'PKR ' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [5, 5], color: '#e2e8f0' },
                        ticks: {
                            callback: value => 'Rs ' + value.toLocaleString(),
                            font: { size: 10 }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }

    // Attach listener to rangeSelect
    const revenueRangeEl = document.getElementById('revenueRange');
    if (revenueRangeEl) {
        revenueRangeEl.addEventListener('change', () => {
            if (window.dashboardInvoices) {
                initRevenueChart(window.dashboardInvoices);
            }
        });
    }

    const btnUpdateRevenue = document.getElementById('btnUpdateRevenue');
    if (btnUpdateRevenue) {
        btnUpdateRevenue.addEventListener('click', () => {
            if (window.dashboardInvoices) {
                initRevenueChart(window.dashboardInvoices);
                Toast.success("Chart updated successfully");
            }
        });
    }

    // Render Activity Log
    function renderActivityLog() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        const activities = [
            { type: 'patient', icon: '👤', text: 'Patient Arrived: [Name]', meta: 'Expired in Lahore', color: '#2a9df4' },
            { type: 'complaint', icon: '⚠️', text: 'New Complaint: [Summary]', meta: 'Posted 5 mins ago', color: '#eb5757' },
            { type: 'appointment', icon: '📅', text: 'Appointment Requested: [Name]', meta: 'Expired in Lahore', color: '#27ae60' },
            { type: 'message', icon: '💬', text: 'New Message from Dr. Ahmed', meta: 'Posted in Australia', color: '#9b51e0' }
        ];

        activityList.innerHTML = activities.map(act => `
            <div class="activity-item">
                <div class="activity-icon" style="background: ${act.color}15; color: ${act.color};">${act.icon}</div>
                <div class="activity-details">
                    <div class="activity-label">${act.text}</div>
                    <div class="activity-meta">${act.meta}</div>
                </div>
            </div>
        `).join('');
    }

    // Chat Widget Logic
    const chatWidget = document.getElementById('quickChatWidget');
    if (chatWidget) {
        const minimizeBtn = chatWidget.querySelector('.chat-minimize');
        const closeBtn = chatWidget.querySelector('.chat-close');
        const chatBody = chatWidget.querySelector('.chat-body');
        const chatFooter = chatWidget.querySelector('.chat-footer');

        minimizeBtn.addEventListener('click', () => {
            const isMinimized = chatBody.style.display === 'none';
            chatBody.style.display = isMinimized ? 'flex' : 'none';
            chatFooter.style.display = isMinimized ? 'flex' : 'none';
            chatWidget.style.height = isMinimized ? 'auto' : '50px';
        });

        closeBtn.addEventListener('click', () => {
            chatWidget.style.display = 'none';
        });
    }

    // Unlock protected KPI
    const kpiProtected = document.querySelectorAll('.kpi-protected');
    const btnUnlockKpi = document.getElementById('btn-unlock-kpi');

    // Check if previously unlocked in this session
    if (sessionStorage.getItem('kpisUnlocked') === 'true') {
        kpiProtected.forEach(kpi => kpi.classList.remove('kpi-protected'));
        if (btnUnlockKpi) btnUnlockKpi.textContent = "Capital Unlocked";
    }

    if (btnUnlockKpi) {
        btnUnlockKpi.addEventListener('click', () => {
            // Check if already unlocked
            if (sessionStorage.getItem('kpisUnlocked') === 'true') {
                Toast.info("Capital already unlocked.");
                return;
            }

            const password = prompt("Please enter password to show capital data:");
            if (password === "userpakteeth") {
                sessionStorage.setItem('kpisUnlocked', 'true');
                kpiProtected.forEach(kpi => kpi.classList.remove('kpi-protected'));
                btnUnlockKpi.textContent = "Capital Unlocked";
                Toast.success("Financial data revealed");
            } else if (password !== null) {
                Toast.error("Incorrect password.");
            }
        });
    }

    // Today's Appointments Table
    const todayApptTableBody = document.querySelector("#todayApptTable tbody");

    function renderTodayAppointments() {
        if (!todayApptTableBody) return;

        // Sort by most recently added first (reverse-chronological) as per system standard
        todayAppointments.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        todayApptTableBody.innerHTML = '';

        if (todayAppointments.length === 0) {
            todayApptTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">No appointments today</td></tr>';
            const paginationContainer = document.getElementById("todayApptPagination");
            if (paginationContainer) paginationContainer.innerHTML = "";
            return;
        }

        // Pagination Logic: Slice the list
        const startIndex = (todayApptCurrentPage - 1) * todayApptRowsPerPage;
        const endIndex = startIndex + todayApptRowsPerPage;
        const paginatedItems = todayAppointments.slice(startIndex, endIndex);

        paginatedItems.forEach(appt => {
            const tr = document.createElement('tr');
            const patientName = `${appt.patient?.firstName || ''} ${appt.patient?.lastName || ''}`.trim() || appt.patientName || appt.patientId;

            // Resolve the raw patient ID string (e.g. "P001") for the profile URL
            const rawPatientId = typeof appt.patientId === 'object'
                ? (appt.patientId?.patientId || appt.patientId?._id || '')
                : (appt.patientId || '');

            tr.innerHTML = `
                <td>${appt.time || '-'}</td>
                <td>${patientName || '-'}</td>
                <td>${appt.type || '-'}</td>
                <td>${appt.dentist || '-'}</td>
                <td>
                    <select class="form-control" 
                        style="
                            font-size: 0.8rem; 
                            padding: 4px 8px; 
                            border-radius: 8px; 
                            border: 1px solid rgba(0,0,0,0.1);
                            background-color: ${appt.status === 'confirmed' ? '#dcfce7' : (appt.status === 'cancelled' ? '#fee2e2' : (appt.status === 'done' ? '#e0f2fe' : '#fef9c3'))};
                            color: ${appt.status === 'confirmed' ? '#166534' : (appt.status === 'cancelled' ? '#991b1b' : (appt.status === 'done' ? '#075985' : '#854d0e'))};
                            font-weight: 600;
                            cursor: pointer;
                        "
                        onchange="if(window.changeAppointmentStatus) window.changeAppointmentStatus('${appt._id || appt.appointmentId}', this.value)"
                        ${appt.status === 'done' ? 'disabled' : ''}
                    >
                        <option value="pending" ${appt.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${appt.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="done" ${appt.status === 'done' ? 'selected' : ''}>Done</option>
                        <option value="cancelled" ${appt.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <div class="appt-hud-wrapper">
                        <button class="appt-hud-trigger" onclick="AppointmentsHUD.toggle(this, '${appt._id || appt.appointmentId}', '${appt.status}', '${rawPatientId}')" title="Actions">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            todayApptTableBody.appendChild(tr);
        });

        renderTodayApptPagination(todayAppointments.length);
    }

    function renderTodayApptPagination(totalItems) {
        const paginationContainer = document.getElementById("todayApptPagination");
        if (!paginationContainer) return;

        const totalPages = Math.ceil(totalItems / todayApptRowsPerPage);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = "";
            return;
        }

        let html = `
            <button class="pagination-btn" onclick="changeTodayApptPage(${todayApptCurrentPage - 1})" ${todayApptCurrentPage === 1 ? 'disabled' : ''}>
                Back
            </button>
            <div class="pagination-numbers">
        `;

        // Smart Truncation Logic
        const delta = 1;
        const range = [];
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= todayApptCurrentPage - delta && i <= todayApptCurrentPage + delta)
            ) {
                range.push(i);
            }
        }

        let l;
        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    html += `<button class="pagination-number" onclick="changeTodayApptPage(${l + 1})">${l + 1}</button>`;
                } else if (i - l !== 1) {
                    html += `<span class="pagination-ellipsis">...</span>`;
                }
            }
            html += `
                <button class="pagination-number ${i === todayApptCurrentPage ? 'active' : ''}" onclick="changeTodayApptPage(${i})">
                    ${i}
                </button>
            `;
            l = i;
        }

        html += `
            </div>
            <button class="pagination-btn" onclick="changeTodayApptPage(${todayApptCurrentPage + 1})" ${todayApptCurrentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;

        paginationContainer.innerHTML = html;
    }

    function changeTodayApptPage(page) {
        todayApptCurrentPage = page;
        renderTodayAppointments();
    }

    window.changeTodayApptPage = changeTodayApptPage;

    // Removed Patients by City logic as it was migrated to Patient Dashboard

    // --- Overlay Calendar Logic ---
    window.openCalendarOverlay = function () {
        const overlay = document.getElementById('calendarOverlay');
        const frame = document.getElementById('calendarFrame');
        if (overlay && frame) {
            frame.src = './calendar-popup.html';
            overlay.style.display = 'flex';
        }
    };

    window.closeCalendarOverlay = function () {
        const overlay = document.getElementById('calendarOverlay');
        const frame = document.getElementById('calendarFrame');
        if (overlay && frame) {
            overlay.style.display = 'none';
            frame.src = 'about:blank'; // Free memory
        }
    };

    // --- Overlay Daily Report Logic ---
    window.openDailyReportOverlay = function () {
        const overlay = document.getElementById('dailyReportOverlay');
        const frame = document.getElementById('dailyReportFrame');
        if (overlay && frame) {
            frame.src = '../analytics/daily-report.html';
            overlay.style.display = 'flex';
        }
    };

    window.closeDailyReportOverlay = function () {
        const overlay = document.getElementById('dailyReportOverlay');
        const frame = document.getElementById('dailyReportFrame');
        if (overlay && frame) {
            overlay.style.display = 'none';
            frame.src = 'about:blank'; // Free memory
        }
    };

    // Weather Integration
    function initWeather() {
        const tempEl = document.getElementById('weather-temp');
        const statusEl = document.getElementById('weather-status');
        const iconEl = document.getElementById('weather-icon');

        if (!tempEl || !statusEl || !iconEl) return;

        // WMO Code Mapping
        const weatherMap = {
            0: { label: 'Clear Sky', icon: '☀️' },
            1: { label: 'Mainly Clear', icon: '🌤️' },
            2: { label: 'Partly Cloudy', icon: '⛅' },
            3: { label: 'Overcast', icon: '☁️' },
            45: { label: 'Foggy', icon: '🌫️' },
            48: { label: 'Rime Fog', icon: '🌫️' },
            51: { label: 'Light Drizzle', icon: '🌧️' },
            53: { label: 'Drizzle', icon: '🌧️' },
            55: { label: 'Dense Drizzle', icon: '🌧️' },
            61: { label: 'Slight Rain', icon: '🌧️' },
            63: { label: 'Rain', icon: '🌧️' },
            65: { label: 'Heavy Rain', icon: '🌧️' },
            71: { label: 'Slight Snow', icon: '❄️' },
            73: { label: 'Snow Fall', icon: '❄️' },
            75: { label: 'Heavy Snow', icon: '❄️' },
            80: { label: 'Slight Showers', icon: '🌦️' },
            81: { label: 'Rain Showers', icon: '🌦️' },
            82: { label: 'Violent Showers', icon: '🌦️' },
            95: { label: 'Thunderstorm', icon: '⛈️' },
            default: { label: 'Unknown', icon: '🌡️' }
        };

        const updateUI = (temp, code) => {
            const data = weatherMap[code] || weatherMap.default;
            tempEl.textContent = `${Math.round(temp)}°C`;
            statusEl.textContent = data.label;
            iconEl.textContent = data.icon;
        };

        const fetchWeather = async (lat, lon) => {
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const data = await response.json();
                if (data.current_weather) {
                    updateUI(data.current_weather.temperature, data.current_weather.weathercode);
                }
            } catch (err) {
                console.error("Weather fetch failed:", err);
                statusEl.textContent = "Weather unavailable";
            }
        };

        // Get location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                () => {
                    // Fallback to Lahore (Project Home)
                    console.log("Location access denied, falling back to Lahore.");
                    fetchWeather(31.5204, 74.3587);
                }
            );
        } else {
            fetchWeather(31.5204, 74.3587);
        }
    }

    // Initialize
    loadDashboardData();
    initWeather();

    // Expose for cross-module refresh (e.g. after saving an appointment)
    window.loadDashboardData = loadDashboardData;
});
// Logout function
window.APP = window.APP || {};

APP.logout = function () {
    // Clear session/local storage tokens
    localStorage.removeItem('authToken'); // or whatever key you use
    sessionStorage.removeItem('authToken');

    // Redirect to login page
    window.location.href = "../../index.html";
};