/**
 * Safely find an appointment for messaging
 * Checks all possible ID fields used in the system
 */
function findAppointmentForMessage(appointments, id) {
    if (!appointments || !id) return null;
    return appointments.find(a =>
        String(a._id) === String(id) ||
        String(a.id) === String(id) ||
        String(a.appointmentId) === String(id)
    );
}

// Make available globally
window.findAppointmentForMessage = findAppointmentForMessage;

/**
 * Safely find a patient for messaging
 */
function findPatientForMessage(patients, id) {
    if (!patients || !id) return null;
    return patients.find(p =>
        String(p._id) === String(id) ||
        String(p.id) === String(id) ||
        String(p.patientId) === String(id)
    );
}

window.findPatientForMessage = findPatientForMessage;

/**
 * Debounce: delays fn execution until 'delay' ms after the last call.
 * Use on search inputs to avoid running O(n) filter logic on every single keystroke.
 *
 * @param {Function} fn    - The function to debounce
 * @param {number}   delay - Silence period in ms (default: 200ms)
 * @returns {Function}     - Debounced wrapper function
 *
 * @example
 *   const debouncedFilter = debounce(filterPatientDropdown, 200);
 *   searchInput.addEventListener('input', debouncedFilter);
 */
function debounce(fn, delay = 200) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * timeExecution: logs how long a function takes to run.
 * Use during development to measure render and compute speed.
 * Safe to leave in production — only logs to console.
 *
 * @param {string}   label - Name shown in the console log
 * @param {Function} fn    - Synchronous function to time
 * @returns {*}            - Whatever fn() returns
 *
 * @example
 *   timeExecution('renderTable', () => renderTodayAppointments());
 *   // Logs: ⏱ renderTable: 2.34ms
 */
function timeExecution(label, fn) {
    const t0 = performance.now();
    const result = fn();
    console.log(`\u23f1 ${label}: ${(performance.now() - t0).toFixed(2)}ms`);
    return result;
}

window.debounce = debounce;
window.timeExecution = timeExecution;
