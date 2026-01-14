import { getAuthHeaders, checkAuth } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Definimos la URL de la API
const BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_URL = BASE_URL + "Facturas";
const CLIENTES_URL = BASE_URL + "Clientes";
const PUNTOS_URL = BASE_URL + "PuntoEmisions";
const ESTABLECIMIENTOS_URL = BASE_URL + "Establecimientoes";
const TIPOS_PAGO_URL = BASE_URL + "TipoPagoes";

let facturaIdToDelete: string | null = null;
let facturaNuevoEstado: boolean = false;
let facturasData: any[] = [];
let hayFiltros = false;
let paginaActual = 1;
const registrosPorPagina = 10;
let facturaActual: any = null;
let facturasFiltradas: any[] = [];

// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initFacturas() {
    checkAuth();
    loadFacturas();
    setupDeleteModal();

    document
        .getElementById("filtroNumero")
        ?.addEventListener("input", () => aplicarFiltros("filtroNumero"));

    document.querySelectorAll(".btnFiltro").forEach((btn) => {
        btn.addEventListener("click", () => {
            const inputId = btn.getAttribute("data-for");
            if (inputId) limpiarFiltroIndividual(inputId);
        });
    });
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

    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando...</td></tr>';

    try {
        // Cargar Facturas, Establecimientos y Tipos de Pago en paralelo
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

        // Procesar Facturas
        const dataFacturas = await resFacturas.json();
        let datosSinOrdenar = Array.isArray(dataFacturas) ? dataFacturas : (dataFacturas.data || []);

        // Ordenamos descendentemente (la factura con número más alto/reciente va primero)
        facturasData = datosSinOrdenar.sort((a: any, b: any) => {
            // Asumimos que facNumeroFactura es un string. localeCompare hace la comparación alfabética/numérica inversa.
            // Si tuvieras un campo numérico 'id' autoincremental, podrías usar: return b.id - a.id;
            const numA = a.facNumeroFactura || "";
            const numB = b.facNumeroFactura || "";
            return numB.localeCompare(numA); 
        });

        // Procesar Establecimientos
        if (resEstab.ok) {
            const dataEstab = await resEstab.json();
            allEstablecimientos = Array.isArray(dataEstab) ? dataEstab : (dataEstab.data || []);
        }

        // Procesar Tipos de Pago
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
                <td colspan="8" class="text-center text-danger">
                    Error de conexión.
                </td>
            </tr>`;
    }
}

function formatInvoiceNumber(num: string | null | undefined): string {
    if (!num) return "N/A";

    // Eliminar cualquier caracter que no sea número
    const digits = num.replace(/\D/g, "");

    // Si no tiene la longitud esperada (15), devolver original o intentar formatear lo que hay
    // Formato: 3 - 3 - 9  (XXX-XXX-XXXXXXXXX)
    if (digits.length === 15) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Fallback: si ya viene con guiones y parece correcto
    if (num.includes("-")) return num;

    return num;
}

function getEstablecimientoInfo(f: any): string {
    // Buscar el establecimiento
    // 1. Intentar por estRuc directo en factura
    // 2. Intentar por puntoEmision.estRuc
    const ruc = f.estRuc || f.puntoEmision?.estRuc;

    if (!ruc) return "N/A";

    const est = allEstablecimientos.find((e: any) => e.estRuc === ruc);
    if (est) {
        return `${est.estNombre} (${est.estRuc})`;
    }

    // Si no encontramos el establecimiento en la lista, mostramos el RUC al menos
    return ruc;
}

function getTipoPagoInfo(f: any): string {
    // Prioridad 1: Objeto anidado
    if (f.tipoPago && f.tipoPago.tipDescripcion) {
        return f.tipoPago.tipDescripcion;
    }

    // Prioridad 2: Buscar en la lista cargada por ID
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
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay resultados.</td></tr>';
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
                    <button type="button" class="btn btn-sm ${f.facEstadoFactura ? "btn-danger" : "btn-success"} d-inline-flex align-items-center btn-delete" 
                        data-numero="${f.facNumeroFactura}" data-estado="${f.facEstadoFactura}">
                        <i class="bi ${f.facEstadoFactura ? "bi-trash" : "bi-check-circle"} me-1"></i> ${f.facEstadoFactura ? "Anular" : "Activar"}
                    </button>
                </div>
            </td>
            <td class="text-nowrap font-monospace text-center">${formatInvoiceNumber(f.facNumeroFactura)}</td>
            <td>${f.cliente?.cliNombre || f.cliCedula}</td>
            <td>${f.facFechaEmision ? String(f.facFechaEmision).split("T")[0] : "N/A"}</td>
            <td>$${f.facTotal.toFixed(2)}</td>
            <td>${getTipoPagoInfo(f)}</td>
            <td>${getEstablecimientoInfo(f)}</td>
            <td><span class="badge ${f.facEstadoFactura ? "text-bg-success" : "text-bg-danger"}">
                    ${f.facEstadoFactura ? "Activa" : "Anulada"}
                </span>
            </td>
        </tr>
    `).join("");

    attachDeleteListeners();
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

