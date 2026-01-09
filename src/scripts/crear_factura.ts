const API_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_URL_INVENTORY = import.meta.env.PUBLIC_EXTERNAL_INVENTORY_URL;

const CLIENTES_URL = API_URL + "Clientes";
const ESTABLECIMIENTOS_URL = API_URL + "Establecimientoes";
const PUNTOS_URL = API_URL + "PuntoEmisions";
const FACTURAS_URL = API_URL + "Facturas";
const TIPOS_PAGO_URL = API_URL + "TipoPagoes";
const PRODUCTOS_EXTERNAL_URL = API_URL_INVENTORY;

declare const bootstrap: any;

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

// Variables Modal Clientes
let clientesFiltrados: any[] = [];
let paginaActualModal = 1;
const registrosPorPaginaModal = 5;
let clienteSeleccionadoTemp: any = null;

// Variables Modal Productos
let productosFiltrados: any[] = [];
let paginaActualProd = 1;
const registrosPorPaginaProd = 5;
let productoSeleccionadoTemp: ProductoExterno | null = null;

export async function initCrearFactura() {
    console.log("Iniciando sistema...");
    const dateInput = document.getElementById("facFechaVisual") as HTMLInputElement;
    if (dateInput) {
        const now = new Date();
        dateInput.value = now.toISOString().split('T')[0];
    }

    setupListeners(); 
    setupDetalles(); 
    setupModalClientes();
    setupModalProductos();

    verificarEstadoBotonEmitir();

    await loadSelects();
}

function setupListeners() {
    const form = document.getElementById("formCrearFactura") as HTMLFormElement;
    form?.addEventListener("submit", handleSubmit);

    const estSelect = document.getElementById("estRuc");
    estSelect?.addEventListener("change", (e) => {
        filtrarPuntosEmision((e.target as HTMLSelectElement).value);
    });

    // NUEVO: Listener para Tipo de Pago
    // Si cambia el tipo de pago, limpiamos el cliente para obligar a re-seleccionar con los nuevos filtros
    const tipoPagoSelect = document.getElementById("tipIdTipop");
    tipoPagoSelect?.addEventListener("change", () => {
        limpiarCamposCliente();
    });

    // Lógica Genérica para Limpiar Filtros
    document.querySelectorAll(".btnFiltroModal").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const button = e.currentTarget as HTMLElement;
            const inputId = button.getAttribute("data-for");
            if (inputId) {
                const input = document.getElementById(inputId) as HTMLInputElement;
                if (input) {
                    input.value = "";
                    input.dispatchEvent(new Event('input'));
                    input.focus();
                }
            }
        });
    });
}

// =========================================================
// NUEVA FUNCIÓN PARA LIMPIAR CLIENTE
// =========================================================
function limpiarCamposCliente() {
    // Limpiar input hidden (el importante)
    (document.getElementById("cliCedula") as HTMLInputElement).value = "";
    
    // Limpiar visuales
    (document.getElementById("cliCedulaVisual") as HTMLInputElement).value = "";
    (document.getElementById("cliNombreVisual") as HTMLInputElement).value = "";
    (document.getElementById("cliTipoVisual") as HTMLInputElement).value = "";
    (document.getElementById("cliDireccionVisual") as HTMLInputElement).value = "";
    (document.getElementById("cliTelefonoVisual") as HTMLInputElement).value = "";
    (document.getElementById("cliEmailVisual") as HTMLInputElement).value = "";

    // Resetear variables temporales
    clienteSeleccionadoTemp = null;
}

function verificarEstadoBotonEmitir() {
    const tbody = document.getElementById("tbodyDetalles");
    const btnEmitir = document.getElementById("btnEmitirFactura") as HTMLButtonElement;
    const emptyMsg = document.getElementById("emptyMessage");
    
    if (tbody && btnEmitir) {
        const tieneFilas = tbody.children.length > 0;
        btnEmitir.disabled = !tieneFilas;
        if (emptyMsg) {
            emptyMsg.style.display = tieneFilas ? 'none' : 'block';
        }
    }
}

