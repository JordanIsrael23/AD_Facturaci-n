
/*
// src/scripts/auditoria.ts
import { getAuthHeaders, checkAuth, registrarAuditoria, obtenerAuditorias } from "./auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Declarar bootstrap
declare const bootstrap: any;

let auditoriaData: any[] = [];
let auditoriaFiltrada: any[] = [];
let paginaActual = 1;
const registrosPorPagina = 15;

// Filtros actuales
let filtros = {
    usuario: '',
    accion: '',
    fechaInicio: '',
    fechaFin: ''
};

export function initAuditoria() {
    checkAuth();
    setupEventListeners();
    cargarAuditorias();
    
    // Registrar acceso al módulo
    registrarAuditoria(
        'Ver Pistas de Auditoria',
        'VIEW',
        'Usuario accedió al módulo de auditoría',
        'Visualización de pistas de auditoría'
    ).catch(err => console.warn('Error en auditoría:', err));
}

function setupEventListeners() {
    // Botones principales
    document.getElementById('btnActualizar')?.addEventListener('click', () => {
        cargarAuditorias();
    });

    document.getElementById('btnExportarPDF')?.addEventListener('click', () => {
        generarPDF();
    });

    // Filtros
    document.getElementById('btnAplicarFiltros')?.addEventListener('click', () => {
        aplicarFiltros();
    });

    document.getElementById('btnLimpiarFiltros')?.addEventListener('click', () => {
        limpiarFiltros();
    });

    // Enter en inputs
    ['filtroUsuario', 'filtroFechaInicio', 'filtroFechaFin'].forEach(id => {
        document.getElementById(id)?.addEventListener('keypress', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') {
                aplicarFiltros();
            }
        });
    });
}

async function cargarAuditorias() {
    const tbody = document.getElementById('auditoriaTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const resultado = await obtenerAuditorias(
            1,
            1000, // Cargar muchos registros para filtrar localmente
            filtros.fechaInicio || undefined,
            filtros.fechaFin || undefined
        );

        if (resultado && resultado.success) {
            auditoriaData = resultado.data;
            auditoriaFiltrada = [...auditoriaData];
            
            // Aplicar filtros locales
            aplicarFiltrosLocales();
            
            // Actualizar estadísticas
            actualizarEstadisticas();
            
            // Mostrar primera página
            paginaActual = 1;
            renderPagina();
        } else {
            throw new Error('No se pudieron cargar las auditorías');
        }
    } catch (error) {
        console.error('Error cargando auditorías:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error al cargar las auditorías. Por favor, intenta de nuevo.
                </td>
            </tr>
        `;
    }
}

function aplicarFiltros() {
    // Obtener valores de filtros
    filtros.usuario = (document.getElementById('filtroUsuario') as HTMLInputElement)?.value.toLowerCase() || '';
    filtros.accion = (document.getElementById('filtroAccion') as HTMLSelectElement)?.value || '';
    filtros.fechaInicio = (document.getElementById('filtroFechaInicio') as HTMLInputElement)?.value || '';
    filtros.fechaFin = (document.getElementById('filtroFechaFin') as HTMLInputElement)?.value || '';

    // Si cambiaron fechas, recargar desde API
    if (filtros.fechaInicio || filtros.fechaFin) {
        cargarAuditorias();
    } else {
        aplicarFiltrosLocales();
        paginaActual = 1;
        renderPagina();
    }
}

function aplicarFiltrosLocales() {
    auditoriaFiltrada = auditoriaData.filter(item => {
        // Filtro por usuario
        if (filtros.usuario && !item.usuario?.username.toLowerCase().includes(filtros.usuario)) {
            return false;
        }

        // Filtro por acción
        if (filtros.accion && item.accion !== filtros.accion) {
            return false;
        }

        return true;
    });
}

function limpiarFiltros() {
    // Limpiar inputs
    (document.getElementById('filtroUsuario') as HTMLInputElement).value = '';
    (document.getElementById('filtroAccion') as HTMLSelectElement).value = '';
    (document.getElementById('filtroFechaInicio') as HTMLInputElement).value = '';
    (document.getElementById('filtroFechaFin') as HTMLInputElement).value = '';

    // Reset filtros
    filtros = {
        usuario: '',
        accion: '',
        fechaInicio: '',
        fechaFin: ''
    };

    // Recargar sin filtros
    cargarAuditorias();
}

function renderPagina() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = auditoriaFiltrada.slice(inicio, fin);

    renderTabla(registrosPagina);
    renderPaginacion();
}

function renderTabla(registros: any[]) {
    const tbody = document.getElementById('auditoriaTableBody');
    if (!tbody) return;

    if (registros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="bi bi-inbox me-2"></i>
                    No se encontraron registros de auditoría.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = registros.map((item, index) => {
        const numero = (paginaActual - 1) * registrosPorPagina + index + 1;
        const fecha = new Date(item.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Color según acción
        const colorAccion = getColorAccion(item.accion);

        return `
            <tr data-id="${item.id}" class="auditoria-row">
                <td class="text-center">${numero}</td>
                <td>
                    <i class="bi bi-person-circle me-1 text-primary"></i>
                    <strong>${item.usuario?.username || 'N/A'}</strong>
                </td>
                <td>
                    <span class="badge ${colorAccion} badge-action">
                        ${item.accion}
                    </span>
                </td>
                <td>
                    <small class="text-muted">${item.funcion?.nombre || 'N/A'}</small>
                </td>
                <td>
                    <small>${truncarTexto(item.descripcion, 60)}</small>
                </td>
                <td>
                    <code class="small">${item.ipUsuario}</code>
                </td>
                <td class="text-nowrap">
                    <small>${fechaFormateada}</small>
                </td>
            </tr>
        `;
    }).join('');

    // Agregar event listeners para ver detalles
    document.querySelectorAll('.auditoria-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) mostrarDetalles(parseInt(id));
        });
    });
}

function getColorAccion(accion: string): string {
    const colores: Record<string, string> = {
        'LOGIN': 'bg-success',
        'LOGOUT': 'bg-secondary',
        'VIEW': 'bg-info',
        'CREATE': 'bg-primary',
        'UPDATE': 'bg-warning text-dark',
        'DELETE': 'bg-danger',
        'EXPORT': 'bg-dark',
        'ACTIVATE': 'bg-success'
    };
    return colores[accion] || 'bg-secondary';
}

function truncarTexto(texto: string, maxLength: number): string {
    if (!texto) return 'N/A';
    return texto.length > maxLength ? texto.substring(0, maxLength) + '...' : texto;
}

function mostrarDetalles(id: number) {
    const registro = auditoriaData.find(item => item.id === id);
    if (!registro) return;

    const fecha = new Date(registro.fecha);
    const fechaFormateada = fecha.toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Llenar modal
    (document.getElementById('detalle-id') as HTMLElement).textContent = registro.id;
    (document.getElementById('detalle-usuario') as HTMLElement).textContent = registro.usuario?.username || 'N/A';
    (document.getElementById('detalle-accion') as HTMLElement).innerHTML = `<span class="badge ${getColorAccion(registro.accion)}">${registro.accion}</span>`;
    (document.getElementById('detalle-funcion') as HTMLElement).textContent = registro.funcion?.nombre || 'N/A';
    (document.getElementById('detalle-descripcion') as HTMLElement).textContent = registro.descripcion || 'N/A';
    (document.getElementById('detalle-observacion') as HTMLElement).textContent = registro.observacion || 'N/A';
    (document.getElementById('detalle-ip') as HTMLElement).textContent = registro.ipUsuario;
    (document.getElementById('detalle-fecha') as HTMLElement).textContent = fechaFormateada;

    // Mostrar modal
    const modalEl = document.getElementById('detallesModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function renderPaginacion() {
    const totalPaginas = Math.ceil(auditoriaFiltrada.length / registrosPorPagina);
    const contenedor = document.getElementById('paginacion');
    if (!contenedor) return;

    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    let paginasHTML = '';

    // Botón anterior
    paginasHTML += `
        <button class="btn btn-sm btn-outline-secondary me-2"
            ${paginaActual === 1 ? 'disabled' : ''} 
            onclick="cambiarPagina(${paginaActual - 1})">
            <i class="bi bi-chevron-left"></i> Anterior
        </button>
    `;

    // Números de página
    const rango = 2;
    let inicio = Math.max(1, paginaActual - rango);
    let fin = Math.min(totalPaginas, paginaActual + rango);

    if (inicio > 1) {
        paginasHTML += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="cambiarPagina(1)">1</button>`;
        if (inicio > 2) paginasHTML += `<span class="mx-2">...</span>`;
    }

    for (let i = inicio; i <= fin; i++) {
        paginasHTML += `
            <button class="btn btn-sm ${i === paginaActual ? 'btn-primary' : 'btn-outline-secondary'} me-1"
                onclick="cambiarPagina(${i})">
                ${i}
            </button>
        `;
    }

    if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) paginasHTML += `<span class="mx-2">...</span>`;
        paginasHTML += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="cambiarPagina(${totalPaginas})">${totalPaginas}</button>`;
    }

    // Botón siguiente
    paginasHTML += `
        <button class="btn btn-sm btn-outline-secondary ms-2"
            ${paginaActual === totalPaginas ? 'disabled' : ''} 
            onclick="cambiarPagina(${paginaActual + 1})">
            Siguiente <i class="bi bi-chevron-right"></i>
        </button>
    `;

    contenedor.innerHTML = paginasHTML;
}

// Función global para cambiar página
(window as any).cambiarPagina = (pagina: number) => {
    paginaActual = pagina;
    renderPagina();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function actualizarEstadisticas() {
    // Total registros
    (document.getElementById('totalRegistros') as HTMLElement).textContent = auditoriaFiltrada.length.toString();

    // Total vistas (VIEW)
    const totalVistas = auditoriaFiltrada.filter(item => item.accion === 'VIEW').length;
    (document.getElementById('totalVistas') as HTMLElement).textContent = totalVistas.toString();

    // Total modificaciones (CREATE, UPDATE, DELETE)
    const totalMods = auditoriaFiltrada.filter(item => 
        ['CREATE', 'UPDATE', 'DELETE'].includes(item.accion)
    ).length;
    (document.getElementById('totalModificaciones') as HTMLElement).textContent = totalMods.toString();

    // Usuarios únicos
    const usuariosUnicos = new Set(auditoriaFiltrada.map(item => item.usuario?.username)).size;
    (document.getElementById('totalUsuarios') as HTMLElement).textContent = usuariosUnicos.toString();
}

async function generarPDF() {
    if (auditoriaFiltrada.length === 0) {
        alert('No hay registros para exportar');
        return;
    }

    // Registrar auditoría de exportación
    await registrarAuditoria(
        'Ver Pistas de Auditoria',
        'EXPORT',
        'Usuario exportó reporte de auditoría a PDF',
        `Total de registros: ${auditoriaFiltrada.length}`
    ).catch(err => console.warn('Error en auditoría:', err));

    const doc = new jsPDF('landscape'); // Modo horizontal para más columnas
    
    // Título
    doc.setFillColor(13, 110, 253);
    doc.rect(0, 0, doc.internal.pageSize.width, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE AUDITORÍA', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-EC')}`, doc.internal.pageSize.width / 2, 25, { align: 'center' });

    // Datos de la tabla
    const tableData = auditoriaFiltrada.map(item => {
        const fecha = new Date(item.fecha);
        return [
            item.usuario?.username || 'N/A',
            item.accion,
            item.funcion?.nombre || 'N/A',
            truncarTexto(item.descripcion, 40),
            item.ipUsuario,
            fecha.toLocaleDateString('es-EC') + ' ' + fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
        ];
    });

    autoTable(doc, {
        startY: 40,
        head: [['Usuario', 'Acción', 'Función', 'Descripción', 'IP', 'Fecha/Hora']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
            fillColor: [13, 110, 253],
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: { 
            fontSize: 8,
            cellPadding: 2
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 25 },
            2: { cellWidth: 40 },
            3: { cellWidth: 70 },
            4: { cellWidth: 30 },
            5: { cellWidth: 35 }
        }
    });

    // Pie de página
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
            `Página ${i} de ${totalPages}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Descargar
    doc.save(`Auditoria_${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Toast de éxito
    mostrarToast('PDF generado exitosamente', 'success');
}

function mostrarToast(mensaje: string, tipo: 'success' | 'error' = 'success') {
    const bgColor = tipo === 'success' ? 'bg-success' : 'bg-danger';
    const icon = tipo === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
    
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    toast.style.zIndex = '9999';
    toast.style.marginTop = '20px';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header ${bgColor} text-white">
                <i class="bi bi-${icon} me-2"></i>
                <strong class="me-auto">${tipo === 'success' ? 'Éxito' : 'Error'}</strong>
                <button type="button" class="btn-close btn-close-white" onclick="this.closest('.position-fixed').remove()"></button>
            </div>
            <div class="toast-body">${mensaje}</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
*/