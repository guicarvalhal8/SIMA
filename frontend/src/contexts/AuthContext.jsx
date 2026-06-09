import { createContext, useCallback, useEffect, useState, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

function normalizeUser(userData) {
    return {
        ...userData,
        role: userData?.role?.toLowerCase(),
    };
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const recoverUser = useCallback(async () => {
        try {
            const userResponse = await api.get('/auth/me');
            setUser(normalizeUser(userResponse.data));
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        localStorage.removeItem('sima_token');
        localStorage.removeItem('sima_user');
        recoverUser();
    }, [recoverUser]);

    const login = async (identifier, password) => {
        try {
            await api.post('/auth/login', { identifier, password });
            const userResponse = await api.get('/auth/me');
            setUser(normalizeUser(userResponse.data));
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            const detail = error.response?.data?.detail;
            return {
                success: false,
                message: detail || (error.request
                    ? 'Não foi possível conectar ao backend. Verifique se a API está rodando em http://127.0.0.1:8000.'
                    : 'Erro ao realizar login'),
            };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.warn('Logout warning:', error);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ authenticated: !!user, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
