import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Menu, ShieldCheck, Sun, Moon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, getInitials, getPageMeta, getRoleMeta } from '@/lib/app-shell';
import { BrandLogo } from '@/components/ui/BrandLogo';

function formatToday() {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date());
}

export function Layout() {
    const { authenticated, loading, user } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const role = user?.role?.toLowerCase();
    const roleMeta = getRoleMeta(role);
    const pageMeta = getPageMeta(location.pathname, role);

    const [theme, setTheme] = React.useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    React.useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    React.useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    if (loading) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary">
                <AnimatedBackground variant="subtle" />
                <div className="relative z-10 flex flex-col items-center gap-5">
                    <div className="rounded-[28px] border border-white/80 bg-white/92 px-6 py-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.26)]">
                        <BrandLogo className="h-14" />
                    </div>
                    <div className="text-center">
                        <p className="mt-1 text-sm text-text-secondary">Preparando o ambiente acadêmico...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    if (location.pathname === '/' && role && role !== 'viewer') {
        return <Navigate to={getDefaultRoute(role)} replace />;
    }

    return (
        <div className="min-h-screen bg-bg-primary text-text-primary">
            <AnimatedBackground variant="subtle" />

            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-sm lg:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="relative lg:pl-72">
                <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-primary/75 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary lg:hidden"
                                aria-label="Abrir menu"
                            >
                                <Menu className="h-5 w-5" />
                            </button>

                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                                    {roleMeta.label}
                                </p>
                                <div className="mt-1 flex min-w-0 items-center gap-3">
                                    <pageMeta.icon className="h-[18px] w-[18px] flex-shrink-0 text-accent-blue" />
                                    <h2 className="truncate text-lg font-semibold text-text-primary">
                                        {pageMeta.label}
                                    </h2>
                                </div>
                                <p className="mt-1 hidden text-sm text-text-secondary sm:block">
                                    {pageMeta.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Dark Mode Toggle Button */}
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary shadow-sm"
                                aria-label="Alternar tema"
                                title={theme === 'light' ? 'Ligar Modo Escuro' : 'Desativar Modo Escuro'}
                            >
                                {theme === 'light' ? (
                                    <Moon className="h-5 w-5 text-accent-purple" />
                                ) : (
                                    <Sun className="h-5 w-5 text-amber-400" />
                                )}
                            </button>

                            <div className="hidden items-center gap-3 rounded-2xl border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-secondary shadow-sm md:flex">
                                <CalendarDays className="h-4 w-4 text-accent-blue" />
                                {formatToday()}
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-card px-3 py-2 shadow-sm">
                                <div className={`hidden h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br ${roleMeta.accent} text-sm font-bold text-white sm:flex`}>
                                    {getInitials(user?.full_name || user?.username)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-text-primary">
                                        {user?.full_name || user?.username}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                                        <ShieldCheck className="h-3.5 w-3.5 text-accent-blue" />
                                        {roleMeta.label}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-[1480px]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}
