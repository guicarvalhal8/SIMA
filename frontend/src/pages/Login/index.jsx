import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Clock,
    Lock,
    User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        } else {
            if (result.message && result.message.includes('aprovad')) {
                setPendingApproval(true);
            } else {
                setError(result.message);
            }
            setLoading(false);
        }
    };

    if (pendingApproval) {
        return (
            <AuthShell>
                <motion.div
                    className="glass-card w-full max-w-md p-10 text-center"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-warning/10 text-warning">
                        <Clock className="h-10 w-10" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-text-primary">Cadastro em aprovacao</h2>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">
                        Sua solicitacao foi registrada e esta aguardando validacao administrativa para liberar o acesso.
                    </p>
                    <div className="mt-5 rounded-[20px] border border-warning/15 bg-warning/8 p-4 text-sm font-medium text-warning">
                        Conta pendente de aprovacao institucional
                    </div>
                    <button
                        type="button"
                        onClick={() => setPendingApproval(false)}
                        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-accent-blue"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para o login
                    </button>
                </motion.div>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <motion.div
                className="glass-card w-full max-w-md p-10"
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="mb-10 text-center">
                    <div className="relative inline-flex">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-brand-gradient text-2xl font-bold text-white shadow-glow">
                            N
                        </div>
                        <div className="absolute -inset-3 -z-10 rounded-[30px] bg-brand-gradient opacity-15 blur-xl" />
                    </div>
                    <h1 className="mt-6 text-3xl font-semibold gradient-text">NEXORA</h1>
                    <p className="mt-2 text-sm tracking-wide text-text-secondary">
                        Plataforma institucional de monitoramento e predicao academica
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <motion.div
                            className="flex items-center gap-2.5 rounded-2xl border border-danger/15 bg-danger/8 p-4 text-sm text-danger"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">{error}</span>
                        </motion.div>
                    )}

                    <Input
                        label="E-mail, matricula ou codigo"
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

                    <Button type="submit" loading={loading} className="mt-2 w-full" icon={ArrowRight}>
                        Entrar no sistema
                    </Button>
                </form>

                <div className="mt-7 text-center">
                    <p className="text-sm text-text-secondary">
                        Nao tem conta?{' '}
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
                    NEXORA • inteligencia analitica para decisoes academicas
                </p>
            </motion.div>
        </AuthShell>
    );
}

function AuthShell({ children }) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary px-4 py-10">
            <AnimatedBackground variant="login" />
            <div className="relative z-10 w-full max-w-5xl">
                <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div className="hidden lg:block">
                        <div className="brand-shell rounded-[32px] border border-white/70 p-10">
                            <span className="inline-flex rounded-full border border-accent-blue/15 bg-accent-blue/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-blue">
                                Plataforma institucional
                            </span>
                            <h2 className="mt-6 text-4xl font-semibold leading-tight text-text-primary">
                                Monitoramento academico com identidade unica da NEXORA.
                            </h2>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary">
                                KPIs, alertas, predições e apoio a decisao para aluno, professor, coordenacao e reitoria em um unico ambiente.
                            </p>
                            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                <AuthFeature title="Leitura institucional" description="Hierarquia visual clara para decisao academica." />
                                <AuthFeature title="Perfis integrados" description="Experiencias adaptadas a cada papel do sistema." />
                                <AuthFeature title="Dados acionaveis" description="Alertas, risco e recomendacoes em destaque." />
                                <AuthFeature title="Identidade NEXORA" description="Visual limpo, responsivo e consistente." />
                            </div>
                        </div>
                    </div>
                    <div>{children}</div>
                </div>
            </div>
        </div>
    );
}

function AuthFeature({ title, description }) {
    return (
        <div className="rounded-[24px] border border-border-subtle bg-white/78 p-5">
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
    );
}
