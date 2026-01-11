
// src/scripts/crear_punto_emision.ts
import { getAuthHeaders, checkAuth } from "./auth";

const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "PuntoEmisions";
const ESTABLECIMIENTOS_URL = import.meta.env.PUBLIC_BACKEND_URL + "Establecimientoes";

declare const bootstrap: any;

export function initCrearPuntoEmision() {
    checkAuth();
    loadEstablecimientosCombo();

    const form = document.getElementById("formCrearPunto") as HTMLFormElement;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const getValue = (key: string) => {
            const val = formData.get(key)?.toString().trim();
            return val === "" ? null : val;
        };

        const punto = {
            pemId: 0, // Generalmente ignorable al crear
            pemIdPuntoEmision: getValue("pem_codigo"),
            estRuc: getValue("est_ruc"),
            pemDescripcion: getValue("pem_descripcion"),
            pemEstado: (document.getElementById("pem_estado") as HTMLInputElement).checked
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(punto),
            });

            if (response.ok) {
                const modalEl = document.getElementById('successModal');
                if (modalEl) {
                    const successModal = new bootstrap.Modal(modalEl);
                    successModal.show();
                    // Configurar el botón del modal para redirigir
                    document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                        window.location.href = "/puntos-emision"; // Corregida URL de redirección
                    });
                }
            } else {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }

                let mensajeParaMostrar = "Ocurrió un error al procesar la solicitud.";
                const contentType = response.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    mensajeParaMostrar = errorData.detail || errorData.title || errorData.message || JSON.stringify(errorData);
                } else {
                    const errorRaw = await response.text();
                    mensajeParaMostrar = errorRaw;
                }
                mostrarErrorEnModal(mensajeParaMostrar);
            }
        } catch (error) {
            console.error("Error de red:", error);
            mostrarErrorEnModal("No se pudo establecer conexión con el servidor.");
        }
    });

    function mostrarErrorEnModal(mensaje: string) {
        const msgElement = document.getElementById("errorModalMsg");
        if (msgElement) {
            msgElement.innerText = mensaje;
        }

        const errorModalEl = document.getElementById("errorModal");
        if (errorModalEl) {
            // @ts-ignore
            const modalError = new bootstrap.Modal(errorModalEl);
            modalError.show();
        }
    }
}

async function loadEstablecimientosCombo() {
    const select = document.getElementById("estRuc") as HTMLSelectElement;
    if (!select) return;

    try {
        const response = await fetch(ESTABLECIMIENTOS_URL, {
            headers: getAuthHeaders()
        });
        if (response.ok) {
            const data = await response.json();
            const lista = Array.isArray(data) ? data : (data.data || []);

            let options = '<option value="">Seleccione Establecimiento...</option>';
            lista.forEach((est: any) => {
                // Solo mostrar activos
                if (est.estEstado) {
                    options += `<option value="${est.estRuc}">${est.estNombre} (${est.estRuc})</option>`;
                }
            });
            select.innerHTML = options;
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (err) {
        console.error("Error cargando establecimientos", err);
        select.innerHTML = '<option value="">Error al cargar datos</option>';
    }
}
