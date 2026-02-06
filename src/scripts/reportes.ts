// src/scripts/reportes.ts
import { getAuthHeaders, checkAuth, registrarAuditoria } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';
import { uploadPDFToS3 } from "../utils/storage";
import { initAmplify } from "../aws-config";

const BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;

const API_CLIENTES = BASE_URL + "Clientes";
const API_FACTURAS = BASE_URL + "Facturas";
const API_TIPOS_PAGO = BASE_URL + "TipoPagoes";

let clientesData: any[] = [];
let facturasData: any[] = [];
let tiposPagoData: any[] = [];
let charts: Record<string, Chart> = {};

export function initReportes() {
    initAmplify();
    checkAuth();
    cargarDatos();
    setupEventListeners();

    // Registrar auditoría
    // Auditoria de acceso eliminada

}

function setupEventListeners() {
    // Actualizar datos
    document.getElementById('btnActualizar')?.addEventListener('click', cargarDatos);

    // Reportes de Clientes
    document.getElementById('btnReporteClientesGeneral')?.addEventListener('click', () => generarReporteClientesGeneral());
    document.getElementById('btnReporteClientesTipo')?.addEventListener('click', () => generarReporteClientesTipo());
    document.getElementById('btnReporteClientesFacturas')?.addEventListener('click', () => generarReporteClientesFacturas());
    document.getElementById('btnReporteTopClientes')?.addEventListener('click', () => generarReporteTopClientes());

    // Reportes de Facturas
    document.getElementById('btnReporteFacturasGeneral')?.addEventListener('click', () => generarReporteFacturasGeneral());
    // btnReporteFacturasEstado removed
    document.getElementById('btnReporteFacturasPeriodo')?.addEventListener('click', () => generarReporteFacturasPeriodo());
    document.getElementById('btnReporteVentasCliente')?.addEventListener('click', () => generarReporteVentasCliente());

    // Análisis
    document.getElementById('btnReporteAnalisis')?.addEventListener('click', () => generarReporteAnalisisCompleto());

    // Limpiar fechas
    document.getElementById('btnLimpiarFechas')?.addEventListener('click', limpiarFechas);

    // Tabs
    document.getElementById('ventas-tab')?.addEventListener('click', () => {
        setTimeout(() => renderCharts(), 100);
    });
}

async function cargarDatos() {
    mostrarToast('Cargando datos...', 'info');

    try {
        // Cargar clientes
        const resClientes = await fetch(API_CLIENTES, { headers: getAuthHeaders() });
        if (resClientes.ok) {
            const dataClientes = await resClientes.json();
            clientesData = Array.isArray(dataClientes) ? dataClientes : (dataClientes.data || []);
        }

        // Cargar facturas
        const resFacturas = await fetch(API_FACTURAS, { headers: getAuthHeaders() });
        if (resFacturas.ok) {
            const dataFacturas = await resFacturas.json();
            facturasData = Array.isArray(dataFacturas) ? dataFacturas : (dataFacturas.data || []);
        }

        // Cargar tipos de pago
        const headers = getAuthHeaders();
        console.log("Headers for TipoPagoes:", headers);
        const resTipos = await fetch(API_TIPOS_PAGO, { headers });
        if (resTipos.ok) {
            const dataTipos = await resTipos.json();
            tiposPagoData = Array.isArray(dataTipos) ? dataTipos : (dataTipos.data || []);
        } else {
            console.error("Error fetching TipoPagoes:", resTipos.status);
        }

        actualizarEstadisticas();
        mostrarToast('Datos cargados correctamente', 'success');
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarToast('Error al cargar datos', 'error');
    }
}

