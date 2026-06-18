// Resolve API base URL — core.js is not loaded in the Electron login popup.
const API_BASE = (window.PAKTEETH_CONFIG && window.PAKTEETH_CONFIG.serverBaseURL)
    ? window.PAKTEETH_CONFIG.serverBaseURL
    : (localStorage.getItem("PAKTEETH_BACKEND_URL") || window.SERVER_BASE_URL || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3000'));

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const togglePwdBtn = document.getElementById("togglePwd");
    const eyeOn = togglePwdBtn.querySelector(".eye-on");
    const eyeOff = togglePwdBtn.querySelector(".eye-off");
    const loginError = document.getElementById("loginError");

    const showError = (msg) => {
        loginError.textContent = msg;
        loginError.style.display = "block";
    };

    const hideError = () => {
        loginError.style.display = "none";
    };

    togglePwdBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";

        // Toggle SVGs robustly
        if (eyeOn) eyeOn.style.display = isPassword ? "none" : "block";
        if (eyeOff) eyeOff.style.display = isPassword ? "block" : "none";
    });

    // Prevent SVGs from swallowing clicks
    if (eyeOn) eyeOn.style.pointerEvents = "none";
    if (eyeOff) eyeOff.style.pointerEvents = "none";

    emailInput.addEventListener("input", hideError);
    passwordInput.addEventListener("input", hideError);

    const DEV_USER = {
        email: "developer@pakteeth.com",
        password: "developerpakteeth"
    };

    const ADMIN_USER = {
        email: "admin@pakteeth.com",
        password: "adminpakteeth"
    };

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError();

        const submitBtn = loginForm.querySelector(".btn-submit");
        const originalBtnText = submitBtn.textContent;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showError("Please fill in both email and password.");
            return;
        }

        // Visual feedback
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying...";
        submitBtn.style.opacity = "0.7";

        const isDev = email.toLowerCase() === DEV_USER.email && password === DEV_USER.password;
        const isAdmin = email.toLowerCase() === ADMIN_USER.email && password === ADMIN_USER.password;

        if (isDev || isAdmin) {
            const roleName = isDev ? "Developer Admin" : "Super Admin";
            const userEmail = isDev ? DEV_USER.email : ADMIN_USER.email;

            const user = {
                email: userEmail,
                name: roleName,
                role: "admin",
                permissions: ["dashboard", "patients", "appointments", "doctors", "encounters", "prescriptions", "billing", "inventory", "analytics", "settings", "capital"]
            };
            handleLoginSuccess(user, "dev");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    handleLoginSuccess(data.user, "loggedIn");
                } else {
                    showError(data.message || "Invalid credentials.");
                    resetBtn();
                }
            } else {
                const data = await res.json();
                showError(data.message || "Invalid credentials.");
                resetBtn();
            }
        } catch (err) {
            showError("Cannot connect to server. Please ensure services are running.");
            resetBtn();
        }

        function resetBtn() {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            submitBtn.style.opacity = "1";
        }
    });

    function handleLoginSuccess(user, token) {
        // Store in localStorage for the popup (shares origin)
        localStorage.setItem("authToken", token);
        localStorage.setItem("currentUser", JSON.stringify(user));

        const submitBtn = loginForm.querySelector(".btn-submit");
        submitBtn.textContent = "Access Granted";
        submitBtn.style.background = "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)";

        setTimeout(() => {
            // Notify Electron that login was successful
            if (window.__pakteeth__ && window.__pakteeth__.loginSuccess) {
                window.__pakteeth__.loginSuccess(user);
            } else {
                // Fallback for browser testing
                window.location.href = "../dashboard/dashboard.html";
            }
        }, 800);
    }


    loginForm.reset();
});
