import React from 'react';
import { Card } from './Card';

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}) {
    return (
        <Card className={className}>
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/35 px-6 text-center">
                {Icon && (
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue">
                        <Icon className="h-6 w-6" />
                    </div>
                )}
                <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                {description && (
                    <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
                        {description}
                    </p>
                )}
                {action && <div className="mt-5">{action}</div>}
            </div>
        </Card>
    );
}
