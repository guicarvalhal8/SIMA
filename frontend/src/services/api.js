import axios from 'axios';

const DEVICE_ID_KEY = 'nexora_device_id';

function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

function getDeviceLabel() {
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo';
    const brand = navigator.userAgentData?.brands?.[0]?.brand || 'Navegador';
    return `${platform} - ${brand}`;
}

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshPromise = null;

async function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = api.post(
            '/auth/refresh',
            {},
            {
                skipAuthRefresh: true,
            }
        ).finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

api.interceptors.request.use((config) => {
    config.headers['X-Device-Id'] = getDeviceId();
    config.headers['X-Device-Label'] = getDeviceLabel();
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};
        const url = originalRequest.url || '';
        const isPublicEndpoint = url.includes('/courses/available');
        const isAuthFlowEndpoint = [
            '/auth/login',
            '/auth/logout',
            '/auth/register',
            '/auth/refresh',
        ].some((path) => url.includes(path));
        const isAuthPage = window.location.pathname.startsWith('/login')
            || window.location.pathname.startsWith('/register');

        if (
            error.response?.status === 401
            && !originalRequest._retry
            && !originalRequest.skipAuthRefresh
            && !isPublicEndpoint
            && !isAuthFlowEndpoint
        ) {
            originalRequest._retry = true;
            try {
                await refreshSession();
                return api(originalRequest);
            } catch (refreshError) {
                if (!isAuthPage) {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        if (error.response?.status === 401 && !isAuthPage && !isPublicEndpoint && isAuthFlowEndpoint) {
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default api;
