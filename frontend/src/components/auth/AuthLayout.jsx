import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { AlertCircle, ArrowLeft, CheckCircle, Clock } from 'lucide-react';

import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';

const DEFAULT_FEATURES = [
    {
        title: 'Leitura institucional',
        description: 'Hierarquia visual clara para decisao academica.',
    },
    {
        title: 'Perfis integrados',
        description: 'Experiencias adaptadas a cada papel do sistema.',
    },
    {
        title: 'Dados acionaveis',
        description: 'Alertas, risco e recomendacoes em destaque.',
    },
    {
        title: 'Identidade NEXORA',
        description: 'Visual limpo, responsivo e consistente.',
    },
];

export function AuthLayout({
    children,
    eyebrow = 'Plataforma institucional',
    title = 'Monitoramento academico com identidade unica da NEXORA.',
    description = 'KPIs, alertas, predicoes e apoio a decisao para aluno, professor, coordenacao e pro-reitoria em um unico ambiente.',
    features = DEFAULT_FEATURES,
}) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary px-4 py-10">
            <AnimatedBackground variant="login" />
            <div className="relative z-10 w-full max-w-6xl">
                <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
                    <div className="hidden lg:block">
                        <div className="brand-shell rounded-[32px] border border-white/70 p-10">
                            <span className="inline-flex rounded-full border border-accent-blue/15 bg-accent-blue/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-blue">
                                {eyebrow}
                            </span>
                            <div className="mt-6 flex items-center gap-4">
                                <div className="rounded-[28px] border border-white/80 bg-white/92 px-5 py-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.26)]">
                                    <BrandLogo className="h-16" />
                                </div>
                            </div>
                            <h2 className="mt-6 text-4xl font-semibold leading-tight text-text-primary">
                                {title}
                            </h2>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary">
                                {description}
                            </p>
                            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                {features.map((feature) => (
                                    <div key={feature.title} className="rounded-[24px] border border-border-subtle bg-white/78 p-5">
                                        <p className="text-sm font-semibold text-text-primary">{feature.title}</p>
                                        <p className="mt-2 text-sm leading-6 text-text-secondary">{feature.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>{children}</div>
                </div>
            </div>
        </div>
    );
}

export function AuthCard({
    title,
    subtitle,
    icon: Icon,
    tone = 'blue',
    children,
    footer,
    maxWidth = 'max-w-lg',
}) {
    const toneMap = {
        blue: 'from-accent-blue to-accent-purple',
        student: 'from-accent-blue to-accent-cyan',
        professor: 'from-accent-purple to-accent-rose',
        coordinator: 'from-accent-amber to-accent-rose',
    };

    return (
        <motion.div
            className={clsx('relative z-10 w-full px-4', maxWidth)}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45 }}
        >
            <div className="glass-card-static p-8 sm:p-10">
                <div className="mb-8 text-center">
                    <div className={clsx('mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow-sm', toneMap[tone] || toneMap.blue)}>
                        {Icon ? <Icon className="h-6 w-6" /> : <BrandLogo compact symbolOnly className="h-8" />}
                    </div>
                    <h1 className="mt-4 text-2xl font-bold gradient-text">{title}</h1>
                    {subtitle && (
                        <p className="mt-2 text-sm text-text-secondary">
                            {subtitle}
                        </p>
                    )}
                </div>

                {children}
                {footer ? <div className="mt-8">{footer}</div> : null}
            </div>
        </motion.div>
    );
}

export function AuthAlert({ children, tone = 'danger' }) {
    const styles = {
        danger: 'border-danger/15 bg-danger/8 text-danger',
        warning: 'border-warning/15 bg-warning/8 text-warning',
        success: 'border-success/15 bg-success/8 text-success',
    };

    return (
        <motion.div
            className={clsx('flex items-start gap-2.5 rounded-2xl border p-4 text-sm', styles[tone] || styles.danger)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
        >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{children}</span>
        </motion.div>
    );
}

export function AuthBackButton({ onClick, label = 'Voltar', className }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx('inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-accent-blue', className)}
        >
            <ArrowLeft className="h-4 w-4" />
            {label}
        </button>
    );
}

export function AuthSuccessState({
    title,
    description,
    onAction,
    actionLabel = 'Ir para o login',
    status = 'success',
}) {
    const iconMap = {
        success: CheckCircle,
        pending: Clock,
    };
    const toneMap = {
        success: 'text-success bg-success/10 border-success/15',
        pending: 'text-warning bg-warning/10 border-warning/15',
    };
    const Icon = iconMap[status] || CheckCircle;

    return (
        <AuthLayout>
            <motion.div
                className="relative z-10 w-full max-w-md px-4"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="glass-card-static p-10 text-center">
                    <div className={clsx('mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border', toneMap[status] || toneMap.success)}>
                        <Icon className="h-10 w-10" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-text-primary">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">{description}</p>
                    <div className={clsx('mt-5 rounded-[20px] border p-4 text-sm font-medium', toneMap[status] || toneMap.success)}>
                        {status === 'pending' ? 'Conta pendente de aprovacao institucional' : 'Cadastro concluido com sucesso'}
                    </div>
                    <Button onClick={onAction} className="mt-8 w-full">
                        {actionLabel}
                    </Button>
                </div>
            </motion.div>
        </AuthLayout>
    );
}
