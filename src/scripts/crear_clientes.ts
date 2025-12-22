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
                const successModal = new bootstrap.Modal(modalEl);
                successModal.show();

                // Configurar el botón del modal para redirigir
                document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                    window.location.href = "/clientes";
                });
            } else {
                const errorText = await response.text();
                alert("Error al crear cliente: " + errorText);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión con la API");
        }
    });
}