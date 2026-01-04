// src/scripts/puntos_emision.ts

// Definimos la URL de la API
const API_URL = import.meta.env.PUBLIC_BACKEND_URL + "PuntoEmisions";

let puntoIdToDelete: string | null = null;
let puntoNuevoEstado: boolean = false;
let puntosData: any[] = [];
let paginaActual = 1;
const registrosPorPagina = 10;
let puntosFiltrados: any[] = [];

// Declaramos bootstrap
declare const bootstrap: any;

export function initPuntosEmision() {
    loadPuntos();
    setupDeleteModal(); // Si se implementa eliminación

    document
        .getElementById("filtroCodigo")
        ?.addEventListener("input", () => aplicarFiltros("filtroCodigo"));

    document
        .getElementById("filtroEstablecimiento")
        ?.addEventListener("input", () => aplicarFiltros("filtroEstablecimiento"));

    document.querySelectorAll(".btnFiltro").forEach((btn) => {
        btn.addEventListener("click", () => {
            const inputId = btn.getAttribute("data-for");
            if (inputId) limpiarFiltroIndividual(inputId);
        });
    });
}

function limpiarFiltros() {
    (document.getElementById("filtroCodigo") as HTMLInputElement).value = "";
    (document.getElementById("filtroEstablecimiento") as HTMLInputElement).value = "";

    puntosFiltrados = [...puntosData];
    paginaActual = 1;

    renderPagina();

    document.querySelectorAll(".iconoFiltro").forEach((icono) => {
        icono.classList.remove("bi-funnel-fill");
        icono.classList.add("bi-funnel");
    });
}

async function loadPuntos() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}`);
        if (!response.ok) throw new Error("Error");

        const data = await response.json();
        const lista = Array.isArray(data) ? data : (data.data || []);
        puntosData = lista;

        puntosFiltrados = [...puntosData];
        paginaActual = 1;

        renderPagina();
    } catch (error) {
        console.error("Error:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Error de conexión.
                </td>
            </tr>`;
    }
}

function renderPuntos(puntos: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    if (puntos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay resultados.</td></tr>';
        return;
    }

    tbody.innerHTML = puntos.map((p: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                    <a href="editar_punto_emision?id=${p.pemId}" class="btn btn-sm btn-warning d-inline-flex align-items-center">
                        <i class="bi bi-pencil-square me-1"></i> Editar
                    </a>
                    <button type="button" class="btn btn-sm ${p.pemEstado ? "btn-danger" : "btn-success"} d-inline-flex align-items-center btn-delete" 
                        data-id="${p.pemId}" data-codigo="${p.pemIdPuntoEmision}" data-estado="${p.pemEstado}">
                        <i class="bi ${p.pemEstado ? "bi-trash" : "bi-check-circle"} me-1"></i> ${p.pemEstado ? "Desactivar" : "Activar"}
                    </button>
                </div>
            </td>
            <td>${p.pemId}</td>
            <td>${p.pemIdPuntoEmision}</td>
            <td>
                <strong>${p.establecimiento?.estNombre || "N/A"}</strong><br/>
                <small class="text-muted">${p.estRuc}</small>
            </td>
            <td>${p.pemDescripcion || ""}</td>
            <td><span class="badge ${p.pemEstado ? 'text-bg-success' : 'text-bg-danger'}">${p.pemEstado ? 'Activo' : 'Inactivo'}</span></td>
        </tr>
    `).join("");

    attachDeleteListeners();
}

function setupDeleteModal() {
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn?.addEventListener("click", async () => {
        if (!puntoIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}/${puntoIdToDelete}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: puntoNuevoEstado }),
            });

            if (response.ok) {
                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadPuntos();
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

            const id = target.getAttribute("data-id");
            const codigo = target.getAttribute("data-codigo");
            const estadoActual = target.getAttribute("data-estado") === "true";

            puntoIdToDelete = id;
            puntoNuevoEstado = !estadoActual;

            const accion = puntoNuevoEstado ? "Activar" : "Desactivar";
            const colorClass = puntoNuevoEstado ? "success" : "danger";
            const prevColorClass = puntoNuevoEstado ? "danger" : "success";

            // Update Modal Styling
            const modalContent = document.querySelector("#confirmDeleteModal .modal-content");
            modalContent?.classList.remove(`border-${prevColorClass}`);
            modalContent?.classList.add(`border-${colorClass}`);

            const modalHeader = document.querySelector("#confirmDeleteModal .modal-header");
            modalHeader?.classList.remove(`bg-${prevColorClass}`);
            modalHeader?.classList.add(`bg-${colorClass}`);

            const modalTitle = document.getElementById("confirmDeleteModalLabel");
            if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-${puntoNuevoEstado ? "check-circle" : "exclamation-triangle"}-fill me-2 fs-4"></i> Confirmar ${accion.toLowerCase()}`;

            const confirmBtn = document.getElementById("confirmDeleteBtn");
            if (confirmBtn) {
                confirmBtn.classList.remove(`btn-${prevColorClass}`);
                confirmBtn.classList.add(`btn-${colorClass}`);
                confirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;
            }

            const modalBody = document.querySelector("#confirmDeleteModal .modal-body p.lead");
            if (modalBody) modalBody.innerHTML = `¿Estás seguro que deseas ${accion.toLowerCase()} al punto de emisión <strong>${codigo}</strong>?`;

            const modalBodySub = document.querySelector("#confirmDeleteModal .modal-body p.text-muted");
            if (modalBodySub) modalBodySub.innerHTML = `El punto de emisión será ${puntoNuevoEstado ? "activado" : "desactivado"}.`;

            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("confirmDeleteModal"));
            modal.show();
        });
    });
}

function aplicarFiltros(inputOrigen: "filtroCodigo" | "filtroEstablecimiento") {
    const codigoInput = document.getElementById("filtroCodigo") as HTMLInputElement;
    const estInput = document.getElementById("filtroEstablecimiento") as HTMLInputElement;

    const codigo = codigoInput.value.toLowerCase();
    const estBusqueda = estInput.value.toLowerCase();

    puntosFiltrados = puntosData.filter((p) => {
        const codigoMatch = p.pemIdPuntoEmision.toLowerCase().includes(codigo);
        const estNombre = p.establecimiento?.estNombre?.toLowerCase() || "";
        const estRuc = p.estRuc?.toLowerCase() || "";
        const estMatch = estNombre.includes(estBusqueda) || estRuc.includes(estBusqueda);

        return codigoMatch && estMatch;
    });

    paginaActual = 1;

    renderPagina();

    actualizarIcono("filtroCodigo", codigo !== "");
    actualizarIcono("filtroEstablecimiento", estBusqueda !== "");
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

function renderPagina() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;

    const itemsPagina = puntosFiltrados.slice(inicio, fin);
    renderPuntos(itemsPagina);
    renderPaginacion();
}

function renderPaginacion() {
    const totalPaginas = Math.ceil(puntosFiltrados.length / registrosPorPagina);
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
