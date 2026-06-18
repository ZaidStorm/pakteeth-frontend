const calendarTitle = document.getElementById("calendarTitle");
const calendarContent = document.getElementById("calendarContent");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const viewSelect = document.getElementById("viewSelect");

const holidayDateInput = document.getElementById("holidayDate");
const holidayNameInput = document.getElementById("holidayName");
const holidayColorInput = document.getElementById("holidayColor");
const addHolidayBtn = document.getElementById("addHolidayBtn");
const holidayListEl = document.getElementById("holidayList");
const saveHolidaysBtn = document.getElementById("saveHolidaysBtn");

let currentView = "day"; 
const viewSelectEl = document.getElementById("viewSelect");
if (viewSelectEl) {
    currentView = viewSelectEl.value || "day";
}

let selectedDoctorName = "";
let currentDate = new Date();
let holidays = {};
try {
    holidays = JSON.parse(localStorage.getItem("pakteethHolidays")) || {};
} catch(e) { holidays = {}; }

let calendarAppointments = [];
let calendarDoctors = [];
let systemStartHour = 8;
let systemEndHour = 22;
let systemSlotInterval = 30;

async function fetchCalendarAppointments() {
    try {
        const [apptsData, staffData, settings] = await Promise.all([
            APP.api.get("/appointments"),
            APP.api.get("/staff"),
            APP.api.get("/calendar-settings").catch(() => ({}))
        ]);

        calendarAppointments = Array.isArray(apptsData) ? apptsData : (apptsData.appointments || []);
        
        const allStaff = Array.isArray(staffData) ? staffData : (staffData.staff || []);
        calendarDoctors = allStaff.filter(s => s.role === "Doctor");
        populateDoctorSelect();

        if (settings.calendarStartTime) {
            systemStartHour = parseInt(settings.calendarStartTime.split(':')[0], 10);
        }
        if (settings.calendarEndTime) {
            const parts = settings.calendarEndTime.split(':');
            systemEndHour = parseInt(parts[0], 10);
            if (parseInt(parts[1], 10) > 0) systemEndHour += 1;
        }
        if (settings.slotInterval) {
            systemSlotInterval = parseInt(settings.slotInterval, 10);
        }
        console.log("Calendar Settings Loaded:", { systemStartHour, systemEndHour, systemSlotInterval });

        renderCalendar();
    } catch (e) {
        console.error("Calendar failed to load data:", e);
    }
}

function populateDoctorSelect() {
    const docSelect = document.getElementById("calendarDoctorSelect");
    if (!docSelect) return;
    docSelect.innerHTML = '<option value="">Select Doctor</option>';
    calendarDoctors.forEach(doc => {
        const opt = document.createElement("option");
        opt.value = doc.name;
        opt.textContent = doc.name;
        docSelect.appendChild(opt);
    });

    if (calendarDoctors.length > 0) {
        if (!selectedDoctorName) {
            selectedDoctorName = calendarDoctors[0].name;
        }
        docSelect.value = selectedDoctorName;
    }
}

function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function renderCalendar() {
    if (!calendarContent) return;
    calendarContent.innerHTML = "";

    const docPicker = document.getElementById("calendarDoctorSelect");
    if (docPicker) docPicker.style.display = (currentView === "week") ? "block" : "none";

    if (currentView === "day") {
        renderDayView();
    } else if (currentView === "week") {
        renderWeekView();
    } else {
        renderMonthView();
    }
}

