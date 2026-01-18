// src/scripts/protectedElement.ts
// Helper para mostrar/ocultar elementos según permisos

import { hasFunction, hasAnyFunction, hasAllFunctions } from './auth';

/**
 * Muestra u oculta un elemento basado en una función requerida
 */
export function showIfHasFunction(elementId: string, funcionNombre: string): boolean {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento con id "${elementId}" no encontrado`);
        return false;
    }

    const hasPermission = hasFunction(funcionNombre);
    
    if (hasPermission) {
        element.style.display = '';
        element.classList.remove('d-none');
    } else {
        element.style.display = 'none';
        element.classList.add('d-none');
    }

    return hasPermission;
}

/**
 * Muestra u oculta un elemento si tiene ALGUNA de las funciones
 */
export function showIfHasAnyFunction(elementId: string, funcionesNombres: string[]): boolean {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento con id "${elementId}" no encontrado`);
        return false;
    }

    const hasPermission = hasAnyFunction(funcionesNombres);
    
    if (hasPermission) {
        element.style.display = '';
        element.classList.remove('d-none');
    } else {
        element.style.display = 'none';
        element.classList.add('d-none');
    }

    return hasPermission;
}

/**
 * Muestra u oculta un elemento si tiene TODAS las funciones
 */
export function showIfHasAllFunctions(elementId: string, funcionesNombres: string[]): boolean {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento con id "${elementId}" no encontrado`);
        return false;
    }

    const hasPermission = hasAllFunctions(funcionesNombres);
    
    if (hasPermission) {
        element.style.display = '';
        element.classList.remove('d-none');
    } else {
        element.style.display = 'none';
        element.classList.add('d-none');
    }

    return hasPermission;
}

/**
 * Inicializa múltiples elementos protegidos usando data attributes
 * 
 * Uso en HTML:
 * <button data-require-function="Crear Clientes">Crear</button>
 * <div data-require-any="Crear Clientes,Editar Clientes">...</div>
 * <div data-require-all="Generar Reportes,Ver Pistas de Auditoria">...</div>
 */
export function initProtectedElements() {
    // Elementos que requieren una función específica
    const singleFunctionElements = document.querySelectorAll('[data-require-function]');
    singleFunctionElements.forEach(element => {
        const funcionNombre = (element as HTMLElement).dataset.requireFunction;
        if (funcionNombre) {
            const hasPermission = hasFunction(funcionNombre);
            if (!hasPermission) {
                (element as HTMLElement).style.display = 'none';
                element.classList.add('d-none');
            }
        }
    });

    // Elementos que requieren ALGUNA de las funciones
    const anyFunctionElements = document.querySelectorAll('[data-require-any]');
    anyFunctionElements.forEach(element => {
        const funcionesStr = (element as HTMLElement).dataset.requireAny;
        if (funcionesStr) {
            const funciones = funcionesStr.split(',').map(f => f.trim());
            const hasPermission = hasAnyFunction(funciones);
            if (!hasPermission) {
                (element as HTMLElement).style.display = 'none';
                element.classList.add('d-none');
            }
        }
    });

    // Elementos que requieren TODAS las funciones
    const allFunctionElements = document.querySelectorAll('[data-require-all]');
    allFunctionElements.forEach(element => {
        const funcionesStr = (element as HTMLElement).dataset.requireAll;
        if (funcionesStr) {
            const funciones = funcionesStr.split(',').map(f => f.trim());
            const hasPermission = hasAllFunctions(funciones);
            if (!hasPermission) {
                (element as HTMLElement).style.display = 'none';
                element.classList.add('d-none');
            }
        }
    });

    console.log('✅ Elementos protegidos inicializados');
}

/**
 * Deshabilita un elemento si no tiene el permiso
 */
export function disableIfNoFunction(elementId: string, funcionNombre: string): boolean {
    const element = document.getElementById(elementId) as HTMLButtonElement | HTMLInputElement;
    if (!element) {
        console.warn(`Elemento con id "${elementId}" no encontrado`);
        return false;
    }

    const hasPermission = hasFunction(funcionNombre);
    
    if (!hasPermission) {
        element.disabled = true;
        element.title = 'No tienes permisos para esta acción';
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
    }

    return hasPermission;
}

// Auto-inicializar al cargar el DOM
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initProtectedElements();
    });
}