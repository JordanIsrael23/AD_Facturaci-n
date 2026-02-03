
// src/scripts/editar_establecimientos.ts
import { getAuthHeaders, checkAuth } from "./auth";

const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Establecimientoes";

declare const bootstrap: any;

export async function initEditarEstablecimiento() {
    checkAuth();
    const params = new URLSearchParams(window.location.search);
    const ruc = params.get("id");
    const form = document.querySelector("form") as HTMLFormElement;

    if (!ruc) {
        window.location.href = "/establecimientos";
        return;
    }

    // 1. Cargar datos del establecimiento al iniciar
    try {
        const response = await fetch(`${API_URL}/${ruc}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error("Establecimiento no encontrado");
        }

        const data = await response.json();

        // Mapear datos a los inputs
        const inputRuc = document.getElementById("ruc") as HTMLInputElement;
        inputRuc.value = data.estRuc || "";
        inputRuc.readOnly = true; // El RUC es PK, no se edita

        (document.getElementById("nombre") as HTMLInputElement).value = data.estNombre || "";
        (document.getElementById("direccion") as HTMLInputElement).value = data.estDireccion || "";
        (document.getElementById("telefono") as HTMLInputElement).value = data.estTelefono || "";

    } catch (error) {
        console.error(error);
        mostrarModal("errorModal", "Error al cargar los datos del establecimiento.");
    }

    // 2. Manejar el envío del formulario (Guardar)
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const establecimiento = {
            estRuc: ruc,
            estNombre: (document.getElementById("nombre") as HTMLInputElement).value,
            estDireccion: (document.getElementById("direccion") as HTMLInputElement).value || null,
            estTelefono: (document.getElementById("telefono") as HTMLInputElement).value || null,
            estEstado: true
        };

        try {
            const response = await fetch(`${API_URL}/${ruc}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(establecimiento),
            });

            if (response.ok || response.status === 204) {
                mostrarModal("successEditModal");

                document.getElementById('btnOkEditSuccess')?.addEventListener('click', () => {
                    window.location.href = "/establecimientos";
                });
            } else {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error("Error en la actualización");
            }
        } catch (e) {
            mostrarModal("errorModal", "No se pudo actualizar el establecimiento. Intente más tarde.");
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
