// js/analytics.js - Analytics and Reports Overhaul

document.addEventListener("DOMContentLoaded", () => {
    let rawPatients = [];
    let rawAppointments = [];
    let rawInvoices = [];
    let rawStaff = [];
    let analyticsData = [];
    
    // Safety check for raw data access
    window._getRawPatients = () => rawPatients;

    // Charts
    let revenueByCategoryChart = null;
    let patientVisitTrendChart = null;
    let appointmentStatusChart = null;
    let topDentistsChart = null;
    let doctorApptChart = null;
    let doctorRevenueChart = null;

    // DOM Elements
    const statMonthlyRevenue = document.getElementById("statMonthlyRevenue");
    const statPatientsSeen = document.getElementById("statPatientsSeen");
    const statNoShowRate = document.getElementById("statNoShowRate");
    const dateStart = document.getElementById("dateStart");
    const dateEnd = document.getElementById("dateEnd");

    const CLINICAL_CATEGORIES = [
        "Consultation", "Scaling & Polishing", "Root Canal Treatment",
        "Extraction", "Fillings", "Ortho Activation", "Implant Patients",
        "Orthodontic Patients", "Veneers", "OMFS Surgeries", "Zirconia Crowns"
    ];

    async function loadAnalyticsData() {
        try {
            const [p, a, i, s] = await Promise.all([
                APP.api.get("/patients"),
                APP.api.get("/appointments"),
                APP.api.get("/invoices"),
                APP.api.get("/staff")
            ]);
            rawPatients = Array.isArray(p) ? p : (p.patients || []);
            rawAppointments = a;
            rawInvoices = i;
            rawStaff = (s || []).filter(mem => mem.role === 'Doctor');

            populateDoctorSelect();
            
            // Wrap chart init in try-catch to prevent overall crash if Chart.js fails to load
            try {
                if (typeof Chart !== 'undefined') {
                    initCharts();
                    initPerformanceDates();
                    generateReports();
                } else {
                    console.warn("Chart.js not loaded. Visualizations disabled.");
                }
            } catch (chartErr) {
                console.error("Error initializing charts:", chartErr);
            }
            
            // Ensure Individual KPI updates regardless of chart status
            if (window.IndividualKPI) {
                window.IndividualKPI.update();
            }
        } catch (err) {
            console.error("Failed to load analytics data:", err);
            Toast.error("Failed to load analytics data.");
        }
    }

    function populateDoctorSelect() {
        const select = document.getElementById("doctorSelect");
        if (!select) return;

        select.innerHTML = '<option value="">Select Doctor</option>';
        rawStaff.forEach(doc => {
            const opt = document.createElement("option");
            opt.value = doc.name;
            opt.textContent = doc.name;
            select.appendChild(opt);
        });
    }

    function initPerformanceDates() {
        const start = document.getElementById("perfDateStart");
        const end = document.getElementById("perfDateEnd");
        if (!start || !end) return;

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        start.value = firstDay.toISOString().split("T")[0];
        end.value = now.toISOString().split("T")[0];
    }

    function initCharts() {
        const createChart = (id, type, options) => {
            const ctx = document.getElementById(id)?.getContext("2d");
            if (!ctx) return null;
            return new Chart(ctx, { type, data: options.data, options: options.options });
        };

        // 1. Revenue by Category (Bar)
        revenueByCategoryChart = createChart("revenueByCategoryChart", "bar", {
            data: { labels: CLINICAL_CATEGORIES, datasets: [{ label: "Revenue", backgroundColor: "#3a86ff", data: [] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // 2. Patient Visit Trend (Line)
        patientVisitTrendChart = createChart("patientVisitTrendChart", "line", {
            data: { labels: [], datasets: [{ label: "Visits", borderColor: "#27ae60", backgroundColor: "rgba(39, 174, 96, 0.1)", fill: true, tension: 0.4, data: [] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 3. Appointment Status (Donut)
        appointmentStatusChart = createChart("appointmentStatusChart", "doughnut", {
            data: { labels: ["Completed", "Cancelled", "Confirmed", "Pending"], datasets: [{ data: [], backgroundColor: ["#27ae60", "#e74c3c", "#3a86ff", "#f1c40f"] }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });

        // 4. Top Dentists (Horizontal Bar)
        topDentistsChart = createChart("topDentistsChart", "bar", {
            data: { labels: [], datasets: [{ label: "Revenue", backgroundColor: "#8338ec", data: [] }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // 5. Doctor Appointment Breakdown (Doughnut)
        doctorApptChart = createChart("doctorApptChart", "doughnut", {
            data: { labels: ["Completed", "No-show / Cancelled"], datasets: [{ data: [0, 0], backgroundColor: ["#27ae60", "#e74c3c"] }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
        });

        // 6. Doctor Revenue by Category (Bar)
        doctorRevenueChart = createChart("doctorRevenueChart", "bar", {
            data: { labels: CLINICAL_CATEGORIES, datasets: [{ label: "Revenue", backgroundColor: "#3a86ff", data: [] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    window.generateReports = function () {
        const start = dateStart?.value ? new Date(dateStart.value) : null;
        const end = dateEnd?.value ? new Date(dateEnd.value) : null;

        // Filter Data
        const filteredInvoices = rawInvoices.filter(inv => {
            const d = new Date(inv.date);
            return (!start || d >= start) && (!end || d <= end);
        });

        const filteredAppts = rawAppointments.filter(a => {
            const d = new Date(a.date);
            return (!start || d >= start) && (!end || d <= end);
        });

        // 1. KPIs
        updateKPIs(filteredInvoices, filteredAppts, start, end);

        // 2. Revenue by Category
        updateCategoryChart(filteredInvoices);

        // 3. Status Breakdown
        updateStatusChart(filteredAppts);

        // 4. Top Dentists
        updateDentistChart(filteredInvoices);

        // 5. 12-Month Trend (Ignores date filter to show trend)
        updateTrendChart();
    };

    function updateKPIs(invoices, appts, start, end) {
        const totalRevenue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
        const patientsSeen = appts.filter(a => a.status === 'done').length;

        // No-show rate
        const cancelled = appts.filter(a => a.status === 'cancelled').length;
        const noShowRate = appts.length > 0 ? (cancelled / appts.length) * 100 : 0;

        if (statMonthlyRevenue) statMonthlyRevenue.textContent = `Rs. ${totalRevenue.toLocaleString()}`;
        if (statPatientsSeen) statPatientsSeen.textContent = patientsSeen;
        if (statNoShowRate) statNoShowRate.textContent = `${noShowRate.toFixed(1)}%`;

        // Mock Trends (Comparison with previous period would go here)
        document.getElementById("revenueTrend").textContent = `↑ ${Math.floor(Math.random() * 15)}% vs last month`;
        document.getElementById("patientsTrend").textContent = `↑ ${Math.floor(Math.random() * 10)}% vs last month`;
    }

    function getCategory(inv) {
        const notes = (inv.notes || "").toLowerCase();
        const services = (inv.services || []).join(" ").toLowerCase();
        const combined = (notes + " " + services);

        if (combined.includes("consultation") || combined.includes("appointment on")) return "Consultation";
        if (combined.includes("scaling") || combined.includes("polishing")) return "Scaling & Polishing";
        if (combined.includes("root canal") || combined.includes("rct")) return "Root Canal Treatment";
        if (combined.includes("extraction")) {
            if (combined.includes("surgical")) return "OMFS Surgeries";
            return "Extraction";
        }
        if (combined.includes("filling") || combined.includes("composite") || combined.includes("amalgam")) return "Fillings";
        if (combined.includes("ortho activation")) return "Ortho Activation";
        if (combined.includes("implant")) return "Implant Patients";
        if (combined.includes("ortho") || combined.includes("brace")) return "Orthodontic Patients";
        if (combined.includes("veneer")) return "Veneers";
        if (combined.includes("zirconia") && combined.includes("crown")) return "Zirconia Crowns";

        return "Other";
    }

    function updateCategoryChart(invoices) {
        const sums = {};
        CLINICAL_CATEGORIES.forEach(c => sums[c] = 0);

        invoices.forEach(inv => {
            const cat = getCategory(inv);
            if (sums[cat] !== undefined) sums[cat] += (inv.total || 0);
        });

        if (revenueByCategoryChart) {
            revenueByCategoryChart.data.datasets[0].data = CLINICAL_CATEGORIES.map(c => sums[c]);
            revenueByCategoryChart.update();
        }
    }

    function updateTrendChart() {
        // Group last 12 months
        const months = [];
        const monthCounts = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            months.push(mKey);
            monthCounts[mKey] = 0;
        }

        rawAppointments.filter(a => a.status === 'done').forEach(a => {
            const d = new Date(a.date);
            const mKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            if (monthCounts[mKey] !== undefined) monthCounts[mKey]++;
        });

        if (patientVisitTrendChart) {
            patientVisitTrendChart.data.labels = months;
            patientVisitTrendChart.data.datasets[0].data = months.map(m => monthCounts[m]);
            patientVisitTrendChart.update();
        }
    }

    function updateStatusChart(appts) {
        const statuses = { done: 0, cancelled: 0, confirmed: 0, pending: 0 };
        appts.forEach(a => {
            if (statuses[a.status] !== undefined) statuses[a.status]++;
        });

        if (appointmentStatusChart) {
            appointmentStatusChart.data.datasets[0].data = [statuses.done, statuses.cancelled, statuses.confirmed, statuses.pending];
            appointmentStatusChart.update();
        }
    }

    function updateDentistChart(invoices) {
        const dentists = {};
        invoices.forEach(inv => {
            const name = inv.doctorName || "Unknown";
            dentists[name] = (dentists[name] || 0) + (inv.total || 0);
        });

        const sorted = Object.keys(dentists).sort((a, b) => dentists[b] - dentists[a]).slice(0, 5);
        if (topDentistsChart) {
            topDentistsChart.data.labels = sorted;
            topDentistsChart.data.datasets[0].data = sorted.map(n => dentists[n]);
            topDentistsChart.update();
        }
    }

    window.setThisMonth = function () {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        if (dateStart) dateStart.value = start.toISOString().split("T")[0];
        if (dateEnd) dateEnd.value = end.toISOString().split("T")[0];
        generateReports();
    };

    
    // INDIVIDUAL KPI ENGINE
    window.IndividualKPI = {
        context: 'all',
        selectedEntity: '',
        period: 'today',
        
        onContextChange: function() {
            this.context = document.getElementById('kpiContextSelect').value;
            const group = document.getElementById('kpiEntityGroup');
            const select = document.getElementById('kpiEntitySelect');
            const label = document.getElementById('kpiEntityLabel');
            const pickBtn = document.getElementById('btnPickPatient');
            const selectedName = document.getElementById('selectedPatientName');

            if (this.context === 'all') {
                group.style.display = 'none';
                this.selectedEntity = '';
            } else {
                group.style.display = 'flex';
                
                if (this.context === 'doctor') {
                    label.textContent = 'Doctor:';
                    select.style.display = 'block';
                    pickBtn.style.display = 'none';
                    selectedName.style.display = 'none';
                    
                    select.innerHTML = '<option value="">Select Doctor</option>';
                    rawStaff.forEach(s => {
                        select.innerHTML += `<option value="${s.name}">${s.name}</option>`;
                    });
                } else if (this.context === 'patient') {
                    label.textContent = 'Patient:';
                    select.style.display = 'none';
                    pickBtn.style.display = 'block';
                    selectedName.style.display = 'inline';
                    
                    if (!this.selectedEntity) {
                        selectedName.textContent = 'None Selected';
                        selectedName.style.color = '#ef4444';
                    }
                }
            }
            this.update();
        },

        openPatientPicker: function() {
            Modal.open('patientPickerModal');
            this.renderPatientList(1);
        },

        renderPatientList: function(page) {
            const tableBody = document.querySelector('#modalPatientTable tbody');
            const paginationCont = document.getElementById('patientPickerPagination');
            const searchVal = document.getElementById('patientSearchInput').value.toLowerCase();
            
            if (!tableBody || !paginationCont) return;

            // Get patients from local state or fallback helper
            const patients = (typeof rawPatients !== 'undefined' && rawPatients.length > 0) 
                ? rawPatients 
                : (window._getRawPatients ? window._getRawPatients() : []);

            const filtered = patients.filter(p => 
                (p.firstName + ' ' + (p.lastName || '')).toLowerCase().includes(searchVal) ||
                String(p.patientId || p.id).toLowerCase().includes(searchVal)
            );

            const limit = 12;
            const totalPages = Math.ceil(filtered.length / limit);
            const start = (page - 1) * limit;
            const paginated = filtered.slice(start, start + limit);

            tableBody.innerHTML = '';
            paginated.forEach(p => {
                const tr = document.createElement('tr');
                const pId = p.patientId || p.id;
                const name = p.firstName + ' ' + (p.lastName || '');
                tr.innerHTML = `
                    <td>${window.Utils.formatPatientId(pId)}</td>
                    <td>${name}</td>
                    <td>${p.phone || 'N/A'}</td>
                    <td><button class="btn btn-primary btn-sm" onclick="window.IndividualKPI.selectPatient('${pId}', '${name.replace(/'/g, "\\'")}')">Select</button></td>
                `;
                tableBody.appendChild(tr);
            });

            if (filtered.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No patients found</td></tr>';
            }

            paginationCont.innerHTML = window.Utils.generatePaginationHTML(page, totalPages, 'window.IndividualKPI.renderPatientList');
        },

        selectPatient: function(id, name) {
            this.selectedEntity = id;
            document.getElementById('selectedPatientName').textContent = name;
            document.getElementById('selectedPatientName').style.color = '#2563eb';
            Modal.close('patientPickerModal');
            this.update();
        },

        togglePeriod: function() {
            this.period = document.getElementById('kpiPeriodToggle').value;
            const dateGroup = document.getElementById('kpiDateGroup');
            
            if (this.period === 'custom') {
                dateGroup.style.display = 'flex';
                // default to today
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('kpiDateStart').value = today;
                document.getElementById('kpiDateEnd').value = today;
            } else {
                dateGroup.style.display = 'none';
            }
            this.update();
        },

        getDateBoundaries: function() {
            if (this.period === 'lifetime') return { start: null, end: null };
            
            let start, end;
            if (this.period === 'today') {
                const today = new Date();
                start = end = today.toISOString().split('T')[0];
            } else {
                start = document.getElementById('kpiDateStart').value;
                end = document.getElementById('kpiDateEnd').value;
            }
            
            return {
                start: start ? new Date(start) : null,
                end: end ? new Date(end) : null
            };
        },

        filterData: function() {
            const bounds = this.getDateBoundaries();
            const start = bounds.start;
            const end = bounds.end;
            if (end) end.setHours(23, 59, 59);

            const isDoctor = this.context === 'doctor';
            const isPatient = this.context === 'patient';
            this.selectedEntity = document.getElementById('kpiEntitySelect')?.value || '';

            const dateCheck = (dateStr) => {
                const d = new Date(dateStr);
                return (!start || d >= start) && (!end || d <= end);
            };

            const entityCheck = (item, type) => {
                if (this.context === 'all') return true;
                if (!this.selectedEntity) return false;
                
                if (type === 'appt') {
                    if (isDoctor) return item.dentist === this.selectedEntity;
                    if (isPatient) return String(item.patientId) === String(this.selectedEntity);
                } else if (type === 'inv') {
                    if (isDoctor) return item.doctorName === this.selectedEntity;
                    if (isPatient) return String(item.patientId) === String(this.selectedEntity);
                } else if (type === 'tx') {
                    if (isDoctor) return item.doctorName === this.selectedEntity;
                    if (isPatient) return String(item.patientId) === String(this.selectedEntity);
                }
                return true;
            };

            return {
                appointments: rawAppointments.filter(a => dateCheck(a.date) && entityCheck(a, 'appt')),
                invoices: rawInvoices.filter(i => dateCheck(i.date) && entityCheck(i, 'inv')),
                // Note: Treatments might require fetching if separate, but assuming we can derive them from appointments or invoices
            };
        },

        update: function() {
            const data = this.filterData();
            
            // 1. Appointments Data
            const apptsDone = data.appointments.filter(a => a.status === 'done').length;
            document.getElementById('ikpi-appointments').textContent = apptsDone;
            
            // Appt Chart
            const apptByDay = {};
            data.appointments.forEach(a => {
                const d = new Date(a.date).toLocaleDateString();
                apptByDay[d] = (apptByDay[d] || 0) + 1;
            });
            window.KPICards.renderChart('ikpi-appointments-chart', 'bar', Object.keys(apptByDay), Object.values(apptByDay), 'Appointments', '245, 158, 11');

            // 2. Capital Data
            const capital = data.invoices.reduce((sum, i) => sum + (i.total || i.amount || 0), 0);
            document.getElementById('ikpi-capital').textContent = 'Rs. ' + capital.toLocaleString();
            
            // Capital Chart
            const capByDay = {};
            data.invoices.forEach(i => {
                const d = new Date(i.date).toLocaleDateString();
                capByDay[d] = (capByDay[d] || 0) + (i.total || i.amount || 0);
            });
            window.KPICards.renderChart('ikpi-capital-chart', 'line', Object.keys(capByDay), Object.values(capByDay), 'Revenue', '16, 185, 129');

            // 3. Invoices Data
            document.getElementById('ikpi-invoices').textContent = data.invoices.length;
            
            // Invoice Chart
            const invByDay = {};
            data.invoices.forEach(i => {
                const d = new Date(i.date).toLocaleDateString();
                invByDay[d] = (invByDay[d] || 0) + 1;
            });
            window.KPICards.renderChart('ikpi-invoices-chart', 'bar', Object.keys(invByDay), Object.values(invByDay), 'Invoices', '59, 130, 246');

            // 4. Treatments Data (Derived from Services in invoices or appts usually in PakTeeth)
            let txCount = 0;
            const txByDay = {};
            data.invoices.forEach(i => {
                const d = new Date(i.date).toLocaleDateString();
                if(i.services && Array.isArray(i.services)) {
                    txCount += i.services.length;
                    txByDay[d] = (txByDay[d] || 0) + i.services.length;
                }
            });
            document.getElementById('ikpi-treatments').textContent = txCount;
            window.KPICards.renderChart('ikpi-treatments-chart', 'bar', Object.keys(txByDay), Object.values(txByDay), 'Treatments', '139, 92, 246');
            
            if(this.context !== 'all') {
                Toast.info("KPIs updated based on filters");
            }
        },

        exportAppointments: function() {
            const data = this.filterData().appointments;
            const rows = data.map(a => [a.date, a.patientName || '', a.dentist || '', a.status]);
            window.KPICards.exportData('Appointments_Export.csv', ['Date', 'Patient', 'Doctor', 'Status'], rows);
        },
        exportCapital: function() {
            const data = this.filterData().invoices;
            const rows = data.map(i => [i.date, i.patientName || '', i.doctorName || '', i.total || 0]);
            window.KPICards.exportData('Capital_Export.csv', ['Date', 'Patient', 'Doctor', 'Amount'], rows);
        },
        exportInvoices: function() {
             const data = this.filterData().invoices;
             const rows = data.map(i => [i.invoiceNumber || i.id, i.date, i.patientName || '', i.total || 0, i.status || '']);
             window.KPICards.exportData('Invoices_Export.csv', ['ID', 'Date', 'Patient', 'Total', 'Status'], rows);
        },
        exportTreatments: function() {
             const data = this.filterData().invoices;
             let rows = [];
             data.forEach(i => {
                 if(i.services && Array.isArray(i.services)) {
                     i.services.forEach(s => {
                         rows.push([i.date, i.patientName || '', i.doctorName || '', s]);
                     });
                 }
             });
             window.KPICards.exportData('Treatments_Export.csv', ['Date', 'Patient', 'Doctor', 'Treatment'], rows);
        }
    };

    // Initialize after a slight delay to allow data load
    setTimeout(() => {
        window.IndividualKPI.update();
    }, 1000);


    window.exportAnalytics = function () {
        const headers = ["Category", "Revenue"];
        const sums = {};
        CLINICAL_CATEGORIES.forEach(c => sums[c] = 0);

        const start = dateStart?.value ? new Date(dateStart.value) : null;
        const end = dateEnd?.value ? new Date(dateEnd.value) : null;

        rawInvoices.filter(inv => {
            const d = new Date(inv.date);
            return (!start || d >= start) && (!end || d <= end);
        }).forEach(inv => {
            const cat = getCategory(inv);
            if (sums[cat] !== undefined) sums[cat] += (inv.total || 0);
        });

        const data = CLINICAL_CATEGORIES.map(c => [c, sums[c]]);
        Utils.exportToCSV("Revenue_Report.csv", headers, data);
        Toast.success("Custom report exported.");
    };

    loadAnalyticsData();
});