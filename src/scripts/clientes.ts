
// src/scripts/clientes.ts
import { getAuthHeaders, checkAuth, hasFunction, registrarAuditoria } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Definimos la URL de la API
const BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_URL = BASE_URL + "Clientes";
const FACTURAS_URL = BASE_URL + "Facturas";

let clienteIdToDelete: string | null = null;
let clienteNuevoEstado: boolean = false;
let clientesData: any[] = [];
let hayFiltros = false;
let paginaActual = 1;
const registrosPorPagina = 10;
let clientesFiltrados: any[] = [];
let currentClienteForPdf: string | null = null;

// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initClientes() {
    checkAuth(); // Verificar auth al cargar
    loadClientes();
    setupDeleteModal();
    setupPdfButton();
    setupGlobalReportButton();

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

    // Auditoria de acceso eliminada

}

function limpiarFiltros() {
    (document.getElementById("filtroCedula") as HTMLInputElement).value = "";
    (document.getElementById("filtroNombre") as HTMLInputElement).value = "";

    clientesFiltrados = [...clientesData];
    paginaActual = 1;

    renderPagina();

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
        const response = await fetch(`${API_URL}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error("Error");
        }

        const data = await response.json();
        clientesData = Array.isArray(data) ? data : (data.data || []);

        clientesFiltrados = [...clientesData];
        paginaActual = 1;

        renderPagina();
    } catch (error) {
        console.error("Error:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-danger">
                    Error de conexión.
                </td>
            </tr>`;
    }
}


