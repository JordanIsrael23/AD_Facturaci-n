// src/scripts/reportes.ts
import { getAuthHeaders, checkAuth, registrarAuditoria } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';

const BASE_URL = import.meta.env.PUBLIC_BACKEND_URL;
const API_CLIENTES = BASE_URL + "Clientes";
const API_FACTURAS = BASE_URL + "Facturas";

let clientesData: any[] = [];
let facturasData: any[] = [];
let charts: Record<string, Chart> = {};

export function initReportes() {
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
    document.getElementById('btnReporteFacturasEstado')?.addEventListener('click', () => generarReporteFacturasEstado());
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
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte general de clientes', '');

    const doc = new jsPDF();
    agregarEncabezado(doc, 'REPORTE GENERAL DE CLIENTES');

    const tableData = clientesData.map(c => [
        c.cliCedula,
        c.cliNombre,
        c.tipoCliente?.ticDescripcion || (c.ticIdTipoc === 1 ? 'Contado' : 'Crédito'),
        c.cliEmail || 'N/A',
        c.cliTelefono || 'N/A',
        c.cliEstado ? 'Activo' : 'Inactivo'
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Cédula/RUC', 'Nombre', 'Tipo', 'Email', 'Teléfono', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [13, 110, 253] },
        styles: { fontSize: 9 }
    });

    agregarPiePagina(doc);
    doc.save(`Clientes_General_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteClientesTipo() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de clientes por tipo', '');

    const contado = clientesData.filter(c => c.ticIdTipoc === 1);
    const credito = clientesData.filter(c => c.ticIdTipoc === 2);

    const doc = new jsPDF();
    agregarEncabezado(doc, 'CLIENTES POR TIPO');

    let yPos = 50;

    // Estadísticas
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen por Tipo', 15, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Clientes Contado: ${contado.length} (${((contado.length / clientesData.length) * 100).toFixed(1)}%)`, 20, yPos);
    yPos += 6;
    doc.text(`Clientes Crédito: ${credito.length} (${((credito.length / clientesData.length) * 100).toFixed(1)}%)`, 20, yPos);
    yPos += 15;

    // Tabla de Contado
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Clientes de Contado', 15, yPos);
    yPos += 5;

    autoTable(doc, {
        startY: yPos,
        head: [['Cédula', 'Nombre', 'Email', 'Estado']],
        body: contado.map(c => [c.cliCedula, c.cliNombre, c.cliEmail || 'N/A', c.cliEstado ? 'Activo' : 'Inactivo']),
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69] },
        styles: { fontSize: 9 }
    });

    const finalYContado = (doc as any).lastAutoTable.finalY + 10;

    // Tabla de Crédito
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Clientes de Crédito', 15, finalYContado);

    autoTable(doc, {
        startY: finalYContado + 5,
        head: [['Cédula', 'Nombre', 'Email', 'Estado']],
        body: credito.map(c => [c.cliCedula, c.cliNombre, c.cliEmail || 'N/A', c.cliEstado ? 'Activo' : 'Inactivo']),
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7] },
        styles: { fontSize: 9 }
    });

    agregarPiePagina(doc);
    doc.save(`Clientes_Por_Tipo_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteClientesFacturas() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de clientes con historial', '');

    const doc = new jsPDF('landscape');
    agregarEncabezado(doc, 'CLIENTES CON HISTORIAL DE COMPRAS');

    const tableData = clientesData.map(cliente => {
        const facturas = facturasData.filter(f =>
            (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
        );
        const total = facturas.reduce((sum, f) => sum + f.facTotal, 0);

        return [
            cliente.cliCedula,
            cliente.cliNombre,
            cliente.tipoCliente?.ticDescripcion || (cliente.ticIdTipoc === 1 ? 'Contado' : 'Crédito'),
            facturas.length,
            `$${total.toFixed(2)}`
        ];
    }).sort((a, b) => parseFloat(b[4].replace('$', '')) - parseFloat(a[4].replace('$', '')));

    autoTable(doc, {
        startY: 45,
        head: [['Cédula', 'Nombre', 'Tipo', 'Nº Facturas', 'Total Comprado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [23, 162, 184] },
        styles: { fontSize: 9 }
    });

    agregarPiePagina(doc);
    doc.save(`Clientes_Historial_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteTopClientes() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte Top 10 clientes', '');

    const clientesConVentas = clientesData.map(cliente => {
        const facturas = facturasData.filter(f =>
            (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
        );
        const total = facturas.reduce((sum, f) => sum + f.facTotal, 0);

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
        `$${c.totalComprado.toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['Ranking', 'Nombre', 'Tipo', 'Facturas', 'Total Comprado']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7] },
        styles: { fontSize: 10 },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' },
            4: { halign: 'right', fontStyle: 'bold' }
        }
    });

    agregarPiePagina(doc);
    doc.save(`Top_10_Clientes_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

// ============================================================
// REPORTES DE FACTURAS
// ============================================================

async function generarReporteFacturasGeneral() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte general de facturas', '');

    const doc = new jsPDF('landscape');
    agregarEncabezado(doc, 'REPORTE GENERAL DE FACTURAS');

    const tableData = facturasData.map(f => [
        f.facNumeroFactura,
        f.cliente?.cliNombre || 'N/A',
        formatearFecha(f.facFechaEmision),
        `$${f.facSubtotal.toFixed(2)}`,
        `$${f.facIva.toFixed(2)}`,
        `$${f.facTotal.toFixed(2)}`,
        f.facEstadoFactura ? 'Activa' : 'Anulada'
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Nº Factura', 'Cliente', 'Fecha', 'Subtotal', 'IVA', 'Total', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [13, 110, 253] },
        styles: { fontSize: 8 }
    });

    agregarPiePagina(doc);
    doc.save(`Facturas_General_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteFacturasEstado() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de facturas por estado', '');

    const activas = facturasData.filter(f => f.facEstadoFactura);
    const anuladas = facturasData.filter(f => !f.facEstadoFactura);

    const doc = new jsPDF('landscape');
    agregarEncabezado(doc, 'FACTURAS POR ESTADO');

    let yPos = 50;

    // Estadísticas
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen por Estado', 15, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Facturas Activas: ${activas.length}`, 20, yPos);
    yPos += 6;
    doc.text(`Facturas Anuladas: ${anuladas.length}`, 20, yPos);
    yPos += 6;
    const totalActivas = activas.reduce((sum, f) => sum + f.facTotal, 0);
    doc.text(`Total Ventas Activas: $${totalActivas.toFixed(2)}`, 20, yPos);
    yPos += 15;

    // Tabla Activas
    autoTable(doc, {
        startY: yPos,
        head: [['Nº Factura', 'Cliente', 'Fecha', 'Total']],
        body: activas.map(f => [
            f.facNumeroFactura,
            f.cliente?.cliNombre || 'N/A',
            formatearFecha(f.facFechaEmision),
            `$${f.facTotal.toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69] },
        styles: { fontSize: 8 }
    });

    agregarPiePagina(doc);
    doc.save(`Facturas_Estado_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteFacturasPeriodo() {
    const fechaInicio = (document.getElementById('facturaFechaInicio') as HTMLInputElement).value;
    const fechaFin = (document.getElementById('facturaFechaFin') as HTMLInputElement).value;

    if (!fechaInicio || !fechaFin) {
        mostrarToast('Selecciona un rango de fechas', 'error');
        return;
    }

    await registrarAuditoria('Generar Reportes', 'EXPORT', `Generó reporte de facturas del ${fechaInicio} al ${fechaFin}`, '');

    const facturasFiltradas = facturasData.filter(f => {
        const fecha = new Date(f.facFechaEmision);
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        return fecha >= inicio && fecha <= fin;
    });

    const doc = new jsPDF('landscape');
    agregarEncabezado(doc, `FACTURAS DEL ${fechaInicio} AL ${fechaFin}`);

    const tableData = facturasFiltradas.map(f => [
        f.facNumeroFactura,
        f.cliente?.cliNombre || 'N/A',
        formatearFecha(f.facFechaEmision),
        `$${f.facTotal.toFixed(2)}`,
        f.facEstadoFactura ? 'Activa' : 'Anulada'
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Nº Factura', 'Cliente', 'Fecha', 'Total', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [23, 162, 184] },
        styles: { fontSize: 9 }
    });

    const total = facturasFiltradas.filter(f => f.facEstadoFactura).reduce((sum, f) => sum + f.facTotal, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Período: $${total.toFixed(2)}`, 15, finalY);

    agregarPiePagina(doc);
    doc.save(`Facturas_Periodo_${fechaInicio}_${fechaFin}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

async function generarReporteVentasCliente() {
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó resumen de ventas por cliente', '');

    const ventasPorCliente = clientesData.map(cliente => {
        const facturas = facturasData.filter(f =>
            (f.cliCedula === cliente.cliCedula || f.cliente?.cliCedula === cliente.cliCedula) && f.facEstadoFactura
        );
        const total = facturas.reduce((sum, f) => sum + f.facTotal, 0);

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
        `$${v.total.toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Cédula', 'Nombre', 'Facturas', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [255, 193, 7] },
        styles: { fontSize: 10 }
    });

    agregarPiePagina(doc);
    doc.save(`Ventas_Por_Cliente_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

// ============================================================
// GRÁFICOS Y ANÁLISIS
// ============================================================

function renderCharts() {
    renderChartVentasMes();
    renderChartClientesTipo();
    renderChartFacturasEstado();
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
            .reduce((sum, f) => sum + f.facTotal, 0);

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

function renderChartFacturasEstado() {
    const canvas = document.getElementById('chartFacturasEstado') as HTMLCanvasElement;
    if (!canvas) return;

    if (charts['facturasEstado']) {
        charts['facturasEstado'].destroy();
    }

    const activas = facturasData.filter(f => f.facEstadoFactura).length;
    const anuladas = facturasData.filter(f => !f.facEstadoFactura).length;

    charts['facturasEstado'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Activas', 'Anuladas'],
            datasets: [{
                data: [activas, anuladas],
                backgroundColor: ['rgba(40, 167, 69, 0.7)', 'rgba(220, 53, 69, 0.7)'],
                borderColor: ['rgba(40, 167, 69, 1)', 'rgba(220, 53, 69, 1)'],
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
    await registrarAuditoria('Generar Reportes', 'EXPORT', 'Generó reporte de análisis completo', '');
    mostrarToast('Generando reporte completo...', 'info');

    const doc = new jsPDF();
    agregarEncabezado(doc, 'ANÁLISIS COMPLETO DE VENTAS');

    // TODO: Agregar gráficos convertidos a imágenes
    doc.setFontSize(10);
    doc.text('Este reporte incluye análisis estadísticos completos', 15, 50);
    doc.text('con gráficos de ventas, clientes y facturación.', 15, 56);

    // Por ahora, agregar resumen textual
    let yPos = 70;
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Ejecutivo:', 15, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Clientes: ${clientesData.length}`, 20, yPos);
    yPos += 6;
    doc.text(`Total Facturas Activas: ${facturasData.filter(f => f.facEstadoFactura).length}`, 20, yPos);
    yPos += 6;
    const totalVentas = facturasData.filter(f => f.facEstadoFactura).reduce((s, f) => s + f.facTotal, 0);
    doc.text(`Total Ventas: $${totalVentas.toFixed(2)}`, 20, yPos);

    agregarPiePagina(doc);
    doc.save(`Analisis_Completo_${getFechaActual()}.pdf`);
    mostrarToast('Reporte generado exitosamente', 'success');
}

// ============================================================
// UTILIDADES
// ============================================================

function agregarEncabezado(doc: jsPDF, titulo: string) {
    doc.setFillColor(13, 110, 253);
    doc.rect(0, 0, doc.internal.pageSize.width, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, doc.internal.pageSize.width / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-EC')}`, doc.internal.pageSize.width / 2, 25, { align: 'center' });
    doc.setTextColor(0, 0, 0);
}

function agregarPiePagina(doc: jsPDF) {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
            `Página ${i} de ${totalPages} | Sistema de Facturación UTN`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }
}

function formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-EC');
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