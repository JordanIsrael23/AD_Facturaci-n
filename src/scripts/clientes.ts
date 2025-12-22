// src/scripts/clientes.ts

// Definimos la URL de la API
const API_URL = "http://127.0.0.1:5055/api/Clientes";
let clienteIdToDelete: string | null = null;
let clientesData: any[] = [];
let hayFiltros = false;


// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initClientes() {
    loadClientes();
    setupDeleteModal();

    document
        .getElementById("filtroCedula")
        ?.addEventListener("input", () => aplicarFiltros("filtroCedula"));

    document
        .getElementById("filtroNombre")
        ?.addEventListener("input", () => aplicarFiltros("filtroNombre"));

    document.querySelectorAll(".btnFiltro").forEach((btn) => {
        btn.addEventListener("click", () => {
            const inputId = btn.getAttribute("data-for");
            if (inputId) limpiarFiltroIndividual(inputId);
        });
    });
}


function limpiarFiltros() {
    (document.getElementById("filtroCedula") as HTMLInputElement).value = "";
    (document.getElementById("filtroNombre") as HTMLInputElement).value = "";

    hayFiltros = false;

    renderClientes(clientesData);

    document.querySelectorAll(".iconoFiltro").forEach((icono) => {
        icono.classList.remove("bi-funnel-fill");
        icono.classList.add("bi-funnel");
    });
}


async function loadClientes() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/activos`);
        if (!response.ok) throw new Error("Error");

        const data = await response.json();
        clientesData = data.data || [];

        renderClientes(clientesData);
    } catch (error) {
        console.error("Error:", error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error de conexión.</td></tr>`;
    }
}

function renderClientes(clientes: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay resultados.</td></tr>';
        return;
    }

    // Aquí es donde "creamos HTML en JS". En Vanilla JS/Astro es aceptable 
    // para actualizaciones dinámicas rápidas sin frameworks pesados.
    tbody.innerHTML = clientes.map((c: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                    <a href="editar_clientes?id=${c.cliCedula}" class="btn btn-sm btn-warning d-inline-flex align-items-center">
                        <i class="bi bi-pencil-square me-1"></i> Editar
                    </a>
                    <button type="button" class="btn btn-sm btn-danger d-inline-flex align-items-center btn-delete" 
                        data-cedula="${c.cliCedula}" data-nombre="${c.cliNombre}">
                        <i class="bi bi-trash me-1"></i> Eliminar
                    </button>
                </div>
            </td>
            <td>${c.cliCedula}</td>
            <td>${c.cliNombre}</td>
            <td>${c.cliFechaNacimiento ? String(c.cliFechaNacimiento).split("T")[0] : "N/A"}</td>
            <td>${c.tipoCliente?.ticDescripcion || (c.ticIdTipoc === 1 ? "Contado" : "Crédito")}</td>
            <td>${c.cliDireccion || ""}</td>
            <td>${c.cliTelefono || ""}</td>
            <td>${c.cliEmail || ""}</td>
            <td><span class="badge text-bg-success">Activo</span></td>
        </tr>
    `).join("");

    attachDeleteListeners();
}

function aplicarFiltros(inputOrigen: "filtroCedula" | "filtroNombre") {
    const cedulaInput = document.getElementById("filtroCedula") as HTMLInputElement;
    const nombreInput = document.getElementById("filtroNombre") as HTMLInputElement;

    const cedula = cedulaInput.value.toLowerCase();
    const nombre = nombreInput.value.toLowerCase();

    const filtrados = clientesData.filter((c) =>
        c.cliCedula.toString().includes(cedula) &&
        c.cliNombre.toLowerCase().includes(nombre)
    );

    renderClientes(filtrados);

    // 👉 SOLO el icono del input que cambió
    actualizarIcono("filtroCedula", cedula !== "");
    actualizarIcono("filtroNombre", nombre !== "");
}
function actualizarIcono(inputId: string, activo: boolean) {
    const btn = document.querySelector(
        `.btnFiltro[data-for="${inputId}"]`
    ) as HTMLElement | null;

    const icono = btn?.querySelector(".iconoFiltro");

    if (!icono) return;

    icono.classList.remove("bi-funnel", "bi-funnel-fill");
    icono.classList.add(activo ? "bi-funnel-fill" : "bi-funnel");
}

function limpiarFiltroIndividual(inputId: string) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (!input) return;

    input.value = "";

    aplicarFiltros(inputId as any);
}



function setupDeleteModal() {
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn?.addEventListener("click", async () => {
        if (!clienteIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}/${clienteIdToDelete}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: false }),
            });

            if (response.ok) {
                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                loadClientes();
            }
        } catch (error) {
            alert("Error de conexión");
        }
    });
}

function attachDeleteListeners() {
    document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const target = (e.target as HTMLElement).closest(".btn-delete");
            if (!target) return;
            
            const cedula = target.getAttribute("data-cedula");
            const nombre = target.getAttribute("data-nombre");

            clienteIdToDelete = cedula;

            const modalBody = document.querySelector("#confirmDeleteModal .modal-body p.lead");
            if (modalBody) modalBody.innerHTML = `¿Eliminar a <strong>${nombre}</strong>?`;

            const modal = new bootstrap.Modal(document.getElementById("confirmDeleteModal"));
            modal.show();
        });
    });
}