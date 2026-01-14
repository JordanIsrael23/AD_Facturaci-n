// src/scripts/editar-cliente.ts

// --- 1. INTEGRACIÓN: Imports de autenticación ---
import { getAuthHeaders, checkAuth } from "./auth";

const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Clientes";

declare const bootstrap: any;

export async function initEditarCliente() {
    // --- 2. INTEGRACIÓN: Verificar sesión al entrar ---
    checkAuth();

    const params = new URLSearchParams(window.location.search);
    const cedula = params.get("id");
    const form = document.querySelector("form") as HTMLFormElement;

    if (!cedula) {
        window.location.href = "/clientes";
        return;
    }

    // 1. Cargar datos del cliente al iniciar
    try {
        // --- 3. INTEGRACIÓN: Añadido headers con token ---
        const response = await fetch(`${API_URL}/${cedula}`, {
            headers: getAuthHeaders() 
        });

        // --- 4. INTEGRACIÓN: Manejo de sesión expirada ---
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) throw new Error("Cliente no encontrado");

        const data = await response.json();

        // Mapear datos a los inputs (TU LÓGICA CONSERVADA)
        const setVal = (id: string, val: any) => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
            if (el) el.value = val || "";
        };

        setVal("cedula", data.cliCedula);
        (document.getElementById("cedula") as HTMLInputElement).readOnly = true; 

        setVal("cliNombre", data.cliNombre);
        // Formatear fecha para input date (YYYY-MM-DD)
        const fecha = data.cliFechaNacimiento ? data.cliFechaNacimiento.split("T")[0] : "";
        setVal("fechaNacimiento", fecha);
        
        setVal("tipoCliente", data.ticIdTipoc);
        setVal("cliTelefono", data.cliTelefono);
        setVal("email", data.cliEmail); 
        setVal("cliDireccion", data.cliDireccion);

    } catch (error) {
        console.error(error);
        mostrarErrorEnModal("Error al cargar los datos del cliente. Verifique la conexión.");
    }

    // 2. Manejar el envío del formulario (Guardar Cambios)
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        // TU LÓGICA CONSERVADA
        const getValue = (id: string) => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
            const val = el?.value.trim();
            return val === "" ? null : val;
        };

        const cliente = {
            cliCedula: cedula,
            cliNombre: getValue("cliNombre"),
            cliFechaNacimiento: getValue("fechaNacimiento"),
            ticIdTipoc: parseInt(getValue("tipoCliente") || "0"),
            cliDireccion: getValue("cliDireccion"),
            cliTelefono: getValue("cliTelefono"),
            cliEmail: getValue("email"),
            cliEstado: true 
        };

        try {
            const response = await fetch(`${API_URL}/${cedula}`, {
                method: "PUT",
                // --- 5. INTEGRACIÓN: Headers combinados (JSON + Token) ---
                headers: { 
                    "Content-Type": "application/json",
                    ...getAuthHeaders() 
                },
                body: JSON.stringify(cliente),
            });

            if (response.ok || response.status === 204) {
                // ÉXITO
                const modalEl = document.getElementById('successEditModal');
                if (modalEl) {
                    const successModal = new bootstrap.Modal(modalEl);
                    successModal.show();
                    
                    document.getElementById('btnOkEditSuccess')?.addEventListener('click', () => {
                        window.location.href = "/clientes";
                    });
                }
            } else {
                // --- 6. INTEGRACIÓN: Manejo de sesión expirada en el submit ---
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }

                // ERROR DETALLADO (TU LÓGICA CONSERVADA)
                let mensajeParaMostrar = "Ocurrió un error al actualizar el cliente.";

                const contentType = response.headers.get("content-type");
                
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    mensajeParaMostrar = errorData.detail || errorData.title || errorData.message || JSON.stringify(errorData);
                } else {
                    const errorRaw = await response.text();
                    mensajeParaMostrar = errorRaw.includes("Error:") 
                        ? errorRaw.split("Error:")[1].split("at ")[0] 
                        : errorRaw;
                }

                mostrarErrorEnModal(mensajeParaMostrar);
            }
        } catch (error) {
            console.error("Error de red:", error);
            mostrarErrorEnModal("No se pudo establecer conexión con el servidor.");
        }
    });
}

// TU LÓGICA DE MODAL CONSERVADA
function mostrarErrorEnModal(mensaje: string) {
    const msgElement = document.getElementById("errorModalMsg");
    if (msgElement) {
        msgElement.innerText = mensaje;
    }

    const errorModalEl = document.getElementById("errorModal");
    if (errorModalEl) {
        const modalError = new bootstrap.Modal(errorModalEl);
        modalError.show();
    }
}