function renderClientes(clientes: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay resultados.</td></tr>';
        return;
    }

    // ⭐ Verificar permisos UNA VEZ fuera del map
    const canEdit = hasFunction("Editar Clientes");
    const canDelete = hasFunction("Desactivar Clientes");

    tbody.innerHTML = clientes.map((c: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                    <!-- Botón Ver - Siempre visible -->
                    <button type="button" class="btn btn-sm btn-info text-white d-inline-flex align-items-center btn-view-cliente" 
                        data-cedula="${c.cliCedula}">
                        <i class="bi bi-eye-fill me-1"></i> Ver
                    </button>
                    
                    ${canEdit ? `
                        <!-- Botón Editar - Solo si tiene permiso -->
                        <a href="editar-clientes?id=${c.cliCedula}" 
                           class="btn btn-sm btn-warning d-inline-flex align-items-center">
                            <i class="bi bi-pencil-square me-1"></i> Editar
                        </a>
                    ` : ''}
                    
                    ${canDelete ? `
                        <!-- Botón Activar/Desactivar - Solo si tiene permiso -->
                        <button type="button" 
                                class="btn btn-sm ${c.cliEstado ? "btn-danger" : "btn-success"} d-inline-flex align-items-center btn-delete" 
                                data-cedula="${c.cliCedula}" 
                                data-nombre="${c.cliNombre}" 
                                data-estado="${c.cliEstado}">
                            <i class="bi ${c.cliEstado ? "bi-trash" : "bi-check-circle"} me-1"></i> 
                            ${c.cliEstado ? "Desactivar" : "Activar"}
                        </button>
                    ` : ''}
                </div>
            </td>
            <td>${c.cliCedula}</td>
            <td>${c.cliNombre}</td>
            <td>${c.cliFechaNacimiento ? String(c.cliFechaNacimiento).split("T")[0] : "N/A"}</td>
            <td>${c.tipoCliente?.ticDescripcion || (c.ticIdTipoc === 1 ? "Contado" : "Crédito")}</td>
            <td>${c.cliDireccion || ""}</td>
            <td>${c.cliTelefono || ""}</td>
            <td>${c.cliEmail || ""}</td>
            <td><span class="badge ${c.cliEstado ? "text-bg-success" : "text-bg-danger"}">
                    ${c.cliEstado ? "Activo" : "Inactivo"}
                </span>
            </td>
        </tr>
    `).join("");

    attachDeleteListeners();
    attachViewListeners();
}

function aplicarFiltros(inputOrigen: "filtroCedula" | "filtroNombre") {
    const cedulaInput = document.getElementById("filtroCedula") as HTMLInputElement;
    const nombreInput = document.getElementById("filtroNombre") as HTMLInputElement;

    const cedula = cedulaInput.value.toLowerCase();
    const nombre = nombreInput.value.toLowerCase();

    clientesFiltrados = clientesData.filter((c) =>
        c.cliCedula.toString().includes(cedula) &&
        c.cliNombre.toLowerCase().includes(nombre)
    );

    paginaActual = 1;

    renderPagina();

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
                headers: getAuthHeaders(),
                body: JSON.stringify({ estado: clienteNuevoEstado }),
            });

            if (response.ok) {
                // ⭐ NUEVO: Registrar auditoría
                const accion = clienteNuevoEstado ? 'ACTIVATE' : 'DELETE';
                const descripcion = `Usuario ${clienteNuevoEstado ? 'activó' : 'desactivó'} el cliente con cédula: ${clienteIdToDelete}`;

                await registrarAuditoria(
                    'Desactivar Clientes',
                    accion,
                    descripcion,
                    `Estado cambiado a: ${clienteNuevoEstado ? 'Activo' : 'Inactivo'}`
                ).catch(err => console.warn('Error en auditoría:', err));

                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadClientes();
            } else if (response.status === 401) {
                window.location.href = '/login';
            }
        } catch (error) {
            alert("Error de conexión");
        }
    });
}

function setupPdfButton() {
    const pdfBtn = document.getElementById("modalBtnPdf");
    pdfBtn?.addEventListener("click", async () => {
        if (!currentClienteForPdf) return;

        // ⭐ NUEVO: Registrar auditoría antes de generar PDF
        await registrarAuditoria(
            'Generar Reportes',
            'EXPORT',
            `Usuario generó PDF del cliente: ${currentClienteForPdf}`,
            'Reporte individual en PDF'
        ).catch(err => console.warn('Error en auditoría:', err));

        await generarPDFCliente(currentClienteForPdf);
    });
}

function setupGlobalReportButton() {
    const btn = document.getElementById("btnReporteGlobal");
    btn?.addEventListener("click", () => {
        // Auditoria de vista previa eliminada


        openReporteGlobal();
    });

    const btnDownload = document.getElementById("btnDownloadGlobalPdf");
    btnDownload?.addEventListener("click", () => {
        // ⭐ NUEVO: Registrar auditoría al descargar PDF global
        registrarAuditoria(
            'Generar Reportes',
            'EXPORT',
            'Usuario generó reporte global de clientes en PDF',
            `Total de clientes en reporte: ${filteredGlobalClients.length}`
        ).catch(err => console.warn('Error en auditoría:', err));

        generarReporteGlobalPDF();
    });
}


function attachDeleteListeners() {
    document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const target = (e.target as HTMLElement).closest(".btn-delete");
            if (!target) return;

            const cedula = target.getAttribute("data-cedula");
            const nombre = target.getAttribute("data-nombre");
            const estadoActual = target.getAttribute("data-estado") === "true";

            clienteIdToDelete = cedula;
            clienteNuevoEstado = !estadoActual;

            const accion = clienteNuevoEstado ? "Activar" : "Desactivar";
            const colorClass = clienteNuevoEstado ? "success" : "danger";
            const prevColorClass = clienteNuevoEstado ? "danger" : "success";

            // Update Modal Styling
            const modalContent = document.querySelector("#confirmDeleteModal .modal-content");
            modalContent?.classList.remove(`border-${prevColorClass}`);
            modalContent?.classList.add(`border-${colorClass}`);

            const modalHeader = document.querySelector("#confirmDeleteModal .modal-header");
            modalHeader?.classList.remove(`bg-${prevColorClass}`);
            modalHeader?.classList.add(`bg-${colorClass}`);

            const modalTitle = document.getElementById("confirmDeleteModalLabel");
            if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-${clienteNuevoEstado ? "check-circle" : "exclamation-triangle"}-fill me-2 fs-4"></i> Confirmar ${accion.toLowerCase()}`;

            const confirmBtn = document.getElementById("confirmDeleteModalBtn");
            if (confirmBtn) {
                confirmBtn.className = `btn btn-${colorClass} d-inline-flex align-items-center`;
                confirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;
            }

            // Fix: re-select button if ID is standard
            const realConfirmBtn = document.getElementById("confirmDeleteBtn");
            if (realConfirmBtn) {
                realConfirmBtn.className = `btn btn-${colorClass} d-inline-flex align-items-center`;
                realConfirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;
            }

            const modalBody = document.querySelector("#confirmDeleteModal .modal-body p.lead");
            if (modalBody) modalBody.innerHTML = `¿Estás seguro que deseas ${accion.toLowerCase()} al cliente <strong>${nombre}</strong>?`;

            const modalBodySub = document.querySelector("#confirmDeleteModal .modal-body p.text-muted");
            if (modalBodySub) modalBodySub.innerHTML = `Este cliente será ${clienteNuevoEstado ? "activado" : "desactivado"}.`;

            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("confirmDeleteModal"));
            modal.show();
        });
    });
}