function renderDayView() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    calendarTitle.textContent = currentDate.toLocaleDateString('en-US', options).toLowerCase();

    const key = formatDateKey(currentDate);
    const dayAppts = calendarAppointments.filter(a => a.date === key);

    calendarContent.className = "calendar-day-view-container";
    calendarContent.style.display = "flex";
    calendarContent.style.flexDirection = "column";

    const fragment = document.createDocumentFragment();

    const headerRow = document.createElement("div");
    headerRow.className = "cal-header-row";
    fragment.appendChild(headerRow);

    const bodyRow = document.createElement("div");
    bodyRow.className = "cal-body-row";
    fragment.appendChild(bodyRow);

    const startHour = systemStartHour;
    const endHour = systemEndHour;
    const pixelsPerHour = 120;
    const slotSize = pixelsPerHour / (60 / systemSlotInterval);

    // Time Column
    const timeCol = document.createElement("div");
    timeCol.className = "cal-time-col";

    const timeHeader = document.createElement("div");
    timeHeader.className = "cal-time-header";
    timeHeader.textContent = "all day";
    headerRow.appendChild(timeHeader);

    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += systemSlotInterval) {
            const ts = document.createElement("div");
            ts.className = "cal-time-slot-label";
            ts.style.height = `${slotSize}px`;
            let dh = h > 12 ? h - 12 : h;
            if (dh === 0) dh = 12;
            let ampm = h >= 12 ? "pm" : "am";
            let yOffset = (h === startHour && m === 0) ? "4px" : "-8px";
            ts.innerHTML = `<span style="position:relative; top:${yOffset};">${dh}:${String(m).padStart(2, '0')} ${ampm}</span>`;
            timeCol.appendChild(ts);
        }
    }
    bodyRow.appendChild(timeCol);

    const docsToRender = calendarDoctors.length > 0 ? calendarDoctors : [{ name: 'Doctor' }];
    docsToRender.forEach(doc => {
        const docCol = document.createElement("div");
        docCol.className = "cal-doc-col unavailable-bg";

        const docHeader = document.createElement("div");
        docHeader.className = "cal-doc-header";
        docHeader.textContent = doc.name;
        headerRow.appendChild(docHeader);

        const gridPattern = document.createElement("div");
        gridPattern.className = "cal-grid-pattern";
        gridPattern.style.backgroundSize = `100% ${slotSize}px`;
        gridPattern.style.backgroundImage = `linear-gradient(to bottom, transparent ${slotSize-1}px, rgba(0,0,0,0.12) ${slotSize}px)`;
        docCol.appendChild(gridPattern);

        let docStart = 9;
        let docEnd = 20;
        if (doc.visitingHours && doc.visitingHours.startTime && doc.visitingHours.endTime) {
            const [sH, sM] = doc.visitingHours.startTime.split(':').map(Number);
            const [eH, eM] = doc.visitingHours.endTime.split(':').map(Number);
            docStart = sH + (sM / 60);
            docEnd = eH + (eM / 60);
        }

        const availTop = Math.max(0, (docStart - startHour)) * pixelsPerHour;
        const availHeight = Math.max(0, Math.min(docEnd, endHour) - Math.max(docStart, startHour)) * pixelsPerHour;

        if (availHeight > 0) {
            const availBlock = document.createElement("div");
            availBlock.className = "availability-block";
            availBlock.style.top = `${availTop}px`;
            availBlock.style.height = `${availHeight}px`;
            docCol.appendChild(availBlock);
        }

        const docAppts = dayAppts.filter(a => a.dentist === doc.name);
        docAppts.forEach(appt => {
            const aptEl = createAppointmentBadge(appt, startHour, pixelsPerHour);
            if (aptEl) docCol.appendChild(aptEl);
        });

        // ── Drag-over highlight overlay (shown during drag) ──────────────────
        const dropHighlight = document.createElement("div");
        dropHighlight.style.cssText = `
            position:absolute; left:0; right:0; height:${pixelsPerHour / (60 / systemSlotInterval)}px;
            background:rgba(42,157,244,0.25); border:2px dashed #2a9df4;
            border-radius:4px; pointer-events:none; display:none; z-index:5;
        `;
        docCol.appendChild(dropHighlight);

        // Helper: compute snapped time from Y offset inside docCol
        function yToTimeStr(y) {
            const rawMins = Math.floor(y / (pixelsPerHour / 60));
            const total   = (startHour * 60) + rawMins;
            const h       = Math.floor(total / 60);
            const m       = Math.floor((total % 60) / systemSlotInterval) * systemSlotInterval;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }

        function yToTop(y) {
            const rawMins = Math.floor(y / (pixelsPerHour / 60));
            const snapped = Math.floor(rawMins / systemSlotInterval) * systemSlotInterval;
            return snapped * (pixelsPerHour / 60);
        }

        // ── Drag events on the column ──────────────────────────────────
        docCol.addEventListener('dragover', (e) => {
            if (!window._draggedAppt) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = docCol.getBoundingClientRect();
            const y = e.clientY - rect.top;
            dropHighlight.style.top = yToTop(y) + 'px';
            dropHighlight.style.display = 'block';
        });

        docCol.addEventListener('dragleave', (e) => {
            // Only hide if we truly left this column (not just moved to a child)
            const rect = docCol.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right ||
                e.clientY < rect.top  || e.clientY > rect.bottom) {
                dropHighlight.style.display = 'none';
            }
        });

        docCol.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropHighlight.style.display = 'none';

            const dragged = window._draggedAppt;
            if (!dragged) return;

            const rect     = docCol.getBoundingClientRect();
            const y        = e.clientY - rect.top;
            const newTime   = yToTimeStr(y);
            const newDoctor = doc.name;
            const newDate   = dragged.date;

            await rescheduleAppointment(dragged, newDate, newTime, newDoctor);
        });

        // ── Click to book ───────────────────────────────────────
        docCol.onclick = async (e) => {
            if (e.target.closest(".calendar-appt-badge")) return;
            const y = e.offsetY;
            const mins = Math.floor(y / (pixelsPerHour / 60));
            const total = (startHour * 60) + mins;
            const h = Math.floor(total / 60);
            const m = Math.floor((total % 60) / systemSlotInterval) * systemSlotInterval;
            const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            const timeFloat = h + (m / 60);
            const isAvail = timeFloat >= docStart && timeFloat < docEnd;

            if (!isAvail) {
                const proceed = await Confirm.show(`Dr. ${doc.name} is not available at ${timeString}. Book anyway?`);
                if (!proceed) return;
            }

            openBookingWithData(key, timeString, doc.name);
        };

        bodyRow.appendChild(docCol);
    });

    calendarContent.appendChild(fragment);
}

