
// src/scripts/crear_factura.ts

const API_URL = import.meta.env.PUBLIC_BACKEND_URL;
const PRODUCTOS_EXTERNAL_URL = import.meta.env.PUBLIC_EXTERNAL_INVENTORY_URL;
const CLIENTES_URL = API_URL + "Clientes";
const ESTABLECIMIENTOS_URL = API_URL + "Establecimientoes";
const PUNTOS_URL = API_URL + "PuntoEmisions";
const FACTURAS_URL = API_URL + "Facturas";
const TIPOS_PAGO_URL = API_URL + "TipoPagoes";

declare const bootstrap: any;

interface Detalle {
    id: number;
    codigo: string;
    cantidad: number;
}

// Estructura de producto externo adaptada a la respuesta JSON actual
interface ProductoExterno {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string;
    costo: string; // "39.00"
    pvp: string;   // "84.00" (Precio Venta Público)
    stock: number;
    impuesto: {
        id: number;
        nombre: string;     // "IVA 15%"
        porcentaje: string; // "15.00"
    } | null;
}

let contadorDetalle = 0;
let allPuntosEmision: any[] = [];
let allProductos: ProductoExterno[] = [];

export async function initCrearFactura() {
    console.log("Iniciando carga de datos...");
    await loadSelects();
    setupDetalles();

    const form = document.getElementById("formCrearFactura") as HTMLFormElement;
    form?.addEventListener("submit", handleSubmit);

    document.getElementById("estRuc")?.addEventListener("change", (e) => {
        const estRuc = (e.target as HTMLSelectElement).value;
        filtrarPuntosEmision(estRuc);
    });
}

async function loadSelects() {

    console.log("--- Iniciando carga de selectores ---");

    // 1. CARGAR CLIENTES
    try {
        const res = await fetch(CLIENTES_URL);
        if (res.ok) {
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.data || []);
            const select = document.getElementById("cliCedula") as HTMLSelectElement;
            if (select) {
                select.innerHTML = '<option value="">Seleccione cliente...</option>';
                lista.forEach((c: any) => {
                    if (c.cliEstado !== false) {
                        const option = document.createElement("option");
                        option.value = c.cliCedula;
                        option.text = `${c.cliNombre} (${c.cliCedula})`;
                        select.appendChild(option);
                    }
                });
            }
        }
    } catch (e) { console.error("Error cargando clientes:", e); }

    // 2. CARGAR ESTABLECIMIENTOS
    try {
        const res = await fetch(ESTABLECIMIENTOS_URL);
        if (res.ok) {
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.data || []);
            const select = document.getElementById("estRuc") as HTMLSelectElement;
            if (select) {
                select.innerHTML = '<option value="">Seleccione establecimiento...</option>';
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
    } catch (e) { console.error("Error cargando establecimientos:", e); }

    // 3. CARGAR PUNTOS DE EMISIÓN
    try {
        const res = await fetch(PUNTOS_URL);
        if (res.ok) {
            const data = await res.json();
            allPuntosEmision = Array.isArray(data) ? data : (data.data || []);
        }
    } catch (e) { console.error("Error cargando puntos:", e); }

    // 4. CARGAR TIPOS DE PAGO
    try {
        const select = document.getElementById("tipIdTipop") as HTMLSelectElement;
        if (select) {
            const res = await fetch(TIPOS_PAGO_URL);
            if (res.ok) {
                const data = await res.json();
                const lista = Array.isArray(data) ? data : (data.data || []);
                select.innerHTML = '<option value="">Seleccione tipo de pago...</option>';
                lista.forEach((t: any) => {
                    const option = document.createElement("option");
                    option.value = t.tipIdTipop || t.id;
                    option.text = t.tipDescripcion || t.descripcion || t.nombre || "Sin descripción";
                    select.appendChild(option);
                });
            }
        }
    } catch (e) { console.error("Excepción cargando tipos pago:", e); }

    // 5. CARGAR PRODUCTOS EXTERNOS
    try {
        console.log("Cargando productos externos...");
        const res = await fetch(PRODUCTOS_EXTERNAL_URL);
        if (res.ok) {
            const data = await res.json();
            allProductos = Array.isArray(data) ? data : (data.data || []);

            // Si ya hay filas (ej: recarga), actualizar sus selects
            actualizarSelectsProductos();
        }
    } catch (e) { console.error("Error cargando productos :", e); }
}

