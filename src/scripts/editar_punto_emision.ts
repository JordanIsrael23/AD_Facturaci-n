
// src/scripts/editar_punto_emision.ts
import { getAuthHeaders, checkAuth } from "./auth";

const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "PuntoEmisions";
const ESTABLECIMIENTOS_URL = import.meta.env.PUBLIC_BACKEND_URL + "Establecimientoes";

declare const bootstrap: any;

export async function initEditarPuntoEmision() {
    checkAuth();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id"); // ID numérico 'pemId'
    const form = document.querySelector("form") as HTMLFormElement;

    if (!id) {
        window.location.href = "/puntos-emision";
        return;
    }

    try {
        // 1. Cargar Establecimientos primero (para el combo)
        await loadEstablecimientosCombo();

        // 2. Cargar datos del punto
        const response = await fetch(`${API_URL}/${id}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error("Punto de emisión no encontrado");
        }

        const data = await response.json();

        // Mapear datos
        const inputId = document.getElementById("pemId") as HTMLInputElement;
        if (inputId) inputId.value = data.pemId;

        (document.getElementById("pemCodigo") as HTMLInputElement).value = data.pemIdPuntoEmision || "";
        (document.getElementById("estRuc") as HTMLSelectElement).value = data.estRuc || "";
        (document.getElementById("pemDescripcion") as HTMLInputElement).value = data.pemDescripcion || "";


    } catch (error) {
        console.error(error);
        mostrarModal("errorModal", "Error al cargar los datos del punto de emisión.");
    }

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const punto = {
            pemId: parseInt(id),
            pemIdPuntoEmision: (document.getElementById("pemCodigo") as HTMLInputElement).value,
            estRuc: (document.getElementById("estRuc") as HTMLSelectElement).value,
            pemDescripcion: (document.getElementById("pemDescripcion") as HTMLInputElement).value,
            pemEstado: true // Se mantiene activo al editar
        };

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(punto),
            });

            if (response.ok || response.status === 204) {
                mostrarModal("successEditModal");
                document.getElementById('btnOkEditSuccess')?.addEventListener('click', () => {
                    window.location.href = "/puntos-emision";
                });
            } else {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error("Error en la actualización");
            }
        } catch (e) {
            mostrarModal("errorModal", "No se pudo actualizar el registro. Intente más tarde.");
        }
    });
}

function mostrarModal(modalId: string, mensaje?: string) {
    if (mensaje) {
        const msgElement = document.querySelector(`#${modalId} .modal-body p`);
        if (msgElement) msgElement.textContent = mensaje;
    }
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
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
                options += `<option value="${est.estRuc}">${est.estNombre} (${est.estRuc})</option>`;
            });
            select.innerHTML = options;
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (err) {
        console.error("Error cargando establecimientos", err);
    }
}
