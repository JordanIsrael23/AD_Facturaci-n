import { getAuthHeaders, checkAuth } from "./auth";

// --- CONFIGURACIÓN API (Del Archivo Verdadero) ---
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
    // --- Chequeo de seguridad al iniciar ---
    checkAuth();
    console.log("Iniciando sistema de facturación...");

    // Fecha automática
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
    // Submit del formulario
    const form = document.getElementById("formCrearFactura") as HTMLFormElement;
    form?.addEventListener("submit", handleSubmit);


    // Cambio en Tipo Pago -> Limpiar Cliente
    const tipoPagoSelect = document.getElementById("tipIdTipop");
    tipoPagoSelect?.addEventListener("change", () => {
        limpiarCamposCliente();
    });

    // Lógica Genérica para Limpiar Filtros de los Modales
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

function limpiarCamposCliente() {
    // Limpia los inputs visuales y el hidden
    const setVal = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = val;
    };

    setVal("cliCedula", "");
    setVal("cliCedulaVisual", "");
    setVal("cliNombreVisual", "");
    setVal("cliTipoVisual", "");
    setVal("cliDireccionVisual", "");
    setVal("cliTelefonoVisual", "");
    setVal("cliEmailVisual", "");
    clienteSeleccionadoTemp = null;
}

function verificarEstadoBotonEmitir() {
    const tbody = document.getElementById("tbodyDetalles");
    // Buscamos el botón submit dentro del form ya que no tiene ID específico en el HTML nuevo
    const btnEmitir = document.querySelector('button[type="submit"]') as HTMLButtonElement;
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
            // --- VALIDACIÓN DE DUPLICADOS CORREGIDA ---
            const existe = Array.from(document.querySelectorAll('#tbodyDetalles .input-producto-codigo'))
                .some((input: any) => input.value === productoSeleccionadoTemp?.codigo);

            if (existe) {
                // AQUI ESTÁ EL CAMBIO: Usamos tu modal de error en lugar de alert()
                mostrarErrorEnModal(`El producto "${productoSeleccionadoTemp.nombre}" ya está agregado. Modifica la cantidad en la tabla.`);
                return; 
            }
            // ------------------------------------------

            if (productoSeleccionadoTemp.stock <= 0) {
                mostrarErrorEnModal(`El producto "${productoSeleccionadoTemp.nombre}" no tiene Stock.`);
                return;
            }

            agregarFilaDetalle(productoSeleccionadoTemp);
            const modalEl = document.getElementById("modalBuscarProducto");
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            }
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
    const modalEl = document.getElementById("modalBuscarProducto");
    if (modalEl) {
        new bootstrap.Modal(modalEl).show();
    }
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

        const tipoPagoSelect = document.getElementById("tipIdTipop") as HTMLSelectElement;
        const tipoPagoId = tipoPagoSelect?.value;

        clientesFiltrados = allClientes.filter(c => {
            if (c.cliEstado === false) return false;

            const coincideTexto = String(c.cliCedula).toLowerCase().includes(cedula) &&
                c.cliNombre.toLowerCase().includes(nombre);

            if (!coincideTexto) return false;

            // Lógica de crédito/contado
            if (tipoPagoId === "2") { // Asumiendo ID 2 es Crédito
                return c.ticIdTipoc === 2;
            }
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
            inputFiltroCedula.value = "";
            inputFiltroNombre.value = "";
            actualizarIconoModal("filtroModalCedula", false);
            actualizarIconoModal("filtroModalNombre", false);
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

        tr.innerHTML = `
            <td class="text-center">
                <input class="form-check-input" type="radio" ${clienteSeleccionadoTemp?.cliCedula === c.cliCedula ? "checked" : ""}>
            </td>
            <td>${c.cliCedula}</td>
            <td>${c.cliNombre}</td>
            <td>${c.ticIdTipoc === 1 ? "Contado" : "Crédito"}</td>
        `;

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
        if (activo) icono.classList.add("text-danger");
    }
}

