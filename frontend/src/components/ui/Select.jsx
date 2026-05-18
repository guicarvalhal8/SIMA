import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export function Select({
    label,
    icon: Icon,
    error,
    description,
    className,
    selectClassName,
    children,
    ...props
}) {
    return (
        <div className={clsx('flex flex-col gap-2', className)}>
            {label && (
                <label className="text-sm font-semibold text-text-secondary">
                    {label}
                </label>
            )}

            <div className="group relative">
                {Icon && (
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors duration-200 group-focus-within:text-accent-blue">
                        <Icon className="h-4 w-4" />
                    </div>
                )}

                <select
                    className={clsx(
                        'w-full appearance-none rounded-2xl border border-border-subtle bg-white px-4 py-3 text-sm text-text-primary shadow-sm shadow-slate-900/[0.02] transition-all duration-200 focus:border-accent-blue/35 focus:outline-none focus:ring-4 focus:ring-accent-blue/10 hover:border-border-hover',
                        Icon && 'pl-11',
                        error && 'border-danger/30 focus:border-danger/40 focus:ring-danger/10',
                        props.disabled && 'cursor-not-allowed bg-bg-secondary text-text-tertiary',
                        selectClassName,
                    )}
                    {...props}
                >
                    {children}
                </select>

                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors duration-200 group-focus-within:text-accent-blue">
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>

            {(description || error) && (
                <span className={clsx('text-xs', error ? 'text-danger' : 'text-text-tertiary')}>
                    {error || description}
                </span>
            )}
        </div>
    );
}
