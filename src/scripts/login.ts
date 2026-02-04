// src/scripts/login.ts

let API_BASE_URL = import.meta.env.PUBLIC_LOGIN_URL;
console.log("Configured API_BASE_URL:", API_BASE_URL);

// WORKAROUND CORS: Si estamos en localhost O en Amplify, usamos el proxy
if (typeof window !== "undefined" && (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("amplifyapp.com")
)) {
    console.log("⚠️ Entorno Proxy detectado: Usando Proxy /security-proxy para evitar bloqueo CORS.");
    API_BASE_URL = "/security-proxy";
} else {
    // Validar solo si no estamos en modo proxy
    if (!API_BASE_URL) {
        console.error("ERROR CRÍTICO: PUBLIC_LOGIN_URL no está definido en las variables de entorno.");
        alert("Configuration Error: PUBLIC_LOGIN_URL is missing.");
    }
}

const LOGIN_URL = `${API_BASE_URL}/api/login`;
const MODULO_ID = 5; // 🔴 CAMBIA ESTE ID POR EL QUE TE ASIGNARON

export function initLogin() {
    console.log("Inicializando Login...");

    // Verificar si ya está autenticado y redirigir
    const existingToken = localStorage.getItem("access_token");
    const path = window.location.pathname.replace(/\/$/, "");
    if (existingToken && path === "/login") {
        console.log("Usuario ya autenticado, redirigiendo...");
        window.location.href = "/";
        return;
    }

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
            modulo_id: MODULO_ID
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

            // Guardar datos en localStorage
            localStorage.setItem("access_token", token);
            localStorage.setItem("user_data", JSON.stringify(user));
            localStorage.setItem("modulo_data", JSON.stringify(modulo));

            console.log("✅ Login exitoso:", {
                username: user.username,
                email: user.email,
                funciones: modulo.funciones.map((f: any) => f.nombre)
            });

            // Registrar auditoría de login (si tiene permisos)
            try {
                await registrarLoginAuditoria(token, modulo.funciones);
            } catch (audError) {
                console.warn("No se pudo registrar auditoría de login:", audError);
            }

            showSuccess(`¡Bienvenido, ${user.username}! Redirigiendo...`, () => {
                // Redirigir al home o dashboard
                window.location.href = "/";
            });

        } else {
            // ERROR DE LOGIN
            let errorMsg = data.message || "Error desconocido al iniciar sesión.";

            // Personalizar mensajes según código de error
            if (response.status === 400) {
                if (data.message?.includes("dominio")) {
                    errorMsg = "Debes usar un correo institucional @utn.edu.ec";
                } else {
                    errorMsg = "Verifica que todos los campos estén completos.";
                }
            } else if (response.status === 401) {
                errorMsg = "Credenciales incorrectas. Verifica tu usuario y contraseña.";
            } else if (response.status === 403) {
                if (data.message?.includes("inactivo")) {
                    errorMsg = "Tu usuario está inactivo. Contacta al administrador.";
                } else {
                    errorMsg = "No tienes permisos para acceder a este módulo.";
                }
            } else if (response.status === 404) {
                errorMsg = "El módulo no está disponible. Contacta a soporte.";
            }

            if (data.detail) {
                errorMsg += ` (${data.detail})`;
            }

            showError(errorMsg);
            console.error("Error de login:", { status: response.status, message: errorMsg });
        }

    } catch (error: any) {
        console.error("Error catch:", error);
        showError("No se pudo conectar con el servidor de seguridad. Intenta más tarde.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Registrar auditoría de login
async function registrarLoginAuditoria(token: string, funciones: any[]) {
    // Buscar una función válida para registrar la auditoría
    // Priorizamos funciones relacionadas con auditoría o la primera disponible
    let funcionId = null;

    const funcionAuditoria = funciones.find(f =>
        f.nombre.toLowerCase().includes('auditoria') ||
        f.nombre.toLowerCase().includes('auditoría')
    );

    if (funcionAuditoria) {
        funcionId = funcionAuditoria.funcion_id;
    } else if (funciones.length > 0) {
        funcionId = funciones[0].funcion_id;
    }

    if (!funcionId) {
        console.warn("No hay funciones disponibles para registrar auditoría");
        return;
    }

    try {
        const ip = await getUserIP();
        const response = await fetch(`${API_BASE_URL}/api/auditoria`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id_funcion: funcionId,
                accion: 'LOGIN',
                descripcion: 'Usuario inició sesión en el sistema',
                observacion: `Acceso al módulo de Facturación desde ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'navegador'}`,
                ip_usuario: ip
            })
        });

        if (response.ok) {
            console.log("✅ Auditoría de login registrada");
        }
    } catch (error) {
        console.warn("Error registrando auditoría:", error);
    }
}

// Obtener IP del usuario
async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '0.0.0.0';
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
        // Scroll to alert
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
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