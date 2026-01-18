// src/scripts/auth.ts

// Configuración dinámica de API_BASE_URL
let API_BASE_URL = import.meta.env.PUBLIC_LOGIN_URL;

if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    console.log("⚠️ Entorno Local: Usando Proxy /security-proxy");
    API_BASE_URL = "/security-proxy";
}

const MODULO_ID = 5; // 🔴 CAMBIA ESTE ID POR EL QUE TE ASIGNARON

// ==========================================
// INTERFACES
// ==========================================

export interface Usuario {
    username: string;
    email: string;
    dni: string;
}

export interface Funcion {
    funcion_id: number;
    nombre: string;
}

export interface ModuloData {
    modulo_id: number;
    nombre: string;
    funciones: Funcion[];
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data: {
        access_token: string;
        user: Usuario;
        modulo: ModuloData;
    };
}

// ==========================================
// FUNCIONES DE ALMACENAMIENTO
// ==========================================

export function getAuthToken(): string | null {
    return localStorage.getItem("access_token");
}

export function getUserData(): Usuario | null {
    const data = localStorage.getItem("user_data");
    return data ? JSON.parse(data) : null;
}

export function getModuloData(): ModuloData | null {
    const data = localStorage.getItem("modulo_data");
    return data ? JSON.parse(data) : null;
}

export function getUserFunciones(): Funcion[] {
    const moduloData = getModuloData();
    return moduloData?.funciones || [];
}

export function saveAuthData(authResponse: AuthResponse) {
    localStorage.setItem("access_token", authResponse.data.access_token);
    localStorage.setItem("user_data", JSON.stringify(authResponse.data.user));
    localStorage.setItem("modulo_data", JSON.stringify(authResponse.data.modulo));
}

export function clearAuthData() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_data");
    localStorage.removeItem("modulo_data");
}

// ==========================================
// HEADERS PARA API
// ==========================================

export function getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    const headers: HeadersInit = {
        "Content-Type": "application/json"
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

// ==========================================
// VERIFICACIÓN DE PERMISOS
// ==========================================

export function hasFunction(nombreFuncion: string): boolean {
    const funciones = getUserFunciones();
    return funciones.some(f => f.nombre === nombreFuncion);
}

export function hasAnyFunction(nombresFunciones: string[]): boolean {
    const funciones = getUserFunciones();
    return funciones.some(f => nombresFunciones.includes(f.nombre));
}

export function hasAllFunctions(nombresFunciones: string[]): boolean {
    const funciones = getUserFunciones();
    return nombresFunciones.every(nombre => 
        funciones.some(f => f.nombre === nombre)
    );
}

export function hasFunctionId(funcionId: number): boolean {
    const funciones = getUserFunciones();
    return funciones.some(f => f.funcion_id === funcionId);
}

export function getFunctionId(nombreFuncion: string): number | null {
    const funciones = getUserFunciones();
    const funcion = funciones.find(f => f.nombre === nombreFuncion);
    return funcion?.funcion_id || null;
}

// ==========================================
// AUTENTICACIÓN
// ==========================================

export async function login(email_username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email_username,
            password,
            modulo_id: MODULO_ID,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Error en el login');
    }

    // Guardar los datos automáticamente
    saveAuthData(data);

    return data;
}

