
// src/scripts/clientes.ts
import { getAuthHeaders, checkAuth } from "./auth";
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


    tbody.innerHTML = clientes.map((c: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-info text-white d-inline-flex align-items-center btn-view-cliente" 
                        data-cedula="${c.cliCedula}">
                        <i class="bi bi-eye-fill me-1"></i> Ver
                    </button>
                    <a href="editar_clientes?id=${c.cliCedula}" class="btn btn-sm btn-warning d-inline-flex align-items-center">
                        <i class="bi bi-pencil-square me-1"></i> Editar
                    </a>
                    <button type="button" class="btn btn-sm ${c.cliEstado ? "btn-danger" : "btn-success"} d-inline-flex align-items-center btn-delete" 
                        data-cedula="${c.cliCedula}" data-nombre="${c.cliNombre}" data-estado="${c.cliEstado}">
                        <i class="bi ${c.cliEstado ? "bi-trash" : "bi-check-circle"} me-1"></i> ${c.cliEstado ? "Desactivar" : "Activar"}
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
        await generarPDFCliente(currentClienteForPdf);
    });
}

function setupGlobalReportButton() {
    const btn = document.getElementById("btnReporteGlobal");
    btn?.addEventListener("click", () => openReporteGlobal());

    const btnDownload = document.getElementById("btnDownloadGlobalPdf");
    btnDownload?.addEventListener("click", () => generarReporteGlobalPDF());
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
        }

        const doc = new jsPDF();
        generateSingleClientPDF(doc, cliente, facturasCliente);
        doc.save(`Reporte_Cliente_${cliente.cliCedula}.pdf`);
        showSuccessToast();

    } catch (err) {
        console.error(err);
        alert("Error al generar reporte");
    } finally {
        removeLoadingToast();
    }
}

// NUEVAS FUNCIONES PARA REPORTE GLOBAL

let allClientsCache: any[] = [];
let allInvoicesCache: any[] = [];

async function openReporteGlobal() {
    // Show Loading in Modal Table
    const modalEl = document.getElementById("reporteGlobalModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    const tbody = document.getElementById("globalReportBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary" role="status"></div><br>Cargando datos globales...</td></tr>';

    try {
        // Fetch all needed data
        // 1. Clientes (already loaded in variable `clientesData` but good to ensure freshness or use local)
        const clients = clientesData.length > 0 ? clientesData : (await (await fetch(API_URL, { headers: getAuthHeaders() })).json());
        const invoicesRes = await fetch(FACTURAS_URL, { headers: getAuthHeaders() });
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];
        const invoicesList = Array.isArray(invoices) ? invoices : (invoices.data || []);

        allClientsCache = Array.isArray(clients) ? clients : (clients.data || []);
        allInvoicesCache = invoicesList;

        // Populate Table Review
        tbody.innerHTML = allClientsCache.map(client => {
            const clientInvoices = allInvoicesCache.filter((f: any) => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);
            const total = clientInvoices.filter((f: any) => f.facEstadoFactura).reduce((sum: number, f: any) => sum + f.facTotal, 0);

            return `
                <tr>
                    <td class="font-monospace">${client.cliCedula}</td>
                    <td class="text-start">${client.cliNombre}</td>
                    <td><span class="badge bg-secondary">${client.tipoCliente?.ticDescripcion || "Estándar"}</span></td>
                    <td>${clientInvoices.length}</td>
                    <td class="fw-bold">$${total.toFixed(2)}</td>
                </tr>
            `;
        }).join("");

    } catch (e) {
        console.error("Error loading global report data", e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error cargando datos. Intente nuevamente.</td></tr>`;
    }
}

async function generarReporteGlobalPDF() {
    if (allClientsCache.length === 0) {
        alert("No hay datos para generar el reporte.");
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

    for (let i = 0; i < allClientsCache.length; i++) {
        const client = allClientsCache[i];
        const clientInvoices = allInvoicesCache.filter((f: any) => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);

        // Verificar espacio para encabezado de cliente
        if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
        } else if (!isFirstPage && i > 0) {
            // Separador visual
            doc.setDrawColor(200, 200, 200);
            doc.line(15, yPos - 5, doc.internal.pageSize.width - 15, yPos - 5);
        }
        isFirstPage = false;

        generateClientSection(doc, client, clientInvoices, yPos);

        // Actualizar yPos basado en lastAutoTable o estimación
        // autoTable escribe en el doc y actualiza lastAutoTable.finalY
        const lastY = (doc as any).lastAutoTable?.finalY;
        yPos = lastY ? lastY + 15 : yPos + 40;
    }

    doc.save(`Reporte_Global_Clientes_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    removeLoadingToast();
    showSuccessToast();
}

function generateClientSection(doc: jsPDF, client: any, invoices: any[], startY: number) {
    const margin = 15;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${client.cliNombre}`, margin, startY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`C.I/RUC: ${client.cliCedula} | Email: ${client.cliEmail || 'N/A'} | Tel: ${client.cliTelefono || 'N/A'}`, margin, startY + 6);

    if (invoices.length > 0) {
        const tableData = invoices.map((f: any) => [
            f.facNumeroFactura,
            f.facFechaEmision ? String(f.facFechaEmision).split("T")[0] : "N/A",
            f.facEstadoFactura ? "Activa" : "Anulada",
            `$${f.facTotal.toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: startY + 10,
            head: [['Factura', 'Fecha', 'Estado', 'Total']],
            body: tableData,
            theme: 'plain',
            margin: { left: margin + 5 },
            tableWidth: 100, // Tabla compacta
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
        });
    } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("(Sin historial de facturas)", margin + 5, startY + 14);
        // Mocking lastAutoTable for spacing if no table
        (doc as any).lastAutoTable = { finalY: startY + 15 };
    }
}

// --- Helpers para reutilizar PDF logic del cliente individual ---
function generateSingleClientPDF(doc: jsPDF, client: any, invoices: any[]) {
    // ... codigo de diseño anterior adaptado o reutilizado si se desea, 
    // pero aqui copiaremos la logica original de generarPDFCliente para integridad
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;

    const colorPrimario = [0, 123, 255];
    doc.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE CLIENTE', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

    let yPos = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Datos del Cliente", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const info = [
        `Cédula: ${client.cliCedula}`,
        `Nombre: ${client.cliNombre}`,
        `Dirección: ${client.cliDireccion || 'N/A'}`,
        `Teléfono: ${client.cliTelefono || 'N/A'}`,
        `Email: ${client.cliEmail || 'N/A'}`,
        `Tipo: ${client.tipoCliente?.ticDescripcion || (client.ticIdTipoc === 1 ? "Contado" : "Crédito")}`
    ];
    info.forEach(line => { doc.text(line, margin, yPos); yPos += 6; });
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Historial de Facturas", margin, yPos);
    yPos += 5;

    if (invoices.length > 0) {
        const tableData = invoices.map((f: any) => [
            f.facNumeroFactura,
            f.facFechaEmision ? String(f.facFechaEmision).split("T")[0] : "N/A",
            f.facEstadoFactura ? "Activa" : "Anulada",
            `$${f.facTotal.toFixed(2)}`
        ]);
        autoTable(doc, {
            startY: yPos,
            head: [['Nº Factura', 'Fecha', 'Estado', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [100, 100, 100] },
            styles: { fontSize: 10 }
        });
        const totalGlobal = invoices.filter((f: any) => f.facEstadoFactura).reduce((sum, f) => sum + f.facTotal, 0);
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Facturado (Activas): $${totalGlobal.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
    } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text("Este cliente no tiene facturas registradas.", margin, yPos + 10);
    }
}

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
