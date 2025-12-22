// src/scripts/editar-cliente.ts
//const API_URL = "http://127.0.0.1:5055/api/Clientes"; URL para pruebas locales 
const API_URL = "http://100.52.136.213:5000/api/Clientes";  // URL de AWS Cuenta DM 

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cliente),
            });

            if (response.ok || response.status === 204) {
                mostrarModal("successEditModal");
                
                document.getElementById('btnOkEditSuccess')?.addEventListener('click', () => {
                    window.location.href = "/clientes";
                });
            } else {
                throw new Error("Error en la actualización");
            }
        } catch (e) {
            mostrarModal("errorModal", "No se pudo actualizar el cliente. Intente más tarde.");
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