function actualizarSelectsProductos() {
    const selects = document.querySelectorAll(".input-producto") as NodeListOf<HTMLSelectElement>;

    selects.forEach(select => {
        const valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione producto...</option>';
        allProductos.forEach(p => {
            const option = document.createElement("option");
            option.value = p.codigo; // Usamos CODIGO como valor clave
            option.text = p.nombre;  // Mostramos NOMBRE en la lista
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
    // Agregar fila inicial
    agregarFilaDetalle();
}

function agregarFilaDetalle() {
    contadorDetalle++;
    const tbody = document.getElementById("tbodyDetalles");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.id = `fila-${contadorDetalle}`;

    // Columnas según requerimiento:
    // 1. Producto (Select)
    // 2. Codigo (Auto)
    // 3. Descripcion (Auto)
    // 4. Stock (Auto)
    // 5. Costo (Auto)
    // 6. Cantidad (Input)
    // 7. Nombre Impuesto (Auto)
    // 8. Precio Sin IVA (Auto) -> PVP
    // 9. Precio Total (Auto)
    // 10. Accion

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

    // Llenar Select
    const select = tr.querySelector(".input-producto") as HTMLSelectElement;
    select.innerHTML = '<option value="">Seleccione producto...</option>';
    allProductos.forEach(p => {
        const option = document.createElement("option");
        option.value = p.codigo;
        option.text = p.nombre;
        select.appendChild(option);
    });

    // Listeners
    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;
    const updateRow = () => calcularFila(tr);

    select.addEventListener("change", updateRow);
    qtyInput.addEventListener("input", updateRow);

    // Borrar
    tr.querySelector(".btn-remove-row")?.addEventListener("click", () => {
        tr.remove();
        if (tbody.children.length === 0) agregarFilaDetalle();
    });
}

function calcularFila(tr: HTMLElement) {
    const select = tr.querySelector(".input-producto") as HTMLSelectElement;
    const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;

    // Inputs de solo lectura
    const inputCodigo = tr.querySelector(".input-codigo") as HTMLInputElement;
    const inputDesc = tr.querySelector(".input-descripcion") as HTMLInputElement;
    const inputStock = tr.querySelector(".input-stock") as HTMLInputElement;
    const inputCosto = tr.querySelector(".input-costo") as HTMLInputElement;
    const inputImpuesto = tr.querySelector(".input-impuesto-nombre") as HTMLInputElement;
    const inputPrecio = tr.querySelector(".input-precio") as HTMLInputElement;
    const totalCell = tr.querySelector(".row-total") as HTMLElement;

    const codigo = select.value;
    let cantidad = parseInt(qtyInput.value) || 0;

    // Limpiar si no hay seleccion
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
        if (cantidad > prod.stock) {
            cantidad = prod.stock;
            qtyInput.value = String(cantidad);
        }
        // Llenar datos informativos
        inputCodigo.value = prod.codigo;
        inputDesc.value = prod.descripcion || "";
        inputStock.value = String(prod.stock);
        inputCosto.value = `$${parseFloat(prod.costo).toFixed(2)}`;

        const nombreImpuesto = prod.impuesto ? prod.impuesto.nombre : "Sin Impuesto";
        const porcentajeImpuesto = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;

        inputImpuesto.value = nombreImpuesto;
        inputPrecio.value = `$${parseFloat(prod.pvp).toFixed(2)}`;

        if (cantidad > 0) {
            // Calculo de total de linea
            // Precio Sin IVA (PVP) * Cantidad
            // + IVA
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

    // 1. Recolectar Cabecera
    const cliCedula = (document.getElementById("cliCedula") as HTMLSelectElement).value;
    const pemId = (document.getElementById("pemId") as HTMLSelectElement).value;
    const estRuc = (document.getElementById("estRuc") as HTMLSelectElement).value;
    const tipIdTipop = (document.getElementById("tipIdTipop") as HTMLSelectElement).value;

    if (!cliCedula || !pemId || !tipIdTipop) {
        mostrarErrorEnModal("Completa todos los campos de la cabecera.");
        return;
    }

    // 2. Recolectar Detalles
    // NOTA: Al backend nuevo solo le importa 'codigo' y 'cantidad'.
    // El resto (precio, nombre, iva) lo recalcula el servidor consultando la API de Inventario.
    // Sin embargo, enviamos la estructura completa para cumplir con el modelo C# si fuera necesario.
    const filas = document.querySelectorAll("#tbodyDetalles tr");
    const detallesPayload: any[] = [];

    filas.forEach((tr) => {
        const select = tr.querySelector(".input-producto") as HTMLSelectElement;
        const qtyInput = tr.querySelector(".input-cantidad") as HTMLInputElement;

        const codigo = select.value;
        const cantidad = parseInt(qtyInput.value);

        if (codigo && cantidad > 0) {
            // Busamos datos en memoria solo para llenar el objeto visualmente
            const prod = allProductos.find(p => p.codigo === codigo);
            if (prod) {
                // Estos cálculos son REFERENCIALES para el frontend.
                // El backend hará sus propios cálculos oficiales.
                const precio = parseFloat(prod.pvp);
                const porcentajeIva = prod.impuesto ? parseFloat(prod.impuesto.porcentaje) : 0;
                const subtotal = precio * cantidad;
                const valorIva = subtotal * (porcentajeIva / 100);
                const total = subtotal + valorIva;

                detallesPayload.push({
                    detIdDetalle: 0,
                    // Enviamos cadena vacía o null, el Backend asignará el ID generado por el SP
                    facNumeroFactura: "",
                    detIdProductoExterno: prod.id,
                    detCodigoProducto: prod.codigo, // VITAL: Esto es lo que usa el backend para buscar
                    detNombreProducto: prod.nombre,
                    detCantidad: cantidad,          // VITAL: Esto es lo que usa el backend para stock
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
    // Se envían para pasar la validación del modelo, pero el Backend los sobrescribirá
    const totalSubtotalSinIva = detallesPayload.reduce((acc, d) => !d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalSubtotalConIva = detallesPayload.reduce((acc, d) => d.detGrabaIva ? acc + d.detSubtotal : acc, 0);
    const totalIva = detallesPayload.reduce((acc, d) => acc + d.detValorIva, 0);
    const totalFactura = detallesPayload.reduce((acc, d) => acc + d.detTotal, 0);

    // 4. Armar Objeto Factura
    const factura = {
        // CAMBIO CLAVE: Enviamos string vacío. 
        // El Backend detecta esto, llama al SP, genera el ID (ej: 001-001-0005) y se lo asigna.
        facNumeroFactura: "",

        estRuc: estRuc,
        cliCedula: cliCedula,
        pemId: parseInt(pemId),
        tipIdTipop: parseInt(tipIdTipop),
        facFechaEmision: new Date().toISOString(),
        facEstadoFactura: true,
        facUsuarioCreacion: "Admin", // Usuario obligatorio

        // Totales calculados en front (backend validará los suyos)
        facSubtotalSinIva: totalSubtotalSinIva,
        facSubtotalConIva: totalSubtotalConIva,
        facIva: totalIva,
        facTotal: totalFactura,
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
            // El backend devuelve el objeto creado con el ID real
            const facturaCreada = await response.json();
            console.log("Factura creada con ID:", facturaCreada.facNumeroFactura);

            const modalEl = document.getElementById('successModal');
            if (modalEl) {
                // Opcional: Mostrar el ID real en el modal de éxito si tienes un elemento para ello
                const msgExito = document.getElementById('mensajeExitoId');
                if (msgExito) msgExito.innerText = `Factura ${facturaCreada.facNumeroFactura} generada correctamente.`;

                const successModal = new bootstrap.Modal(modalEl);
                successModal.show();

                document.getElementById('btnOkSuccess')?.addEventListener('click', () => {
                    window.location.href = "/facturas";
                });
            }
        } else {
            let msg = "Error al crear factura";

            // 1. Leemos el cuerpo UNA sola vez como texto plano
            const rawText = await response.text();

            try {
                // 2. Intentamos convertir ese texto a JSON manualmente
                const errData = JSON.parse(rawText);

                // 3. Si funcionó, extraemos el mensaje bonito
                msg = errData.detail || errData.message || JSON.stringify(errData);

                if (errData.errors) {
                    // Para errores de validación de .NET (ej: campos requeridos)
                    msg += ": " + JSON.stringify(errData.errors);
                }
            } catch (e) {
                // 4. Si falló el JSON.parse, significa que el error era texto plano o HTML
                // Usamos el texto crudo que leímos al principio (si no está vacío)
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
