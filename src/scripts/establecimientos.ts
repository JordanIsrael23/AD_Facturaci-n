// src/scripts/establecimientos.ts

// Definimos la URL de la API
const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "Establecimientoes";

let establecimientoRucToDelete: string | null = null;
let establecimientoNuevoEstado: boolean = false;
let establecimientosData: any[] = [];
let paginaActual = 1;
const registrosPorPagina = 10;
let establecimientosFiltrados: any[] = [];

// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initEstablecimientos() {
    loadEstablecimientos();
    setupDeleteModal();

    document
        .getElementById("filtroRuc")
        ?.addEventListener("input", () => aplicarFiltros("filtroRuc"));

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
    (document.getElementById("filtroRuc") as HTMLInputElement).value = "";
    (document.getElementById("filtroNombre") as HTMLInputElement).value = "";

    establecimientosFiltrados = [...establecimientosData];
    paginaActual = 1;

    renderPagina();

    document.querySelectorAll(".iconoFiltro").forEach((icono) => {
        icono.classList.remove("bi-funnel-fill");
        icono.classList.add("bi-funnel");
    });
}

async function loadEstablecimientos() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}`);
        if (!response.ok) throw new Error("Error");

        const data = await response.json();
        // Ajustar según si la API devuelve directamente el array o un objeto { data: [] }
        // La API de Clientes devolvia { data: [] } aparentemente en el endpoint /activos ?
        // El usuario dijo "La api tiene la ruta .../api/Establecimientoes". 
        // Asumiremos que devuelve un array o { data: ... } standard.
        // Si sigue el patrón de clientes pero sin /activos (que puede ser otro endpoint),
        // revisaré la respuesta. Por ahora asumiré array directo o data.

        // En clientes.ts: fetch(`${API_URL}/activos`) -> data.data
        // Aquí intentaré fetch(API_URL). Si es similar, quizás sea data.data o data directa.
        // Dado que es una API nueva, asumiré que devuelve la lista directamente o en data.
        // Probaré con data.data primero si sigue el template, si no data.

        const lista = Array.isArray(data) ? data : (data.data || []);
        establecimientosData = lista;

        establecimientosFiltrados = [...establecimientosData];
        paginaActual = 1;

        renderPagina();
    } catch (error) {
        console.error("Error:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    Error de conexión.
                </td>
            </tr>`;
    }
}

