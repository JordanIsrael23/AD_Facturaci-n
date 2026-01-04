
// src/scripts/crear_factura.ts

const API_URL = import.meta.env.PUBLIC_BACKEND_URL;
const CLIENTES_URL = API_URL + "Clientes";
const ESTABLECIMIENTOS_URL = API_URL + "Establecimientoes";
const PUNTOS_URL = API_URL + "PuntoEmisions";
const FACTURAS_URL = API_URL + "Facturas";
const TIPOS_PAGO_URL = API_URL + "TipoPagoes"; // Según instrucción explícita podría ser TipoClientes, pero usando TipoPagos por semántica correcta

declare const bootstrap: any;

interface Detalle {
    id: number;
    codigo: string;
    cantidad: number;
}

let detalles: Detalle[] = [];
let contadorDetalle = 0;
let allPuntosEmision: any[] = [];

export function initCrearFactura() {
    loadSelects();
    setupDetalles();

    const form = document.getElementById("formCrearFactura") as HTMLFormElement;
    form?.addEventListener("submit", handleSubmit);

    // Listener para establecimiento
    document.getElementById("estRuc")?.addEventListener("change", (e) => {
        const estRuc = (e.target as HTMLSelectElement).value;
        filtrarPuntosEmision(estRuc);
    });
}

async function loadSelects() {
    // 1. Clientes
    try {
        const res = await fetch(CLIENTES_URL);
        if (res.ok) {
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.data || []);
            const select = document.getElementById("cliCedula") as HTMLSelectElement;
            if (select) {
                lista.forEach((c: any) => {
                    if (c.cliEstado) {
                        const option = document.createElement("option");
                        option.value = c.cliCedula;
                        option.text = `${c.cliNombre} (${c.cliCedula})`;
                        select.appendChild(option);
                    }
                });
            }
        }
    } catch (e) { console.error("Error cargando clientes", e); }

    // 2. Establecimientos
    try {
        const res = await fetch(ESTABLECIMIENTOS_URL);
        if (res.ok) {
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.data || []);
            const select = document.getElementById("estRuc") as HTMLSelectElement;
            if (select) {
                lista.forEach((e: any) => {
                    if (e.estEstado) {
                        const option = document.createElement("option");
                        option.value = e.estRuc;
                        option.text = `${e.estNombre} (${e.estRuc})`;
                        select.appendChild(option);
                    }
                });
            }
        }
    } catch (e) { console.error("Error cargando establecimientos", e); }

    // 3. Puntos Emision (Cargar todos en memoria)
    try {
        const res = await fetch(PUNTOS_URL);
        if (res.ok) {
            const data = await res.json();
            allPuntosEmision = Array.isArray(data) ? data : (data.data || []);
        }
    } catch (e) { console.error("Error cargando puntos", e); }

    // 4. Tipos Pago (Desde API)
    try {
        const select = document.getElementById("tipIdTipop") as HTMLSelectElement;
        const res = await fetch(TIPOS_PAGO_URL);
        if (res.ok && select) {
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.data || []);
            lista.forEach((t: any) => {
                const option = document.createElement("option");
                // Mapeo flexible
                option.value = t.tipIdTipop || t.id;
                option.text = t.tipDescripcion || t.descripcion;
                select.appendChild(option);
            });
        }
    } catch (e) { console.error("Error tipos pago", e); }
}

function filtrarPuntosEmision(estRuc: string) {
    const select = document.getElementById("pemId") as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione un punto...</option>';
    select.disabled = !estRuc;

    if (!estRuc) return;

    // Filtrar puntos que pertenezcan al establecimiento seleccionado
    const puntosFiltrados = allPuntosEmision.filter((p: any) =>
        p.pemEstado && p.estRuc === estRuc
    );

    puntosFiltrados.forEach((p: any) => {
        const option = document.createElement("option");
        option.value = p.pemId;
        option.text = `${p.pemDescripcion} - ${p.pemIdPuntoEmision}`;
        select.appendChild(option);
    });

    if (puntosFiltrados.length === 0) {
        const option = document.createElement("option");
        option.text = "No hay puntos activos";
        select.appendChild(option);
    }
}

