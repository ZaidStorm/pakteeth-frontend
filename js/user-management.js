/**
 * User Management & RBAC Logic - Role-Based Access Control
 * Updated to use MongoDB API
 */

// ====== MODULE LIST ======
// id matches the filename (without .html) as expected by APP.updateNavigationLocks
const MODULES_LIST = [
    { id: "dashboard", label: "Dashboard" },
    { id: "patient-dashboard", label: "Patients Directory" },
    { id: "patient-profile", label: "Patient Profile" },
    { id: "appointments", label: "Appointments" },
    { id: "doctors", label: "Staff (Doctors)" },
    { id: "billing", label: "Billing" },
    { id: "prescriptions", label: "Prescriptions" },
    { id: "reports", label: "Reports" },
    { id: "dental-chart", label: "Dental Chart" },
    { id: "analytics", label: "Analytics" },
    { id: "capital-summary", label: "Capital Summary" },
    { id: "settings", label: "General Settings" }
];

// ====== INPUT VALIDATION ======
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validateName(name) {
    return name && name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
}

function sanitizeInput(input) {
    return input.trim().replace(/[<>]/g, '');
}

// ====== STATE ======
let currentUserEditId = null;

// ====== INITIALIZATION ======
document.addEventListener("DOMContentLoaded", () => {
    APP.initCurrentUser();
    APP.ensureAuth();

    const currentUser = APP.currentUser;
    if (!currentUser) {
        Toast.error("User not logged in. Redirecting...");
        setTimeout(() => window.location.href = "/index.html", 1000);
        return;
    }

    // Role bypass for super admin
    const permissions = currentUser.permissions || [];
    if (currentUser.email !== "user@pakteeth.com" && currentUser.email !== "admin@pakteeth.com" && !permissions.includes("settings")) {
        Toast.error("Super Admin / Settings access required.");
        setTimeout(() => window.location.href = "../dashboard/dashboard.html", 1500);
        return;
    }

    // Populate permissions checkboxes
    const grid = document.getElementById("permissionsGrid");
    if (grid) {
        grid.innerHTML = MODULES_LIST.map(mod => `
            <label class="perm-item">
                <input type="checkbox" name="permissions" value="${mod.id}">
                <span>${mod.label}</span>
            </label>
        `).join("");
    }

    renderUsers();
});

// ====== USER LIST RENDERING ======
async function renderUsers() {
    try {
        const tbody = document.querySelector("#usersTable tbody");
        if (!tbody) return;

        const usersList = await APP.api.get("/users");

        // Filter out super admins if desired
        const displayUsers = usersList.filter(u => u.email !== 'user@pakteeth.com' && u.email !== 'admin@pakteeth.com');

        if (displayUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No staff users created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = displayUsers.map(u => {
            const perms = Array.isArray(u.permissions) ? u.permissions : [];
            const labels = perms.map(p => {
                const mod = MODULES_LIST.find(m => m.id === p);
                return mod ? mod.label : p;
            });

            return `
            <tr>
                <td style="font-weight:600;">${u.name || "N/A"}</td>
                <td>${u.email}</td>
                <td style="font-size:0.85rem; color:var(--text-muted);">${labels.join(', ') || "<i>No access</i>"}</td>
                <td>
                    <div style="display:flex; gap: 8px;">
                        <button class="btn btn-sm btn-warning-outline" onclick="editUser('${u._id}')" title="Edit Permissions">Edit</button>
                        <button class="btn btn-sm btn-danger-outline" onclick="deleteUser('${u._id}')" title="Delete User">Delete</button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Failed to render users:", err);
        Toast.error("Failed to load users");
    }
}

// ====== USER MODAL HANDLING ======
function openUserModal() {
    currentUserEditId = null;
    document.getElementById("modalTitle").innerText = "Create New User";
    document.getElementById("userForm").reset();
    document.getElementById("u_id").value = "";
    Modal.open("userModal");
}

async function editUser(id) {
    try {
        const user = await APP.api.get(`/users/${id}`);
        if (!user) return;

        currentUserEditId = id;
        document.getElementById("modalTitle").innerText = "Edit User";
        document.getElementById("u_id").value = user._id;
        document.getElementById("u_name").value = user.name || "";
        document.getElementById("u_email").value = user.email || "";
        document.getElementById("u_password").value = ""; // Don't show password

        const perms = Array.isArray(user.permissions) ? user.permissions : [];
        const checkboxes = document.querySelectorAll('input[name="permissions"]');
        checkboxes.forEach(cb => {
            cb.checked = perms.includes(cb.value);
        });

        Modal.open("userModal");
    } catch (err) {
        console.error("Failed to load user details:", err);
        Toast.error("Failed to load user details");
    }
}

async function saveUser() {
    const id = document.getElementById("u_id").value;
    const name = sanitizeInput(document.getElementById("u_name").value);
    const email = sanitizeInput(document.getElementById("u_email").value);
    const password = document.getElementById("u_password").value;

    if (!name || !validateName(name)) {
        Toast.error("Valid name required (min 2 letters).");
        return;
    }

    if (!email || !validateEmail(email)) {
        Toast.error("Valid email required.");
        return;
    }

    if (!id && (!password || !validatePassword(password))) {
        Toast.error("Password must be at least 6 characters for new users.");
        return;
    }

    const checkboxes = document.querySelectorAll('input[name="permissions"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);

    const userData = { name, email, permissions };
    if (password) userData.password = password;

    try {
        if (id) {
            await APP.api.put(`/users/${id}`, userData);
            Toast.success("User updated successfully");
        } else {
            await APP.api.post("/users", userData);
            Toast.success("New user created");
        }

        Modal.close("userModal");
        renderUsers();
        if (APP.updateNavigationLocks) APP.updateNavigationLocks();
    } catch (err) {
        console.error("Failed to save user:", err);
        Toast.error("Error saving user: " + (err.message || "Unknown error"));
    }
}

async function deleteUser(id) {
    const ok = await Confirm.show("Are you sure you want to delete this user?");
    if (!ok) return;

    try {
        await APP.api.delete(`/users/${id}`);
        Toast.success("User deleted");
        renderUsers();
        if (APP.updateNavigationLocks) APP.updateNavigationLocks();
    } catch (err) {
        console.error("Failed to delete user:", err);
        Toast.error("Failed to delete user");
    }
}
