import { getAuthHeaders, checkAuth } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Definimos la URL de la API
// Definimos la URL de la API
let BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;

if (typeof window !== "undefined" && (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("amplifyapp.com")
)) {
    console.log("⚠️ [Facturas] Entorno Proxy: Usando Proxy /backend-proxy");
    BASE_URL = "/backend-proxy/api/";
}
const API_URL = BASE_URL + "Facturas";
const CLIENTES_URL = BASE_URL + "Clientes";
const PUNTOS_URL = BASE_URL + "PuntoEmisions";
const ESTABLECIMIENTOS_URL = BASE_URL + "Establecimientoes";
const TIPOS_PAGO_URL = BASE_URL + "TipoPagoes";

// Variables de estado
let facturasData: any[] = [];
let paginaActual = 1;
const registrosPorPagina = 10;
let facturaActual: any = null;
let facturasFiltradas: any[] = [];

// Variables para el reporte global
let allInvoicesCache: any[] = [];
let allClientsCache: any[] = [];
let filteredGlobalFacturas: any[] = [];
let globalFilters = {
    tipoPago: "", // ID del tipo pago
};

// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initFacturas() {
    checkAuth();
    loadFacturas();

    document
        .getElementById("filtroNumero")
        ?.addEventListener("input", () => aplicarFiltros("filtroNumero"));

    document.querySelectorAll(".btnFiltro").forEach((btn) => {
        btn.addEventListener("click", () => {
            const inputId = btn.getAttribute("data-for");
            if (inputId) limpiarFiltroIndividual(inputId);
        });
    });
    setupGlobalReportButton();
}

function limpiarFiltros() {
    (document.getElementById("filtroNumero") as HTMLInputElement).value = "";
    facturasFiltradas = [...facturasData];
    paginaActual = 1;
    renderPagina();

    document.querySelectorAll(".iconoFiltro").forEach((icono) => {
        icono.classList.remove("bi-funnel-fill");
        icono.classList.add("bi-funnel");
    });
}

let allEstablecimientos: any[] = [];
let allTiposPago: any[] = [];

