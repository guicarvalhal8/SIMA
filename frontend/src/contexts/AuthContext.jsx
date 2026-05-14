import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const recoverUser = () => {
            const storedUser = localStorage.getItem('sima_user');
            const token = localStorage.getItem('sima_token');

            if (storedUser && token) {
                const user = JSON.parse(storedUser);
                setUser({
                    ...user,
                    role: user.role?.toLowerCase()
                });
            }
            setLoading(false);
        };

        recoverUser();
    }, []);

    const login = async (identifier, password) => {
        try {
            const response = await api.post('/auth/login', { identifier, password });

            const { access_token, user: userData } = response.data; // Ajuste conforme resposta real da API
            // Nota: A API atual retorna token e detalhes do usuário? Vamos assumir que sim ou ajustar.
            // Se a API retornar apenas token, precisamos decodificar ou fazer fetch do /me

            // Ajuste baseado no conhecimento prévio da API:
            // A API retorna { access_token, token_type, ... }
            // Precisamos decodificar ou salvar o user info se vier junto.
            // Vou assumir que precisamos fazer um 'fetch user' ou salvar o básico.

            // Armazenando Token
            localStorage.setItem('sima_token', access_token);

            // Mockando dados do user por enquanto se a API de login não retornar dados do user além do token
            // O endpoint /auth/login retorna access_token.
            // O endpoint /auth/me retorna os dados do usuário.

            // Vamos buscar os dados do usuário logo após o login
            api.defaults.headers.Authorization = `Bearer ${access_token}`;
            const userResponse = await api.get('/auth/me');
            const user = {
                ...userResponse.data,
                role: userResponse.data.role?.toLowerCase()
            };

            localStorage.setItem('sima_user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (error) {
            console.error("Login error:", error);
            const detail = error.response?.data?.detail;
            return {
                success: false,
                message: detail || (error.request
                    ? 'Nao foi possivel conectar ao backend. Verifique se a API esta rodando em http://127.0.0.1:8000.'
                    : 'Erro ao realizar login'),
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('sima_token');
        localStorage.removeItem('sima_user');
        setUser(null);
        delete api.defaults.headers.Authorization;
    };

    return (
        <AuthContext.Provider value={{ authenticated: !!user, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
