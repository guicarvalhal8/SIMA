import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const variants = {
    default: 'glass-card',
    static: 'glass-card-static',
    glow: 'glass-card glow-border',
    muted: 'bg-bg-secondary/80 border border-border-subtle rounded-[26px] shadow-card text-text-primary',
    hero: 'rounded-[30px] border border-border-subtle bg-brand-gradient-soft shadow-card text-text-primary',
};

export function Card({
    children,
    className,
    contentClassName,
    variant = 'default',
    animate = true,
    delay = 0,
    as: Component = 'div',
}) {
    const Wrapper = animate ? motion.div : Component;
    const animationProps = animate ? {
        initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
    } : {};

    return (
        <Wrapper
            className={clsx(
                variants[variant] || variants.default,
                'relative overflow-hidden',
                className,
            )}
            {...animationProps}
        >
            <div className={clsx('flex h-full flex-col p-6 sm:p-7', contentClassName)}>
                {children}
            </div>
        </Wrapper>
    );
}

export function CardHeader({
    title,
    subtitle,
    icon: Icon,
    className,
    action,
}) {
    return (
        <div className={clsx('mb-5 flex items-start justify-between gap-4', className)}>
            <div className="flex items-start gap-3">
                {Icon && (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue shadow-glow-sm">
                        <Icon className="h-5 w-5" />
                    </div>
                )}
                <div>
                    <h3 className="text-base font-semibold text-text-primary">{title}</h3>
                    {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}
