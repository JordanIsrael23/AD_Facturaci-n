const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Clientes";

declare const bootstrap: any;

export async function initEditarCliente() {
    const params = new URLSearchParams(window.location.search);
    const cedula = params.get("id");
    const form = document.querySelector("form") as HTMLFormElement;

    if (!cedula) {
        window.location.href = "/clientes";
        return;
    }

    // 1. Cargar datos del cliente al iniciar
    try {
        const response = await fetch(`${API_URL}/${cedula}`);
        if (!response.ok) throw new Error("Cliente no encontrado");

        const data = await response.json();

        // Mapear datos a los inputs
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
        setVal("email", data.cliEmail); // Aseguramos que se cargue el email
        setVal("cliDireccion", data.cliDireccion);

    } catch (error) {
        console.error(error);
        mostrarErrorEnModal("Error al cargar los datos del cliente. Verifique la conexión.");
    }

    // 2. Manejar el envío del formulario (Guardar Cambios)
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Función auxiliar para obtener valor o null (igual que en crear)
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
            cliEmail: getValue("email"), // Aquí enviamos el email igual que en crear
            cliEstado: true // Asumimos que al editar se mantiene activo, o podrías agregar un checkbox si quisieras
        };

        try {
            const response = await fetch(`${API_URL}/${cedula}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
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
                // ERROR DETALLADO (Lógica copiada de crear-cliente.ts)
                let mensajeParaMostrar = "Ocurrió un error al actualizar el cliente.";

                // Intentamos determinar si la respuesta es JSON
                const contentType = response.headers.get("content-type");
                
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    // Extraemos el mensaje según formato estándar .NET
                    mensajeParaMostrar = errorData.detail || errorData.title || errorData.message || JSON.stringify(errorData);
                } else {
                    // Si es texto plano (ej. errores de SQL directos)
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

// Función auxiliar unificada para mostrar el error en el modal
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