import React, { useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function AcademicCourseSelector({
    label,
    helperText,
    selectedCourses = [],
    availableCourses = [],
    searchValue = '',
    onSearchChange,
    onToggleCourse,
    searchPlaceholder = 'Busque um curso...',
    emptyAvailableText = 'Nenhum curso disponível no momento.',
    emptySearchText = 'Nenhum curso encontrado para esta busca.',
    className,
    variant = 'expanded',
    showCount = true,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const normalizedSearch = normalizeText(searchValue);
    const selectedCount = selectedCourses.length;
    const isDropdown = variant === 'dropdown';

    const filteredCourses = useMemo(() => (
        availableCourses.filter((course) => normalizeText(course).includes(normalizedSearch))
    ), [availableCourses, normalizedSearch]);

    const sharedList = (
        <>
            {showCount ? (
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                    <p className="text-sm font-semibold text-text-primary">Cursos disponíveis</p>
                    <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                        {filteredCourses.length}
                    </span>
                </div>
            ) : null}

            {availableCourses.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                    {emptyAvailableText}
                </div>
            ) : filteredCourses.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                    {emptySearchText}
                </div>
            ) : (
                <div className="max-h-64 overflow-y-auto p-2">
                    {filteredCourses.map((course) => {
                        const selected = selectedCourses.some((item) => normalizeText(item) === normalizeText(course));
                        return (
                            <button
                                key={course}
                                type="button"
                                onClick={() => onToggleCourse(course)}
                                className={clsx(
                                    'flex w-full items-start justify-between gap-3 rounded-[18px] px-4 py-3 text-left transition',
                                    selected
                                        ? 'bg-accent-purple/10 text-accent-purple'
                                        : 'text-text-primary hover:bg-bg-secondary/65',
                                )}
                            >
                                <span className="pr-2 text-sm leading-6">{course}</span>
                                <span
                                    className={clsx(
                                        'mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                                        selected
                                            ? 'border-accent-purple/20 bg-accent-purple/12 text-accent-purple'
                                            : 'border-border-subtle bg-white text-text-tertiary',
                                    )}
                                >
                                    {selected ? (
                                        <>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Selecionado
                                        </>
                                    ) : (
                                        'Adicionar'
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );

    if (isDropdown) {
        return (
            <div className={clsx('relative space-y-3', className)}>
                {label ? (
                    <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-secondary">{label}</label>
                        {helperText ? <p className="text-sm leading-6 text-text-secondary">{helperText}</p> : null}
                    </div>
                ) : null}

                {selectedCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {selectedCourses.map((course) => (
                            <button
                                key={course}
                                type="button"
                                onClick={() => onToggleCourse(course)}
                                className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent-purple/20 bg-accent-purple/10 px-3 py-1.5 text-left text-sm font-medium text-accent-purple transition hover:bg-accent-purple/16"
                            >
                                <span className="break-words">{course}</span>
                                <X className="h-3.5 w-3.5 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        onFocus={() => setIsOpen(true)}
                        placeholder={searchPlaceholder}
                        className="h-14 w-full rounded-2xl border border-border-subtle bg-white pl-11 pr-4 text-sm text-text-primary shadow-sm shadow-slate-900/[0.02] transition-all duration-200 placeholder:text-text-tertiary/85 focus:border-accent-blue/35 focus:outline-none focus:ring-4 focus:ring-accent-blue/10 hover:border-border-hover"
                    />
                </div>

                {isOpen ? <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /> : null}

                {isOpen ? (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border-subtle bg-white/98 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.32)] backdrop-blur-xl"
                    >
                        {sharedList}
                    </motion.div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={clsx('space-y-4', className)}>
            {label ? (
                <div className="space-y-1">
                    <label className="block text-sm font-semibold text-text-secondary">{label}</label>
                    {helperText ? <p className="text-sm leading-6 text-text-secondary">{helperText}</p> : null}
                </div>
            ) : null}

            <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-4">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-accent-purple/10 p-2 text-accent-purple">
                        <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-text-primary">Cursos selecionados</p>
                        <p className="text-xs text-text-tertiary">
                            {selectedCount === 0 ? 'Nenhum curso selecionado ainda.' : `${selectedCount} curso${selectedCount > 1 ? 's' : ''} selecionado${selectedCount > 1 ? 's' : ''}.`}
                        </p>
                    </div>
                </div>

                <div className="mt-4 min-h-[72px] rounded-[20px] border border-dashed border-border-subtle bg-white/70 p-3">
                    {selectedCount > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {selectedCourses.map((course) => (
                                <button
                                    key={course}
                                    type="button"
                                    onClick={() => onToggleCourse(course)}
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent-purple/20 bg-accent-purple/10 px-3 py-2 text-left text-sm font-medium text-accent-purple transition hover:bg-accent-purple/16"
                                >
                                    <span className="break-words">{course}</span>
                                    <X className="h-3.5 w-3.5 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[44px] items-center justify-center text-sm text-text-tertiary">
                            Selecione um ou mais cursos para continuar.
                        </div>
                    )}
                </div>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-14 w-full rounded-2xl border border-border-subtle bg-white pl-11 pr-4 text-sm text-text-primary shadow-sm shadow-slate-900/[0.02] transition-all duration-200 placeholder:text-text-tertiary/85 focus:border-accent-blue/35 focus:outline-none focus:ring-4 focus:ring-accent-blue/10 hover:border-border-hover"
                />
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-white/92 shadow-sm">
                {sharedList}
            </div>
        </div>
    );
}
