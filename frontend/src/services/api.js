import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxy configurado no vite.config.js
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sima_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor para lidar com erros de resposta (ex: 401 - Token expirado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Não redirecionar se o 401 veio do login/register ou endpoints públicos
            const url = error.config?.url || '';
            const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
            const isPublicEndpoint = url.includes('/courses/available');
            const isRegisterPage = window.location.pathname.startsWith('/register');

            if (!isAuthEndpoint && !isPublicEndpoint && !isRegisterPage) {
                localStorage.removeItem('sima_token');
                localStorage.removeItem('sima_user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
