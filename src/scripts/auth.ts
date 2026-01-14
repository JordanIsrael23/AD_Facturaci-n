
export function getAuthToken(): string | null {
    return localStorage.getItem("access_token");
}

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

export function checkAuth() {
    // Evitar loop infinito si ya estamos en login
    if (window.location.pathname === "/login") return;

    const token = getAuthToken();
    if (!token) {
        window.location.href = "/login";
    }
}

export function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_data");
    localStorage.removeItem("modulo_data");
    window.location.href = "/login";
}
