import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, PanelLeftClose, ShieldCheck, X } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials, getNavItems, getRoleMeta } from '@/lib/app-shell';
import { BrandLogo } from '@/components/ui/BrandLogo';

export function Sidebar({ open, onClose }) {
    const { logout, user } = useAuth();
    const location = useLocation();
    const roleMeta = getRoleMeta(user?.role);
    const navItems = getNavItems(user?.role);
    const userName = user?.full_name || user?.username || 'Usuário';

    return (
        <motion.aside
            className={clsx(
                'fixed inset-y-0 left-0 z-50 flex w-[296px] flex-col overflow-hidden border-r border-slate-200/80 bg-white/96 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.38)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0',
                open ? 'translate-x-0' : '-translate-x-full',
            )}
            initial={false}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(11,87,208,0.16),transparent_62%),radial-gradient(circle_at_top_right,rgba(106,27,255,0.16),transparent_54%)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent-blue/20 to-transparent" />

            <div className="relative flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
                <Link
                    to={roleMeta.home}
                    className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
                >
                    <BrandLogo symbolOnly className="h-12 flex-shrink-0" compact />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Plataforma acadêmica
                        </p>
                        <h1 className="mt-1 text-[1.85rem] font-bold tracking-[-0.03em] text-text-primary">
                            NEXORA
                        </h1>
                    </div>
                </Link>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="relative flex-1 overflow-y-auto px-4 py-5">
                <nav className="rounded-[28px] border border-slate-200/80 bg-white/72 p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.24)]">
                    <div className="flex items-center justify-between px-2 pb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Navegação
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {navItems.length} módulos
                        </span>
                    </div>

                    <div className="space-y-5">
                    {navItems.map((item) => {
                        const active = item.to === '/'
                            ? location.pathname === '/'
                            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                        const navState = item.to?.includes('analysis-center')
                            ? { openAnalysisIntro: true }
                            : undefined;

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                state={navState}
                                onClick={onClose}
                                className={clsx(
                                    'group relative block overflow-hidden rounded-[16px] border px-3.5 py-3.5 transition-all duration-200',
                                    active
                                        ? 'border-accent-blue/20 bg-[linear-gradient(135deg,rgba(11,87,208,0.14),rgba(106,27,255,0.1))] shadow-[0_20px_38px_-28px_rgba(11,87,208,0.62)]'
                                        : 'border-slate-200/70 bg-white/76 hover:border-accent-blue/16 hover:bg-slate-50',
                                )}
                            >
                                <span
                                    className={clsx(
                                        'absolute inset-y-3.5 left-0 w-1 rounded-r-full transition-all duration-200',
                                        active ? 'bg-gradient-to-b from-accent-blue to-accent-purple opacity-100' : 'bg-accent-blue/25 opacity-0 group-hover:opacity-100',
                                    )}
                                />

                                <div className={clsx('flex gap-3', active ? 'items-start' : 'items-center')}>
                                    <div className={clsx(
                                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors',
                                        active
                                            ? 'border-white/80 bg-white text-accent-blue shadow-sm'
                                            : 'border-slate-200/70 bg-slate-50 text-text-secondary group-hover:border-accent-blue/12 group-hover:text-accent-blue',
                                    )}>
                                        <item.icon className="h-[18px] w-[18px]" />
                                    </div>

                                    <div className="min-w-0">
                                        <p className={clsx(
                                            'text-sm font-semibold leading-5',
                                            active ? 'text-slate-950' : 'text-slate-700 group-hover:text-text-primary',
                                        )}>
                                            {item.label}
                                        </p>
                                        {active && (
                                            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-600">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </NavLink>
                        );
                    })}
                    </div>
                </nav>
            </div>

            <div className="relative border-t border-border-subtle bg-bg-card/92 dark:bg-bg-primary/95 p-4 transition-colors">
                <div className="rounded-[26px] border border-border-subtle bg-gradient-to-b from-white/95 to-slate-50/95 dark:from-bg-card dark:to-bg-secondary p-4 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.28)] transition-all">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br ${roleMeta.accent} text-sm font-bold text-white shadow-[0_16px_32px_-20px_rgba(11,87,208,0.75)]`}>
                            {getInitials(userName)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">{userName}</p>
                            <p className="text-xs text-text-secondary">{roleMeta.label}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={logout}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-bg-card dark:bg-bg-tertiary px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-danger/15 hover:bg-danger/5 hover:text-danger dark:hover:bg-danger/10"
                    >
                        <LogOut className="h-4 w-4" />
                        Encerrar sessão
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-2 px-2 text-[11px] leading-5 text-text-tertiary">
                    <PanelLeftClose className="h-3.5 w-3.5" />
                    Sistema institucional de monitoramento e predição acadêmica
                </div>
            </div>
        </motion.aside>
    );
}
