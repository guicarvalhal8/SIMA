import React from 'react';
import clsx from 'clsx';

const variantStyles = {
    success: 'bg-success/10 text-success border-success/15',
    warning: 'bg-warning/10 text-warning border-warning/15',
    attention: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-danger/10 text-danger border-danger/15',
    info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/15',
    neutral: 'bg-slate-200/55 text-text-secondary border-slate-300/60',
    purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/15',
    cyan: 'bg-accent-cyan/12 text-accent-blue border-accent-cyan/20',
};

export function Badge({
    children,
    variant = 'neutral',
    dot = false,
    className,
}) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                variantStyles[variant],
                className,
            )}
        >
            {dot && (
                <span className={clsx(
                    'h-2 w-2 rounded-full',
                    variant === 'success' && 'bg-success',
                    variant === 'warning' && 'bg-warning',
                    variant === 'attention' && 'bg-amber-500',
                    variant === 'danger' && 'bg-danger',
                    variant === 'info' && 'bg-accent-blue',
                    variant === 'purple' && 'bg-accent-purple',
                    variant === 'cyan' && 'bg-accent-cyan',
                    variant === 'neutral' && 'bg-text-tertiary',
                )} />
            )}
            {children}
        </span>
    );
}