async function loadFacturas() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    try {
        const headers = { headers: getAuthHeaders() };

        const [resFacturas, resEstab, resTipos] = await Promise.all([
            fetch(API_URL, headers),
            fetch(ESTABLECIMIENTOS_URL, headers),
            fetch(TIPOS_PAGO_URL, headers)
        ]);

        if (!resFacturas.ok) {
            if (resFacturas.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error("Error cargando facturas");
        }

        const dataFacturas = await resFacturas.json();
        let datosSinOrdenar = Array.isArray(dataFacturas) ? dataFacturas : (dataFacturas.data || []);

        facturasData = datosSinOrdenar.sort((a: any, b: any) => {
            const numA = a.facNumeroFactura || "";
            const numB = b.facNumeroFactura || "";
            return numB.localeCompare(numA);
        });

        if (resEstab.ok) {
            const dataEstab = await resEstab.json();
            allEstablecimientos = Array.isArray(dataEstab) ? dataEstab : (dataEstab.data || []);
        }

        if (resTipos.ok) {
            const dataTipos = await resTipos.json();
            allTiposPago = Array.isArray(dataTipos) ? dataTipos : (dataTipos.data || []);
        }

        facturasFiltradas = [...facturasData];
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

function formatInvoiceNumber(num: string | null | undefined): string {
    if (!num) return "N/A";
    const digits = num.replace(/\D/g, "");
    if (digits.length === 15) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (num.includes("-")) return num;
    return num;
}

function getEstablecimientoInfo(f: any): string {
    const ruc = f.estRuc || f.puntoEmision?.estRuc;
    if (!ruc) return "N/A";
    const est = allEstablecimientos.find((e: any) => e.estRuc === ruc);
    if (est) {
        return `${est.estNombre} (${est.estRuc})`;
    }
    return ruc;
}

function getTipoPagoInfo(f: any): string {
    if (f.tipoPago && f.tipoPago.tipDescripcion) {
        return f.tipoPago.tipDescripcion;
    }
    if (f.tipIdTipop) {
        const tipo = allTiposPago.find((t: any) => t.tipIdTipop === f.tipIdTipop || t.id === f.tipIdTipop);
        if (tipo) {
            return tipo.tipDescripcion || tipo.descripcion || "N/A";
        }
    }
    return "N/A";
}

function renderFacturas(facturas: any[]) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    if (facturas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay resultados.</td></tr>';
        return;
    }

    tbody.innerHTML = facturas.map((f: any) => `
        <tr>
            <td>
                <div class="d-flex gap-2">
                     <button type="button" class="btn btn-sm btn-info text-white d-inline-flex align-items-center btn-view-factura" 
                        data-numero="${f.facNumeroFactura}">
                        <i class="bi bi-eye-fill me-1"></i> Ver
                    </button>
                </div>
            </td>
            <td class="text-nowrap font-monospace text-center">${formatInvoiceNumber(f.facNumeroFactura)}</td>
            <td>${f.cliente?.cliNombre || f.cliCedula}</td>
            <td>${f.facFechaEmision ? String(f.facFechaEmision).split("T")[0] : "N/A"}</td>
            <td>$${f.facTotal.toFixed(2)}</td>
            <td>${getTipoPagoInfo(f)}</td>
            <td>${getEstablecimientoInfo(f)}</td>
        </tr>
    `).join("");

    attachViewListeners();
}

function aplicarFiltros(inputOrigen: "filtroNumero") {
    const numeroInput = document.getElementById("filtroNumero") as HTMLInputElement;
    const numero = numeroInput.value.toLowerCase();

    facturasFiltradas = facturasData.filter((f) =>
        f.facNumeroFactura.toLowerCase().includes(numero)
    );

    paginaActual = 1;
    renderPagina();
    actualizarIcono("filtroNumero", numero !== "");
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

function setupGlobalReportButton() {
    const btn = document.getElementById("btnReporteGlobal");
    btn?.addEventListener("click", () => openReporteGlobal());
    const btnDownload = document.getElementById("btnDownloadGlobalPdf");
    btnDownload?.addEventListener("click", () => generarReporteGlobalPDF());
}

function renderPagina() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;

    const facturasPagina = facturasFiltradas.slice(inicio, fin);
    renderFacturas(facturasPagina);
    renderPaginacion();
}

function renderPaginacion() {
    const totalPaginas = Math.ceil(facturasFiltradas.length / registrosPorPagina);
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

function attachViewListeners() {
    document.querySelectorAll(".btn-view-factura").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const target = (e.target as HTMLElement).closest(".btn-view-factura");
            if (!target) return;

            const numero = target.getAttribute("data-numero");
            if (!numero) return;

            await showFacturaDetails(numero);
        });
    });
}

