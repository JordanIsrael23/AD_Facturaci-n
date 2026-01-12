
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

            const confirmBtn = document.getElementById("confirmDeleteBtn");
            confirmBtn?.classList.remove(`btn-${prevColorClass}`);
            confirmBtn?.classList.add(`btn-${colorClass}`);
            if (confirmBtn) confirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;

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

    // Populate Info
    const setText = (id: string, val: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setText("modalCliNombre", cliente.cliNombre);
    setText("modalCliCedula", cliente.cliCedula);
    setText("modalCliFechaNac", cliente.cliFechaNacimiento ? String(cliente.cliFechaNacimiento).split("T")[0] : "N/A");
    setText("modalCliTipo", cliente.tipoCliente?.ticDescripcion || (cliente.ticIdTipoc === 1 ? "Contado" : "Crédito"));
    setText("modalCliEmail", cliente.cliEmail || "N/A");
    setText("modalCliTelefono", cliente.cliTelefono || "N/A");
    setText("modalCliDireccion", cliente.cliDireccion || "N/A");

    // Estado badge
    const estadoEl = document.getElementById("modalCliEstado");
    if (estadoEl) {
        estadoEl.innerHTML = `<span class="badge ${cliente.cliEstado ? "text-bg-success" : "text-bg-danger"}">${cliente.cliEstado ? "Activo" : "Inactivo"}</span>`;
    }

    // Load Invoices
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

    // Show Modal
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

    // Mostrar toast de carga
    const loadingToast = document.createElement('div');
    loadingToast.id = 'pdfLoadingToast';
    loadingToast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    loadingToast.style.zIndex = '9999';
    loadingToast.style.marginTop = '20px';
    loadingToast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header bg-primary text-white">
                <span class="spinner-border spinner-border-sm me-2"></span>
                <strong class="me-auto">Generando Reporte</strong>
            </div>
            <div class="toast-body">
                Obteniendo facturas y generando PDF...
            </div>
        </div>
    `;
    document.body.appendChild(loadingToast);

    try {
        // Obtener facturas del backend (traemos todas y filtramos, idealmente habría endpoint por cliente)
        const res = await fetch(FACTURAS_URL, { headers: getAuthHeaders() });
        let facturasCliente: any[] = [];

        if (res.ok) {
            const allFacturas = await res.json();
            const lista = Array.isArray(allFacturas) ? allFacturas : (allFacturas.data || []);
            // Filtrar por cedula
            facturasCliente = lista.filter((f: any) => f.cliCedula === cedula || f.cliente?.cliCedula === cedula);
        } else {
            console.warn("No se pudieron cargar las facturas");
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        let yPos = 20;

        // --- ENCABEZADO ---
        const colorPrimario = [0, 123, 255]; // Azul bootstrap

        doc.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE CLIENTE', pageWidth / 2, 12, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

        yPos = 40;

        // --- INFO CLIENTE ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Datos del Cliente", margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const info = [
            `Cédula: ${cliente.cliCedula}`,
            `Nombre: ${cliente.cliNombre}`,
            `Dirección: ${cliente.cliDireccion || 'N/A'}`,
            `Teléfono: ${cliente.cliTelefono || 'N/A'}`,
            `Email: ${cliente.cliEmail || 'N/A'}`,
            `Tipo: ${cliente.tipoCliente?.ticDescripcion || (cliente.ticIdTipoc === 1 ? "Contado" : "Crédito")}`
        ];

        info.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += 6;
        });

        yPos += 10;

        // --- TABLA DE FACTURAS ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Historial de Facturas", margin, yPos);
        yPos += 5;

        if (facturasCliente.length > 0) {
            const tableData = facturasCliente.map((f: any) => [
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

            // Total Global
            const totalGlobal = facturasCliente.filter((f: any) => f.facEstadoFactura).reduce((sum, f) => sum + f.facTotal, 0);
            const finalY = (doc as any).lastAutoTable.finalY + 10;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total Facturado (Activas): $${totalGlobal.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text("Este cliente no tiene facturas registradas.", margin, yPos + 10);
        }

        // Guardar
        doc.save(`Reporte_Cliente_${cliente.cliCedula}.pdf`);

        // Toast éxito
        const successToast = document.createElement('div');
        successToast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
        successToast.style.zIndex = '9999';
        successToast.style.marginTop = '20px';
        successToast.innerHTML = `
             <div class="toast show" role="alert">
                 <div class="toast-header bg-success text-white">
                     <strong class="me-auto">Reporte Generado</strong>
                     <button type="button" class="btn-close btn-close-white" onclick="this.closest('.position-fixed').remove()"></button>
                 </div>
                 <div class="toast-body">Se descargó el reporte correctamente.</div>
             </div>
         `;
        document.body.appendChild(successToast);
        setTimeout(() => successToast.remove(), 4000);

    } catch (err) {
        console.error("Error generando PDF cliente", err);
        alert("Ocurrió un error al generar el reporte.");
    } finally {
        if (loadingToast) loadingToast.remove();
    }
}
