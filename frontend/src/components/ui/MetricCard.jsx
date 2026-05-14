import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Card } from './Card';

const toneStyles = {
    blue: {
        wrapper: 'bg-accent-blue/10 text-accent-blue',
        trend: 'text-accent-blue',
    },
    purple: {
        wrapper: 'bg-accent-purple/10 text-accent-purple',
        trend: 'text-accent-purple',
    },
    indigo: {
        wrapper: 'bg-accent-indigo/10 text-accent-indigo',
        trend: 'text-accent-indigo',
    },
    emerald: {
        wrapper: 'bg-success/10 text-success',
        trend: 'text-success',
    },
    amber: {
        wrapper: 'bg-warning/10 text-warning',
        trend: 'text-warning',
    },
    rose: {
        wrapper: 'bg-danger/10 text-danger',
        trend: 'text-danger',
    },
    dark: {
        wrapper: 'bg-accent-blue-dark/10 text-accent-blue-dark',
        trend: 'text-accent-blue-dark',
    },
};

export function MetricCard({
    title,
    value,
    icon: Icon,
    tone = 'blue',
    helper,
    trend,
    delay = 0,
    valueClassName,
}) {
    const styles = toneStyles[tone] || toneStyles.blue;

    return (
        <Card delay={delay} className="h-full">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                        {title}
                    </p>
                    <p className={clsx('text-3xl font-semibold tracking-tight text-text-primary', valueClassName)}>
                        {value}
                    </p>
                    {helper && <p className="text-sm text-text-secondary">{helper}</p>}
                </div>

                {Icon && (
                    <div className={clsx('flex h-12 w-12 items-center justify-center rounded-[18px]', styles.wrapper)}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>

            {trend && (
                <motion.div
                    className={clsx('mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', styles.wrapper)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: delay + 0.15 }}
                >
                    <span className={styles.trend}>{trend}</span>
                </motion.div>
            )}
        </Card>
    );
}