function llenarDatosCliente(cliente: any) {
    const setVal = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = val;
    };

    setVal("cliCedula", cliente.cliCedula); // Hidden
    setVal("cliCedulaVisual", cliente.cliCedula);
    setVal("cliNombreVisual", cliente.cliNombre);
    setVal("cliTipoVisual", cliente.ticIdTipoc === 1 ? "Contado" : "Crédito");
    setVal("cliDireccionVisual", cliente.cliDireccion || "");
    setVal("cliTelefonoVisual", cliente.cliTelefono || "");
    setVal("cliEmailVisual", cliente.cliEmail || "");
}

// =========================================================
// CARGA DE DATOS (CON INTEGRACIÓN DE HEADERS)
// =========================================================
// Reemplaza tu función loadSelects actual por esta:
async function loadSelects() {
    const fetchApi = async (url: string, isInternal: boolean) => {
        try {
            const opts = isInternal ? { headers: getAuthHeaders() } : {};
            const r = await fetch(url, opts);
            return r.ok ? await r.json() : [];
        } catch { return []; }
    };

    const [clientesData, estData, puntosData, tiposData, prodData] = await Promise.all([
        fetchApi(CLIENTES_URL, true),
        fetchApi(ESTABLECIMIENTOS_URL, true),
        fetchApi(PUNTOS_URL, true),
        fetchApi(TIPOS_PAGO_URL, true),
        fetchApi(PRODUCTOS_EXTERNAL_URL, false)
    ]);

    allClientes = Array.isArray(clientesData) ? clientesData : (clientesData.data || []);
    allProductos = Array.isArray(prodData) ? prodData : (prodData.data || []);
    allPuntosEmision = Array.isArray(puntosData) ? puntosData : (puntosData.data || []);
    
    // Datos de Establecimientos y Puntos (Búsqueda automática de los fijos)
    const establecimientos = Array.isArray(estData) ? estData : (estData.data || []);
    const puntos = Array.isArray(puntosData) ? puntosData : (puntosData.data || []);

    // 1. Buscar y setear "Gran Aqui"
    const establecimientoFijo = establecimientos.find((e: any) => 
        e.estNombre.trim().toLowerCase() === "gran aqui" || 
        e.estNombre.includes("Gran Aqui") // Fallback por si hay espacios extra
    );

    const inputEstRuc = document.getElementById("estRuc") as HTMLInputElement;
    if (establecimientoFijo && inputEstRuc) {
        inputEstRuc.value = establecimientoFijo.estRuc; // Asignamos el RUC al input hidden
        console.log("Establecimiento fijado:", establecimientoFijo.estNombre);

        // 2. Buscar y setear "Caja de cobro - 001" basado en el RUC encontrado
        // La lógica original era: `${p.pemDescripcion} - ${p.pemIdPuntoEmision}`
        const puntoFijo = puntos.find((p: any) => 
            p.estRuc === establecimientoFijo.estRuc && 
            p.pemEstado === true &&
            // Buscamos coincidencia con el formato visual que tenías
            (`${p.pemDescripcion} - ${p.pemIdPuntoEmision}` === "Caja de cobro - 001" ||
             p.pemDescripcion.includes("Caja de cobro")) // Fallback flexible
        );

        const inputPemId = document.getElementById("pemId") as HTMLInputElement;
        if (puntoFijo && inputPemId) {
            inputPemId.value = puntoFijo.pemId; // Asignamos el ID al input hidden
            console.log("Punto de emisión fijado:", puntoFijo.pemDescripcion);
        } else {
            console.error("No se encontró el Punto de Emisión 'Caja de cobro - 001' en la API");
        }
    } else {
        console.error("No se encontró el Establecimiento 'Gran Aqui' en la API");
    }

    // Llenar solo el select de Tipo de Pago (que sigue siendo select)
    const llenarSelect = (id: string, data: any[], valProp: string, txtProp: string) => {
        const sel = document.getElementById(id) as HTMLSelectElement;
        if (sel) {
            sel.innerHTML = '<option value="">Seleccione...</option>';
            data.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d[valProp] || d.id;
                opt.text = d[txtProp] || d.nombre;
                sel.appendChild(opt);
            });
        }
    };
    llenarSelect("tipIdTipop", Array.isArray(tiposData) ? tiposData : (tiposData.data || []), "tipIdTipop", "tipDescripcion");
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

    if (emptyMsg) emptyMsg.style.display = 'none';

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

    // 1. Recolectar Cabecera
    const cliCedula = (document.getElementById("cliCedula") as HTMLInputElement).value;
    const pemId = (document.getElementById("pemId") as HTMLInputElement).value;
    const estRuc = (document.getElementById("estRuc") as HTMLInputElement).value;
    const tipIdTipop = (document.getElementById("tipIdTipop") as HTMLSelectElement).value;
    const fecha = (document.getElementById("facFechaVisual") as HTMLInputElement).value;

    if (!cliCedula || !pemId || !tipIdTipop) {
        mostrarErrorEnModal("Completa todos los campos de la cabecera.");
        return;
    }

    // 2. Recolectar Detalles
    const filas = document.querySelectorAll("#tbodyDetalles tr");
    const detallesPayload: any[] = [];

    filas.forEach((tr) => {
        const codigo = (tr.querySelector(".input-producto-codigo") as HTMLInputElement).value;
        const cantidad = parseInt((tr.querySelector(".input-cantidad") as HTMLInputElement).value);

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

    // 3. Totales (Referenciales)
    const totalSubtotalSinIva = detallesPayload.reduce((acc, d) => !d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalSubtotalConIva = detallesPayload.reduce((acc, d) => d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalIva = detallesPayload.reduce((acc, d) => acc + d.detValorIva, 0);
    const totalFactura = detallesPayload.reduce((acc, d) => acc + d.detTotal, 0);

    // 4. Armar Objeto Factura
    const factura = {
        facNumeroFactura: "",
        estRuc: estRuc,
        cliCedula: cliCedula,
        pemId: parseInt(pemId),
        tipIdTipop: parseInt(tipIdTipop),
        facFechaEmision: new Date(fecha).toISOString(),
        facEstadoFactura: true,
        facUsuarioCreacion: "Admin",
        facSubtotalSinIva: totalSubtotalSinIva,
        facSubtotalConIva: totalSubtotalConIva,
        facIva: totalIva,
        facTotal: totalFactura,
        detallesFactura: detallesPayload
    };

    // --- MANEJO DE MODAL DE CARGA ---
    const loadingModalEl = document.getElementById("loadingModal");
    let loadingModalInstance: any = null;
    
    if (loadingModalEl) {
        loadingModalInstance = new bootstrap.Modal(loadingModalEl);
        loadingModalInstance.show();
    }
    // -------------------------------

    // 5. Enviar
    try {
        const response = await fetch(FACTURAS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify(factura)
        });

        // Ocultar modal de carga antes de mostrar resultado
        if (loadingModalInstance) {
             // Pequeño timeout para asegurar transición suave
             await new Promise(r => setTimeout(r, 500)); 
             loadingModalInstance.hide();
        }

        if (response.ok) {
            let numeroFactura = "";
            try {
                const data = await response.json();
                numeroFactura = data.facNumeroFactura || "";
            } catch (e) {
                console.warn("La respuesta no tiene JSON válido, pero fue exitosa.");
            }

            const modalEl = document.getElementById('successModal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                const msgExito = document.getElementById('mensajeExitoId'); // Asegúrate que este ID exista en tu HTML si lo usas, si no, ignora esta línea
                
                // Si tienes un elemento para mensaje dinámico:
                if (msgExito) {
                    msgExito.innerText = numeroFactura 
                        ? `Factura ${numeroFactura} generada correctamente.`
                        : `Factura generada correctamente.`;
                }

                modal.show();
                document.getElementById('btnOkSuccess')?.addEventListener('click', () => window.location.href = "/facturas");
            }
        } else {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }

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
        // Ocultar modal de carga si hay error de red
        if (loadingModalInstance) loadingModalInstance.hide();

        console.error("Error de red:", error);
        mostrarErrorEnModal("Error de conexión con el servidor.");
    }
}

function mostrarErrorEnModal(msg: string) {
    const msgEl = document.getElementById("errorModalMsg");
    const modalEl = document.getElementById("errorModal");
    if (msgEl && modalEl) {
        msgEl.innerText = msg;
        new bootstrap.Modal(modalEl).show();
    }
}