export async function verifyToken(): Promise<boolean> {
    const token = getAuthToken();
    if (!token) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/api/mis-funciones`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                modulo_id: MODULO_ID,
            }),
        });

        return response.ok;
    } catch (error) {
        console.error('Error verificando token:', error);
        return false;
    }
}

export function checkAuth() {
    // Evitar loop infinito si ya estamos en login
    if (window.location.pathname === "/login") return;

    const token = getAuthToken();
    if (!token) {
        console.log("⚠️ No hay token, redirigiendo a login...");
        window.location.href = "/login";
        return;
    }
}

export function logout() {
    // Registrar auditoría de logout antes de limpiar
    const funciones = getUserFunciones();
    if (funciones.length > 0) {
        registrarAuditoria(
            funciones[0].nombre,
            'LOGOUT',
            'Usuario cerró sesión',
            'Sesión finalizada'
        ).catch(err => console.warn("Error registrando logout:", err));
    }

    clearAuthData();
    window.location.href = "/login";
}

// ==========================================
// VERIFICACIÓN DE PERMISOS POR RUTA
// ==========================================

export function checkRoutePermission(pathname: string): boolean {
    const routePermissions: Record<string, string[]> = {
        '/clientes': ['Crear Clientes', 'Editar Clientes', 'Desactivar Clientes'],
        '/crear-cliente': ['Crear Clientes'],
        '/editar-clientes': ['Editar Clientes'],
        '/facturas': ['Generar Facturas'],
        '/crear-factura': ['Generar Facturas'],
        '/reportes': ['Generar Reportes'],
        '/establecimientos': ['Crear Establecimientos', 'Editar Establecimientos', 'Desactivar Establecimientos'],
        '/crear-establecimiento': ['Crear Establecimientos'],
        '/editar-establecimientos': ['Editar Establecimientos'],
        '/puntos-emision': ['Crear Puntos de emisión', 'Editar Puntos de emisión', 'Desactivar Puntos de emisión'],
        '/crear-punto-emision': ['Crear Puntos de emisión'],
        '/editar-punto-emision': ['Editar Puntos de emisión'],
        '/auditoria': ['Ver Pistas de Auditoria'],
    };

    for (const [route, requiredFunctions] of Object.entries(routePermissions)) {
        if (pathname.startsWith(route)) {
            return hasAnyFunction(requiredFunctions);
        }
    }

    return true; // Si no está en la lista, permitir acceso
}

export function redirectIfNoPermission() {
    const pathname = window.location.pathname;
    
    // Rutas públicas
    const publicRoutes = ['/login', '/sin-acceso', '/'];
    if (publicRoutes.includes(pathname)) return;

    if (!checkRoutePermission(pathname)) {
        console.warn(`⛔ Sin permisos para acceder a: ${pathname}`);
        window.location.href = "/sin-acceso";
    }
}

// ==========================================
// AUDITORÍA
// ==========================================

export async function registrarAuditoria(
    nombreFuncion: string,
    accion: string,
    descripcion: string,
    observacion: string = ''
): Promise<boolean> {
    const token = getAuthToken();
    if (!token) {
        console.warn("No hay token para registrar auditoría");
        return false;
    }

    const funcionId = getFunctionId(nombreFuncion);
    if (!funcionId) {
        console.error(`Función "${nombreFuncion}" no encontrada en los permisos del usuario`);
        return false;
    }

    try {
        const ip = await getUserIP();
        const response = await fetch(`${API_BASE_URL}/api/auditoria`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                id_funcion: funcionId,
                accion,
                descripcion,
                observacion: observacion || `Acción realizada desde el módulo de Facturación`,
                ip_usuario: ip,
            }),
        });

        if (response.ok) {
            console.log(`✅ Auditoría registrada: ${accion} - ${nombreFuncion}`);
            return true;
        } else {
            const error = await response.json();
            console.error("Error en auditoría:", error);
            return false;
        }
    } catch (error) {
        console.error('Error registrando auditoría:', error);
        return false;
    }
}

// Obtener IP del usuario (aproximada)
async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '0.0.0.0';
    }
}

// ==========================================
// OBTENER PISTAS DE AUDITORÍA
// ==========================================

export interface PistaAuditoria {
    id: number;
    accion: string;
    descripcion: string;
    observacion: string;
    ipUsuario: string;
    fecha: string;
    usuarioId: number;
    funcionId: number;
    usuario: { username: string };
    funcion: { nombre: string };
}

export interface AuditoriaResponse {
    success: boolean;
    data: PistaAuditoria[];
    pagination: {
        total_records: number;
        current_page: number;
        total_pages: number;
        limit_applied: number;
    };
}

export async function obtenerAuditorias(
    page: number = 1,
    limit: number = 15,
    fechaInicio?: string,
    fechaFin?: string,
    idUsuario?: number
): Promise<AuditoriaResponse | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });

        if (fechaInicio) params.append('fecha_inicio', fechaInicio);
        if (fechaFin) params.append('fecha_fin', fechaFin);
        if (idUsuario) params.append('id_usuario', idUsuario.toString());

        const response = await fetch(`${API_BASE_URL}/api/auditoria?${params}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            console.error("Error obteniendo auditorías:", response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error obteniendo auditorías:', error);
        return null;
    }
}

// ==========================================
// UTILIDADES DE INFORMACIÓN
// ==========================================

export function getRoleName(): string {
    const funciones = getUserFunciones();
    
    // Determinar el rol basado en las funciones
    const funcionesNombres = funciones.map(f => f.nombre);
    
    if (funcionesNombres.includes('Ver Pistas de Auditoria') && 
        funcionesNombres.includes('Crear Establecimientos')) {
        return 'Administrador';
    }
    
    if (funcionesNombres.includes('Ver Pistas de Auditoria') && 
        funcionesNombres.includes('Generar Reportes') &&
        funcionesNombres.length === 2) {
        return 'Gerente';
    }
    
    if (funcionesNombres.includes('Generar Reportes') && 
        funcionesNombres.includes('Desactivar Clientes')) {
        return 'Cajero';
    }
    
    if (funcionesNombres.includes('Crear Clientes') && 
        funcionesNombres.length === 2) {
        return 'Operador';
    }
    
    return 'Usuario';
}

export function getUserDisplayName(): string {
    const user = getUserData();
    return user?.username || 'Usuario';
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Auto-verificar autenticación al cargar
if (typeof window !== 'undefined') {
    // No verificar en la página de login
    if (window.location.pathname !== '/login') {
        // Verificar que haya token
        const token = getAuthToken();
        if (!token) {
            console.log("⚠️ Sin autenticación, redirigiendo...");
            window.location.href = '/login';
        }
    }
}