function renderWeekView() {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday start

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    calendarTitle.textContent = `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    calendarContent.style.display = "grid";
    calendarContent.style.gridTemplateColumns = "80px repeat(7, 1fr)";
    calendarContent.style.backgroundColor = "#fff";

    const fragment = document.createDocumentFragment();

    // Headers
    fragment.appendChild(createCell("time", "Time", true));
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const header = document.createElement("div");
        header.className = "day-label";
        header.innerHTML = `<div>${d.toLocaleDateString("en-US", { weekday: "short" })}</div><div style="font-size:0.8rem">${d.getDate()}</div>`;
        fragment.appendChild(header);
    }

    // Body
    for (let h = systemStartHour; h < systemEndHour; h++) {
        for (let m = 0; m < 60; m += systemSlotInterval) {
            const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            const ampm = h >= 12 ? "PM" : "AM";
            const timeLabel = `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
            fragment.appendChild(createCell("time-label", timeLabel));

            for (let i = 0; i < 7; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                const key = formatDateKey(d);

                const cell = document.createElement("div");
                cell.className = "day-cell";
                cell.onclick = () => handleDateClick(d, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

                const dayAppts = calendarAppointments.filter(a => a.date === key && a.dentist === selectedDoctorName);
                const slotAppts = dayAppts.filter(a => {
                    const [ah, am] = a.time.split(":").map(Number);
                    return ah === h && am === m;
                });

                slotAppts.forEach(a => {
                    const status = (a.status || "pending").toLowerCase();
                    const badge = document.createElement("div");
                    badge.className = `calendar-appt-badge ${status}`;
                    badge.style.position = "relative";
                    badge.style.margin = "2px";
                    badge.style.fontSize = "9px";
                    badge.style.cursor = "grab";
                    badge.textContent = a.patientName || a.patientId;

                    // Enable dragging for week view badges
                    badge.draggable = true;
                    badge.addEventListener('dragstart', (e) => {
                        e.stopPropagation();
                        window._draggedAppt = { 
                            id: a._id || a.appointmentId, 
                            date: a.date, 
                            time: a.time, 
                            dentist: a.dentist, 
                            patient: a.patientName || a.patientId 
                        };
                        badge.style.opacity = '0.5';
                    });
                    badge.addEventListener('dragend', () => {
                        badge.style.opacity = '1';
                        window._draggedAppt = null;
                    });

                    cell.appendChild(badge);
                });

                // Drop support for week cells
                cell.addEventListener('dragover', (e) => {
                    if (!window._draggedAppt) return;
                    e.preventDefault();
                    cell.style.backgroundColor = "rgba(42,157,244,0.1)";
                });
                cell.addEventListener('dragleave', () => {
                    cell.style.backgroundColor = "";
                });
                cell.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    cell.style.backgroundColor = "";
                    const dragged = window._draggedAppt;
                    if (!dragged) return;

                    const newDate = key;
                    const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    const newDoctor = selectedDoctorName;

                    await rescheduleAppointment(dragged, newDate, newTime, newDoctor);
                });

                fragment.appendChild(cell);
            }
        }
    }
    calendarContent.appendChild(fragment);
}