function attachViewListeners() {
    document.querySelectorAll(".btn-view-cliente").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const target = (e.target as HTMLElement).closest(".btn-view-cliente");
            if (!target) return;

            const cedula = target.getAttribute("data-cedula");
            if (!cedula) return;

            // Auditoria de ver detalles eliminada


            await showClienteDetails(cedula);
        });
    });
}


function renderPagina() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;

    const clientesPagina = clientesFiltrados.slice(inicio, fin);
    renderClientes(clientesPagina);
    renderPaginacion();
}

function renderPaginacion() {
    const totalPaginas = Math.ceil(clientesFiltrados.length / registrosPorPagina);
    const contenedor = document.getElementById("paginacion");
    if (!contenedor) return;

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

async function showClienteDetails(cedula: string) {
    const cliente = clientesData.find(c => c.cliCedula === cedula);
    if (!cliente) return;

    currentClienteForPdf = cedula;
    const setText = (id: string, val: string) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    setText("modalCliNombre", cliente.cliNombre);
    setText("modalCliCedula", cliente.cliCedula);
    setText("modalCliFechaNac", cliente.cliFechaNacimiento ? String(cliente.cliFechaNacimiento).split("T")[0] : "N/A");
    setText("modalCliTipo", cliente.tipoCliente?.ticDescripcion || (cliente.ticIdTipoc === 1 ? "Contado" : "Crédito"));
    setText("modalCliEmail", cliente.cliEmail || "N/A");
    setText("modalCliTelefono", cliente.cliTelefono || "N/A");
    setText("modalCliDireccion", cliente.cliDireccion || "N/A");

    const estadoEl = document.getElementById("modalCliEstado");
    if (estadoEl) estadoEl.innerHTML = `<span class="badge ${cliente.cliEstado ? "text-bg-success" : "text-bg-danger"}">${cliente.cliEstado ? "Activo" : "Inactivo"}</span>`;

    const tbody = document.getElementById("modalCliFacturasBody");
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando facturas...</td></tr>';

        try {
            const res = await fetch(FACTURAS_URL, { headers: getAuthHeaders() });
            if (res.ok) {
                const allFacturas = await res.json();
                const lista = Array.isArray(allFacturas) ? allFacturas : (allFacturas.data || []);
                const facturasCliente = lista.filter((f: any) => f.cliCedula === cedula || f.cliente?.cliCedula === cedula);

                if (facturasCliente.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin facturas registradas</td></tr>';
                } else {
                    tbody.innerHTML = facturasCliente.map((f: any) => `
                        <tr>
                            <td class="font-monospace">${f.facNumeroFactura}</td>
                            <td>${f.facFechaEmision ? String(f.facFechaEmision).split("T")[0] : "N/A"}</td>
                            <td class="fw-bold">$${f.facTotal.toFixed(2)}</td>
                            <td><span class="badge ${f.facEstadoFactura ? "text-bg-success" : "text-bg-danger"}">${f.facEstadoFactura ? "Activa" : "Anulada"}</span></td>
                        </tr>
                    `).join("");
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error cargando facturas</td></tr>';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error de conexión</td></tr>';
        }
    }

    const modalEl = document.getElementById("viewClienteModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

async function generarPDFCliente(cedula: string) {
    const cliente = clientesData.find(c => c.cliCedula === cedula);
    if (!cliente) {
        alert("Cliente no encontrado");
        return;
    }
    showLoadingToast();

    try {
        const res = await fetch(FACTURAS_URL, { headers: getAuthHeaders() });
        let facturasCliente: any[] = [];
        if (res.ok) {
            const all = await res.json();
            const lista = Array.isArray(all) ? all : (all.data || []);
            facturasCliente = lista.filter((f: any) => f.cliCedula === cedula || f.cliente?.cliCedula === cedula);

            // --- FETCH DETAILS FOR INVOICES (Required for product breakdown) ---
            for (const invoice of facturasCliente) {
                if (!invoice.detallesFactura) {
                    try {
                        const resDet = await fetch(`${FACTURAS_URL}/${invoice.facNumeroFactura}`, { headers: getAuthHeaders() });
                        if (resDet.ok) {
                            const fullFactura = await resDet.json();
                            Object.assign(invoice, fullFactura);
                        }
                    } catch (e) {
                        console.warn(`Error fetching details for invoice ${invoice.facNumeroFactura}`, e);
                    }
                }
            }
        }

        const doc = new jsPDF();

        // --- TRACKING FOR CONTAINER BORDER ---
        let yPos = 20;
        const startPage = doc.getNumberOfPages(); // Usually 1
        const startY = yPos;

        // Generar contenido reutilizando la lógica del reporte global
        generateClientSection(doc, cliente, facturasCliente, yPos + 5);

        // Recuperar Y final y Página Final
        const endPage = doc.getNumberOfPages();
        const lastY = (doc as any).customLastY || (doc as any).lastAutoTable?.finalY;
        let endY = (lastY || (startY + 60)) + 5;

        // --- TOTAL GENERAL AL FINAL ---
        if (facturasCliente.length > 0) {
            const finalPageHeight = doc.internal.pageSize.height;
            // Chequear si cabe el total
            if (endY + 15 > finalPageHeight - 20) {
                doc.addPage();
                endY = 20;
            }

            const totalGlobal = facturasCliente.filter((f: any) => f.facEstadoFactura).reduce((sum, f) => sum + f.facTotal, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(`TOTAL GENERAL: $${totalGlobal.toFixed(2)}`, doc.internal.pageSize.width - 15 - 10, endY + 10, { align: 'right' });
            endY += 15;
        }

        // --- DRAW CONTAINER BORDER ---
        // Ajustamos endY un poco mas para cerrar
        drawClientBorder(doc, startPage, startY, doc.getNumberOfPages(), endY + 5);

        doc.save(`Reporte_Cliente_${cliente.cliCedula}.pdf`);
        showSuccessToast();

    } catch (err) {
        console.error(err);
        alert("Error al generar reporte");
    } finally {
        removeLoadingToast();
    }
}

// Deprecated or removed separate function in favor of inline logic or simpler wrapper?
// Actually I will remove generateSingleClientPDF definition since I logic'd it into generarPDFCliente 
// OR I keep it empty/dummy or remove calls to it?
// The current replacementREMOVES generateSingleClientPDF entirely if I target the right range.
// But wait, generateSingleClientPDF definition is what I am replacing?
// The tool says "Updating generarPDFCliente...".
// My ReplacementContent starts with `async function generarPDFCliente...`
// So I should target from `async function generarPDFCliente` down to `function generateSingleClientPDF... end`.
// `generarPDFCliente` starts at 453. `generateSingleClientPDF` seems to follow or be elsewhere.
// Ah, the view showed `generateSingleClientPDF` usage inside `generarPDFCliente` at line 471.
// And `generateSingleClientPDF` DEFINITION was likely removed in my thought? No, I need to remove it.
// The view showed `generateSingleClientPDF` definition starts around 1000? No, I viewed 1000-1096 and didn't see `function generateSingleClientPDF`.
// Wait, looking at grep results, it was in `clientes.ts`.
// Looking at lines 1000-1096 again... 
// Line 1003 `let yPos = 40;`... this looks like the body of `generateSingleClientPDF` but without the function signature?
// NO, that was just loose code? Or I missed the signature line 999?
// I need to be careful. I'll search for the signature again.

// Actually, I'll just update `generarPDFCliente` to NOT call `generateSingleClientPDF` and implement the logic directly.
// And I will try to delete `generateSingleClientPDF` if I can find it.
// Let's first update `generarPDFCliente`.


// NUEVAS FUNCIONES PARA REPORTE GLOBAL

let allClientsCache: any[] = [];
let allInvoicesCache: any[] = [];
let filteredGlobalClients: any[] = []; // Estado de filtros
let globalFilters = {
    showContado: true,
    showCredito: true,
    estado: ""
};

async function openReporteGlobal() {
    // Show Loading in Modal Table
    const modalEl = document.getElementById("reporteGlobalModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    setupGlobalReportFiltersListeners(); // Ensure listeners are attached

    const tbody = document.getElementById("globalReportBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary" role="status"></div><br>Cargando datos globales...</td></tr>';

    try {
        let clients = [];
        // 1. Fetch Clients if not cached
        if (clientesData.length > 0) {
            clients = clientesData;
        } else {
            console.log("Fetching clients for global report...");
            const resClients = await fetch(API_URL, { headers: getAuthHeaders() });
            if (!resClients.ok) {
                if (resClients.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`Error fetching clients: ${resClients.status}`);
            }
            const dataClients = await resClients.json();
            clients = Array.isArray(dataClients) ? dataClients : (dataClients.data || []);
        }

        // 2. Fetch Invoices
        console.log("Fetching invoices for global report...");
        const resInvoices = await fetch(FACTURAS_URL, { headers: getAuthHeaders() });
        let invoicesList = [];

        if (resInvoices.ok) {
            const dataInvoices = await resInvoices.json();
            invoicesList = Array.isArray(dataInvoices) ? dataInvoices : (dataInvoices.data || []);
        } else {
            if (resInvoices.status === 401) {
                window.location.href = '/login';
                return;
            }
            console.error(`Error fetching invoices: ${resInvoices.status}`);
        }

        allClientsCache = Array.isArray(clients) ? clients : (clients.data || []);
        // Ordenar alfabéticamente por nombre
        allClientsCache.sort((a, b) => a.cliNombre.localeCompare(b.cliNombre));

        allInvoicesCache = invoicesList;

        // Reset filtros on open
        resetGlobalFilters();
        // Inicialmente filtered using default checkbox state (both checked)
        applyGlobalFilters();

    } catch (e) {
        console.error("Error loading global report data", e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error cargando datos. Ver consola para más detalles.</td></tr>`;
    }
}

function setupGlobalReportFiltersListeners() {
    const ids = ["globalFiltroEstado"];
    const checks = ["checkTipoContado", "checkTipoCredito"];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAttached) {
            el.addEventListener("change", applyGlobalFilters);
            el.dataset.listenerAttached = "true";
        }
    });

    checks.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAttached) {
            el.addEventListener("change", applyGlobalFilters);
            el.dataset.listenerAttached = "true";
        }
    });

    const btnClear = document.getElementById("btnLimpiarFiltrosGlobal");
    if (btnClear && !btnClear.dataset.listenerAttached) {
        btnClear.addEventListener("click", () => {
            resetGlobalFilters();
            applyGlobalFilters();
        });
        btnClear.dataset.listenerAttached = "true";
    }
}

function resetGlobalFilters() {
    globalFilters = { showContado: true, showCredito: true, estado: "" };

    const checkContado = document.getElementById("checkTipoContado") as HTMLInputElement;
    if (checkContado) checkContado.checked = true;

    const checkCredito = document.getElementById("checkTipoCredito") as HTMLInputElement;
    if (checkCredito) checkCredito.checked = true;

    (document.getElementById("globalFiltroEstado") as HTMLSelectElement).value = "";

    // logic will be applied by applyGlobalFilters called after reset
}

function applyGlobalFilters() {
    const checkContado = document.getElementById("checkTipoContado") as HTMLInputElement;
    const checkCredito = document.getElementById("checkTipoCredito") as HTMLInputElement;

    globalFilters.showContado = checkContado ? checkContado.checked : true;
    globalFilters.showCredito = checkCredito ? checkCredito.checked : true;
    globalFilters.estado = (document.getElementById("globalFiltroEstado") as HTMLSelectElement).value;

    filteredGlobalClients = allClientsCache.filter(c => {
        // Filtro Tipo
        // ticIdTipoc: 1=Contado, 2=Crédito
        let validTipo = false;
        if (c.ticIdTipoc === 1 && globalFilters.showContado) validTipo = true;
        if (c.ticIdTipoc === 2 && globalFilters.showCredito) validTipo = true;
        // Fallback for null type? Usually assume standards, but let's be strict to checkboxes
        if (!c.ticIdTipoc && globalFilters.showContado) validTipo = true; // Default behavior if needed

        // Filtro Estado
        let validEstado = true;
        if (globalFilters.estado !== "") {
            validEstado = c.cliEstado.toString() === globalFilters.estado;
        }

        return validTipo && validEstado;
    });

    renderGlobalReportTable();
}

function renderGlobalReportTable() {
    const tbody = document.getElementById("globalReportBody");
    if (!tbody) return;

    if (filteredGlobalClients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay clientes que coincidan con los filtros.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredGlobalClients.map(client => {
        const clientInvoices = allInvoicesCache.filter((f: any) => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);
        const total = clientInvoices.filter((f: any) => f.facEstadoFactura).reduce((sum: number, f: any) => sum + f.facTotal, 0);

        return `
            <tr>
                <td class="font-monospace">${client.cliCedula}</td>
                <td class="text-start">${client.cliNombre}</td>
                <td><span class="badge bg-secondary">${client.tipoCliente?.ticDescripcion || (client.ticIdTipoc === 1 ? "Contado" : "Crédito")}</span></td>
                <td>${clientInvoices.length}</td>
                <td class="fw-bold">$${total.toFixed(2)}</td>
            </tr>
        `;
    }).join("");
}

async function generarReporteGlobalPDF() {
    if (filteredGlobalClients.length === 0) {
        alert("No hay datos para generar el reporte con los filtros actuales.");
        return;
    }

    showLoadingToast("Generando Reporte Global...");
    const doc = new jsPDF();
    let isFirstPage = true;

    // Generar página para cada cliente o un reporte continuo
    // Requerimiento: "Informe detallado de todos". Reporte Continuo es mejor.

    // Portada
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE GENERAL DE CLIENTES", doc.internal.pageSize.width / 2, 25, { align: "center" });
    doc.setFontSize(14);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width / 2, 35, { align: "center" });

    let yPos = 50;

    for (let i = 0; i < filteredGlobalClients.length; i++) {
        const client = filteredGlobalClients[i];
        const clientInvoices = allInvoicesCache.filter((f: any) => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);

        // --- FETCH DETAILS FOR INVOICES (Required for product breakdown) ---
        for (const invoice of clientInvoices) {
            if (!invoice.detallesFactura) {
                try {
                    const res = await fetch(`${FACTURAS_URL}/${invoice.facNumeroFactura}`, { headers: getAuthHeaders() });
                    if (res.ok) {
                        const fullFactura = await res.json();
                        // Update the invoice object in the cache (reference) with full details
                        Object.assign(invoice, fullFactura);
                    }
                } catch (e) {
                    console.warn(`Error fetching details for invoice ${invoice.facNumeroFactura}`, e);
                }
            }
        }

        // PRE-CALCULATE CARD HEIGHT TO CHECK PAGE BREAK
        // Estimación base (Nombre + espacios)
        let estimatedHeight = 60;

        // Calcular altura real de la tarjeta del cliente antes de dibujar
        // (Lógica replicada de generateClientSection para 'dry-run')
        const contentWidth = doc.internal.pageSize.width - 30; // Margin 15*2
        const _nLines = doc.splitTextToSize(client.cliNombre, contentWidth - 10);
        const _nH = doc.getTextDimensions(_nLines).h;
        const _addrLines = doc.splitTextToSize(client.cliDireccion || 'N/A', contentWidth - (doc.getTextWidth("Dirección:") + 10));
        const _addrH = doc.getTextDimensions(_addrLines).h;
        // Altura base Aprox: PaddingTop(10) + Nombre(_nH) + LineSep(2) + Gap(8) + 3 filas de datos(Lines*3) + Gap(4) + Address(_addrH) + PaddingBot(5)
        const clientCardHeight = 10 + _nH + 2 + 8 + 24 + 4 + _addrH + 5;

        // Verificar espacio para encabezado de cliente usando la altura real
        if (yPos + clientCardHeight > doc.internal.pageSize.height - 20) {
            doc.addPage();
            yPos = 20;
        } else if (!isFirstPage && i > 0) {
            yPos += 10; // Espacio extra entre cuadros
        }
        isFirstPage = false;

        // --- TRACKING FOR CONTAINER BORDER ---
        const startPage = doc.getNumberOfPages();
        const startY = yPos; // Start of the box

        generateClientSection(doc, client, clientInvoices, yPos + 5); // Add internal padding top

        // Recuperar Y final y Página Final
        const endPage = doc.getNumberOfPages();
        const lastY = (doc as any).customLastY || (doc as any).lastAutoTable?.finalY;
        const endY = (lastY || (startY + 60)) + 5; // Add internal padding bottom

        // --- DRAW CONTAINER BORDER ---
        drawClientBorder(doc, startPage, startY, endPage, endY);

        // Prepare for next iteration
        yPos = endY + 15; // Vertical margin between boxes
    }
    doc.save(`Reporte_Global_Clientes_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    removeLoadingToast();
    showSuccessToast();
}

/**
 * Dibuja un borde alrededor de una sección que puede abarcar múltiples páginas.
 */
function drawClientBorder(doc: jsPDF, startPage: number, startY: number, endPage: number, endY: number) {
    const margin = 10; // Margen externo del borde (más amplio que el contenido)
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const boxWidth = pageWidth - (margin * 2);
    const boxX = margin;

    // Configuración de estilo del borde
    doc.setDrawColor(108, 117, 125); // Gris secundario bootstrap
    doc.setLineWidth(0.5);

    // Guardar página actual para restaurarla al final
    const originalPage = doc.getNumberOfPages();

    for (let p = startPage; p <= endPage; p++) {
        doc.setPage(p);

        const topY = (p === startPage) ? startY : 20; // 20 es margen superior standard si no es startPage
        const bottomY = (p === endPage) ? endY : (pageHeight - 20); // 20 margen inferior standard

        // DIBUJAR BORDES

        // 1. Línea Izquierda
        doc.line(boxX, topY, boxX, bottomY);

        // 2. Línea Derecha
        doc.line(boxX + boxWidth, topY, boxX + boxWidth, bottomY);

        // 3. Línea Superior (Solo en startPage)
        if (p === startPage) {
            doc.line(boxX, topY, boxX + boxWidth, topY);
        }

        // 4. Línea Inferior (Solo en endPage)
        if (p === endPage) {
            doc.line(boxX, bottomY, boxX + boxWidth, bottomY);
        }
    }

    // Restaurar página original
    doc.setPage(originalPage);
}

function generateClientSection(doc: jsPDF, client: any, invoices: any[], startY: number) {
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);

    // --- SECCIÓN DEL CLIENTE (DISEÑO VERTICAL TIPO TARJETA) ---
    // Colores
    const bgFill = [248, 249, 250];
    const borderColor = [220, 220, 220];
    const labelColor = [33, 37, 41];
    const textColor = [73, 80, 87];

    let currentY = startY + 10;
    const cardStartX = margin;
    const cardStartY = startY;

    // Definir función de dibujo para reutilizar después de pintar el fondo
    const drawContent = () => {
        let cy = startY + 10;

        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");

        const nLines = doc.splitTextToSize(client.cliNombre, contentWidth - 10);
        doc.text(nLines, margin + 5, cy);
        const nH = doc.getTextDimensions(nLines).h;

        const lY = cy + nH + 2;
        doc.setDrawColor(13, 110, 253);
        doc.setLineWidth(0.5);
        doc.line(margin + 5, lY, margin + 5 + 50, lY);

        cy = lY + 8;

        // Helper interno
        const pField = (lbl: string, val: string, x: number, y: number, maxW: number) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text(lbl, x, y);
            const lW = doc.getTextWidth(lbl);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            const vLines = doc.splitTextToSize(val, maxW - lW - 5);
            doc.text(vLines, x + lW + 2, y);
            return doc.getTextDimensions(vLines).h;
        };

        const halfWidth = contentWidth / 2;

        const h1_ = pField("Cédula/RUC:", client.cliCedula, margin + 5, cy, halfWidth);
        cy += Math.max(h1_, 6) + 2;

        const h2_ = pField("Email:", client.cliEmail || 'N/A', margin + 5, cy, contentWidth);
        cy += Math.max(h2_, 6) + 2;

        // Teléfono
        pField("Teléfono:", client.cliTelefono || 'N/A', margin + 5, cy, halfWidth);

        // Col 2
        let c2y = lY + 8;
        const c2x = margin + halfWidth + 5;
        pField("Tipo:", client.tipoCliente?.ticDescripcion || (client.ticIdTipoc === 1 ? "Contado" : "Crédito"), c2x, c2y, halfWidth);

        c2y += 8;
        // Estado circle
        doc.setFillColor(client.cliEstado ? 40 : 220, client.cliEstado ? 167 : 53, client.cliEstado ? 69 : 69);
        doc.circle(c2x + 15, c2y - 1, 1.5, 'F');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(client.cliEstado ? "Activo" : "Inactivo", c2x + 20, c2y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.text("Estado:", c2x, c2y);

        // Dirección
        cy = Math.max(cy, c2y + 6) + 4;
        const ha = pField("Dirección:", client.cliDireccion || 'N/A', margin + 5, cy, contentWidth);
        cy += Math.max(ha, 6) + 5;

        return cy; // Retorna Y final
    };

    // 1. Simulación (o run real tapado) para obtener altura
    // O mejor, dibujamos el rectangulo blanco encima del primer run? No.
    // Vamos a fiarnos del cálculo manual de altura que hicimos antes.

    // Ok, ejecutamos drawContent una vez para pintar ENCIMA del rectangulo, 
    // PERO primero pintamos el rectangulo. ¿Cómo sabemos la altura antes?
    // Estimación conservadora o dry-run real.

    // Vamos a hacer un "pseudo-dry-run" calculando solo alturas de textos largos.
    const _nLines = doc.splitTextToSize(client.cliNombre, contentWidth - 10);
    const _nH = doc.getTextDimensions(_nLines).h;

    const _addrLines = doc.splitTextToSize(client.cliDireccion || 'N/A', contentWidth - (doc.getTextWidth("Dirección:") + 10));
    const _addrH = doc.getTextDimensions(_addrLines).h;

    // Altura base Aprox: PaddingTop(10) + Nombre(_nH) + LineSep(2) + Gap(8) + 3 filas de datos(Lines*3) + Gap(4) + Address(_addrH) + PaddingBot(5)
    // Filas de datos ~ 8pts * 3 = 24.
    const calculatedHeight = 10 + _nH + 2 + 8 + 24 + 4 + _addrH + 5; // Aprox

    // Pintar Fondo Correcto
    doc.setFillColor(bgFill[0], bgFill[1], bgFill[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(cardStartX, cardStartY, contentWidth, calculatedHeight, 3, 3, 'FD');

    // Ahora pintar contenido real
    drawContent();

    // --- SECCIÓN DE FACTURAS ---
    currentY = startY + calculatedHeight + 10;
    doc.setTextColor(0, 0, 0);

    if (invoices.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Historial de Facturas (${invoices.length})`, margin, currentY);
        currentY += 5;

        invoices.forEach((factura, index) => {
            // Check page break para Info Factura ( Header ~ 20 height )
            if (currentY + 30 > doc.internal.pageSize.height - 20) {
                doc.addPage();
                currentY = 20;
            }

            // Cabecera Factura
            doc.setFillColor(52, 58, 64);
            doc.rect(margin, currentY, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");

            const fechaFac = factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A";
            const estadoFac = factura.facEstadoFactura ? "ACTIVA" : "ANULADA";
            doc.text(`FACTURA #${factura.facNumeroFactura}  |  Fecha: ${fechaFac}  |  Estado: ${estadoFac}`, margin + 3, currentY + 5.5);
            doc.text(`Total: $${factura.facTotal.toFixed(2)}`, pageWidth - margin - 3, currentY + 5.5, { align: 'right' });

            currentY += 8;

            const detalles = factura.detallesFactura || [];
            if (detalles.length > 0) {
                const bodyData = detalles.map((d: any) => [
                    d.detCodigoProducto || String(d.detIdProductoExterno),
                    d.detNombreProducto,
                    d.detCantidad,
                    `$${d.detPrecioUnitario.toFixed(2)}`,
                    `$${d.detTotal.toFixed(2)}`
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Cód.', 'Producto', 'Cant.', 'P. Unit', 'Total']],
                    body: bodyData,
                    theme: 'plain',
                    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                    headStyles: { fillColor: [233, 236, 239], textColor: [73, 80, 87], fontStyle: 'bold', lineWidth: 0 },
                    columnStyles: {
                        0: { cellWidth: 25 },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 20, halign: 'right' }
                    },
                    margin: { left: margin, right: margin },
                    // IMPORTANTE: Manejo de salto de página automático de autoTable
                    // Si autoTable salta de pagina, queremos que el siguiente contenido respete el margen top
                    pageBreak: 'auto',
                });

                // Actualizar currentY
                currentY = (doc as any).lastAutoTable.finalY + 5;
            } else {
                doc.setTextColor(150, 150, 150);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.text("(Sin detalles de productos disponibles)", margin + 3, currentY + 5);
                currentY += 10;
            }
            currentY += 2;
        });
    } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(108, 117, 125);
        doc.text("(Este cliente no tiene facturas registradas)", margin, currentY + 5);
        currentY += 10;
    }

    // Guardar posición final en variable custom para el loop principal
    (doc as any).customLastY = currentY;
}

// --- Helpers para reutilizar PDF logic del cliente individual ---


// --- Toast Helpers ---
function showLoadingToast(msg = "Generando Reporte...") {
    if (document.getElementById('pdfLoadingToast')) return;
    const toast = document.createElement('div');
    toast.id = 'pdfLoadingToast';
    toast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    toast.style.zIndex = '9999';
    toast.style.marginTop = '20px';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header bg-primary text-white">
                <span class="spinner-border spinner-border-sm me-2"></span>
                <strong class="me-auto">${msg}</strong>
            </div>
            <div class="toast-body">Por favor espere...</div>
        </div>`;
    document.body.appendChild(toast);
}

function removeLoadingToast() {
    document.getElementById('pdfLoadingToast')?.remove();
}

function showSuccessToast() {
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    toast.style.zIndex = '9999';
    toast.style.marginTop = '20px';
    toast.innerHTML = `
         <div class="toast show" role="alert">
             <div class="toast-header bg-success text-white">
                 <strong class="me-auto">Reporte Generado</strong>
                 <button type="button" class="btn-close btn-close-white" onclick="this.closest('.position-fixed').remove()"></button>
             </div>
             <div class="toast-body">Se descargó el reporte correctamente.</div>
         </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
