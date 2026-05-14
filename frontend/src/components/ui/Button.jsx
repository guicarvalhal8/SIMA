import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const variants = {
    primary: 'bg-brand-gradient text-white shadow-glow-sm hover:shadow-glow focus-visible:ring-accent-blue/25',
    secondary: 'bg-white text-text-primary border border-border-subtle hover:border-border-hover hover:bg-bg-elevated focus-visible:ring-accent-blue/15',
    outline: 'bg-transparent text-text-primary border border-border-subtle hover:border-accent-blue/30 hover:bg-accent-blue/5 focus-visible:ring-accent-blue/15',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-secondary focus-visible:ring-accent-blue/10',
    danger: 'bg-danger/8 text-danger border border-danger/15 hover:bg-danger/12 focus-visible:ring-danger/15',
};

const sizes = {
    sm: 'h-9 px-3.5 text-xs rounded-xl gap-1.5',
    md: 'h-11 px-[18px] text-sm rounded-2xl gap-2',
    lg: 'h-12 px-5.5 text-sm rounded-2xl gap-2.5',
};

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className,
    loading = false,
    icon: Icon,
    type = 'button',
    ...props
}) {
    return (
        <button
            type={type}
            className={clsx(
                'inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-55',
                variants[variant],
                sizes[size],
                className,
            )}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? (
                <Loader2 className={clsx(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', 'animate-spin')} />
            ) : Icon ? (
                <Icon className={clsx(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            ) : null}
            {children}
        </button>
    );
}