/**
 * Shared logic for rescheduling an appointment (Confirmation + API)
 */
async function rescheduleAppointment(dragged, newDate, newTime, newDoctor) {
    if (!dragged) return;

    // Nothing changed — ignore
    if (newTime === dragged.time && newDoctor === dragged.dentist && newDate === dragged.date) return;

    // Format HH:MM → "hh:mm AM/PM"
    const fmtTime = (t) => {
        if (!t) return "-";
        const [hh, mm] = t.split(':').map(Number);
        const ap = hh >= 12 ? 'PM' : 'AM';
        const dh = hh % 12 || 12;
        return `${String(dh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
    };

    const msg =
        `Reschedule appointment for ${dragged.patient}?\n\n` +
        `FROM:  ${fmtTime(dragged.time)}  \u2502  Dr. ${dragged.dentist}  \u2502  ${dragged.date}\n` +
        `  TO:  ${fmtTime(newTime)}  \u2502  Dr. ${newDoctor}  \u2502  ${newDate}`;

    const ok = await Confirm.show(msg, '\uD83D\uDCC5 Reschedule Appointment');
    if (!ok) return;

    try {
        const res = await fetch(`/appointments/${dragged.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time: newTime, dentist: newDoctor, date: newDate })
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            Toast.error(errBody.error || 'Could not reschedule \u2014 time slot may be occupied.');
            return;
        }
        Toast.success(`Rescheduled to ${newDate} ${fmtTime(newTime)}${newDoctor !== dragged.dentist ? ' with Dr. ' + newDoctor : ''}`);
        
        if (window.fetchCalendarAppointments) window.fetchCalendarAppointments();
        if (typeof window.loadAppointments === 'function') window.loadAppointments();
        if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
    } catch (err) {
        console.error('Reschedule failed:', err);
        Toast.error('Network error \u2014 could not reschedule.');
    }
}