function setupDetalles() {
    const btnAdd = document.getElementById("btnAddDetalle");
    btnAdd?.addEventListener("click", () => {
        agregarFilaDetalle();
    });

    // Agregar una fila inicial
    agregarFilaDetalle();
}

function agregarFilaDetalle() {
    contadorDetalle++;
    const tbody = document.getElementById("tbodyDetalles");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.id = `fila-${contadorDetalle}`;
    tr.innerHTML = `
        <td>
            <input type="text" class="form-control input-codigo" placeholder="Ej. P001" required>
        </td>
        <td>
            <input type="number" class="form-control input-cantidad text-center" value="1" min="1" required>
        </td>
        <td class="text-muted fst-italic align-middle small">
            Calculado al guardar
        </td>
        <td class="text-center align-middle">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    // Evento borrar
    tr.querySelector(".btn-remove-row")?.addEventListener("click", () => {
        tr.remove();
        if (tbody.children.length === 0) agregarFilaDetalle(); // Mantener al menos 1
    });
}

async function handleSubmit(e: Event) {
    e.preventDefault();

    // 1. Recolectar Cabecera
    const cliCedula = (document.getElementById("cliCedula") as HTMLSelectElement).value;
    const pemId = (document.getElementById("pemId") as HTMLSelectElement).value;
    const estRuc = (document.getElementById("estRuc") as HTMLSelectElement).value; // Solo para validación visual
    const tipIdTipop = (document.getElementById("tipIdTipop") as HTMLSelectElement).value;

    if (!cliCedula || !pemId || !tipIdTipop) {
        mostrarErrorEnModal("Completa todos los campos de la cabecera.");
        return;
    }

    // 2. Recolectar Detalles
    const filas = document.querySelectorAll("#tbodyDetalles tr");
    const detallesPayload: any[] = [];

    filas.forEach((tr) => {
        const codigo = (tr.querySelector(".input-codigo") as HTMLInputElement).value.trim();
        const cantidad = parseInt((tr.querySelector(".input-cantidad") as HTMLInputElement).value);

        if (codigo && cantidad > 0) {
            detallesPayload.push({
                detCodigoProducto: codigo,
                detCantidad: cantidad,
                // Resto de campos se calculan en backend
                detNombreProducto: "Pendiente",
                detPrecioUnitario: 0
            });
        }
    });

    if (detallesPayload.length === 0) {
        mostrarErrorEnModal("Debes agregar al menos un producto con código y cantidad válida.");
        return;
    }

    // 3. Generar ID temporal (Timestamp)
    const numeroFactura = `FAC-${Date.now()}`;

    // 4. Armar Objeto Factura
    const factura = {
        facNumeroFactura: numeroFactura,
        estRuc: estRuc, // Incluimos RUC aunque el backend lo deduzca del punto, por completitud
        cliCedula: cliCedula,
        pemId: parseInt(pemId),
        tipIdTipop: parseInt(tipIdTipop),
        // Fechas se marcan en backend usualmente o aqui
        facFechaEmision: new Date().toISOString(),
        facEstadoFactura: true,
        // Iniciales en 0
        facSubtotalSinIva: 0,
        facSubtotalConIva: 0,
        facIva: 0,
        facTotal: 0,
        detallesFactura: detallesPayload
    };

    // 5. Enviar
    try {
        const response = await fetch(FACTURAS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(factura),
        });

        if (response.ok) {
            const modalEl = document.getElementById('successModal');
            if (modalEl) {
                const successModal = new bootstrap.Modal(modalEl);
                successModal.show();

                document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                    window.location.href = "/facturas";
                });
            }
        } else {
            let msg = "Error al crear factura";
            try {
                const errData = await response.json();
                msg = errData.detail || errData.message || JSON.stringify(errData);
            } catch {
                msg = await response.text();
            }
            mostrarErrorEnModal(msg);
        }
    } catch (error) {
        mostrarErrorEnModal("Error de conexión con el servidor.");
    }
}

function mostrarErrorEnModal(mensaje: string) {
    const msgElement = document.getElementById("errorModalMsg");
    if (msgElement) msgElement.innerText = mensaje;

    const errorModalEl = document.getElementById("errorModal");
    if (errorModalEl) {
        const modalError = new bootstrap.Modal(errorModalEl);
        modalError.show();
    }
}