function setupDeleteModal() {
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn?.addEventListener("click", async () => {
        if (!facturaIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}/${facturaIdToDelete}/estado`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ estado: facturaNuevoEstado }),
            });

            if (response.ok) {
                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadFacturas();
            } else if (response.status === 401) {
                window.location.href = '/login';
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

            const numero = target.getAttribute("data-numero");
            const estadoActual = target.getAttribute("data-estado") === "true";

            facturaIdToDelete = numero;
            facturaNuevoEstado = !estadoActual;

            const accion = facturaNuevoEstado ? "Activar" : "Anular";
            const colorClass = facturaNuevoEstado ? "success" : "danger";
            const prevColorClass = facturaNuevoEstado ? "danger" : "success";

            // Update Modal Styling
            const modalContent = document.querySelector("#confirmDeleteModal .modal-content");
            modalContent?.classList.remove(`border-${prevColorClass}`);
            modalContent?.classList.add(`border-${colorClass}`);

            const modalHeader = document.querySelector("#confirmDeleteModal .modal-header");
            modalHeader?.classList.remove(`bg-${prevColorClass}`);
            modalHeader?.classList.add(`bg-${colorClass}`);

            const modalTitle = document.getElementById("confirmDeleteModalLabel");
            if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-${facturaNuevoEstado ? "check-circle" : "exclamation-triangle"}-fill me-2 fs-4"></i> Confirmar ${accion.toLowerCase()}`;

            const confirmBtn = document.getElementById("confirmDeleteModal .btn-danger");
            // Nota: Aquí había un error en el script original seleccionando el botón.
            // Arreglamos seleccionando por ID
            const confirmBtnFixed = document.getElementById("confirmDeleteBtn");

            if (confirmBtnFixed) {
                confirmBtnFixed.className = `btn btn-${colorClass} d-inline-flex align-items-center`;
                confirmBtnFixed.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;
            }

            const modalBody = document.querySelector("#confirmDeleteModal .modal-body p.lead");
            if (modalBody) modalBody.innerHTML = `¿Estás seguro que deseas ${accion.toLowerCase()} la factura <strong>${numero}</strong>?`;

            const modalBodySub = document.querySelector("#confirmDeleteModal .modal-body p.text-muted");
            if (modalBodySub) modalBodySub.innerHTML = `La factura será ${facturaNuevoEstado ? "activada" : "anulada"}.`;

            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("confirmDeleteModal"));
            modal.show();
        });
    });
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

