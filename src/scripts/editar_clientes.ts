
// src/scripts/editar-cliente.ts
import { getAuthHeaders, checkAuth, registrarAuditoria } from "./auth";

const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Clientes";

declare const bootstrap: any;

export async function initEditarCliente() {
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
        const response = await fetch(`${API_URL}/${cedula}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert(`Error 401 en CARGAR EDITOR CLIENTE.\nAPI URL: ${API_URL}\nTu token no es válido para este backend.`);
                window.location.href = '/login';
                return;
            }
            throw new Error("Cliente no encontrado");
        }

        const data = await response.json();

        // Mapear datos a los inputs
        const inputCedula = document.getElementById("cedula") as HTMLInputElement;
        inputCedula.value = data.cliCedula || "";
        inputCedula.readOnly = true; // La cédula no se edita por ser PK

        (document.getElementById("cliNombre") as HTMLInputElement).value = data.cliNombre || "";
        (document.getElementById("fechaNacimiento") as HTMLInputElement).value = data.cliFechaNacimiento ? data.cliFechaNacimiento.split("T")[0] : "";
        (document.getElementById("tipoCliente") as HTMLSelectElement).value = data.ticIdTipoc?.toString() || "";
        (document.getElementById("cliTelefono") as HTMLInputElement).value = data.cliTelefono || "";
        (document.getElementById("email") as HTMLInputElement).value = data.cliEmail || "";
        (document.getElementById("cliDireccion") as HTMLInputElement).value = data.cliDireccion || "";

    } catch (error) {
        console.error(error);
        mostrarModal("errorModal", "Error al cargar los datos del cliente.");
    }

    // 2. Manejar el envío del formulario (Guardar)
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const cliente = {
            cliCedula: cedula,
            cliNombre: (document.getElementById("cliNombre") as HTMLInputElement).value,
            cliFechaNacimiento: (document.getElementById("fechaNacimiento") as HTMLInputElement).value || null,
            ticIdTipoc: parseInt((document.getElementById("tipoCliente") as HTMLSelectElement).value || "0"),
            cliDireccion: (document.getElementById("cliDireccion") as HTMLInputElement).value || null,
            cliTelefono: (document.getElementById("cliTelefono") as HTMLInputElement).value || null,
            cliEmail: (document.getElementById("email") as HTMLInputElement).value || null,
            cliEstado: true
        };

        try {
            const response = await fetch(`${API_URL}/${cedula}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(cliente),
            });

            if (response.ok || response.status === 204) {
                await registrarAuditoria(
                    'Editar Clientes',
                    'UPDATE',
                    `Se editó el cliente: ${cliente.cliNombre}`,
                    `Cédula: ${cliente.cliCedula}`
                ).catch(err => console.warn('Error en auditoría:', err));

                mostrarModal("successEditModal");

                document.getElementById('btnOkEditSuccess')?.addEventListener('click', () => {
                    window.location.href = "/clientes";
                });
            } else {
                if (response.status === 401) {
                    alert(`Error 401 en GUARDAR EDICION CLIENTE.\nAPI URL: ${API_URL}\nTu token no es válido para este backend.`);
                    window.location.href = '/login';
                    return;
                }

                // MANEJO INTELIGENTE DE ERRORES (IGUAL QUE EN CREAR CLIENTE)
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

                mostrarModal("errorModal", mensajeParaMostrar);
            }
        } catch (e: any) { // Type 'any' to safely access .message
            console.error("Error de red:", e);
            mostrarModal("errorModal", "No se pudo establecer conexión con el servidor o ocurrió un error inesperado.");
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