// ============================================
// PDF GENERATION (Individual)
// ============================================
function generarPDFFactura() {
    if (!facturaActual) {
        alert("No hay factura cargada");
        return;
    }

    showLoadingToast("Generando PDF...");

    setTimeout(() => {
        const doc = new jsPDF();
        const factura = facturaActual;

        const colorPrimario = [0, 123, 255];
        const colorSecundario = [108, 117, 125];
        const colorExito = [40, 167, 69];

        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        let yPos = 20;

        // ENCABEZADO
        doc.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('FACTURA', pageWidth / 2, 12, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(formatInvoiceNumber(factura.facNumeroFactura), pageWidth / 2, 22, { align: 'center' });

        yPos = 40;

        // Info Factura y Cliente
        doc.setTextColor(0, 0, 0);

        const col1X = margin;
        const col2X = pageWidth / 2 + 5;
        const colWidth = (pageWidth / 2) - margin - 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
        doc.text('Información de Factura', col1X, yPos);

        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const infoFactura = [
            ['Nº Factura:', formatInvoiceNumber(factura.facNumeroFactura)],
            ['Fecha:', factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A"],
            ['Punto Emisión:', factura?.puntoEmision?.pemDescripcion || "N/A"],
            ['Establecimiento:', factura?.puntoEmision?.establecimiento?.estNombre || "N/A"]
        ];

        let startYPos = yPos;
        infoFactura.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorSecundario[0], colorSecundario[1], colorSecundario[2]);
            doc.text(label, col1X, yPos);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const textValue = doc.splitTextToSize(value, colWidth - 35);
            doc.text(textValue, col1X + 32, yPos);
            yPos += 5;
        });

        // Columna Derecha
        yPos = startYPos - 6;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorExito[0], colorExito[1], colorExito[2]);
        doc.text('Información del Cliente', col2X, yPos);

        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const cli = factura.cliente;
        const infoCliente = [
            ['Cliente:', cli?.cliNombre || factura.cliCedula],
            ['Cédula/RUC:', cli?.cliCedula || factura.cliCedula],
            ['Dirección:', cli?.cliDireccion || "N/A"],
            ['Teléfono:', cli?.cliTelefono || "N/A"],
            ['Email:', cli?.cliEmail || "N/A"]
        ];

        infoCliente.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorSecundario[0], colorSecundario[1], colorSecundario[2]);
            doc.text(label, col2X, yPos);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const textValue = doc.splitTextToSize(value, colWidth - 28);
            doc.text(textValue, col2X + 26, yPos);

            yPos += 5;
            if (label === 'Cliente:' || label === 'Dirección:') {
                yPos += 5;
            }
        });

        yPos = Math.max(yPos, startYPos + 25) + 8;

        // Tabla
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Detalle de Productos', margin, yPos);
        yPos += 3;

        const detalles = factura.detallesFactura || [];
        const tableData = detalles.map((d: any) => [
            d.detCodigoProducto || "S/C",
            d.detNombreProducto,
            d.detCantidad.toString(),
            `$${d.detPrecioUnitario.toFixed(2)}`,
            d.detGrabaIva ? "Sí" : "No",
            `$${d.detTotal.toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Código', 'Descripción', 'Cant.', 'P. Unit.', 'IVA', 'Total']],
            body: tableData,
            theme: 'striped',
            margin: { left: margin, right: margin },
            headStyles: {
                fillColor: [colorSecundario[0], colorSecundario[1], colorSecundario[2]],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 15 },
                3: { halign: 'right', cellWidth: 23 },
                4: { halign: 'center', cellWidth: 12 },
                5: { halign: 'right', cellWidth: 23 }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;
        const totales = [
            ['Subtotal (0%):', `$${factura.facSubtotalSinIva.toFixed(2)}`],
            ['Subtotal (IVA):', `$${factura.facSubtotalConIva.toFixed(2)}`],
            ['IVA Total:', `$${factura.facIva.toFixed(2)}`]
        ];

        let totalY = finalY;
        doc.setFontSize(9);
        const totalesX = pageWidth - margin - 50;

        totales.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorSecundario[0], colorSecundario[1], colorSecundario[2]);
            doc.text(label, totalesX, totalY, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(value, pageWidth - margin, totalY, { align: 'right' });
            totalY += 6;
        });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
        doc.text('TOTAL:', totalesX, totalY, { align: 'right' });
        doc.text(`$${factura.facTotal.toFixed(2)}`, pageWidth - margin, totalY, { align: 'right' });

        const nombreArchivo = `Factura_${formatInvoiceNumber(factura.facNumeroFactura).replace(/\//g, '-')}.pdf`;
        doc.save(nombreArchivo);

        removeLoadingToast();
        showSuccessToast();
    }, 1000);
}

// ============================================
// REPORTE GLOBAL
// ============================================
async function openReporteGlobal() {
    const modalEl = document.getElementById("reporteGlobalModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setupGlobalReportFiltersListeners();

    const tbody = document.getElementById("globalReportBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary" role="status"></div><br>Cargando datos globales...</td></tr>';

    try {
        let invoices = [];
        if (facturasData.length > 0) {
            invoices = facturasData;
        } else {
            const resInvoices = await fetch(API_URL, { headers: getAuthHeaders() });
            if (!resInvoices.ok) {
                if (resInvoices.status === 401) window.location.href = '/login';
                throw new Error(`Error fetching invoices: ${resInvoices.status}`);
            }
            const dataInvoices = await resInvoices.json();
            invoices = Array.isArray(dataInvoices) ? dataInvoices : (dataInvoices.data || []);
        }

        if (allClientsCache.length === 0) {
            const resClients = await fetch(CLIENTES_URL, { headers: getAuthHeaders() });
            if (resClients.ok) {
                const dataClients = await resClients.json();
                allClientsCache = Array.isArray(dataClients) ? dataClients : (dataClients.data || []);
            }
        }
        allInvoicesCache = invoices;

        const selectTipo = document.getElementById("globalFiltroTipoPago") as HTMLSelectElement;
        if (selectTipo && allTiposPago.length > 0) {
            selectTipo.innerHTML = '<option value="">Todos los tipos</option>' +
                allTiposPago.map(t => `<option value="${t.tipIdTipop}">${t.tipDescripcion}</option>`).join('');
        }

        resetGlobalFilters();
        applyGlobalFilters();
    } catch (e) {
        console.error("Error loading global report data", e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error cargando datos. Ver consola para más detalles.</td></tr>`;
    }
}

function setupGlobalReportFiltersListeners() {
    const el = document.getElementById("globalFiltroTipoPago");
    if (el && !el.dataset.listenerAttached) {
        el.addEventListener("change", applyGlobalFilters);
        el.dataset.listenerAttached = "true";
    }

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
    globalFilters = { tipoPago: "" };
    (document.getElementById("globalFiltroTipoPago") as HTMLSelectElement).value = "";
}

function applyGlobalFilters() {
    globalFilters.tipoPago = (document.getElementById("globalFiltroTipoPago") as HTMLSelectElement).value;

    filteredGlobalFacturas = allInvoicesCache.filter(f => {
        let validTipo = true;
        if (globalFilters.tipoPago !== "") {
            const tipoId = parseInt(globalFilters.tipoPago);
            validTipo = !isNaN(tipoId) && f.tipIdTipop === tipoId;
        }
        return validTipo;
    });
    renderGlobalReportTable();
}

function renderGlobalReportTable() {
    const tbody = document.getElementById("globalReportBody");
    if (!tbody) return;
    if (filteredGlobalFacturas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay facturas que coincidan con los filtros.</td></tr>';
        return;
    }
    tbody.innerHTML = filteredGlobalFacturas.map(factura => {
        const clienteNombre = allClientsCache.find(c => c.cliCedula === (factura.cliente?.cliCedula || factura.cliCedula))?.cliNombre || factura.cliente?.cliNombre || "N/A";
        const tipoPagoDesc = getTipoPagoInfo(factura);
        return `
            <tr>
                <td class="font-monospace">${formatInvoiceNumber(factura.facNumeroFactura)}</td>
                <td class="text-start">${clienteNombre}</td>
                <td>${factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A"}</td>
                <td class="fw-bold">$${factura.facTotal.toFixed(2)}</td>
                <td><span class="badge bg-secondary">${tipoPagoDesc}</span></td>
            </tr>
        `;
    }).join("");
}

async function generarReporteGlobalPDF() {
    if (filteredGlobalFacturas.length === 0) {
        alert("No hay datos para generar el reporte con los filtros actuales.");
        return;
    }
    showLoadingToast("Generando Reporte Global...");
    const doc = new jsPDF();
    let isFirstPage = true;
    let yPos = 50;

    // Portada
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE GENERAL DE FACTURAS", doc.internal.pageSize.width / 2, 25, { align: "center" });
    doc.setFontSize(14);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width / 2, 35, { align: "center" });

    yPos = 50;
    for (let i = 0; i < filteredGlobalFacturas.length; i++) {
        const factura = filteredGlobalFacturas[i];
        if (!factura.detallesFactura) {
            try {
                const res = await fetch(`${API_URL}/${factura.facNumeroFactura}`, { headers: getAuthHeaders() });
                if (res.ok) {
                    const fullFactura = await res.json();
                    filteredGlobalFacturas[i] = { ...factura, ...fullFactura };
                    factura.detallesFactura = fullFactura.detallesFactura;
                }
            } catch (e) { console.warn("Error cargando detalles para PDF", e); }
        }

        if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
        } else if (!isFirstPage && i > 0) {
            doc.setDrawColor(200, 200, 200);
            doc.line(15, yPos - 5, doc.internal.pageSize.width - 15, yPos - 5);
        }
        isFirstPage = false;
        generateFacturaSection(doc, factura, yPos);
        const lastY = (doc as any).lastAutoTable?.finalY;
        yPos = lastY ? lastY + 15 : yPos + 60;
    }
    doc.save(`Reporte_Global_Facturas_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    removeLoadingToast();
    showSuccessToast();
}

function drawTextBlock(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number
): number {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + doc.getTextDimensions(lines).h + 3;
}

function generateFacturaSection(doc: jsPDF, factura: any, startY: number) {
    const margin = 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Factura: ${formatInvoiceNumber(factura.facNumeroFactura)}`, margin, startY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    const clienteCedula = factura.cliente?.cliCedula || factura.cliCedula || "";
    const clienteNombre = allClientsCache.find(c => c.cliCedula === clienteCedula)?.cliNombre || factura.cliente?.cliNombre || "N/A";
    const tipoPago = getTipoPagoInfo(factura);

    let currentY = startY + 6;
    const maxWidth = doc.internal.pageSize.width - margin * 2;

    currentY = drawTextBlock(doc, `Cliente: ${clienteNombre}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Tipo de Pago: ${tipoPago}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Fecha: ${factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A"}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Total: $${factura.facTotal.toFixed(2)}`, margin, currentY, maxWidth);

    const tableStartY = currentY + 4;
    const detalles = factura.detallesFactura || [];
    if (detalles.length > 0) {
        const tableData = detalles.map((d: any) => [
            d.detCodigoProducto || "S/C",
            d.detNombreProducto,
            d.detCantidad.toString(),
            `$${d.detPrecioUnitario.toFixed(2)}`,
            d.detGrabaIva ? "Sí" : "No",
            `$${d.detTotal.toFixed(2)}`
        ]);
        autoTable(doc, {
            startY: tableStartY,
            head: [['Código', 'Descripción', 'Cant.', 'P. Unit.', 'IVA', 'Total']],
            body: tableData,
            theme: 'plain',
            margin: { left: margin + 5 },
            tableWidth: 100,
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
        });
    } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("(Sin detalles de productos)", margin + 5, tableStartY + 4);
        (doc as any).lastAutoTable = { finalY: tableStartY + 5 };
    }
    const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: $${factura.facTotal.toFixed(2)}`, doc.internal.pageSize.width - margin, finalY, { align: 'right' });
}

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

async function showFacturaDetails(numeroFactura: string) {
    let factura = facturasData.find(f => f.facNumeroFactura === numeroFactura);

    if (!factura || !factura.detallesFactura) {
        try {
            const response = await fetch(`${API_URL}/${numeroFactura}`, { headers: getAuthHeaders() });
            if (response.ok) {
                factura = await response.json();
            }
        } catch (e) {
            console.error("Error cargando factura completa", e);
        }
    }

    if (!factura) {
        alert("No se pudo cargar la información de la factura.");
        return;
    }

    if (!factura.cliente && factura.cliCedula) {
        try {
            const res = await fetch(`${CLIENTES_URL}/${factura.cliCedula}`, { headers: getAuthHeaders() });
            if (res.ok) factura.cliente = await res.json();
        } catch (e) { console.warn("No se pudo cargar cliente extra", e); }
    }

    if (!factura.puntoEmision && factura.pemId) {
        try {
            const res = await fetch(`${PUNTOS_URL}/${factura.pemId}`, { headers: getAuthHeaders() });
            if (res.ok) factura.puntoEmision = await res.json();
        } catch (e) { console.warn("No se pudo cargar punto extra", e); }
    }

    if (factura.puntoEmision && !factura.puntoEmision.establecimiento && factura.puntoEmision.estRuc) {
        try {
            const res = await fetch(`${ESTABLECIMIENTOS_URL}/${factura.puntoEmision.estRuc}`, { headers: getAuthHeaders() });
            if (res.ok) {
                factura.puntoEmision.establecimiento = await res.json();
            }
        } catch (e) { console.warn("No se pudo cargar establecimiento extra", e); }
    }

    const setText = (id: string, text: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    setText("modalFacNumero", factura.facNumeroFactura);
    setText("modalFacFecha", factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A");
    setText("modalFacPuntoEmision", factura?.puntoEmision?.pemDescripcion || "N/A");

    const estNombre = factura?.puntoEmision?.establecimiento?.estNombre || "N/A";
    setText("modalFacEstablecimiento", estNombre);

    // ==========================================================
    // CORRECCIÓN: Agregar la línea que faltaba
    // ==========================================================
    setText("modalFacTipoPago", getTipoPagoInfo(factura));
    // ==========================================================

    const cli = factura.cliente;
    setText("modalCliNombre", cli?.cliNombre || factura.cliCedula);
    setText("modalCliCedula", cli?.cliCedula || factura.cliCedula);
    setText("modalCliDireccion", cli?.cliDireccion || "N/A");
    setText("modalCliTelefono", cli?.cliTelefono || "N/A");
    setText("modalCliEmail", cli?.cliEmail || "N/A");

    const tbody = document.getElementById("modalDetallesBody");
    if (tbody) {
        const detalles = factura.detallesFactura || [];
        if (detalles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay detalles registrados</td></tr>`;
        } else {
            tbody.innerHTML = detalles.map((d: any) => `
                <tr>
                    <td class="ps-4">
                        <span class="badge bg-light text-dark border">${d.detCodigoProducto || "S/C"}</span>
                    </td>
                    <td>${d.detNombreProducto}</td>
                    <td class="text-center">${d.detCantidad}</td>
                    <td class="text-end">$${d.detPrecioUnitario.toFixed(2)}</td>
                    <td class="text-center">
                        ${d.detGrabaIva
                    ? '<i class="bi bi-check-circle-fill text-success" title="Sí"></i>'
                    : '<i class="bi bi-dash-circle text-secondary" title="No"></i>'}
                    </td>
                    <td class="text-end pe-4 fw-medium">$${d.detTotal.toFixed(2)}</td>
                </tr>
            `).join("");
        }
    }

    setText("modalFacSubtotalSinIva", `$${factura.facSubtotalSinIva.toFixed(2)}`);
    setText("modalFacSubtotalConIva", `$${factura.facSubtotalConIva.toFixed(2)}`);
    setText("modalFacIva", `$${factura.facIva.toFixed(2)}`);
    setText("modalFacTotal", `$${factura.facTotal.toFixed(2)}`);

    facturaActual = factura;

    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (downloadBtn) {
        const newBtn = downloadBtn.cloneNode(true) as HTMLElement;
        downloadBtn.parentNode?.replaceChild(newBtn, downloadBtn);
        newBtn.addEventListener("click", generarPDFFactura);
    }

    const modalEl = document.getElementById("viewFacturaModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}