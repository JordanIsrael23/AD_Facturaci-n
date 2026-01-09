
// src/scripts/facturas.ts

// Definimos la URL de la API
const BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_URL = BASE_URL + "Facturas";
const CLIENTES_URL = BASE_URL + "Clientes";
const PUNTOS_URL = BASE_URL + "PuntoEmisions";
const ESTABLECIMIENTOS_URL = BASE_URL + "Establecimientoes";

let facturaIdToDelete: string | null = null;
let facturaNuevoEstado: boolean = false;
let facturasData: any[] = [];
let hayFiltros = false;
let paginaActual = 1;
const registrosPorPagina = 10;
let facturasFiltradas: any[] = [];

// Declaramos bootstrap para evitar errores de TS
declare const bootstrap: any;

export function initFacturas() {
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

const TIPOS_PAGO_URL = BASE_URL + "TipoPagoes";

let allEstablecimientos: any[] = [];
let allTiposPago: any[] = [];

async function loadFacturas() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando...</td></tr>';

    try {
        // Cargar Facturas, Establecimientos y Tipos de Pago en paralelo
        const [resFacturas, resEstab, resTipos] = await Promise.all([
            fetch(API_URL),
            fetch(ESTABLECIMIENTOS_URL),
            fetch(TIPOS_PAGO_URL)
        ]);

        if (!resFacturas.ok) throw new Error("Error cargando facturas");

        // Procesar Facturas
        const dataFacturas = await resFacturas.json();
        facturasData = Array.isArray(dataFacturas) ? dataFacturas : (dataFacturas.data || []);

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
                        <i class="bi bi-eye-fill me-3"></i> Ver
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: facturaNuevoEstado }),
            });

            if (response.ok) {
                const modalEl = document.getElementById("confirmDeleteModal");
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadFacturas();
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

            const confirmBtn = document.getElementById("confirmDeleteBtn");
            confirmBtn?.classList.remove(`btn-${prevColorClass}`);
            confirmBtn?.classList.add(`btn-${colorClass}`);
            if (confirmBtn) confirmBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Aceptar y ${accion}`;

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

async function showFacturaDetails(numeroFactura: string) {
    let factura = facturasData.find(f => f.facNumeroFactura === numeroFactura);

    // 1. Obtener factura base si no tiene detalles
    if (!factura || !factura.detallesFactura) {
        try {
            const response = await fetch(`${API_URL}/${numeroFactura}`);
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

    // 2. Cargar Cliente si falta
    if (!factura.cliente && factura.cliCedula) {
        try {
            const res = await fetch(`${CLIENTES_URL}/${factura.cliCedula}`);
            if (res.ok) factura.cliente = await res.json();
        } catch (e) { console.warn("No se pudo cargar cliente extra", e); }
    }

    // 3. Cargar Punto Emision si falta
    if (!factura.puntoEmision && factura.pemId) {
        try {
            const res = await fetch(`${PUNTOS_URL}/${factura.pemId}`);
            if (res.ok) factura.puntoEmision = await res.json();
        } catch (e) { console.warn("No se pudo cargar punto extra", e); }
    }

    // 4. Cargar Establecimiento si falta (desde Punto de Emision)
    if (factura.puntoEmision && !factura.puntoEmision.establecimiento && factura.puntoEmision.estRuc) {
        try {
            const res = await fetch(`${ESTABLECIMIENTOS_URL}/${factura.puntoEmision.estRuc}`);
            if (res.ok) {
                factura.puntoEmision.establecimiento = await res.json();
            }
        } catch (e) { console.warn("No se pudo cargar establecimiento extra", e); }
    }

    // Poblar modal
    const setText = (id: string, text: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    // Info Factura
    setText("modalFacNumero", factura.facNumeroFactura);
    setText("modalFacFecha", factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A");
    setText("modalFacTipoPago", getTipoPagoInfo(factura));
    setText("modalFacPuntoEmision", factura?.puntoEmision?.pemDescripcion || "N/A");

    // Establecimiento
    const estNombre = factura?.puntoEmision?.establecimiento?.estNombre || "N/A";
    setText("modalFacEstablecimiento", estNombre);

    const estadoEl = document.getElementById("modalFacEstado");
    if (estadoEl) {
        estadoEl.innerHTML = `<span class="badge ${factura.facEstadoFactura ? "text-bg-success" : "text-bg-danger"}">
            ${factura.facEstadoFactura ? "Activa" : "Anulada"}
        </span>`;
    }

    // Info Cliente
    const cli = factura.cliente;
    setText("modalCliNombre", cli?.cliNombre || factura.cliCedula);
    setText("modalCliCedula", cli?.cliCedula || factura.cliCedula);
    setText("modalCliDireccion", cli?.cliDireccion || "N/A");
    setText("modalCliTelefono", cli?.cliTelefono || "N/A");
    setText("modalCliEmail", cli?.cliEmail || "N/A");

    // Detalles
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

    // Totales
    setText("modalFacSubtotalSinIva", `$${factura.facSubtotalSinIva.toFixed(2)}`);
    setText("modalFacSubtotalConIva", `$${factura.facSubtotalConIva.toFixed(2)}`);
    setText("modalFacIva", `$${factura.facIva.toFixed(2)}`);
    setText("modalFacTotal", `$${factura.facTotal.toFixed(2)}`);

    // Mostrar Modal
    const modalEl = document.getElementById("viewFacturaModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
