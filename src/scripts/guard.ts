// src/scripts/guard.ts
// Este script protege las rutas verificando permisos al cargar la página

import { checkAuth, redirectIfNoPermission, registrarAuditoria, getUserFunciones } from './auth';

// Ejecutar INMEDIATAMENTE (antes de que se renderice la página)
if (typeof window !== 'undefined') {
    // Verificar autenticación primero
    checkAuth();
    
    // Verificar permisos para la ruta actual
    redirectIfNoPermission();
    
    // Registrar auditoría cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        const funciones = getUserFunciones();
        if (funciones.length > 0) {
            const pathname = window.location.pathname;
            
            // Registrar acceso a la página (si no es login o home)
            if (pathname !== '/login' && pathname !== '/' && pathname !== '/sin-acceso') {
                const funcionNombre = funciones[0].nombre;
                registrarAuditoria(
                    funcionNombre,
                    'VIEW',
                    `Usuario accedió a ${pathname}`,
                    `Navegador: ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Otro'}`
                ).catch(err => console.warn('Error registrando auditoría:', err));
            }
        }
        
        console.log('✅ Guard inicializado y ruta protegida');
    });
}

// Exportar función para llamarla manualmente si es necesario
export function initGuard() {
    checkAuth();
    redirectIfNoPermission();
}

// Re-exportar funciones útiles para usar en las páginas
export { 
    checkAuth, 
    redirectIfNoPermission, 
    hasFunction, 
    hasAnyFunction,
    getUserData,
    getUserFunciones,
    registrarAuditoria,
    logout
} from './auth';