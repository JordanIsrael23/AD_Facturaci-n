// src/scripts/crear_establecimientos.ts
const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Establecimientoes";

declare const bootstrap: any;

export function initCrearEstablecimiento() {
    const form = document.getElementById("formCrearEstablecimiento") as HTMLFormElement;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const getValue = (key: string) => {
            const val = formData.get(key)?.toString().trim();
            return val === "" ? null : val;
        };

        const establecimiento = {
            estRuc: getValue("est_ruc"),
            estNombre: getValue("est_nombre"),
            estDireccion: getValue("est_direccion"),
            estTelefono: getValue("est_telefono"),
            estEstado: (document.getElementById("est_estado") as HTMLInputElement).checked
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(establecimiento),
            });

            if (response.ok) {
                // MOSTRAR MODAL DE ÉXITO
                const modalEl = document.getElementById('successModal');
                if (modalEl) {
                    const successModal = new bootstrap.Modal(modalEl);
                    successModal.show();

                    // Configurar el botón del modal para redirigir
                    document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                        window.location.href = "/establecimientos";
                    });
                }
            } else {
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