function renderEstablecimientos(establecimientos: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    if (establecimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay resultados.</td></tr>';
        return;
    }

    tbody.innerHTML = establecimientos.map((e: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                    <a href="editar_establecimientos?id=${e.estRuc}" class="btn btn-sm btn-warning d-inline-flex align-items-center">
                        <i class="bi bi-pencil-square me-1"></i> Editar
                    </a>
                    <button type="button" class="btn btn-sm ${e.estEstado ? "btn-danger" : "btn-success"} d-inline-flex align-items-center btn-delete" 
                        data-ruc="${e.estRuc}" data-nombre="${e.estNombre}" data-estado="${e.estEstado}">
                        <i class="bi ${e.estEstado ? "bi-trash" : "bi-check-circle"} me-1"></i> ${e.estEstado ? "Desactivar" : "Activar"}
                    </button>
                </div>
            </td>
            <td>${e.estRuc}</td>
            <td>${e.estNombre}</td>
            <td>${e.estDireccion || ""}</td>
            <td>${e.estTelefono || ""}</td>
            <td><span class="badge ${e.estEstado ? 'text-bg-success' : 'text-bg-danger'}">${e.estEstado ? 'Activo' : 'Inactivo'}</span></td>
        </tr>
    `).join("");

    attachDeleteListeners();
}

function aplicarFiltros(inputOrigen: "filtroRuc" | "filtroNombre") {
    const rucInput = document.getElementById("filtroRuc") as HTMLInputElement;
    const nombreInput = document.getElementById("filtroNombre") as HTMLInputElement;

    const ruc = rucInput.value.toLowerCase();
    const nombre = nombreInput.value.toLowerCase();

    establecimientosFiltrados = establecimientosData.filter((e) =>
        e.estRuc.toString().toLowerCase().includes(ruc) &&
        e.estNombre.toLowerCase().includes(nombre)
    );

    paginaActual = 1;

    renderPagina();

    actualizarIcono("filtroRuc", ruc !== "");
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
        if (!establecimientoRucToDelete) return;
        try {
            const response = await fetch(`${API_URL}/${establecimientoRucToDelete}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: establecimientoNuevoEstado }),
            });

            if (response.ok) {
                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadEstablecimientos();
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

            const ruc = target.getAttribute("data-ruc");
            const nombre = target.getAttribute("data-nombre");
            const estadoActual = target.getAttribute("data-estado") === "true";

            establecimientoRucToDelete = ruc;
            establecimientoNuevoEstado = !estadoActual;

            const accion = establecimientoNuevoEstado ? "Activar" : "Desactivar";
            const colorClass = establecimientoNuevoEstado ? "success" : "danger";
            const prevColorClass = establecimientoNuevoEstado ? "danger" : "success";

            // Update Modal Styling
            const modalContent = document.querySelector("#confirmDeleteModal .modal-content");
            modalContent?.classList.remove(`border-${prevColorClass}`);
            modalContent?.classList.add(`border-${colorClass}`);

            const modalHeader = document.querySelector("#confirmDeleteModal .modal-header");
            modalHeader?.classList.remove(`bg-${prevColorClass}`);
            modalHeader?.classList.add(`bg-${colorClass}`);

            const modalTitle = document.getElementById("confirmDeleteModalLabel");
            if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-${establecimientoNuevoEstado ? "check-circle" : "exclamation-triangle"}-fill me-2 fs-4"></i> Confirmar ${accion.toLowerCase()}`;

            const confirmBtn = document.getElementById("confirmDeleteBtn");
            confirmBtn?.classList.remove(`btn-${prevColorClass}`);
            confirmBtn?.classList.add(`btn-${colorClass}`);
            if (confirmBtn) confirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;

            const modalBody = document.querySelector("#confirmDeleteModal .modal-body p.lead");
            if (modalBody) modalBody.innerHTML = `¿Estás seguro que deseas ${accion.toLowerCase()} al establecimiento <strong>${nombre}</strong>?`;

            const modalBodySub = document.querySelector("#confirmDeleteModal .modal-body p.text-muted");
            if (modalBodySub) modalBodySub.innerHTML = `El establecimiento será ${establecimientoNuevoEstado ? "activado" : "desactivado"}.`;

            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("confirmDeleteModal"));
            modal.show();
        });
    });
}

function renderPagina() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;

    const itemsPagina = establecimientosFiltrados.slice(inicio, fin);
    renderEstablecimientos(itemsPagina);
    renderPaginacion();
}

function renderPaginacion() {
    const totalPaginas = Math.ceil(establecimientosFiltrados.length / registrosPorPagina);
    const contenedor = document.getElementById("paginacion");
    if (!contenedor) return;

    if (totalPaginas <= 1) {
        contenedor.innerHTML = "";
        return;
    }

    contenedor.innerHTML = `
        <button class="btn btn-sm btn-outline-secondary me-2"
            ${paginaActual === 1 ? "disabled" : ""} id="btnAnterior">
            Anterior
        </button>

        <span>Página ${paginaActual} de ${totalPaginas}</span>

        <button class="btn btn-sm btn-outline-secondary ms-2"
            ${paginaActual === totalPaginas ? "disabled" : ""} id="btnSiguiente">
            Siguiente
        </button>
    `;

    document.getElementById("btnAnterior")?.addEventListener("click", () => {
        paginaActual--;
        renderPagina();
    });

    document.getElementById("btnSiguiente")?.addEventListener("click", () => {
        paginaActual++;
        renderPagina();
    });
}