function actualizarEstadisticas() {
    // Total clientes
    document.getElementById('totalClientes')!.textContent = clientesData.length.toString();

    // Total facturas
    const facturasActivas = facturasData.filter(f => f.facEstadoFactura);
    document.getElementById('totalFacturas')!.textContent = facturasActivas.length.toString();

    // Total ventas
    const totalVentas = facturasActivas.reduce((sum, f) => sum + (f.facTotal || 0), 0);
    document.getElementById('totalVentas')!.textContent = `$${totalVentas.toFixed(2)}`;

    // Promedio venta
    const promedio = facturasActivas.length > 0 ? totalVentas / facturasActivas.length : 0;
    document.getElementById('promedioVenta')!.textContent = `$${promedio.toFixed(2)}`;
}

// ============================================================
// REPORTES DE CLIENTES
// ============================================================

async function generarReporteClientesGeneral() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte general de clientes', '');

        const doc = new jsPDF();

        // --- PORTADA ---
        agregarEncabezado(doc, 'REPORTE GENERAL DE CLIENTES');
        let yPos = 50;
        let isFirstPage = true;

        for (let i = 0; i < clientesData.length; i++) {
            const client = clientesData[i];
            const clientInvoices = facturasData.filter(f => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);

            // Fetch details if missing (simulado/rápido) - Para reportes muy grandes esto puede ser lento.
            // Considerar si cargar detalles bajo demanda o asumir que están.
            // En reporte global de clientes.ts se cargan lazy. Aquí quizás ya están? 
            // `cargarDatos` trae /Facturas, que suele ser lista simple.
            // Vamos a intentar traer detalles si no estan.

            // --- PRE-CALC HEIGHT ---
            // --- PRE-CALC HEIGHT ---
            let estimatedHeight = 60 + (clientInvoices.length * 15);

            // Fetch Details for Invoices (Copy-Paste Logic)
            for (const invoice of clientInvoices) {
                await ensureInvoiceDetails(invoice);
            }

            if (yPos + estimatedHeight > doc.internal.pageSize.height - 20) {
                doc.addPage();
                yPos = 20;
            } else if (!isFirstPage && i > 0) {
                yPos += 10;
            }
            isFirstPage = false;

            const startPage = doc.getNumberOfPages();
            const startY = yPos;

            generateClientSection(doc, client, clientInvoices, yPos + 5);

            const endPage = doc.getNumberOfPages();
            const lastY = (doc as any).customLastY || (doc as any).lastAutoTable?.finalY;
            const endY = (lastY || (startY + 60)) + 5;

            drawClientBorder(doc, startPage, startY, endPage, endY);

            yPos = endY + 15;
        }

        agregarPiePagina(doc);
        const fileName = `Clientes_General_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            mostrarToast('Subiendo respaldo a la nube...', 'info');
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
            mostrarToast('Reporte subido a S3 exitosamente', 'success');
        } catch (e) {
            console.warn("Error subiendo a S3", e);
            mostrarToast('Error al subir respaldo a S3', 'error');
        }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar el reporte de clientes', 'error');
    }
}

async function generarReporteClientesTipo() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de clientes por tipo', '');

        const contado = clientesData.filter(c => c.ticIdTipoc === 1);
        const credito = clientesData.filter(c => c.ticIdTipoc === 2);

        // Función interna para generar bloque por tipo
        const generarBloqueTipo = async (doc: jsPDF, titulo: string, clientes: any[]) => {
            doc.addPage();
            agregarEncabezado(doc, titulo);

            let yPos = 50;
            let isFirstPage = true;

            for (let i = 0; i < clientes.length; i++) {
                const client = clientes[i];
                const clientInvoices = facturasData.filter(f => f.cliCedula === client.cliCedula || f.cliente?.cliCedula === client.cliCedula);

                // Fetch details
                for (const invoice of clientInvoices) {
                    await ensureInvoiceDetails(invoice);
                }

                // Pre-calc height (simulated)
                let estimatedHeight = 60 + (clientInvoices.length * 15);

                if (yPos + estimatedHeight > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                } else if (!isFirstPage && i > 0) {
                    yPos += 10;
                }
                isFirstPage = false;

                const startPage = doc.getNumberOfPages();
                const startY = yPos;

                generateClientSection(doc, client, clientInvoices, yPos + 5);

                const endPage = doc.getNumberOfPages();
                const lastY = (doc as any).customLastY || (doc as any).lastAutoTable?.finalY;
                const endY = (lastY || (startY + 60)) + 5;

                drawClientBorder(doc, startPage, startY, endPage, endY);
                yPos = endY + 15;
            }
        };

        const doc = new jsPDF();
        // Portada Resumen
        agregarEncabezado(doc, 'CLIENTES POR TIPO - RESUMEN');
        let yPos = 50;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen Estadístico', 15, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`• Clientes Contado: ${contado.length} (${((contado.length / (clientesData.length || 1)) * 100).toFixed(1)}%)`, 20, yPos);
        yPos += 8;
        doc.text(`• Clientes Crédito: ${credito.length} (${((credito.length / (clientesData.length || 1)) * 100).toFixed(1)}%)`, 20, yPos);

        // Generar secciones detalladas
        if (contado.length > 0) await generarBloqueTipo(doc, 'CLIENTES DE CONTADO', contado);
        if (credito.length > 0) await generarBloqueTipo(doc, 'CLIENTES DE CRÉDITO', credito);

        agregarPiePagina(doc);
        const fileName = `Clientes_Por_Tipo_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar el reporte de tipos', 'error');
    }
}

