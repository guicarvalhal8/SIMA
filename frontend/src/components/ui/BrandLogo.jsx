import React from 'react';
import clsx from 'clsx';
import nexoraLogo from '@/assets/nexora-logo.png';
import nexoraSymbol from '@/assets/nexora-symbol.png';

export function BrandLogo({ className, compact = false, symbolOnly = false }) {
    return (
        <img
            src={symbolOnly ? nexoraSymbol : nexoraLogo}
            alt={symbolOnly ? 'Simbolo NEXORA' : 'NEXORA'}
            className={clsx(
                'block w-auto object-contain object-left',
                compact ? 'h-12' : 'h-14',
                className,
            )}
        />
    );
}
