// Resolve the API base URL independently — core.js is not loaded on the login page.
// Priority: Electron config injection → SERVER_BASE_URL set by socket-client → origin fallback
const API_BASE = (window.PAKTEETH_CONFIG && window.PAKTEETH_CONFIG.serverBaseURL)
    ? window.PAKTEETH_CONFIG.serverBaseURL
    : (localStorage.getItem("PAKTEETH_BACKEND_URL") || window.SERVER_BASE_URL || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3000'));

document.addEventListener("DOMContentLoaded", () => {
    const electronControls = document.getElementById("electron-controls");
    const browserLoginContainer = document.getElementById("browser-login-container");
    const isElectron = !!(window.__pakteeth__ && window.__pakteeth__.openLoginWindow);

    if (isElectron) {
        // --- ELECTRON MODE ---
        electronControls.style.display = "flex";
        browserLoginContainer.style.display = "none";

        const openLoginBtn = document.getElementById("openLoginBtn");
        openLoginBtn.addEventListener("click", () => {
            // Reveal the embedded login UI
            browserLoginContainer.style.display = "flex";
            // Hide the trigger button
            openLoginBtn.style.display = "none";
        });

        // Initialize embedded logic so the form works locally in Electron mode
        initializeEmbeddedLogin();

        window.__pakteeth__.onAuthComplete((user) => {
            console.log("Login successful via popup, sync session...", user);
            // Sync session to this origin's local storage
            localStorage.setItem("authToken", "dev-popup");
            localStorage.setItem("currentUser", JSON.stringify(user));
            
            // Redirect to dashboard
            window.location.href = "pages/dashboard/dashboard.html";
        });

    } else {
        // --- BROWSER MODE ---
        electronControls.style.display = "none";
        browserLoginContainer.style.display = "block";
        initializeEmbeddedLogin();
    }

    function initializeEmbeddedLogin() {
        const loginForm = document.getElementById("loginForm");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const togglePwdBtn = document.getElementById("togglePwd");
        const eyeOn = togglePwdBtn.querySelector(".eye-on");
        const eyeOff = togglePwdBtn.querySelector(".eye-off");
        const loginError = document.getElementById("loginError");

        togglePwdBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            
            if (eyeOn) {
                eyeOn.style.display = isPassword ? "none" : "inline";
                eyeOn.style.pointerEvents = "none";
            }
            if (eyeOff) {
                eyeOff.style.display = isPassword ? "inline" : "none";
                eyeOff.style.pointerEvents = "none";
            }
        });

        const showError = (msg) => {
            loginError.textContent = msg;
            loginError.style.display = "block";
        };

        const hideError = () => {
            loginError.style.display = "none";
        };

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
                showError("Cannot connect to server. Ensure local services are running.");
                resetBtn();
            }

            function resetBtn() {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                submitBtn.style.opacity = "1";
            }
        });

        function handleLoginSuccess(user, token) {
            localStorage.setItem("authToken", token);
            localStorage.setItem("currentUser", JSON.stringify(user));

            const submitBtn = loginForm.querySelector(".btn-submit");
            submitBtn.textContent = "Access Granted";
            submitBtn.style.background = "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)";

            setTimeout(() => {
                window.location.href = "pages/dashboard/dashboard.html";
            }, 800);
        }
    }
});