// =========================================================
// LÓGICA DEL MODAL DE PRODUCTOS
// =========================================================

function setupModalProductos() {
    const btnAceptar = document.getElementById("btnProdAceptar");
    const inputFiltroCodigo = document.getElementById("filtroProdCodigo") as HTMLInputElement;
    const inputFiltroNombre = document.getElementById("filtroProdNombre") as HTMLInputElement;
    const btnAnt = document.getElementById("btnProdAnt");
    const btnSig = document.getElementById("btnProdSig");

    const aplicarFiltrosProd = () => {
        const codigo = inputFiltroCodigo?.value.toLowerCase() || "";
        const nombre = inputFiltroNombre?.value.toLowerCase() || "";
        productosFiltrados = allProductos.filter(p => 
            p.codigo.toLowerCase().includes(codigo) &&
            p.nombre.toLowerCase().includes(nombre)
        );
        actualizarIconoModal("filtroProdCodigo", codigo !== "");
        actualizarIconoModal("filtroProdNombre", nombre !== "");
        paginaActualProd = 1;
        renderTablaProductosModal();
    };

    inputFiltroCodigo?.addEventListener("input", aplicarFiltrosProd);
    inputFiltroNombre?.addEventListener("input", aplicarFiltrosProd);

    btnAnt?.addEventListener("click", () => {
        if (paginaActualProd > 1) { paginaActualProd--; renderTablaProductosModal(); }
    });

    btnSig?.addEventListener("click", () => {
        const total = Math.ceil(productosFiltrados.length / registrosPorPaginaProd);
        if (paginaActualProd < total) { paginaActualProd++; renderTablaProductosModal(); }
    });

    btnAceptar?.addEventListener("click", () => {
        if (productoSeleccionadoTemp) {
            if (productoSeleccionadoTemp.stock <= 0) {
                mostrarErrorEnModal(`El producto "${productoSeleccionadoTemp.nombre}" no tiene Stock.`);
                return;
            }
            agregarFilaDetalle(productoSeleccionadoTemp);
            const modal = bootstrap.Modal.getInstance(document.getElementById("modalBuscarProducto"));
            modal.hide();
        }
    });
}

function abrirModalProductosParaAgregar() {
    productosFiltrados = [...allProductos];
    productoSeleccionadoTemp = null;
    paginaActualProd = 1;
    (document.getElementById("filtroProdCodigo") as HTMLInputElement).value = "";
    (document.getElementById("filtroProdNombre") as HTMLInputElement).value = "";
    actualizarIconoModal("filtroProdCodigo", false);
    actualizarIconoModal("filtroProdNombre", false);
    (document.getElementById("btnProdAceptar") as HTMLButtonElement).disabled = true;
    renderTablaProductosModal();
    new bootstrap.Modal(document.getElementById("modalBuscarProducto") as HTMLElement).show();
}

