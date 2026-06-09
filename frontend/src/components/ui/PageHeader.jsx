import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleMeta } from '@/lib/app-shell';

export function PageHeader({
    title,
    subtitle,
    eyebrow,
    icon: Icon,
    actions,
}) {
    const { user } = useAuth();
    const roleMeta = getRoleMeta(user?.role);

    return (
        <motion.div
            className="brand-shell relative overflow-visible rounded-[32px] border border-white/70 bg-white px-6 py-6 sm:px-8 sm:py-7"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                    <div className="mb-4 flex items-center gap-3">
                        {Icon && (
                            <div className={`flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br ${roleMeta.accent} text-white shadow-glow-sm`}>
                                <Icon className="h-6 w-6" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${roleMeta.badge}`}>
                                {eyebrow || roleMeta.shortLabel}
                            </span>
                            <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                Monitoramento, predição e apoio à decisão acadêmica
                            </div>
                        </div>
                    </div>

                    <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[2rem]">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-[15px]">
                            {subtitle}
                        </p>
                    )}
                </div>

                {actions && (
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        {actions}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
