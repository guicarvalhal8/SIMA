import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    AuthAlert,
    AuthCard,
    AuthLayout,
    AuthSuccessState,
} from '@/components/auth/AuthLayout';

export function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(identifier, password);
        if (result.success) {
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
            return;
        }

        if (result.message && result.message.includes('aprovad')) {
            setPendingApproval(true);
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    if (pendingApproval) {
        return (
            <AuthSuccessState
                status="pending"
                title="Cadastro em aprovação"
                description="Sua solicitação foi registrada e está aguardando validação administrativa para liberar o acesso."
                actionLabel="Voltar para o login"
                onAction={() => setPendingApproval(false)}
            />
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                title="Entrar na NEXORA"
                subtitle="Use sua matrícula, código institucional ou e-mail para acessar a plataforma."
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <Input
                        label="E-mail, matrícula ou código"
                        placeholder="Digite seu identificador de acesso"
                        icon={User}
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        required
                    />

                    <Input
                        label="Senha"
                        type="password"
                        placeholder="Digite sua senha"
                        icon={Lock}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />

                    <Button type="submit" loading={loading} className="w-full">
                        Entrar no sistema
                    </Button>
                </form>

                <div className="mt-7 text-center">
                    <p className="text-sm text-text-secondary">
                        Não tem conta?{' '}
                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="font-semibold text-accent-blue transition-colors hover:text-accent-purple"
                        >
                            Solicitar cadastro
                        </button>
                    </p>
                </div>

                <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                    NEXORA | inteligência analítica para decisões acadêmicas
                </p>
            </AuthCard>
        </AuthLayout>
    );
}