function renderMonthView() {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    calendarTitle.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();

    calendarContent.style.display = "grid";
    calendarContent.style.gridTemplateColumns = "repeat(7, 1fr)";

    const fragment = document.createDocumentFragment();

    // Day Names
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
        const label = document.createElement("div");
        label.className = "day-label";
        label.textContent = day;
        fragment.appendChild(label);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay + daysInMonth; i++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";

        if (i >= firstDay) {
            const dayNum = i - firstDay + 1;
            const d = new Date(year, month, dayNum);
            const key = formatDateKey(d);

            // Mark today
            const now = new Date();
            if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                cell.classList.add("today");
            }

            cell.innerHTML = `<div class="day-number" style="padding:5px">${dayNum}</div>`;
            cell.onclick = () => handleDateClick(d);

            const dayAppts = calendarAppointments.filter(a => a.date === key && a.status !== "cancelled");
            if (dayAppts.length > 0) {
                dayAppts.forEach(appt => {
                    const status = (appt.status || "pending").toLowerCase();
                    const badge = document.createElement("div");
                    badge.className = `calendar-appt-badge ${status}`;
                    badge.style.position = "relative";
                    badge.style.margin = "2px";
                    badge.style.padding = "2px 4px";
                    badge.style.fontSize = "10px";
                    badge.style.cursor = "grab";
                    badge.style.whiteSpace = "nowrap";
                    badge.style.overflow = "hidden";
                    badge.style.textOverflow = "ellipsis";
                    badge.style.display = "block";
                    badge.textContent = appt.patientName || appt.patientId;

                    // Draggable Month Badge
                    badge.draggable = true;
                    badge.addEventListener('dragstart', (e) => {
                        e.stopPropagation();
                        window._draggedAppt = { 
                            id: appt._id || appt.appointmentId, 
                            date: appt.date, 
                            time: appt.time, 
                            dentist: appt.dentist, 
                            patient: appt.patientName || appt.patientId 
                        };
                        badge.style.opacity = '0.5';
                    });
                    badge.addEventListener('dragend', () => {
                        badge.style.opacity = '1';
                        window._draggedAppt = null;
                    });
                    
                    cell.appendChild(badge);
                });
            }

            // Drop support for month day cells
            cell.addEventListener('dragover', (e) => {
                if (!window._draggedAppt) return;
                e.preventDefault();
                cell.style.backgroundColor = "rgba(42,157,244,0.1)";
            });
            cell.addEventListener('dragleave', () => {
                cell.style.backgroundColor = "";
            });
            cell.addEventListener('drop', async (e) => {
                e.preventDefault();
                cell.style.backgroundColor = "";
                const dragged = window._draggedAppt;
                if (!dragged) return;

                const newDate = key;
                // Preserve original time and doctor when dragging in Month View
                const newTime = dragged.time;
                const newDoctor = dragged.dentist;

                await rescheduleAppointment(dragged, newDate, newTime, newDoctor);
            });
        }
        fragment.appendChild(cell);
    }
    calendarContent.appendChild(fragment);
}

function createCell(cls, text, isHeader = false) {
    const div = document.createElement("div");
    div.className = cls;
    if (isHeader) div.classList.add("day-label");
    div.style.border = "1px solid #eee";
    div.style.padding = "5px";
    div.style.fontSize = "0.75rem";
    div.textContent = text;
    return div;
}

function handleDateClick(date, timeString = "09:00") {
    currentDate = new Date(date);
    currentView = "day";
    const viewSel = document.getElementById("viewSelect");
    if (viewSel) viewSel.value = "day";
    renderCalendar();

    // Auto-open modal
    setTimeout(() => {
        openBookingWithData(formatDateKey(date), timeString, selectedDoctorName || (calendarDoctors[0]?.name));
    }, 100);
}

function openBookingWithData(date, time, dentist) {
    currentDate = new Date(date);
    if (currentView !== "day") {
        currentView = "day";
        renderCalendar();
    }
    // Now pass data directly to the modular modal opener
    if (window.addAppointmentModal) {
        window.addAppointmentModal(date, time, dentist);
    }
}

function createAppointmentBadge(appt, startHour, pixelsPerHour) {
    // Shared logic for Day View badges
    let [h, m] = appt.time.split(":").map(Number);
    if (h < startHour || h >= systemEndHour) return null;

    const duration = appt.scheduledDuration || 30;
    const top = ((h - startHour) * pixelsPerHour) + (m * (pixelsPerHour / 60));
    const height = (duration * (pixelsPerHour / 60)) - 2;

    const el = document.createElement("div");
    const status = (appt.status || "pending").toLowerCase();
    el.className = `calendar-appt-badge ${status}`;
    el.style.top = `${top}px`;
    el.style.height = `${height}px`;

    el.innerHTML = `
        <div style="font-weight:bold; font-size:10.5px; margin-bottom: 2px;">${(appt.patientName || appt.patientId).toUpperCase()}</div>
        <div style="font-size: 9px; opacity: 0.8; font-weight: 500;">${appt.type || 'Treatment'}</div>
    `;

    // ── Drag support ──────────────────────────────────────────
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id:      appt._id || appt.appointmentId,
            date:    appt.date,
            time:    appt.time,
            dentist: appt.dentist,
            patient: appt.patientName || appt.patientId
        }));
        // Keep a reference so drop zones can resolve it quickly
        window._draggedAppt = { id: appt._id || appt.appointmentId, date: appt.date, time: appt.time, dentist: appt.dentist, patient: appt.patientName || appt.patientId };
        setTimeout(() => { el.style.opacity = '0.4'; }, 0);
    });
    el.addEventListener('dragend', () => {
        el.style.opacity = '1';
        window._draggedAppt = null;
    });

    el.onclick = (e) => {
        e.stopPropagation();
        if (window.showAppointmentTooltip) window.showAppointmentTooltip(e, appt, el);
    };
    return el;
}