async function generarReporteClientesFacturas() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de clientes con historial', '');

        const doc = new jsPDF('landscape');
        agregarEncabezado(doc, 'CLIENTES CON HISTORIAL DE COMPRAS');

        const tableData = clientesData.map(cliente => {
            const facturas = facturasData.filter(f =>
                (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
            );
            const total = facturas.reduce((sum, f) => sum + (f.facTotal || 0), 0);

            return [
                cliente.cliCedula,
                cliente.cliNombre,
                cliente.tipoCliente?.ticDescripcion || (cliente.ticIdTipoc === 1 ? 'Contado' : 'Crédito'),
                facturas.length,
                `$${total.toFixed(2)}`
            ];
        }).sort((a, b) => parseFloat(b[4].replace('$', '')) - parseFloat(a[4].replace('$', '')));

        autoTable(doc, {
            startY: 50,
            head: [['Cédula', 'Nombre', 'Tipo', 'Nº Facturas', 'Total Comprado']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [23, 162, 184], fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 4 },
            alternateRowStyles: { fillColor: [240, 255, 255] },
            columnStyles: {
                3: { halign: 'center' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        agregarPiePagina(doc);
        const fileName = `Clientes_Historial_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar historial de compras', 'error');
    }
}

async function generarReporteTopClientes() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte Top 10 clientes', '');

        const clientesConVentas = clientesData.map(cliente => {
            const facturas = facturasData.filter(f =>
                (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
            );
            const total = facturas.reduce((sum, f) => sum + Number(f.facTotal || 0), 0);

            return {
                ...cliente,
                cantidadFacturas: facturas.length,
                totalComprado: total
            };
        }).filter(c => c.totalComprado > 0)
            .sort((a, b) => b.totalComprado - a.totalComprado)
            .slice(0, 10);

        const doc = new jsPDF();
        agregarEncabezado(doc, 'TOP 10 MEJORES CLIENTES');

        doc.setFontSize(10);
        doc.text('Clientes ordenados por volumen de compras', 15, 45);

        const tableData = clientesConVentas.map((c, index) => [
            `#${index + 1}`,
            c.cliNombre,
            c.tipoCliente?.ticDescripcion || (c.ticIdTipoc === 1 ? 'Contado' : 'Crédito'),
            c.cantidadFacturas,
            `$${(c.totalComprado || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 55,
            head: [['Ranking', 'Nombre', 'Tipo', 'Facturas', 'Total Comprado']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [255, 193, 7], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 11, cellPadding: 4 },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold', fillColor: [255, 243, 205] },
                3: { halign: 'center' },
                4: { halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: [255, 250, 230] }
        });

        agregarPiePagina(doc);
        const fileName = `Top_10_Clientes_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar top clientes', 'error');
    }
}

// ============================================================
// REPORTES DE FACTURAS
// ============================================================

async function generarReporteFacturasGeneral() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte general de facturas', '');

        const doc = new jsPDF();

        agregarEncabezado(doc, 'REPORTE GENERAL DE FACTURAS');
        let yPos = 50;
        let isFirstPage = true;

        for (let i = 0; i < facturasData.length; i++) {
            const factura = facturasData[i];

            await ensureInvoiceDetails(factura);

            // Check page break (Header ~ 40 height + Details Table)
            if (yPos > doc.internal.pageSize.height - 60) {
                doc.addPage();
                yPos = 20;
            } else if (!isFirstPage && i > 0) {
                // Separator line
                doc.setDrawColor(200, 200, 200);
                doc.line(15, yPos - 5, doc.internal.pageSize.width - 15, yPos - 5);
            }
            isFirstPage = false;

            generateFacturaSection(doc, factura, yPos);

            const lastY = (doc as any).lastAutoTable?.finalY;
            yPos = lastY ? lastY + 15 : yPos + 60;
        }

        agregarPiePagina(doc);
        const fileName = `Facturas_General_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar reporte de facturas', 'error');
    }
}



async function generarReporteFacturasPeriodo() {
    try {
        const fechaInicio = (document.getElementById('facturaFechaInicio') as HTMLInputElement).value;
        const fechaFin = (document.getElementById('facturaFechaFin') as HTMLInputElement).value;

        if (!fechaInicio || !fechaFin) {
            mostrarToast('Selecciona un rango de fechas', 'error');
            return;
        }

        await registrarAuditoria('Generar Reportes', 'EXPORT', `Generó reporte de facturas del ${fechaInicio} al ${fechaFin}`, '');

        const facturasFiltradas = facturasData.filter(f => {
            const fechaFactura = new Date(f.facFechaEmision);
            fechaFactura.setHours(0, 0, 0, 0);
            const inicio = new Date(fechaInicio + 'T00:00:00');
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(fechaFin + 'T00:00:00');
            fin.setHours(0, 0, 0, 0);
            return fechaFactura.getTime() >= inicio.getTime() && fechaFactura.getTime() <= fin.getTime();
        });

        const doc = new jsPDF();
        agregarEncabezado(doc, `FACTURAS DEL ${fechaInicio} AL ${fechaFin}`);

        let yPos = 50;
        let isFirstPage = true;

        for (let i = 0; i < facturasFiltradas.length; i++) {
            const factura = facturasFiltradas[i];
            await ensureInvoiceDetails(factura);
            if (yPos > doc.internal.pageSize.height - 60) {
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

        // Total Periodo
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        const total = facturasFiltradas.filter(f => f.facEstadoFactura).reduce((sum, f) => sum + (f.facTotal || 0), 0);
        doc.text(`Total Período: $${total.toFixed(2)}`, 15, 20);

        agregarPiePagina(doc);
        const fileName = `Facturas_Periodo_${fechaInicio}_${fechaFin}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar reporte por periodo', 'error');
    }
}

async function generarReporteVentasCliente() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó resumen de ventas por cliente', '');

        const ventasPorCliente = clientesData.map(cliente => {
            const facturas = facturasData.filter(f =>
                (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
            );
            const total = facturas.reduce((sum, f) => sum + Number(f.facTotal || 0), 0);

            return {
                cedula: cliente.cliCedula,
                nombre: cliente.cliNombre,
                cantidad: facturas.length,
                total: total
            };
        }).filter(v => v.cantidad > 0)
            .sort((a, b) => b.total - a.total);

        const doc = new jsPDF();
        agregarEncabezado(doc, 'RESUMEN DE VENTAS POR CLIENTE');

        const tableData = ventasPorCliente.map(v => [
            v.cedula,
            v.nombre,
            v.cantidad,
            `$${(v.total || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 50,
            head: [['Cédula', 'Nombre', 'Facturas', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [255, 193, 7], fontStyle: 'bold', textColor: [0, 0, 0] },
            styles: { fontSize: 10, cellPadding: 4 },
            alternateRowStyles: { fillColor: [255, 250, 230] },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right', fontStyle: 'bold' }
            }
        });

        agregarPiePagina(doc);
        const fileName = `Ventas_Por_Cliente_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar ventas por cliente', 'error');
    }
}

// ============================================================
// GRÁFICOS Y ANÁLISIS
// ============================================================

function renderCharts() {
    renderChartVentasMes();
    renderChartClientesTipo();
    // renderChartFacturasEstado removed
}

function renderChartVentasMes() {
    const canvas = document.getElementById('chartVentasMes') as HTMLCanvasElement;
    if (!canvas) return;

    // Destruir chart anterior si existe
    if (charts['ventasMes']) {
        charts['ventasMes'].destroy();
    }

    // Obtener últimos 6 meses
    const meses = [];
    const ventas = [];
    const hoy = new Date();

    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        meses.push(nombreMes);

        const ventasMes = facturasData
            .filter(f => {
                const fechaFac = new Date(f.facFechaEmision);
                return fechaFac.getMonth() === fecha.getMonth() &&
                    fechaFac.getFullYear() === fecha.getFullYear() &&
                    f.facEstadoFactura;
            })
            .reduce((sum, f) => sum + Number(f.facTotal || 0), 0);

        ventas.push(ventasMes);
    }

    charts['ventasMes'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Ventas ($)',
                data: ventas,
                backgroundColor: 'rgba(13, 110, 253, 0.5)',
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderChartClientesTipo() {
    const canvas = document.getElementById('chartClientesTipo') as HTMLCanvasElement;
    if (!canvas) return;

    if (charts['clientesTipo']) {
        charts['clientesTipo'].destroy();
    }

    const contado = clientesData.filter(c => c.ticIdTipoc === 1).length;
    const credito = clientesData.filter(c => c.ticIdTipoc === 2).length;

    charts['clientesTipo'] = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Contado', 'Crédito'],
            datasets: [{
                data: [contado, credito],
                backgroundColor: ['rgba(40, 167, 69, 0.7)', 'rgba(255, 193, 7, 0.7)'],
                borderColor: ['rgba(40, 167, 69, 1)', 'rgba(255, 193, 7, 1)'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}



async function generarReporteAnalisisCompleto() {
    try {
        await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de análisis completo', '');
        mostrarToast('Generando reporte completo...', 'info');

        const doc = new jsPDF();
        agregarEncabezado(doc, 'ANÁLISIS COMPLETO DE VENTAS');

        doc.setFontSize(10);
        doc.text('Este reporte incluye análisis estadísticos completos', 15, 50);
        doc.text('con gráficos de ventas, clientes y facturación.', 15, 56);

        let yPos = 70;
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen Ejecutivo:', 15, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'normal');
        doc.text(`Total Clientes: ${clientesData.length}`, 20, yPos);
        yPos += 6;
        doc.text(`Total Facturas Activas: ${facturasData.filter(f => f.facEstadoFactura).length}`, 20, yPos);
        yPos += 6;
        const totalVentas = facturasData.filter(f => f.facEstadoFactura).reduce((s, f) => s + (f.facTotal || 0), 0);
        doc.text(`Total Ventas: $${totalVentas.toFixed(2)}`, 20, yPos);

        agregarPiePagina(doc);
        const fileName = `Analisis_Completo_${getFechaActual()}.pdf`;
        doc.save(fileName);

        // Upload to S3
        try {
            const blob = doc.output('blob');
            await uploadPDFToS3(blob, 'reportes', fileName);
            mostrarToast('Reporte subido a S3 exitosamente', 'success');
        } catch (e) { console.warn("S3 Upload Failed", e); }

        mostrarToast('Reporte generado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error al generar análisis completo', 'error');
    }
}

// ============================================
// HELPERS FOR DETAILED REPORTS (Ported from clientes.ts & facturas.ts)
// ============================================

async function ensureInvoiceDetails(factura: any) {
    if (!factura.detallesFactura) {
        try {
            const res = await fetch(`${API_FACTURAS}/${factura.facNumeroFactura}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const fullFactura = await res.json();
                Object.assign(factura, fullFactura);
            }
        } catch (e) {
            console.warn(`Error fetching details for invoice ${factura.facNumeroFactura}`, e);
        }
    }
}

/**
 * Dibuja un borde alrededor de una sección que puede abarcar múltiples páginas.
 */
function drawClientBorder(doc: jsPDF, startPage: number, startY: number, endPage: number, endY: number) {
    const margin = 10;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const boxWidth = pageWidth - (margin * 2);
    const boxX = margin;

    doc.setDrawColor(108, 117, 125);
    doc.setLineWidth(0.5);

    const originalPage = doc.getNumberOfPages();

    for (let p = startPage; p <= endPage; p++) {
        doc.setPage(p);

        const topY = (p === startPage) ? startY : 20;
        const bottomY = (p === endPage) ? endY : (pageHeight - 20);

        doc.line(boxX, topY, boxX, bottomY); // Left
        doc.line(boxX + boxWidth, topY, boxX + boxWidth, bottomY); // Right

        if (p === startPage) doc.line(boxX, topY, boxX + boxWidth, topY); // Top
        if (p === endPage) doc.line(boxX, bottomY, boxX + boxWidth, bottomY); // Bottom
    }
    doc.setPage(originalPage);
}

function generateClientSection(doc: jsPDF, client: any, invoices: any[], startY: number) {
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);

    // --- SECCIÓN DEL CLIENTE (DISEÑO VERTICAL TIPO TARJETA) ---
    const bgFill = [248, 249, 250];
    const borderColor = [220, 220, 220];
    const labelColor = [33, 37, 41];
    const textColor = [73, 80, 87];

    const cardStartX = margin;
    const cardStartY = startY;

    // Helper interno
    const pField = (lbl: string, val: string, x: number, y: number, maxW: number) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.text(lbl, x, y);
        const lW = doc.getTextWidth(lbl);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const vLines = doc.splitTextToSize(val, maxW - lW - 5);
        doc.text(vLines, x + lW + 2, y);
        return doc.getTextDimensions(vLines).h;
    };

    const drawContent = () => {
        let cy = startY + 10;

        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");

        const nLines = doc.splitTextToSize(client.cliNombre, contentWidth - 10);
        doc.text(nLines, margin + 5, cy);
        const nH = doc.getTextDimensions(nLines).h;

        const lY = cy + nH + 2;
        doc.setDrawColor(13, 110, 253);
        doc.setLineWidth(0.5);
        doc.line(margin + 5, lY, margin + 5 + 50, lY);

        cy = lY + 8;
        const halfWidth = contentWidth / 2;

        const h1_ = pField("Cédula/RUC:", client.cliCedula, margin + 5, cy, halfWidth);
        cy += Math.max(h1_, 6) + 2;

        const h2_ = pField("Email:", client.cliEmail || 'N/A', margin + 5, cy, contentWidth);
        cy += Math.max(h2_, 6) + 2;

        pField("Teléfono:", client.cliTelefono || 'N/A', margin + 5, cy, halfWidth);

        let c2y = lY + 8;
        const c2x = margin + halfWidth + 5;
        pField("Tipo:", client.tipoCliente?.ticDescripcion || (client.ticIdTipoc === 1 ? "Contado" : "Crédito"), c2x, c2y, halfWidth);

        c2y += 8;
        doc.setFillColor(client.cliEstado ? 40 : 220, client.cliEstado ? 167 : 53, client.cliEstado ? 69 : 69);
        doc.circle(c2x + 15, c2y - 1, 1.5, 'F');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(client.cliEstado ? "Activo" : "Inactivo", c2x + 20, c2y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.text("Estado:", c2x, c2y);

        cy = Math.max(cy, c2y + 6) + 4;
        const ha = pField("Dirección:", client.cliDireccion || 'N/A', margin + 5, cy, contentWidth);
        cy += Math.max(ha, 6) + 5;

        return cy;
    };

    // Calculate height
    const _nLines = doc.splitTextToSize(client.cliNombre, contentWidth - 10);
    const _nH = doc.getTextDimensions(_nLines).h;
    const _addrLines = doc.splitTextToSize(client.cliDireccion || 'N/A', contentWidth - (doc.getTextWidth("Dirección:") + 10));
    const _addrH = doc.getTextDimensions(_addrLines).h;
    const calculatedHeight = 10 + _nH + 2 + 8 + 24 + 4 + _addrH + 5;

    // Pintar Fondo
    doc.setFillColor(bgFill[0], bgFill[1], bgFill[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(cardStartX, cardStartY, contentWidth, calculatedHeight, 3, 3, 'FD');

    drawContent();

    // --- SECCIÓN DE FACTURAS ---
    let currentY = startY + calculatedHeight + 10;
    doc.setTextColor(0, 0, 0);

    if (invoices.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Historial de Facturas (${invoices.length})`, margin, currentY);
        currentY += 5;

        invoices.forEach((factura, index) => {
            if (currentY + 30 > doc.internal.pageSize.height - 20) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFillColor(52, 58, 64);
            doc.rect(margin, currentY, contentWidth, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");

            const fechaFac = factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A";
            const estadoFac = factura.facEstadoFactura ? "ACTIVA" : "ANULADA";
            // Removed Estado from text as requested
            doc.text(`FACTURA #${factura.facNumeroFactura}  |  Fecha: ${fechaFac}`, margin + 3, currentY + 5.5);
            doc.text(`Total: $${(factura.facTotal || 0).toFixed(2)}`, pageWidth - margin - 3, currentY + 5.5, { align: 'right' });

            currentY += 8;

            const detalles = factura.detallesFactura || [];
            if (detalles.length > 0) {
                const bodyData = detalles.map((d: any) => [
                    d.detCodigoProducto || String(d.detIdProductoExterno),
                    d.detNombreProducto,
                    d.detCantidad,
                    `$${(d.detPrecioUnitario || 0).toFixed(2)}`,
                    `$${(d.detTotal || 0).toFixed(2)}`
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Cód.', 'Producto', 'Cant.', 'P. Unit', 'Total']],
                    body: bodyData,
                    theme: 'plain',
                    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                    headStyles: { fillColor: [233, 236, 239], textColor: [73, 80, 87], fontStyle: 'bold', lineWidth: 0 },
                    columnStyles: {
                        0: { cellWidth: 25 },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 20, halign: 'right' }
                    },
                    margin: { left: margin, right: margin },
                    pageBreak: 'auto',
                });

                currentY = (doc as any).lastAutoTable.finalY + 5;
            } else {
                doc.setTextColor(150, 150, 150);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.text("(Sin detalles de productos disponibles)", margin + 3, currentY + 5);
                currentY += 10;
            }
            currentY += 2;
        });
    } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(108, 117, 125);
        doc.text("(Este cliente no tiene facturas registradas)", margin, currentY + 5);
        currentY += 10;
    }
    (doc as any).customLastY = currentY;
}

// =================================== 
// HELPERS FACTURAS
// ==================================

function drawTextBlock(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + doc.getTextDimensions(lines).h + 3;
}

function generateFacturaSection(doc: jsPDF, factura: any, startY: number) {
    const margin = 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Factura: ${factura.facNumeroFactura}`, margin, startY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    const clienteCedula = factura.cliente?.cliCedula || factura.cliCedula || "";
    // Note: In reportes.ts we have 'clientesData' globally
    const clienteNombre = clientesData?.find(c => c.cliCedula === clienteCedula)?.cliNombre || factura.cliente?.cliNombre || "N/A";

    // Fix TipoPago: check nested object first, then fallback to lookup using tipIdTipop (common FK)
    const tipoObj = factura.tipoPago || tiposPagoData.find(t => t.tipIdTipop === factura.tipIdTipop) || {};
    const tipoPago = tipoObj.tipDescripcion || "N/A";

    let currentY = startY + 6;
    const maxWidth = doc.internal.pageSize.width - margin * 2;

    currentY = drawTextBlock(doc, `Cliente: ${clienteNombre}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Tipo de Pago: ${tipoPago}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Fecha: ${factura.facFechaEmision ? String(factura.facFechaEmision).split("T")[0] : "N/A"}`, margin, currentY, maxWidth);
    currentY = drawTextBlock(doc, `Total: $${(factura.facTotal || 0).toFixed(2)}`, margin, currentY, maxWidth);

    const tableStartY = currentY + 4;
    const detalles = factura.detallesFactura || [];
    if (detalles.length > 0) {
        const tableData = detalles.map((d: any) => [
            d.detCodigoProducto || "S/C",
            d.detNombreProducto,
            d.detCantidad.toString(),
            `$${(d.detPrecioUnitario || 0).toFixed(2)}`,
            d.detGrabaIva ? "Sí" : "No",
            `$${(d.detTotal || 0).toFixed(2)}`
        ]);
        autoTable(doc, {
            startY: tableStartY,
            head: [['Código', 'Descripción', 'Cant.', 'P. Unit.', 'IVA', 'Total']],
            body: tableData,
            theme: 'plain',
            margin: { left: margin + 5 },
            tableWidth: doc.internal.pageSize.width - (margin * 2) - 10,
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
    doc.text(`Total a Pagar: $${(factura.facTotal || 0).toFixed(2)}`, doc.internal.pageSize.width - margin, finalY + 5, { align: 'right' });
    (doc as any).lastAutoTable = { finalY: finalY + 10 };
}

function agregarEncabezado(doc: jsPDF, titulo: string) {
    // Modificar Header para usar estilos estándar (similar a clientes.ts)
    doc.setFillColor(41, 128, 185); // Azúl corporativo
    doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, doc.internal.pageSize.width / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`, doc.internal.pageSize.width / 2, 30, { align: 'center' });

    // Reset colors
    doc.setTextColor(0, 0, 0);
}

function agregarPiePagina(doc: jsPDF) {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);

        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(15, doc.internal.pageSize.height - 15, doc.internal.pageSize.width - 15, doc.internal.pageSize.height - 15);

        doc.text(
            `Sistema de Facturación UTN - Página ${i} de ${totalPages}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }
}

function formatearFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return isNaN(date.getTime()) ? 'Fecha Inválida' : date.toLocaleDateString('es-EC');
}

function getFechaActual(): string {
    return new Date().toISOString().split('T')[0];
}

function limpiarFechas() {
    (document.getElementById('facturaFechaInicio') as HTMLInputElement).value = '';
    (document.getElementById('facturaFechaFin') as HTMLInputElement).value = '';
}

function mostrarToast(mensaje: string, tipo: 'success' | 'error' | 'info' = 'success') {
    const colores = {
        success: { bg: 'bg-success', icon: 'check-circle-fill' },
        error: { bg: 'bg-danger', icon: 'exclamation-triangle-fill' },
        info: { bg: 'bg-info', icon: 'info-circle-fill' }
    };

    const { bg, icon } = colores[tipo];

    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    toast.style.zIndex = '9999';
    toast.style.marginTop = '20px';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header ${bg} text-white">
                <i class="bi bi-${icon} me-2"></i>
                <strong class="me-auto">${tipo === 'success' ? 'Éxito' : tipo === 'error' ? 'Error' : 'Información'}</strong>
                <button type="button" class="btn-close btn-close-white" onclick="this.closest('.position-fixed').remove()"></button>
            </div>
            <div class="toast-body">${mensaje}</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), tipo === 'info' ? 2000 : 4000);
}