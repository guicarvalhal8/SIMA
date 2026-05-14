import React from 'react';

export function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-2xl border border-border-subtle bg-white/95 px-4 py-3 shadow-card">
            {label && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</p>}
            <div className="space-y-1.5">
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-text-secondary">{entry.name}</span>
                        <span className="font-semibold" style={{ color: entry.color }}>
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
