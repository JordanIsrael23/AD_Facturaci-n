let API_BASE_URL = import.meta.env.PUBLIC_LOGIN_URL;
console.log("Configured API_BASE_URL:", API_BASE_URL);

// WORKAROUND CORS: Si estamos en localhost, usamos el proxy configurado en astro.config.mjs
if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    console.log("⚠️ Entorno Local detectado: Usando Proxy /security-proxy para evitar bloqueo CORS.");
    API_BASE_URL = "/security-proxy";
} else {
    // Validar solo si no estamos en modo proxy
    if (!API_BASE_URL) {
        console.error("ERROR CRÍTICO: PUBLIC_LOGIN_URL no está definido en las variables de entorno.");
        alert("Configuration Error: PUBLIC_LOGIN_URL is missing.");
    }
}

const LOGIN_URL = `${API_BASE_URL}/api/login`;

export function initLogin() {
    console.log("Inicializando Login...");
    const form = document.getElementById("loginForm") as HTMLFormElement;
    if (form) {
        form.addEventListener("submit", handleLogin);
    }
}

async function handleLogin(e: Event) {
    e.preventDefault();
    console.log("Intentando iniciar sesión...");

    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById("password") as HTMLInputElement;
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const modulo_id = 5;

    if (!email || !password) {
        showError("Por favor, completa todos los campos.");
        return;
    }

    const submitBtn = document.getElementById("btnSubmit") as HTMLButtonElement;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Autenticando...';

    // Limpiar alertas previas
    hideAlerts();

    try {
        const payload = {
            email_username: email,
            password: password,
            modulo_id: modulo_id
        };
        console.log("Enviando payload:", payload);

        const response = await fetch(LOGIN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // Intentar parsear respuesta
        let data;
        try {
            data = await response.json();
            console.log("Respuesta del servidor:", data);
        } catch (err) {
            console.error("Error parseando JSON:", err);
            throw new Error("Respuesta inválida del servidor");
        }

        if (response.ok && data.success) {
            // LOGIN EXITOSO
            const token = data.data.access_token;
            const user = data.data.user;
            const modulo = data.data.modulo;

            localStorage.setItem("access_token", token);
            localStorage.setItem("user_data", JSON.stringify(user));
            localStorage.setItem("modulo_data", JSON.stringify(modulo));

            showSuccess(`¡Bienvenido, ${user.username}! Redirigiendo...`, () => {
                // Redirigir al home o dashboard
                window.location.href = "/";
            });

        } else {
            // ERROR DE LOGIN
            // 400: Todos los campos son requeridos / Email incorrecto dominio
            // 401: Credenciales inválidas
            // 403: Usuario inactivo
            // 404: Módulo no existe
            let errorMsg = data.message || "Error desconocido al iniciar sesión.";

            // Personalizar mensajes si es necesario
            if (response.status === 401) {
                errorMsg = "Credenciales incorrectas. Verifica tu usuario y contraseña.";
            }

            if (data.detail) {
                errorMsg += ` (${data.detail})`;
            }

            showError(errorMsg);
        }

    } catch (error: any) {
        console.error("Error catch:", error);
        showError("No se pudo conectar con el servidor de seguridad. Intenta más tarde.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

function hideAlerts() {
    const errorAlert = document.getElementById("loginErrorAlert");
    const successAlert = document.getElementById("loginSuccessAlert");
    if (errorAlert) errorAlert.classList.add("d-none");
    if (successAlert) successAlert.classList.add("d-none");
}

function showError(msg: string) {
    const errorAlert = document.getElementById("loginErrorAlert");
    if (errorAlert) {
        errorAlert.innerText = msg;
        errorAlert.classList.remove("d-none");
        // Shake animation effect optional
    } else {
        alert(msg);
    }
}

function showSuccess(msg: string, callback?: () => void) {
    const successAlert = document.getElementById("loginSuccessAlert");
    if (successAlert) {
        successAlert.innerText = msg;
        successAlert.classList.remove("d-none");
    }

    if (callback) {
        setTimeout(callback, 2000);
    }
}