function renderTablaProductosModal() {
    const tbody = document.getElementById("tbodyModalProductos");
    const info = document.getElementById("infoPaginacionProd");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    const inicio = (paginaActualProd - 1) * registrosPorPaginaProd;
    const fin = inicio + registrosPorPaginaProd;
    const items = productosFiltrados.slice(inicio, fin);
    const totalPaginas = Math.ceil(productosFiltrados.length / registrosPorPaginaProd);

    if (info) info.innerText = `Mostrando ${items.length > 0 ? inicio + 1 : 0} - ${Math.min(fin, productosFiltrados.length)} de ${productosFiltrados.length}`;
    
    const btnAnt = document.getElementById("btnProdAnt") as HTMLButtonElement;
    const btnSig = document.getElementById("btnProdSig") as HTMLButtonElement;
    if (btnAnt) btnAnt.disabled = paginaActualProd === 1;
    if (btnSig) btnSig.disabled = paginaActualProd >= totalPaginas || totalPaginas === 0;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No hay productos disponibles</td></tr>`;
        return;
    }

    items.forEach(p => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        const isSelected = productoSeleccionadoTemp && productoSeleccionadoTemp.codigo === p.codigo;
        if (isSelected) tr.classList.add("table-info"); 

        tr.innerHTML = `
            <td class="text-center">
                <input class="form-check-input" type="radio" name="radioProdModal" ${isSelected ? "checked" : ""}>
            </td>
            <td><small class="fw-bold">${p.codigo}</small></td>
            <td>${p.nombre}</td>
            <td><small class="text-muted text-truncate d-inline-block" style="max-width: 150px;">${p.descripcion || "-"}</small></td>
            <td class="text-center"><span class="badge ${p.stock > 0 ? 'bg-success' : 'bg-danger'}">${p.stock}</span></td>
            <td class="text-end fw-bold">$${parseFloat(p.pvp).toFixed(2)}</td>
        `;

        tr.addEventListener("click", () => {
            productoSeleccionadoTemp = p;
            (document.getElementById("btnProdAceptar") as HTMLButtonElement).disabled = false;
            renderTablaProductosModal();
        });

        tbody.appendChild(tr);
    });
}

// =========================================================
// LÓGICA DEL MODAL DE CLIENTES
// =========================================================

function setupModalClientes() {
    const btnBuscar = document.getElementById("btnBuscarCliente");
    const btnAceptar = document.getElementById("btnModalAceptar");
    const inputFiltroCedula = document.getElementById("filtroModalCedula") as HTMLInputElement;
    const inputFiltroNombre = document.getElementById("filtroModalNombre") as HTMLInputElement;
    const btnAnt = document.getElementById("btnModalAnt");
    const btnSig = document.getElementById("btnModalSig");

    const aplicarFiltros = () => {
        const cedula = inputFiltroCedula?.value.toLowerCase() || "";
        const nombre = inputFiltroNombre?.value.toLowerCase() || "";
        
        // OBTENEMOS EL TIPO DE PAGO SELECCIONADO
        const tipoPagoSelect = document.getElementById("tipIdTipop") as HTMLSelectElement;
        const tipoPagoId = tipoPagoSelect?.value; 

        clientesFiltrados = allClientes.filter(c => {
            // 1. Filtro Básico: Estado Activo
            if (c.cliEstado === false) return false;

            // 2. Filtro de Texto (Cédula y Nombre)
            const coincideTexto = String(c.cliCedula).toLowerCase().includes(cedula) && 
                                  c.cliNombre.toLowerCase().includes(nombre);
            
            if (!coincideTexto) return false;

            // 3. FILTRO POR TIPO DE PAGO (Lógica Solicitada)
            // Si el pago es Crédito (ID "2"), el cliente DEBE ser de crédito (ID 2)
            if (tipoPagoId === "2") { // Asumimos que "2" es el value del select para Crédito
                return c.ticIdTipoc === 2;
            }
            
            // Si es Contado (ID "1") u otro, mostramos TODOS (se retorna true si pasó el filtro de texto)
            return true;
        });

        actualizarIconoModal("filtroModalCedula", cedula !== "");
        actualizarIconoModal("filtroModalNombre", nombre !== "");
        paginaActualModal = 1;
        renderTablaClientesModal();
    };

    inputFiltroCedula?.addEventListener("input", aplicarFiltros);
    inputFiltroNombre?.addEventListener("input", aplicarFiltros);

    btnAnt?.addEventListener("click", () => {
        if (paginaActualModal > 1) { paginaActualModal--; renderTablaClientesModal(); }
    });
    btnSig?.addEventListener("click", () => {
        const total = Math.ceil(clientesFiltrados.length / registrosPorPaginaModal);
        if (paginaActualModal < total) { paginaActualModal++; renderTablaClientesModal(); }
    });

    btnBuscar?.addEventListener("click", () => {
        const modalEl = document.getElementById("modalBuscarCliente");
        if (modalEl) {
            // Al abrir el modal, aplicamos los filtros iniciales
            // Esto es importante porque si ya está seleccionado "Crédito",
            // la lista debe nacer filtrada.
            inputFiltroCedula.value = ""; 
            inputFiltroNombre.value = "";
            actualizarIconoModal("filtroModalCedula", false); 
            actualizarIconoModal("filtroModalNombre", false);
            
            // Forzamos el filtrado inicial para respetar la regla de pago
            aplicarFiltros(); 
            
            clienteSeleccionadoTemp = null;
            if (btnAceptar) (btnAceptar as HTMLButtonElement).disabled = true;
            new bootstrap.Modal(modalEl).show();
        }
    });

    btnAceptar?.addEventListener("click", () => {
        if (clienteSeleccionadoTemp) {
            llenarDatosCliente(clienteSeleccionadoTemp);
            bootstrap.Modal.getInstance(document.getElementById("modalBuscarCliente")).hide();
        }
    });
}

function renderTablaClientesModal() {
    const tbody = document.getElementById("tbodyModalClientes");
    const info = document.getElementById("infoPaginacionModal");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const inicio = (paginaActualModal - 1) * registrosPorPaginaModal;
    const fin = inicio + registrosPorPaginaModal;
    const items = clientesFiltrados.slice(inicio, fin);
    
    if (info) info.innerText = `Mostrando ${items.length} de ${clientesFiltrados.length}`;
    
    items.forEach(c => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        if (clienteSeleccionadoTemp?.cliCedula === c.cliCedula) tr.classList.add("table-primary");
        tr.innerHTML = `<td class="text-center"><input class="form-check-input" type="radio" ${clienteSeleccionadoTemp?.cliCedula === c.cliCedula ? "checked" : ""}></td><td>${c.cliCedula}</td><td>${c.cliNombre}</td><td>${c.ticIdTipoc === 1 ? "Contado" : "Crédito"}</td>`;
        tr.addEventListener("click", () => {
            clienteSeleccionadoTemp = c;
            (document.getElementById("btnModalAceptar") as HTMLButtonElement).disabled = false;
            renderTablaClientesModal();
        });
        tbody.appendChild(tr);
    });
}

function actualizarIconoModal(inputId: string, activo: boolean) {
    const btn = document.querySelector(`.btnFiltroModal[data-for="${inputId}"]`);
    const icono = btn?.querySelector("i");
    if (icono) {
        icono.classList.remove("bi-funnel", "bi-funnel-fill", "text-danger");
        icono.classList.add(activo ? "bi-funnel-fill" : "bi-funnel");
        if(activo) icono.classList.add("text-danger");
    }
}

function llenarDatosCliente(cliente: any) {
    (document.getElementById("cliCedula") as HTMLInputElement).value = cliente.cliCedula;
    (document.getElementById("cliCedulaVisual") as HTMLInputElement).value = cliente.cliCedula;
    (document.getElementById("cliNombreVisual") as HTMLInputElement).value = cliente.cliNombre;
    (document.getElementById("cliTipoVisual") as HTMLInputElement).value = cliente.ticIdTipoc === 1 ? "Contado" : "Crédito";
    (document.getElementById("cliDireccionVisual") as HTMLInputElement).value = cliente.cliDireccion || "";
    (document.getElementById("cliTelefonoVisual") as HTMLInputElement).value = cliente.cliTelefono || "";
    (document.getElementById("cliEmailVisual") as HTMLInputElement).value = cliente.cliEmail || "";
}

// =========================================================
// CARGA DE DATOS Y TABLA DETALLES
// =========================================================

async function loadSelects() {
    const fetchApi = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : []; } catch { return []; } };
    
    const [clientesData, estData, puntosData, tiposData, prodData] = await Promise.all([
        fetchApi(CLIENTES_URL), fetchApi(ESTABLECIMIENTOS_URL), fetchApi(PUNTOS_URL), fetchApi(TIPOS_PAGO_URL), fetchApi(PRODUCTOS_EXTERNAL_URL)
    ]);

    allClientes = Array.isArray(clientesData) ? clientesData : (clientesData.data || []);
    allProductos = Array.isArray(prodData) ? prodData : (prodData.data || []);
    allPuntosEmision = Array.isArray(puntosData) ? puntosData : (puntosData.data || []);

    const llenarSelect = (id: string, data: any[], valProp: string, txtProp: string) => {
        const sel = document.getElementById(id) as HTMLSelectElement;
        if(sel) {
            sel.innerHTML = '<option value="">Seleccione...</option>';
            data.forEach(d => {
                if(d.estEstado !== false) {
                    const opt = document.createElement("option");
                    opt.value = d[valProp] || d.id;
                    opt.text = d[txtProp] || d.nombre;
                    sel.appendChild(opt);
                }
            });
        }
    };

    llenarSelect("estRuc", Array.isArray(estData) ? estData : (estData.data || []), "estRuc", "estNombre");
    llenarSelect("tipIdTipop", Array.isArray(tiposData) ? tiposData : (tiposData.data || []), "tipIdTipop", "tipDescripcion");
}

function filtrarPuntosEmision(estRuc: string) {
    const select = document.getElementById("pemId") as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = '<option value="">Seleccione...</option>';
    select.disabled = !estRuc;
    const filtrados = allPuntosEmision.filter((p: any) => p.pemEstado && p.estRuc === estRuc);
    filtrados.forEach((p: any) => {
        const option = document.createElement("option");
        option.value = p.pemId;
        option.text = `${p.pemDescripcion} - ${p.pemIdPuntoEmision}`;
        select.appendChild(option);
    });
}

function setupDetalles() {
    document.getElementById("btnAddDetalle")?.addEventListener("click", () => abrirModalProductosParaAgregar());
    verificarEstadoBotonEmitir(); 
}

function agregarFilaDetalle(prod: ProductoExterno) {
    contadorDetalle++;
    const tbody = document.getElementById("tbodyDetalles");
    const emptyMsg = document.getElementById("emptyMessage");
    if (!tbody) return;
    
    if(emptyMsg) emptyMsg.style.display = 'none';

    const tr = document.createElement("tr");
    tr.id = `fila-${contadorDetalle}`;

    tr.innerHTML = `
        <td class="text-center align-middle">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row"><i class="bi bi-trash"></i></button>
        </td>
        <td class="align-middle">
            <input type="text" class="form-control form-control-sm bg-white fw-bold input-producto-nombre" readonly value="${prod.nombre}">
            <input type="hidden" class="input-producto-codigo" value="${prod.codigo}">
        </td>
        <td class="align-middle"><input type="text" class="form-control-plaintext form-control-sm input-codigo-visual text-muted small" readonly value="${prod.codigo}"></td>
        <td class="align-middle text-center"><input type="text" class="form-control-plaintext form-control-sm text-center input-stock" readonly value="${prod.stock}"></td>
        <td class="align-middle text-end"><input type="text" class="form-control-plaintext form-control-sm text-end input-costo text-muted" readonly value="$${parseFloat(prod.costo).toFixed(2)}"></td>
        <td class="align-middle">
            <input type="number" class="form-control form-control-sm input-cantidad text-center" value="1" min="1" max="${prod.stock}" required>
        </td>
        <td class="align-middle text-center"><input type="text" class="form-control-plaintext form-control-sm text-center input-impuesto-nombre small" readonly value="${prod.impuesto ? prod.impuesto.nombre : '0%'}"></td>
        <td class="align-middle text-end"><input type="text" class="form-control-plaintext form-control-sm text-end input-precio" readonly value="$${parseFloat(prod.pvp).toFixed(2)}"></td>
        <td class="align-middle text-end fw-bold row-total">$0.00</td>
    `;
    tbody.appendChild(tr);

    verificarEstadoBotonEmitir();

    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;
    calcularFila(tr);

    qtyInput.addEventListener("input", () => calcularFila(tr));

    tr.querySelector(".btn-remove-row")?.addEventListener("click", () => {
        tr.remove();
        verificarEstadoBotonEmitir();
    });
}

function calcularFila(tr: HTMLElement) {
    const codigoHidden = (tr.querySelector(".input-producto-codigo") as HTMLInputElement).value;
    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;
    const totalCell = tr.querySelector(".row-total") as HTMLElement;

    const prod = allProductos.find(p => p.codigo === codigoHidden);
    if (prod) {
        let cantidad = parseInt(qtyInput.value) || 0;
        
        if (cantidad > prod.stock) {
            cantidad = prod.stock;
            qtyInput.value = String(cantidad);
        }
        if (cantidad < 1) cantidad = 0;

        const precio = parseFloat(prod.pvp);
        const iva = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;
        const subtotal = precio * cantidad;
        const total = subtotal * (1 + (iva / 100));
        
        totalCell.innerText = `$${total.toFixed(2)}`;
    }
}

async function handleSubmit(e: Event) {
    e.preventDefault();
    const cliCedula = (document.getElementById("cliCedula") as HTMLInputElement).value;
    const pemId = (document.getElementById("pemId") as HTMLSelectElement).value;
    const tipIdTipop = (document.getElementById("tipIdTipop") as HTMLSelectElement).value;
    const fecha = (document.getElementById("facFechaVisual") as HTMLInputElement).value;

    if (!cliCedula || !pemId) { mostrarErrorEnModal("Faltan datos de cabecera."); return; }

    const filas = document.querySelectorAll("#tbodyDetalles tr");
    const detalles: any[] = [];

    filas.forEach((tr) => {
        const codigo = (tr.querySelector(".input-producto-codigo") as HTMLInputElement).value;
        const cantidad = parseInt((tr.querySelector(".input-cantidad") as HTMLInputElement).value);

        if (codigo && cantidad > 0) {
            const prod = allProductos.find(p => p.codigo === codigo);
            if (prod) {
                const precio = parseFloat(prod.pvp);
                const pctIva = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;
                const subtotal = precio * cantidad;
                const valorIva = subtotal * (pctIva / 100);
                
                detalles.push({
                    detIdDetalle: 0, facNumeroFactura: "",
                    detIdProductoExterno: prod.id, detCodigoProducto: prod.codigo, detNombreProducto: prod.nombre,
                    detCantidad: cantidad, detPrecioUnitario: precio,
                    detGrabaIva: pctIva > 0, detSubtotal: subtotal, detPorcentajeIva: pctIva, detValorIva: valorIva, detTotal: subtotal + valorIva
                });
            }
        }
    });

    if (detalles.length === 0) { mostrarErrorEnModal("Agrega productos válidos."); return; }

    const totalSubSin = detalles.reduce((a, d) => !d.detGrabaIva ? a + d.detSubtotal : a, 0);
    const totalSubCon = detalles.reduce((a, d) => d.detGrabaIva ? a + d.detSubtotal : a, 0);
    const totalIva = detalles.reduce((a, d) => a + d.detValorIva, 0);
    const totalFac = detalles.reduce((a, d) => a + d.detTotal, 0);

    const factura = {
        facNumeroFactura: "", estRuc: (document.getElementById("estRuc") as HTMLSelectElement).value,
        cliCedula, pemId: parseInt(pemId), tipIdTipop: parseInt(tipIdTipop),
        facFechaEmision: new Date(fecha).toISOString(), facEstadoFactura: true, facUsuarioCreacion: "Admin",
        facSubtotalSinIva: totalSubSin, facSubtotalConIva: totalSubCon, facIva: totalIva, facTotal: totalFac,
        detallesFactura: detalles
    };

    try {
        const res = await fetch(FACTURAS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(factura) });
        if (res.ok) {
            const data = await res.json();
            const modal = new bootstrap.Modal(document.getElementById('successModal'));
            (document.getElementById('mensajeExitoId') as HTMLElement).innerText = `Factura ${data.facNumeroFactura || ""} generada.`;
            modal.show();
            document.getElementById('btnOkSuccess')?.addEventListener('click', () => window.location.href = "/facturas");
        } else {
            mostrarErrorEnModal("Error al guardar la factura.");
        }
    } catch { mostrarErrorEnModal("Error de conexión."); }
}

function mostrarErrorEnModal(msg: string) {
    (document.getElementById("errorModalMsg") as HTMLElement).innerText = msg;
    new bootstrap.Modal(document.getElementById("errorModal")).show();
}