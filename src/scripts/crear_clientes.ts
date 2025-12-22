// src/scripts/crear-cliente.ts
const API_URL = "http://127.0.0.1:5055/api/Clientes";

declare const bootstrap: any;

export function initCrearCliente() {
    const form = document.getElementById("formCrearCliente") as HTMLFormElement;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const getValue = (key: string) => {
            const val = formData.get(key)?.toString().trim();
            return val === "" ? null : val;
        };

        const cliente = {
            cliCedula: getValue("cli_cedula"),
            cliNombre: getValue("cli_nombre"),
            cliFechaNacimiento: getValue("cli_fecha_nacimiento"),
            ticIdTipoc: parseInt(getValue("tic_id_tipoc") || "0"),
            cliDireccion: getValue("cli_direccion"),
            cliTelefono: getValue("cli_telefono"),
            cliEmail: getValue("cli_email"),
            cliEstado: (document.getElementById("cli_estado") as HTMLInputElement).checked,
            cliFechaCreacion: new Date().toISOString()
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cliente),
            });

            if (response.ok) {
                // MOSTRAR MODAL DE ÉXITO
                const modalEl = document.getElementById('successModal');
                if (modalEl) {
                    const successModal = new bootstrap.Modal(modalEl);
                    successModal.show();

                    // Configurar el botón del modal para redirigir
                    document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                        window.location.href = "/clientes";
                    });
                }
            } else {
                // MANEJO INTELIGENTE DE ERRORES (JSON O TEXTO)
                let mensajeParaMostrar = "Ocurrió un error al procesar la solicitud.";

                // Intentamos determinar si la respuesta es JSON por el encabezado
                const contentType = response.headers.get("content-type");
                
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    // Extraemos el mensaje según el formato estándar de .NET (Problem Details)
                    mensajeParaMostrar = errorData.detail || errorData.title || errorData.message || JSON.stringify(errorData);
                } else {
                    // Si es texto plano (como los errores directos de SQL/Triggers)
                    const errorRaw = await response.text();
                    mensajeParaMostrar = errorRaw.includes("Error:") 
                        ? errorRaw.split("Error:")[1].split("at ")[0] 
                        : errorRaw;
                }

                mostrarErrorEnModal(mensajeParaMostrar);
            }
        } catch (error) {
            console.error("Error de red:", error);
            mostrarErrorEnModal("No se pudo establecer conexión con el servidor. Verifique si la API está en ejecución.");
        }
    });

    // FUNCIÓN AUXILIAR PARA MOSTRAR EL MODAL DE ERROR
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