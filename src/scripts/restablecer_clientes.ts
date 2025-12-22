const API_URL = "http://127.0.0.1:5055/api/Clientes";
let clientesInactivos: any[] = [];

declare const bootstrap: any;

export function initRestablecer() {
    loadInactiveClients();
    setupSelectAll();
    setupRestoreAction();

    document.getElementById("filtroCedula")?.addEventListener("input", aplicarFiltros);
    document.getElementById("filtroNombre")?.addEventListener("input", aplicarFiltros);
}

async function loadInactiveClients() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4">Cargando clientes inactivos...</td></tr>';

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Error al cargar clientes");
        const data = await response.json();
        clientesInactivos = (data || []).filter((c: any) => c.cliEstado === false);
        renderTabla(clientesInactivos);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error al conectar con la API.</td></tr>`;
    }
}

function renderTabla(clientes: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4">No hay clientes inactivos disponibles.</td></tr>';
        return;
    }

    tbody.innerHTML = clientes.map((c: any) => `
        <tr>
            <td class="text-center">
                <input type="checkbox" class="form-check-input client-checkbox" value="${c.cliCedula}" />
            </td>
            <td>${c.cliCedula}</td>
            <td>${c.cliNombre}</td>
            <td>${c.cliFechaNacimiento ? c.cliFechaNacimiento.split("T")[0] : "N/A"}</td>
            <td>${c.tipoCliente?.ticDescripcion || (c.ticIdTipoc === 1 ? "Contado" : "Crédito")}</td>
            <td>${c.cliDireccion || ""}</td>
            <td>${c.cliTelefono || ""}</td>
            <td>${c.cliEmail || ""}</td>
            <td><span class="badge bg-secondary">Inactivo</span></td>
        </tr>
    `).join("");
}

function aplicarFiltros() {
    const cedula = (document.getElementById("filtroCedula") as HTMLInputElement).value.toLowerCase();
    const nombre = (document.getElementById("filtroNombre") as HTMLInputElement).value.toLowerCase();
    const filtrados = clientesInactivos.filter((c) => 
        c.cliCedula.toString().includes(cedula) && c.cliNombre.toLowerCase().includes(nombre)
    );
    renderTabla(filtrados);
}

function setupSelectAll() {
    const selectAll = document.getElementById("selectAll") as HTMLInputElement;
    selectAll?.addEventListener("change", (e) => {
        const checkboxes = document.querySelectorAll(".client-checkbox");
        checkboxes.forEach((cb: any) => (cb.checked = (e.target as HTMLInputElement).checked));
    });
}

function setupRestoreAction() {
    const btnRestablecerMain = document.getElementById("btnRestablecerMain");
    const confirmRestoreBtn = document.getElementById("confirmRestoreBtn");

    // PASO 1: Al hacer click en el botón principal de la página
    btnRestablecerMain?.addEventListener("click", () => {
        const checkboxesChecked = document.querySelectorAll(".client-checkbox:checked");
        
        if (checkboxesChecked.length === 0) {
            // No hay nada seleccionado: Mostrar advertencia directamente
            const warningModal = new bootstrap.Modal(document.getElementById("warningSelectModal"));
            warningModal.show();
        } else {
            // Hay selección: Mostrar el modal de confirmación
            const confirmModal = new bootstrap.Modal(document.getElementById("confirmRestoreModal"));
            confirmModal.show();
        }
    });

    // PASO 2: Acción dentro del modal de confirmación
    confirmRestoreBtn?.addEventListener("click", async () => {
        const checkboxes = document.querySelectorAll(".client-checkbox:checked");
        const ids = Array.from(checkboxes).map((cb: any) => (cb as HTMLInputElement).value);

        try {
            const promises = ids.map((id) =>
                fetch(`${API_URL}/${id}/estado`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado: true }),
                })
            );

            await Promise.all(promises);

            // Cerrar modal de confirmación
            const confirmModalEl = document.getElementById("confirmRestoreModal");
            const confirmModal = bootstrap.Modal.getInstance(confirmModalEl);
            confirmModal?.hide();

            // Mostrar modal de éxito
            const successModal = new bootstrap.Modal(document.getElementById("successRestoreModal"));
            successModal.show();

            // Refrescar tabla
            (document.getElementById("selectAll") as HTMLInputElement).checked = false;
            loadInactiveClients();
            
        } catch (error) {
            console.error("Error al restablecer:", error);
        }
    });
}