if (prevBtn) {
    prevBtn.onclick = () => {
        if (currentView === "day") currentDate.setDate(currentDate.getDate() - 1);
        else if (currentView === "week") currentDate.setDate(currentDate.getDate() - 7);
        else currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    }
}

if (nextBtn) {
    nextBtn.onclick = () => {
        if (currentView === "day") currentDate.setDate(currentDate.getDate() + 1);
        else if (currentView === "week") currentDate.setDate(currentDate.getDate() + 7);
        else currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    }
}

if (viewSelect) {
    viewSelect.onchange = (e) => {
        currentView = e.target.value;
        renderCalendar();
    };
}

const docSelect = document.getElementById("calendarDoctorSelect");
if (docSelect) {
    docSelect.onchange = (e) => {
        selectedDoctorName = e.target.value;
        if (currentView === "week") renderCalendar();
    };
}

// Initial render
if (viewSelect) {
    currentView = viewSelect.value;
}
renderCalendar();
fetchCalendarAppointments();

// Expose for cross-module refresh (e.g. after appointment saved in system-appointments.js)
window.fetchCalendarAppointments = fetchCalendarAppointments;


// Tooltip implementation
window.showAppointmentTooltip = function (e, appt, element) {
    // Remove existing tooltip
    let existing = document.getElementById('appt-tooltip');
    if (existing) {
        existing.remove();
    }

    // Toggle off if clicking the same one
    if (window.currentTooltipApptId === appt._id) {
        window.currentTooltipApptId = null;
        return;
    }

    window.currentTooltipApptId = appt._id;

    const tooltip = document.createElement("div");
    tooltip.id = "appt-tooltip";

    // Styling
    tooltip.style.position = "absolute";
    tooltip.style.backgroundColor = "white";
    tooltip.style.border = "1px solid #ccc";
    tooltip.style.padding = "15px";
    tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    tooltip.style.borderRadius = "8px";
    tooltip.style.zIndex = "1000";
    tooltip.style.minWidth = "200px";
    tooltip.style.fontFamily = "Arial, sans-serif";
    tooltip.style.fontSize = "14px";
    tooltip.style.color = "#333";

    const pName = appt.patientName || (appt.patientId && appt.patientId.firstName ? `${appt.patientId.firstName} ${appt.patientId.lastName}` : appt.patientId) || 'Patient';
    const apptStatus = appt.status || 'pending';
    const statusDisplay = apptStatus.charAt(0).toUpperCase() + apptStatus.slice(1);

    tooltip.innerHTML = `
        <div style="margin-bottom: 8px;"><strong>Date:</strong> ${appt.date}</div>
        <div style="margin-bottom: 8px;"><strong>Time:</strong> ${appt.time || '-'}</div>
        <div style="margin-bottom: 8px;"><strong>Patient:</strong> ${pName}</div>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <strong>Status:</strong>
            <select id="appt-status-select" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #ddd; font-size: 13px; cursor: pointer; background: ${apptStatus === 'done' ? '#e0f2fe' : apptStatus === 'cancelled' ? '#fee2e2' : apptStatus === 'confirmed' ? '#dcfce7' : '#fef9c3'}; font-weight: 600; color: #333; outline: none; transition: all 0.2s;">
                <option value="pending" ${apptStatus === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="confirmed" ${apptStatus === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="done" ${apptStatus === 'done' ? 'selected' : ''}>Done</option>
                <option value="cancelled" ${apptStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>
        <div style="margin-bottom: 15px;"><strong>Doctor:</strong> ${appt.dentist || '-'}</div>
        <div style="margin-bottom: 15px; padding: 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
            <div style="font-weight: 600; color: #166534; margin-bottom: 8px; font-size: 13px;">📣 Inform Patient</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button id="whatsapp-remind-btn" style="background:#25d366; color:white; border:none; padding: 8px 10px; cursor:pointer; border-radius:6px; font-weight:bold; font-size:12px;">
                    📱 Manual WA
                </button>
                <button id="whatsapp-remind-auto-btn" style="background:#075e54; color:white; border:none; padding: 8px 10px; cursor:pointer; border-radius:6px; font-weight:bold; font-size:12px;">
                    🤖 Auto WA
                </button>
                <button id="sms-remind-btn" style="grid-column: span 2; background:#2766ba; color:white; border:none; padding: 8px 10px; cursor:pointer; border-radius:6px; font-weight:bold; font-size:12px;">
                    💬 Send SMS Reminder
                </button>
            </div>

        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="view-profile-btn" style="background-color: #2a9df4; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold; flex: 1.2; white-space: nowrap;">
                👤 View Profile
            </button>
            <button id="close-tooltip-btn" style="background-color: #f0f0f0; color: #333; border: 1px solid #ccc; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold; flex: 0.8;">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(tooltip);

    // Event Listeners for Status Change
    const statusSelect = document.getElementById('appt-status-select');
    if (statusSelect) {
        statusSelect.onchange = async (e) => {
            const newStatus = e.target.value;
            const appId = appt._id || appt.appointmentId;
            if (window.changeAppointmentStatus) {
                await window.changeAppointmentStatus(appId, newStatus);
                tooltip.remove();
                window.currentTooltipApptId = null;
            } else {
                Toast.error('Status update function not found.');
            }
        };
    }

    // Position
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Default: below element
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;

    // Make sure it doesn't go off screen
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 20;
    }
    if (top + tooltipRect.height > window.scrollY + window.innerHeight) {
        top = rect.top + window.scrollY - tooltipRect.height - 5;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Event Listeners
    document.getElementById('view-profile-btn').onclick = () => {
        const pid = typeof appt.patientId === 'object' ? appt.patientId?._id : appt.patientId;
        if (!pid) { Toast.error('Patient ID not found.'); return; }
        
        const url = `../patients/patient-profile.html?id=${encodeURIComponent(pid)}`;
        
        // If we are inside an iframe (e.g. dashboard calendar popup)
        if (window.parent && window.parent !== window) {
            if (typeof window.parent.closeCalendarOverlay === 'function') {
                window.parent.closeCalendarOverlay();
            }
            window.parent.location.href = url;
        } else {
            // Navigate normally
            window.location.href = url;
        }
    };

    // WhatsApp Reminder
    const waBtn = document.getElementById('whatsapp-remind-btn');
    if (waBtn) {
        waBtn.onclick = async () => {
            try {
                // Fetch patient's phone number from the API
                const pid = typeof appt.patientId === 'object' ? appt.patientId?._id : appt.patientId;
                if (!pid) { Toast.error("Patient ID not found."); return; }

                const res = await fetch(`${API_BASE}/patients/${pid}`);
                const patient = await res.json();
                const phone = patient?.phone;

                if (!phone) {
                    Toast.error("No phone number found for this patient.");
                    return;
                }

                // Format date/time nicely
                const apptDate = appt.date || "-";
                const apptTime = appt.time || "-";
                const doctorName = appt.dentist || "your doctor";
                const patientName = appt.patientName || patient.firstName || "there";

                const message = `Dear ${patientName}, this is a reminder from PakTeeth Dental Clinic.\n\nYou have an appointment scheduled:\n📅 Date: ${apptDate}\n⏰ Time: ${apptTime}\n👨‍⚕️ Doctor: ${doctorName}\n\nPlease arrive 5 minutes early. Thank you!`;

                if (window.Share?.openWhatsAppText) {
                    window.Share.openWhatsAppText(phone, message);
                } else {
                    const cleanPhone = phone.replace(/\D/g, '');
                    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, "_blank");
                }
            } catch (err) {
                console.error("WhatsApp remind failed:", err);
                Toast.error("Failed to open WhatsApp reminder.");
            }
        };
    }

    // Automated WhatsApp Reminder
    const waAutoBtn = document.getElementById('whatsapp-remind-auto-btn');
    if (waAutoBtn) {
        waAutoBtn.onclick = async () => {
            try {
                const pid = typeof appt.patientId === 'object' ? appt.patientId?._id : appt.patientId;
                if (!pid) { Toast.error("Patient ID not found."); return; }

                const res = await fetch(`${API_BASE}/patients/${pid}`);
                const patient = await res.json();
                const phone = patient?.phone;

                if (!phone) {
                    Toast.error("No phone number found for this patient.");
                    return;
                }

                const patientName = appt.patientName || patient.firstName || "Patient";
                const apptDate = appt.date || "-";
                const apptTime = appt.time || "-";
                const doctorName = appt.dentist || "your doctor";

                const message = `Dear ${patientName}, this is a reminder from PakTeeth Dental Clinic.\nYou have an appointment on ${apptDate} at ${apptTime} with Dr. ${doctorName}.\nPlease arrive 5 minutes early. Thank you!`;

                waAutoBtn.textContent = "Sending...";
                waAutoBtn.disabled = true;
                const success = await Share.sendWhatsAppAutomated(phone, message);
                waAutoBtn.textContent = "🤖 Auto WA";
                waAutoBtn.disabled = false;
            } catch (err) {
                console.error("WhatsApp auto failed:", err);
                Toast.error("Failed to send automated WhatsApp.");
                waAutoBtn.textContent = "🤖 Auto WA";
                waAutoBtn.disabled = false;
            }
        };
    }
    // SMS Reminder
    const smsBtn = document.getElementById('sms-remind-btn');
    if (smsBtn) {
        smsBtn.onclick = async () => {
            try {
                const pid = typeof appt.patientId === 'object' ? appt.patientId?._id : appt.patientId;
                if (!pid) { Toast.error("Patient ID not found."); return; }

                const res = await fetch(`${API_BASE}/patients/${pid}`);
                const patient = await res.json();
                const phone = patient?.phone;

                if (!phone) {
                    Toast.error("No phone number found for this patient.");
                    return;
                }

                const patientName = appt.patientName || patient.firstName || "Patient";
                const apptDate = appt.date || "-";
                const apptTime = appt.time || "-";
                const doctorName = appt.dentist || "your doctor";

                const message = `Reminder: You have an appointment at PakTeeth Clinic on ${apptDate} at ${apptTime} with Dr. ${doctorName}.`;

                smsBtn.textContent = "Sending...";
                smsBtn.disabled = true;
                const success = await Share.sendSMS(phone, message);
                smsBtn.textContent = "💬 Send SMS Reminder";
                smsBtn.disabled = false;
            } catch (err) {
                console.error("SMS failed:", err);
                Toast.error("Failed to send SMS.");
                smsBtn.textContent = "💬 Send SMS Reminder";
                smsBtn.disabled = false;
            }
        };
    }

    const cancelBtn = document.getElementById('cancel-appt-btn');
    if (cancelBtn) {
        cancelBtn.onclick = async () => {
            const ok = await Confirm.show("Cancel this appointment?");
            if (!ok) return;
            try {
                const appId = appt._id || appt.appointmentId;
                const res = await fetch(`${API_BASE}/appointments/${appId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelled' })
                });
                if (res.ok) {
                    Toast.success('Appointment cancelled.');
                    tooltip.remove();
                    window.currentTooltipApptId = null;
                    if (window.fetchCalendarAppointments) window.fetchCalendarAppointments();
                    if (window.loadAppointments) window.loadAppointments();
                } else {
                    Toast.error('Failed to cancel appointment.');
                }
            } catch (err) {
                console.error(err);
                Toast.error('Error cancelling appointment.');
            }
        };
    }

    document.getElementById('close-tooltip-btn').onclick = () => {
        tooltip.remove();
        window.currentTooltipApptId = null;
    };

    // close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeTooltip(event) {
            if (!tooltip.contains(event.target) && event.target !== element) {
                tooltip.remove();
                window.currentTooltipApptId = null;
                document.removeEventListener('click', closeTooltip);
            }
        });
    }, 10);
};