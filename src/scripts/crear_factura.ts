// src/scripts/crear_factura.ts

const API_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_URL_INVENTORY = import.meta.env.PUBLIC_EXTERNAL_INVENTORY_URL;

// URLs Locales
const CLIENTES_URL = API_URL + "Clientes";
const ESTABLECIMIENTOS_URL = API_URL + "Establecimientoes";
const PUNTOS_URL = API_URL + "PuntoEmisions";
const FACTURAS_URL = API_URL + "Facturas";
const TIPOS_PAGO_URL = API_URL + "TipoPagoes";

// URL de Productos
const PRODUCTOS_EXTERNAL_URL = API_URL_INVENTORY;

declare const bootstrap: any;

// Interfaces
interface Detalle {
    id: number;
    codigo: string;
    cantidad: number;
}

interface ProductoExterno {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string;
    costo: string;
    pvp: string;
    stock: number;
    impuesto: {
        id: number;
        nombre: string;
        porcentaje: string;
    } | null;
}

// Variables Globales
let contadorDetalle = 0;
let allPuntosEmision: any[] = [];
let allProductos: ProductoExterno[] = [];
let allClientes: any[] = [];

export async function initCrearFactura() {
    console.log("Iniciando sistema de facturación...");

    // 1. CONFIGURACIÓN INICIAL (FECHA LOCAL)
    const dateInput = document.getElementById("facFechaVisual") as HTMLInputElement;
    if (dateInput) {
        // Obtenemos fecha local del sistema
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    // 2. ACTIVAR LISTENERS
    setupListeners(); 
    setupDetalles();

    // 3. CARGAR DATOS
    await loadSelects();
}

function setupListeners() {
    const form = document.getElementById("formCrearFactura") as HTMLFormElement;
    form?.addEventListener("submit", handleSubmit);

    const estSelect = document.getElementById("estRuc");
    estSelect?.addEventListener("change", (e) => {
        const estRuc = (e.target as HTMLSelectElement).value;
        filtrarPuntosEmision(estRuc);
    });

    const cliSelect = document.getElementById("cliCedula");
    cliSelect?.addEventListener("change", (e) => {
        const cedula = (e.target as HTMLSelectElement).value;
        llenarDatosCliente(cedula);
    });
}

function llenarDatosCliente(cedula: string) {
    const nombreIn = document.getElementById("cliNombreVisual") as HTMLInputElement;
    const tipoIn = document.getElementById("cliTipoVisual") as HTMLInputElement;
    const dirIn = document.getElementById("cliDireccionVisual") as HTMLInputElement;
    const telIn = document.getElementById("cliTelefonoVisual") as HTMLInputElement;
    const emailIn = document.getElementById("cliEmailVisual") as HTMLInputElement;

    if (!cedula || allClientes.length === 0) {
        [nombreIn, tipoIn, dirIn, telIn, emailIn].forEach(i => { if(i) i.value = ""; });
        return;
    }

    const cliente = allClientes.find((c: any) => c.cliCedula === cedula);
    
    if (cliente) {
        if(nombreIn) nombreIn.value = cliente.cliNombre || "";
        if(tipoIn) tipoIn.value = cliente.ticIdTipoc === 1 ? "Contado" : (cliente.ticIdTipoc === 2 ? "Crédito" : "Otro");
        if(dirIn) dirIn.value = cliente.cliDireccion || "";
        if(telIn) telIn.value = cliente.cliTelefono || "";
        if(emailIn) emailIn.value = cliente.cliEmail || "";
    }
}

async function loadSelects() {
    console.log("--- Descargando datos del servidor ---");

    const loadClientes = async () => {
        try {
            const res = await fetch(CLIENTES_URL);
            if (res.ok) {
                const data = await res.json();
                allClientes = Array.isArray(data) ? data : (data.data || []);
                const select = document.getElementById("cliCedula") as HTMLSelectElement;
                if (select) {
                    const valActual = select.value;
                    select.innerHTML = '<option value="">Seleccione cliente...</option>';
                    allClientes.forEach((c: any) => {
                        if (c.cliEstado !== false) {
                            const option = document.createElement("option");
                            option.value = c.cliCedula;
                            option.text = `${c.cliNombre} (${c.cliCedula})`;
                            select.appendChild(option);
                        }
                    });
                    if(valActual) select.value = valActual;
                }
            }
        } catch (e) { console.error("Error clientes:", e); }
    };

    const loadEstablecimientos = async () => {
        try {
            const res = await fetch(ESTABLECIMIENTOS_URL);
            if (res.ok) {
                const data = await res.json();
                const lista = Array.isArray(data) ? data : (data.data || []);
                const select = document.getElementById("estRuc") as HTMLSelectElement;
                if (select) {
                    select.innerHTML = '<option value="">Seleccione...</option>';
                    lista.forEach((e: any) => {
                        if (e.estEstado !== false) {
                            const option = document.createElement("option");
                            option.value = e.estRuc;
                            option.text = `${e.estNombre} (${e.estRuc})`;
                            select.appendChild(option);
                        }
                    });
                }
            }
        } catch (e) { console.error("Error establecimientos:", e); }
    };

    const loadPuntos = async () => {
        try {
            const res = await fetch(PUNTOS_URL);
            if (res.ok) {
                const data = await res.json();
                allPuntosEmision = Array.isArray(data) ? data : (data.data || []);
            }
        } catch (e) { console.error("Error puntos:", e); }
    };

    const loadTiposPago = async () => {
        try {
            const res = await fetch(TIPOS_PAGO_URL);
            if (res.ok) {
                const data = await res.json();
                const lista = Array.isArray(data) ? data : (data.data || []);
                const select = document.getElementById("tipIdTipop") as HTMLSelectElement;
                if (select) {
                    select.innerHTML = '<option value="">Seleccione tipo pago...</option>';
                    lista.forEach((t: any) => {
                        const option = document.createElement("option");
                        option.value = t.tipIdTipop || t.id;
                        option.text = t.tipDescripcion || t.nombre || "Sin descripción";
                        select.appendChild(option);
                    });
                }
            }
        } catch (e) { console.error("Error tipos pago:", e); }
    };

    const loadProductos = async () => {
        try {
            const res = await fetch(PRODUCTOS_EXTERNAL_URL);
            if (res.ok) {
                const data = await res.json();
                allProductos = Array.isArray(data) ? data : (data.data || []);
                actualizarSelectsProductos();
            }
        } catch (e) { console.error("Error productos:", e); }
    };

    await Promise.all([loadClientes(), loadEstablecimientos(), loadPuntos(), loadTiposPago(), loadProductos()]);
    console.log("Carga de datos finalizada.");
}

function actualizarSelectsProductos() {
    const selects = document.querySelectorAll(".input-producto") as NodeListOf<HTMLSelectElement>;
    selects.forEach(select => {
        const valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione producto...</option>';
        allProductos.forEach(p => {
            const option = document.createElement("option");
            option.value = p.codigo;
            option.text = p.nombre;
            select.appendChild(option);
        });
        if (valorActual) select.value = valorActual;
    });
}

function filtrarPuntosEmision(estRuc: string) {
    const select = document.getElementById("pemId") as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione un punto...</option>';
    select.disabled = !estRuc;

    if (!estRuc) return;

    const puntosFiltrados = allPuntosEmision.filter((p: any) =>
        p.pemEstado && p.estRuc === estRuc
    );

    puntosFiltrados.forEach((p: any) => {
        const option = document.createElement("option");
        option.value = p.pemId;
        option.text = `${p.pemDescripcion} - ${p.pemIdPuntoEmision}`;
        select.appendChild(option);
    });

    if (puntosFiltrados.length === 0 && allPuntosEmision.length > 0) {
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
    agregarFilaDetalle();
}

function agregarFilaDetalle() {
    contadorDetalle++;
    const tbody = document.getElementById("tbodyDetalles");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.id = `fila-${contadorDetalle}`;

    tr.innerHTML = `
        <td class="text-center align-middle">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row">
                <i class="bi bi-trash"></i>
            </button>
        </td>
        <td>
             <select class="form-select input-producto" style="min-width: 200px;" required>
                <option value="">Cargando...</option>
             </select>
        </td>
        <td class="align-middle"><input type="text" class="form-control-plaintext form-control-sm input-codigo" readonly></td>
        <td class="align-middle"><input type="text" class="form-control-plaintext form-control-sm input-descripcion" readonly></td>
        <td class="align-middle text-center"><input type="text" class="form-control-plaintext form-control-sm text-center input-stock" readonly></td>
        <td class="align-middle text-end"><input type="text" class="form-control-plaintext form-control-sm text-end input-costo" readonly></td>
        
        <td>
            <input type="number" class="form-control input-cantidad text-center" value="1" min="1" required>
        </td>

        <td class="align-middle text-center"><input type="text" class="form-control-plaintext form-control-sm text-center input-impuesto-nombre" readonly></td>
        <td class="align-middle text-end"><input type="text" class="form-control-plaintext form-control-sm text-end input-precio" readonly></td>
        <td class="align-middle text-end fw-bold row-total">$0.00</td>
    `;
    tbody.appendChild(tr);

    const select = tr.querySelector(".input-producto") as HTMLSelectElement;
    if (allProductos.length > 0) {
        select.innerHTML = '<option value="">Seleccione producto...</option>';
        allProductos.forEach(p => {
            const option = document.createElement("option");
            option.value = p.codigo;
            option.text = p.nombre;
            select.appendChild(option);
        });
    }

    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;
    const updateRow = () => calcularFila(tr);

    select.addEventListener("change", updateRow);
    qtyInput.addEventListener("input", updateRow);

    tr.querySelector(".btn-remove-row")?.addEventListener("click", () => {
        tr.remove();
        if (tbody.children.length === 0) agregarFilaDetalle();
    });
}

function calcularFila(tr: HTMLElement) {
    const select = tr.querySelector(".input-producto") as HTMLSelectElement;
    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;

    const inputCodigo = tr.querySelector(".input-codigo") as HTMLInputElement;
    const inputDesc = tr.querySelector(".input-descripcion") as HTMLInputElement;
    const inputStock = tr.querySelector(".input-stock") as HTMLInputElement;
    const inputCosto = tr.querySelector(".input-costo") as HTMLInputElement;
    const inputImpuesto = tr.querySelector(".input-impuesto-nombre") as HTMLInputElement;
    const inputPrecio = tr.querySelector(".input-precio") as HTMLInputElement;
    const totalCell = tr.querySelector(".row-total") as HTMLElement;

    const codigo = select.value;
    let cantidad = parseInt(qtyInput.value) || 0;

    if (!codigo) {
        inputCodigo.value = "";
        inputDesc.value = "";
        inputStock.value = "";
        inputCosto.value = "";
        inputImpuesto.value = "";
        inputPrecio.value = "";
        totalCell.innerText = "$0.00";
        return;
    }

    const prod = allProductos.find(p => p.codigo === codigo);
    if (prod) {
        // CONTROL 1: STOCK CERO
        if (prod.stock <= 0) {
            mostrarErrorEnModal(`El producto "${prod.nombre}" está AGOTADO (Stock: 0).`);
            select.value = ""; 
            inputCodigo.value = "";
            inputDesc.value = "";
            inputStock.value = "";
            inputCosto.value = "";
            inputImpuesto.value = "";
            inputPrecio.value = "";
            totalCell.innerText = "$0.00";
            return;
        }

        // CONTROL 2: CANTIDAD > STOCK
        if (cantidad > prod.stock) {
            mostrarErrorEnModal(`Inventario insuficiente. Stock disponible: ${prod.stock}`);
            cantidad = prod.stock;
            qtyInput.value = String(cantidad);
        }

        inputCodigo.value = prod.codigo;
        inputDesc.value = prod.descripcion || "";
        inputStock.value = String(prod.stock);
        inputCosto.value = `$${parseFloat(prod.costo).toFixed(2)}`;

        const nombreImpuesto = prod.impuesto ? prod.impuesto.nombre : "Sin Impuesto";
        const porcentajeImpuesto = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;

        inputImpuesto.value = nombreImpuesto;
        inputPrecio.value = `$${parseFloat(prod.pvp).toFixed(2)}`;

        if (cantidad > 0) {
            const precioUnit = parseFloat(prod.pvp);
            const subtotal = precioUnit * cantidad;
            const valorIva = subtotal * (porcentajeImpuesto / 100);
            const total = subtotal + valorIva;
            totalCell.innerText = `$${total.toFixed(2)}`;
        } else {
            totalCell.innerText = "$0.00";
        }
    }
}

async function handleSubmit(e: Event) {
    e.preventDefault();

    // 1. Cabecera
    const cliCedula = (document.getElementById("cliCedula") as HTMLSelectElement).value;
    const pemId = (document.getElementById("pemId") as HTMLSelectElement).value;
    const estRuc = (document.getElementById("estRuc") as HTMLSelectElement).value;
    const tipIdTipop = (document.getElementById("tipIdTipop") as HTMLSelectElement).value;
    
    // CORRECCIÓN: Obtenemos el valor visual de la fecha (YYYY-MM-DD)
    const fechaVisual = (document.getElementById("facFechaVisual") as HTMLInputElement).value;

    if (!cliCedula || !pemId || !tipIdTipop) {
        mostrarErrorEnModal("Completa todos los campos de la cabecera.");
        return;
    }

    // 2. Detalles
    const filas = document.querySelectorAll("#tbodyDetalles tr");
    const detallesPayload: any[] = [];

    filas.forEach((tr) => {
        const select = tr.querySelector(".input-producto") as HTMLSelectElement;
        const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;

        const codigo = select.value;
        const cantidad = parseInt(qtyInput.value);

        if (codigo && cantidad > 0) {
            const prod = allProductos.find(p => p.codigo === codigo);
            if (prod) {
                const precio = parseFloat(prod.pvp);
                const porcentajeIva = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;
                const subtotal = precio * cantidad;
                const valorIva = subtotal * (porcentajeIva / 100);
                const total = subtotal + valorIva;

                detallesPayload.push({
                    detIdDetalle: 0,
                    facNumeroFactura: "",
                    detIdProductoExterno: prod.id,
                    detCodigoProducto: prod.codigo,
                    detNombreProducto: prod.nombre,
                    detCantidad: cantidad,
                    detPrecioUnitario: precio,
                    detGrabaIva: porcentajeIva > 0,
                    detSubtotal: subtotal,
                    detPorcentajeIva: porcentajeIva,
                    detValorIva: valorIva,
                    detTotal: total
                });
            }
        }
    });

    if (detallesPayload.length === 0) {
        mostrarErrorEnModal("Debes agregar al menos un producto válido.");
        return;
    }

    // 3. Totales
    const totalSubtotalSinIva = detallesPayload.reduce((acc, d) => !d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalSubtotalConIva = detallesPayload.reduce((acc, d) => d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalIva = detallesPayload.reduce((acc, d) => acc + d.detValorIva, 0);
    const totalFactura = detallesPayload.reduce((acc, d) => acc + d.detTotal, 0);

    // 4. Objeto Factura
    const factura = {
        facNumeroFactura: "",
        estRuc: estRuc,
        cliCedula: cliCedula,
        pemId: parseInt(pemId),
        tipIdTipop: parseInt(tipIdTipop),
        
        facFechaEmision: fechaVisual ? new Date(`${fechaVisual}T00:00:00`).toISOString() : new Date().toISOString(),
        
        facEstadoFactura: true,
        facUsuarioCreacion: "Admin", 
        facSubtotalSinIva: totalSubtotalSinIva,
        facSubtotalConIva: totalSubtotalConIva,
        facIva: totalIva,
        facTotal: totalFactura,
        detallesFactura: detallesPayload
    };

    // 5. Enviar POST Factura
    try {
        const response = await fetch(FACTURAS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(factura),
        });

        if (response.ok) {
            const facturaCreada = await response.json();
            
            const modalEl = document.getElementById('successModal');
            if (modalEl) {
                const msgExito = document.getElementById('mensajeExitoId');
                if (msgExito) msgExito.innerText = `Factura ${facturaCreada.facNumeroFactura || ""} generada correctamente.`;

                const successModal = new bootstrap.Modal(modalEl);
                successModal.show();

                document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                    window.location.href = "/facturas";
                });
            }
        } else {
            let msg = "Error al crear factura";
            const rawText = await response.text();
            try {
                const errData = JSON.parse(rawText);
                msg = errData.detail || errData.message || JSON.stringify(errData);
                if (errData.errors) msg += ": " + JSON.stringify(errData.errors);
            } catch (e) {
                if (rawText) msg = rawText;
            }
            mostrarErrorEnModal(msg);
        }
    } catch (error) {
        console.error("Error de red:", error);
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