function generarPDFFactura() {
    if (!facturaActual) {
        alert("No hay factura cargada");
        return;
    }

    // ====== MOSTRAR MENSAJE DE "GENERANDO PDF..." ======
    const loadingToast = document.createElement('div');
    loadingToast.id = 'pdfLoadingToast';
    loadingToast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    loadingToast.style.zIndex = '9999';
    loadingToast.style.marginTop = '20px';
    loadingToast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header bg-primary text-white">
                <span class="spinner-border spinner-border-sm me-2"></span>
                <strong class="me-auto">Generando PDF</strong>
            </div>
            <div class="toast-body">
                Por favor espere, generando documento...
            </div>
        </div>
    `;
    document.body.appendChild(loadingToast);
    
    // Dar tiempo para que se vea el mensaje
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

        // SECCIÓN: INFORMACIÓN DE FACTURA Y CLIENTE (DOS COLUMNAS)
        doc.setTextColor(0, 0, 0);
        
        // Columna Izquierda - Info Factura
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
            ['Estado:', factura.facEstadoFactura ? "Activa" : "Anulada"],
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
        
        // Columna Derecha - Info Cliente
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

            // Espaciado normal
            yPos += 5;

            // Salto extra después de Cliente y Dirección
            if (label === 'Cliente:' || label === 'Dirección:') {
                yPos += 5;
            }
        });

        yPos = Math.max(yPos, startYPos + 25) + 8;

        // TABLA DE PRODUCTOS
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
            styles: { 
                fontSize: 8,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 15 },
                3: { halign: 'right', cellWidth: 23 },
                4: { halign: 'center', cellWidth: 12 },
                5: { halign: 'right', cellWidth: 23 }
            }
        });

        // TOTALES
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

        // TOTAL GENERAL
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
        doc.text('TOTAL:', totalesX, totalY, { align: 'right' });
        doc.text(`$${factura.facTotal.toFixed(2)}`, pageWidth - margin, totalY, { align: 'right' });

        // PIE DE PÁGINA
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(7);
        doc.setTextColor(colorSecundario[0], colorSecundario[1], colorSecundario[2]);
        doc.setFont('helvetica', 'italic');
        doc.text(
            `Documento generado el ${new Date().toLocaleDateString('es-ES')}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );

        const nombreArchivo = `Factura_${formatInvoiceNumber(factura.facNumeroFactura).replace(/\//g, '-')}.pdf`;
        doc.save(nombreArchivo);

        // ====== REMOVER MENSAJE DE CARGA ======
        const toast = document.getElementById('pdfLoadingToast');
        if (toast) toast.remove();
        
        // ====== MOSTRAR MENSAJE DE ÉXITO ======
        const successToast = document.createElement('div');
        successToast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
        successToast.style.zIndex = '9999';
        successToast.style.marginTop = '20px';
        successToast.innerHTML = `
            <div class="toast show" role="alert">
                <div class="toast-header bg-success text-white">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <strong class="me-auto">PDF Generado</strong>
                    <button type="button" class="btn-close btn-close-white" onclick="this.closest('.position-fixed').remove()"></button>
                </div>
                <div class="toast-body">
                    El PDF fue generado correctamente. Seleccione dónde desea guardarlo.
                </div>
            </div>
        `;
        document.body.appendChild(successToast);
        
        // Cerrar automáticamente después de 4 segundos
        setTimeout(() => {
            if (successToast.parentNode) {
                successToast.remove();
            }
        }, 10000);
    }, 1000); // Tiempo para que se vea el mensaje de carga
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

    const estadoEl = document.getElementById("modalFacEstado");
    if (estadoEl) {
        estadoEl.innerHTML = `<span class="badge ${factura.facEstadoFactura ? "text-bg-success" : "text-bg-danger"}">
            ${factura.facEstadoFactura ? "Activa" : "Anulada"}
        </span>`;
    }

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

    // AGREGAR ESTO NUEVO AQUÍ
    facturaActual = factura;
    
    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (downloadBtn) {
        const newBtn = downloadBtn.cloneNode(true) as HTMLElement;
        downloadBtn.parentNode?.replaceChild(newBtn, downloadBtn);
        newBtn.addEventListener("click", generarPDFFactura);
    }
    // FIN DE LO NUEVO

    const modalEl = document.getElementById("viewFacturaModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
