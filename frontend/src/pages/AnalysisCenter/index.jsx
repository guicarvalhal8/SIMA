import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    BookOpen,
    BrainCircuit,
    CalendarRange,
    CheckCircle2,
    Download,
    Filter,
    Layers3,
    Lightbulb,
    Loader2,
    Search,
    ShieldAlert,
    TrendingUp,
    Upload,
    Users,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath, isProfessorLikeRole } from '@/lib/app-shell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDetailModal } from '@/components/StudentDetailModal';

function getRiskVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function DisciplineRiskPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 16);
    const chartRows = topRows.slice(0, 10).map((item) => ({
        disciplina: item.subject,
        risco: Math.round(Number(item.avg_risk || 0) * 100),
    }));

    const driverLabels = {
        nota: 'Nota',
        primeira_avaliacao: 'Primeira avaliacao',
        presenca: 'Presenca',
        queda_presenca: 'Queda de presenca',
        atividade: 'Atividade',
        oscilacao: 'Oscilacao',
        aprovacao: 'Reprovacao',
        historico: 'Historico',
        carga: 'Carga',
        dificuldade_disciplina: 'Dificuldade',
        trabalho: 'Trabalho',
    };

    return (
        <Card>
            <CardHeader
                title="Risco por disciplina"
                subtitle="Ranking do recorte atual. Ajuda a priorizar quais disciplinas precisam de intervencao primeiro."
                icon={BookOpen}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Risco medio', description: 'Media do risco estimado nos registros da disciplina (maior = pior).' },
                        { label: 'Criticos/altos', description: 'Quantidade de registros com risco alto/critico na disciplina.' },
                        { label: 'Principais causas', description: 'Fatores que mais puxaram o risco para cima nessa disciplina.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha dados suficientes para calcular risco por disciplina.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ left: 22 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis type="category" dataKey="disciplina" tickLine={false} axisLine={false} fontSize={12} width={160} />
                                    <Tooltip />
                                    <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 10, 10]} name="Risco medio (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Disciplina</th>
                                        <th className="px-4">Risco medio</th>
                                        <th className="px-4">Criticos/altos</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">Presenca</th>
                                        <th className="px-4">Principais causas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.subject}</td>
                                            <td className="px-4 py-4"><Badge variant={getRiskVariant(item.risk_level)}>{formatRisk(item.avg_risk)}</Badge></td>
                                            <td className="px-4 py-4 text-text-secondary">{item.critical_students}</td>
                                            <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.avg_grade || 0).toFixed(2)}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatPercent(item.avg_attendance)}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                                {(item.top_drivers || []).map((key) => driverLabels[key] || key).join(' • ') || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function StudentSegmentsPanel({ rows }) {
    const safeRows = rows || [];
    const chartRows = safeRows.slice(0, 8).map((item) => ({
        segmento: item.label,
        alunos: Number(item.students || 0),
    }));

    return (
        <Card>
            <CardHeader
                title="Segmentos de alunos"
                subtitle="Perfis para aplicar intervencoes diferentes (com menos tentativa e erro)."
                icon={Users}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Segmento', description: 'Grupo com caracteristicas parecidas (nota/presenca/atividade/risco).' },
                        { label: 'Alunos', description: 'Quantidade de alunos nesse perfil.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha dados suficientes para segmentar alunos.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="segmento" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip />
                                    <Bar dataKey="alunos" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Alunos" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Segmento</th>
                                        <th className="px-4">Alunos</th>
                                        <th className="px-4">Risco medio</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">Presenca</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.label}</td>
                                            <td className="px-4 py-4 text-text-secondary">{item.students}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatRisk(item.avg_risk)}</td>
                                            <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.avg_grade || 0).toFixed(2)}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatPercent(item.avg_attendance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function RiskProjectionPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 20);
    const chartRows = topRows.map((item) => ({
        aluno: item.student_name?.split(' ')[0] || item.student_name,
        agora: Math.round(Number(item.current_risk || 0) * 100),
        semanas8: Math.round(Number(item.projected_8w || 0) * 100),
    }));

    return (
        <Card>
            <CardHeader
                title="Projecao de risco"
                subtitle="Uma previsao simples baseada na tendencia do aluno (para agir antes)."
                icon={TrendingUp}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Agora', description: 'Risco atual estimado.' },
                        { label: '8 semanas', description: 'Projecao aproximada se a tendencia continuar igual.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha dados suficientes para projecao.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="agora" fill="#0B57D0" radius={[10, 10, 0, 0]} name="Agora (%)" />
                                    <Bar dataKey="semanas8" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="8 semanas (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Aluno</th>
                                        <th className="px-4">Agora</th>
                                        <th className="px-4">4 semanas</th>
                                        <th className="px-4">8 semanas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.student_name}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatRisk(item.current_risk)}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatRisk(item.projected_4w)}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatRisk(item.projected_8w)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function HeatmapPanel({ data }) {
    const metrics = data?.metrics || [];
    const classes = data?.classes || [];
    const cells = data?.cells || [];

    const cellByKey = useMemo(() => {
        const index = new Map();
        cells.forEach((cell) => {
            index.set(`${cell.class_id}::${cell.metric}`, cell.value);
        });
        return index;
    }, [cells]);

    function colorFor(metricId, value) {
        const v = Number(value || 0);
        if (metricId === 'risk') {
            if (v >= 0.75) return 'bg-red-200';
            if (v >= 0.58) return 'bg-amber-200';
            return 'bg-emerald-200';
        }
        if (metricId === 'grade') {
            if (v < 5) return 'bg-red-200';
            if (v < 6) return 'bg-amber-200';
            return 'bg-emerald-200';
        }
        if (v < 0.65) return 'bg-red-200';
        if (v < 0.75) return 'bg-amber-200';
        return 'bg-emerald-200';
    }

    function formatValue(metricId, value) {
        if (metricId === 'grade') return Number(value || 0).toFixed(2);
        if (metricId === 'risk') return formatRisk(value);
        return `${Math.round(Number(value || 0) * 100)}%`;
    }

    return (
        <Card>
            <CardHeader
                title="Mapa de calor"
                subtitle="Cores para encontrar turmas com problema rapidamente."
                icon={BarChart3}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Vermelho', description: 'Pior zona (precisa de atencao urgente).' },
                        { label: 'Amarelo', description: 'Zona de atencao (monitorar e agir cedo).' },
                        { label: 'Verde', description: 'Boa zona (sem sinal forte de problema).' },
                    ]}
                />

                {!classes.length || !metrics.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha dados suficientes para o mapa de calor.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Turma</th>
                                    {metrics.map((metric) => (
                                        <th key={metric.id} className="px-4">{metric.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((row) => (
                                    <tr key={row.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{row.label}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{row.semester}</p>
                                        </td>
                                        {metrics.map((metric, idx) => {
                                            const value = cellByKey.get(`${row.id}::${metric.id}`);
                                            const tone = colorFor(metric.id, value);
                                            return (
                                                <td key={`${row.id}-${metric.id}`} className={idx === metrics.length - 1 ? 'rounded-r-[20px] px-4 py-4' : 'px-4 py-4'}>
                                                    <span className={[tone, 'inline-flex min-w-[74px] items-center justify-center rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-900'].join(' ')}>
                                                        {formatValue(metric.id, value)}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
}

function MinimalOverview({ overview, classes }) {
    const topClasses = (classes || []).slice(0, 6).map((item) => ({
        turma: item.label,
        risco: Math.round(Number(item.risk_score || 0) * 100),
    }));

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
                <MetricCard title="Alunos" value={overview.total_students} helper="No recorte atual" icon={Users} tone="blue" />
                <MetricCard title="Media de notas" value={overview.avg_grade?.toFixed(2)} helper="No recorte atual" icon={CheckCircle2} tone="indigo" />
                <MetricCard title="Risco medio" value={formatRisk(overview.avg_risk)} helper="Quanto maior, pior" icon={ShieldAlert} tone="amber" />
            </div>

            <Card>
                <CardHeader title="Turmas com mais risco" subtitle="Top 6 (para priorizar)" icon={BarChart3} />
                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topClasses}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="turma" tickLine={false} axisLine={false} fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                            <Tooltip />
                            <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Risco (%)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}

function formatPercent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}

function formatRisk(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatClassLabel(item) {
    return `${item.label} • ${item.semester}`;
}

function AnalysisIntroModal({ open, analyses, onSelect, onClose }) {
    if (!open) return null;

    const safeAnalyses = analyses || [];

    function getSimpleDescription(id) {
        if (id === 'overview') {
            return 'Um resumo geral: como estao as turmas, medias e sinais de atencao.';
        }
        if (id === 'by_class') {
            return 'Veja cada turma e, ao clicar, os alunos com maior risco de evasao.';
        }
        if (id === 'between_classes') {
            return 'Compare duas turmas: escolha Turma A e Turma B e veja qual esta melhor em nota, presenca e risco.';
        }
        if (id === 'by_semester') {
            return 'Veja como os numeros mudaram de um semestre para outro.';
        }
        if (id === 'risk_topics') {
            return 'Descubra quais disciplinas/turmas estao puxando o risco para cima.';
        }
        if (id === 'discipline_bottlenecks') {
            return 'Mostra disciplinas com piores combinacoes de nota, presenca e atividade.';
        }
        if (id === 'intervention_priorities') {
            return 'Uma lista do que atacar primeiro para reduzir risco e melhorar desempenho.';
        }
        return 'Abra esta analise.';
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[26px] border border-border-subtle bg-white p-6 shadow-card-hover">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Central de analises</p>
                        <h2 className="mt-2 text-xl font-semibold text-text-primary">O que voce quer ver agora?</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Escolha uma opcao. Se tiver duvida, comece por "Visao geral".
                        </p>
                    </div>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {safeAnalyses.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-4 py-4 text-left transition hover:border-border-hover hover:bg-bg-secondary/55"
                        >
                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{getSimpleDescription(item.id)}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StudentTrendsPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 12);
    const chartRows = topRows.map((item) => ({
        aluno: item.student_name?.split(' ')[0] || item.student_name,
        risco: Math.round(Number(item.current_risk || 0) * 100),
        riscoMudou: Math.round(Number(item.risk_delta || 0) * 100),
    }));

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="Tendencia por aluno"
                    subtitle="Quem piorou rapido e quem esta com maior risco agora."
                    icon={TrendingUp}
                />
                <div className="space-y-4">
                    <MetricsHelp
                        items={[
                            { label: 'Risco atual', description: 'Quanto maior, pior. Use para priorizar acompanhamento.' },
                            { label: 'Mudanca de risco', description: 'Quanto o risco subiu ou desceu do primeiro para o ultimo semestre.' },
                        ]}
                    />

                    {!safeRows.length ? (
                        <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                            Ainda nao ha dados suficientes para tendencia por aluno.
                        </div>
                    ) : (
                        <>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartRows}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Risco atual (%)" />
                                        <Bar dataKey="riscoMudou" fill="#0B57D0" radius={[10, 10, 0, 0]} name="Mudanca de risco (%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                            <th className="px-4">Aluno</th>
                                            <th className="px-4">Risco atual</th>
                                            <th className="px-4">Mudou</th>
                                            <th className="px-4">Nota atual</th>
                                            <th className="px-4">Presenca</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topRows.map((item) => (
                                            <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                                <td className="rounded-l-[20px] px-4 py-4">
                                                    <p className="font-semibold text-text-primary">{item.student_name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">{item.semesters} semestres</p>
                                                </td>
                                                <td className="px-4 py-4"><Badge variant={getRiskVariant(item.current_risk >= 0.75 ? 'critical' : item.current_risk >= 0.58 ? 'high' : item.current_risk >= 0.38 ? 'medium' : 'low')}>{formatRisk(item.current_risk)}</Badge></td>
                                                <td className="px-4 py-4 text-text-secondary">{item.risk_delta > 0 ? '+' : ''}{Math.round(Number(item.risk_delta || 0) * 100)}%</td>
                                                <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.current_grade || 0).toFixed(2)}</td>
                                                <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatPercent(item.current_attendance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}

function RiskFactorsPanel({ rows, diagnostics }) {
    const safeRows = rows || [];
    const chartRows = safeRows.map((item) => ({
        fator: item.label,
        contribuicao: Number(item.avg_contribution_percent || 0),
    }));
    const bestModel = (diagnostics?.models || []).slice().sort((a, b) => Number(b.roc_auc || 0) - Number(a.roc_auc || 0))[0];
    const techniques = diagnostics?.techniques_used || [];

    return (
        <Card>
            <CardHeader
                title="Fatores de risco"
                subtitle="O que mais esta puxando o risco para cima no recorte atual."
                icon={Lightbulb}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Contribuicao', description: 'Quanto cada fator pesa, em media, no risco final (maior = pior).' },
                        { label: 'AUC CV', description: 'Capacidade do modelo separar casos mais seguros dos mais arriscados.' },
                    ]}
                />

                {diagnostics?.mode === 'statistical' ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="Melhor AUC CV"
                                value={bestModel ? Number(bestModel.roc_auc || 0).toFixed(3) : '0.000'}
                                helper={bestModel ? bestModel.label : 'Sem modelo dominante'}
                                icon={BrainCircuit}
                                tone="purple"
                            />
                            <MetricCard
                                title="Melhor F1"
                                value={bestModel ? Number(bestModel.f1 || 0).toFixed(3) : '0.000'}
                                helper="Balanceia precisao e recall"
                                icon={CheckCircle2}
                                tone="emerald"
                            />
                            <MetricCard
                                title="Variaveis finais"
                                value={diagnostics?.selected_feature_count || 0}
                                helper={`${diagnostics?.folds || 0} folds de validacao cruzada`}
                                icon={Layers3}
                                tone="blue"
                            />
                            <MetricCard
                                title="Outliers tratados"
                                value={diagnostics?.preprocessing?.outliers_treated || 0}
                                helper={`${diagnostics?.preprocessing?.missing_values_imputed || 0} imputacoes`}
                                icon={ShieldAlert}
                                tone="amber"
                            />
                        </div>

                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                            <p className="font-semibold text-text-primary">Pipeline estatistico ativo</p>
                            <p className="mt-2 leading-6">
                                {diagnostics?.target_definition || 'Modelo supervisionado com pre-processamento, selecao de variaveis e ensemble.'}
                            </p>
                            {!!techniques.length && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {techniques.map((item) => (
                                        <Badge key={item} variant="info">{item}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : diagnostics?.reason ? (
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Fallback heuristico:</span> {diagnostics.reason}
                    </div>
                ) : null}

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha dados suficientes para calcular fatores.
                    </div>
                ) : (
                    <>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ left: 18 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis type="category" dataKey="fator" tickLine={false} axisLine={false} fontSize={12} width={130} />
                                    <Tooltip />
                                    <Bar dataKey="contribuicao" fill="#6A1BFF" radius={[10, 10, 10, 10]} name="Peso no risco (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Fator</th>
                                        <th className="px-4">Peso medio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.label}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{Number(item.avg_contribution_percent || 0).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function EarlyAlertsPanel({ rows, onSelectStudent, onViewCriteria }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 60);

    return (
        <Card>
            <CardHeader
                title="Alertas precoces"
                subtitle="Sinais simples para agir cedo e reduzir evasao."
                icon={ShieldAlert}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Prioridade', description: 'Quanto maior, mais urgente olhar primeiro.' },
                        { label: 'Tags', description: 'Motivos do alerta (nota baixa, presenca baixa, etc.).' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Nenhum alerta encontrado para o recorte atual.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Aluno</th>
                                    <th className="px-4">Turma</th>
                                    <th className="px-4">Prioridade</th>
                                    <th className="px-4">Tags</th>
                                    <th className="px-4">Risco</th>
                                    <th className="px-4">Criterios</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topRows.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={[
                                            'rounded-[22px] border border-border-subtle bg-white shadow-sm',
                                            'cursor-pointer transition hover:border-border-hover hover:bg-bg-secondary/40',
                                        ].join(' ')}
                                        onClick={() => {
                                            if (onSelectStudent) onSelectStudent(item);
                                        }}
                                    >
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{item.student_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                        </td>
                                        <td className="px-4 py-4 text-text-secondary">{item.class_label}</td>
                                        <td className="px-4 py-4"><Badge variant={item.priority >= 5 ? 'danger' : item.priority >= 3 ? 'warning' : 'info'}>{item.priority}</Badge></td>
                                        <td className="px-4 py-4 text-text-secondary">{(item.tags || []).join(' • ')}</td>
                                        <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatRisk(item.risk_score)}</td>
                                        <td className="px-4 py-4">
                                            <Button
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onViewCriteria) onViewCriteria(item);
                                                }}
                                            >
                                                Ver criterios
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
}

function InterventionSimulatorPanel({ data }) {
    const baseline = data?.baseline || {};
    const scenarios = data?.scenarios || [];
    const chartRows = scenarios.map((item) => ({
        cenario: item.label,
        risco: Math.round(Number(item.risk || 0) * 100),
    }));

    return (
        <Card>
            <CardHeader
                title="Simulador de intervencao"
                subtitle="Cenarios simples para entender o que pode reduzir o risco."
                icon={BrainCircuit}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Cenario', description: 'Um exemplo do que aconteceria se a turma melhorasse em um ponto.' },
                        { label: 'Mudanca de risco', description: 'Negativo = melhora (risco cai). Positivo = piora.' },
                    ]}
                />

                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-5">
                    <p className="text-sm font-semibold text-text-primary">Situacao atual (media do recorte)</p>
                    <p className="mt-2 text-sm text-text-secondary">
                        Nota: <span className="font-semibold text-text-primary">{Number(baseline.grade || 0).toFixed(2)}</span>
                        {'  '}Presenca: <span className="font-semibold text-text-primary">{formatPercent(baseline.attendance)}</span>
                        {'  '}Atividade: <span className="font-semibold text-text-primary">{formatPercent(baseline.activity)}</span>
                        {'  '}Risco: <span className="font-semibold text-text-primary">{formatRisk(baseline.risk)}</span>
                    </p>
                </div>

                {!scenarios.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda nao ha cenarios disponiveis.
                    </div>
                ) : (
                    <>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="cenario" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip />
                                    <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Risco (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Cenario</th>
                                        <th className="px-4">Risco</th>
                                        <th className="px-4">Mudou</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scenarios.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.label}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatRisk(item.risk)}</td>
                                            <td className="rounded-r-[20px] px-4 py-4">
                                                <Badge variant={Number(item.risk_change || 0) < 0 ? 'success' : Number(item.risk_change || 0) > 0 ? 'danger' : 'info'}>
                                                    {Number(item.risk_change_percent || 0) > 0 ? '+' : ''}{Number(item.risk_change_percent || 0).toFixed(2)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function MetricsHelp({ items }) {
    const safeItems = items || [];
    if (!safeItems.length) return null;

    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/40 px-5 py-5 text-sm text-text-secondary">
            <p className="text-sm font-semibold text-text-primary">O que significa cada numero?</p>
            <div className="mt-3 space-y-2">
                {safeItems.map((row) => (
                    <div key={row.label} className="leading-6">
                        <span className="font-semibold text-text-primary">{row.label}:</span> {row.description}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AnalysisMenu({ analyses, selectedAnalysis, onSelect }) {
    return (
        <Card className="h-fit lg:sticky lg:top-28">
            <CardHeader
                title="Analises academicas"
                subtitle="Escolha o tipo de leitura que deseja aprofundar."
                icon={Layers3}
            />

            <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {analyses.map((item) => {
                    const active = item.id === selectedAnalysis;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className={[
                                'min-w-[220px] rounded-[22px] border px-4 py-4 text-left transition-all duration-200 lg:min-w-0',
                                active
                                    ? 'border-accent-blue/25 bg-brand-gradient-soft shadow-glow-sm'
                                    : 'border-border-subtle bg-bg-secondary/40 hover:border-border-hover hover:bg-white',
                            ].join(' ')}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                {active && <ArrowRight className="h-4 w-4 text-accent-blue" />}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}

function AtRiskStudentsPanel({ title, subtitle, classLabel, rows, loading, error, onSelectStudent, onViewCriteria }) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} icon={ShieldAlert} />
            <div className="space-y-4">
                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/40 px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{classLabel || 'Selecione uma turma'}</p>
                    <p className="mt-1 text-sm text-text-secondary">Clique em um aluno para abrir o perfil detalhado.</p>
                </div>

                {loading ? (
                    <div className="rounded-[22px] border border-border-subtle bg-white px-6 py-10 text-sm text-text-secondary">
                        Carregando alunos em risco...
                    </div>
                ) : error ? (
                    <div className="rounded-[22px] border border-border-subtle bg-white px-6 py-10 text-sm text-danger">
                        {error}
                    </div>
                ) : !rows?.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-white/60 px-6 py-10 text-center text-sm text-text-secondary">
                        Nenhum aluno em risco alto/crítico encontrado para esta turma.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <MetricsHelp
                            items={[
                                { label: 'Nivel', description: 'Um resumo do risco. "Alto" e "critico" merecem atencao primeiro.' },
                                { label: 'Risco', description: 'Probabilidade de evasao (quanto maior, pior).'} ,
                                { label: 'Nota', description: 'Media de notas do aluno nessa turma.' },
                                { label: 'Presenca', description: 'Percentual de presenca (quanto maior, melhor).' },
                            ]}
                        />

                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rows.slice(0, 10).map((item) => ({
                                    aluno: item.student_name?.split(' ')[0] || item.student_name,
                                    risco: Math.round(Number(item.risk_score || 0) * 100),
                                    nota: Number(item.grade_average || 0),
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Risco (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Aluno</th>
                                    <th className="px-4">Nivel</th>
                                    <th className="px-4">Risco</th>
                                    <th className="px-4">Nota</th>
                                    <th className="px-4">Presenca</th>
                                    <th className="px-4">Criterios</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((item) => (
                                    <tr
                                        key={`${item.record_id}-${item.student_name}`}
                                        className="cursor-pointer rounded-[22px] border border-border-subtle bg-white shadow-sm transition hover:border-border-hover hover:bg-bg-secondary/40"
                                        onClick={() => onSelectStudent(item)}
                                    >
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{item.student_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                        </td>
                                        <td className="px-4 py-4"><Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge></td>
                                        <td className="px-4 py-4 text-text-secondary">{formatRisk(item.risk_score)}</td>
                                        <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.grade_average || 0).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-text-secondary">{formatPercent(item.attendance)}</td>
                                        <td className="rounded-r-[20px] px-4 py-4">
                                            <Button
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onViewCriteria) onViewCriteria(item);
                                                }}
                                            >
                                                Ver criterios
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

function BetweenClassesPanel({ title, subtitle, rows }) {
    const [classAId, setClassAId] = useState('');
    const [classBId, setClassBId] = useState('');

    useEffect(() => {
        if (!rows?.length) {
            setClassAId('');
            setClassBId('');
            return;
        }

        const firstId = rows[0]?.id || '';
        const secondId = rows[1]?.id || '';

        setClassAId((previous) => (
            previous && rows.some((item) => item.id === previous) ? previous : firstId
        ));
        setClassBId((previous) => {
            if (previous && rows.some((item) => item.id === previous) && previous !== firstId) {
                return previous;
            }
            return secondId && secondId !== firstId ? secondId : '';
        });
    }, [rows]);

    const classA = useMemo(() => rows.find((item) => item.id === classAId) || null, [rows, classAId]);
    const classB = useMemo(() => rows.find((item) => item.id === classBId) || null, [rows, classBId]);

    const comparisonRows = useMemo(() => {
        if (!classA || !classB) return [];
        const metrics = [
            { id: 'risk', label: 'Indice de risco', a: classA.risk_score, b: classB.risk_score, formatter: formatRisk, better: 'lower' },
            { id: 'grade', label: 'Nota media', a: classA.avg_grade, b: classB.avg_grade, formatter: (v) => Number(v || 0).toFixed(2), better: 'higher' },
            { id: 'attendance', label: 'Presenca media', a: classA.avg_attendance, b: classB.avg_attendance, formatter: formatPercent, better: 'higher' },
            { id: 'activity', label: 'Atividade media', a: classA.avg_activity, b: classB.avg_activity, formatter: formatPercent, better: 'higher' },
            { id: 'working', label: 'Trabalho', a: classA.working_share, b: classB.working_share, formatter: formatPercent, better: 'lower' },
        ];

        return metrics.map((item) => {
            const delta = Number(item.a || 0) - Number(item.b || 0);
            const aBetter = item.better === 'higher' ? delta > 0 : delta < 0;
            const bBetter = item.better === 'higher' ? delta < 0 : delta > 0;
            return {
                ...item,
                delta,
                aTone: aBetter ? 'success' : bBetter ? 'neutral' : 'info',
                bTone: bBetter ? 'success' : aBetter ? 'neutral' : 'info',
            };
        });
    }, [classA, classB]);

    const comparisonSummary = useMemo(() => {
        if (!classA || !classB || classAId === classBId) return '';

        const classAWins = comparisonRows.filter((row) => row.aTone === 'success').length;
        const classBWins = comparisonRows.filter((row) => row.bTone === 'success').length;

        if (classAWins === classBWins) {
            return 'As duas turmas estao equilibradas no recorte atual, entao vale olhar os detalhes de risco e atividade para decidir onde agir primeiro.';
        }

        const winner = classAWins > classBWins ? classA : classB;
        const loser = classAWins > classBWins ? classB : classA;
        const reason = comparisonRows.find((row) => (
            classAWins > classBWins ? row.aTone === 'success' : row.bTone === 'success'
        ));

        return `${winner.label} leva vantagem sobre ${loser.label} principalmente por ${String(reason?.label || 'um conjunto mais consistente de indicadores').toLowerCase()}.`;
    }, [classA, classAId, classB, classBId, comparisonRows]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title={title} subtitle={subtitle} icon={Users} />
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Turma A</span>
                        <select
                            value={classAId}
                            onChange={(event) => setClassAId(event.target.value)}
                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                        >
                            <option value="">Selecione</option>
                            {rows.map((item) => (
                                <option key={item.id} value={item.id}>{formatClassLabel(item)}</option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Turma B</span>
                        <select
                            value={classBId}
                            onChange={(event) => setClassBId(event.target.value)}
                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                        >
                            <option value="">Selecione</option>
                            {rows.map((item) => (
                                <option key={item.id} value={item.id}>{formatClassLabel(item)}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {classAId && classBId && classAId === classBId && (
                    <p className="mt-4 text-sm text-danger">Selecione duas turmas diferentes para comparar.</p>
                )}
            </Card>

            {!classA || !classB || classAId === classBId ? (
                <Card>
                    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 text-center">
                        <Users className="h-10 w-10 text-accent-blue" />
                        <p className="mt-5 text-lg font-semibold text-text-primary">Selecione duas turmas</p>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
                            Escolha Turma A e Turma B para exibir o comparativo entre risco, nota, presenca e atividade.
                        </p>
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardHeader
                        title="Comparativo objetivo"
                        subtitle={`${classA.label} vs ${classB.label}`}
                        icon={BarChart3}
                    />
                    <div className="mx-6 rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Leitura rapida:</span> {comparisonSummary}
                    </div>
                    <div className="px-6 pb-2 text-sm text-text-secondary">
                        Diferença = quanto a Turma A está acima ou abaixo da Turma B.
                    </div>

                    <div className="px-6">
                        <MetricsHelp
                            items={[
                                { label: 'Indice de risco', description: 'Chance de evasao (menor e melhor).' },
                                { label: 'Nota media', description: 'Media de notas da turma (maior e melhor).' },
                                { label: 'Presenca media', description: 'Media de presenca (maior e melhor).' },
                                { label: 'Atividade media', description: 'Indicador de entregas/atividades (maior e melhor).' },
                                { label: 'Trabalho', description: 'Percentual de alunos que trabalham (pode aumentar dificuldade de acompanhar).' },
                            ]}
                        />
                    </div>

                    <div className="h-72 px-6 pt-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparisonRows.map((row) => ({
                                    metrica: row.label,
                                    turmaA: row.id === 'risk' ? Math.round(Number(row.a || 0) * 100) : Number(row.a || 0),
                                    turmaB: row.id === 'risk' ? Math.round(Number(row.b || 0) * 100) : Number(row.b || 0),
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="metrica" tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="turmaA" fill="#0B57D0" radius={[10, 10, 0, 0]} name="Turma A" />
                                <Bar dataKey="turmaB" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Turma B" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">O que estamos comparando</th>
                                    <th className="px-4">Turma A</th>
                                    <th className="px-4">Turma B</th>
                                    <th className="px-4">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonRows.map((row) => (
                                    <tr key={row.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                        <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{row.label}</td>
                                        <td className="px-4 py-4"><Badge variant={row.aTone}>{row.formatter(row.a)}</Badge></td>
                                        <td className="px-4 py-4"><Badge variant={row.bTone}>{row.formatter(row.b)}</Badge></td>
                                        <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                            {row.delta > 0 ? '+' : ''}{row.id === 'risk' ? `${(row.delta * 100).toFixed(1)}%` : row.id === 'attendance' || row.id === 'activity' || row.id === 'working' ? `${row.delta.toFixed(1)}%` : row.delta.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }) {
    return (
        <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
            >
                <option value="">Todos</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}

function MetricGrid({ overview, isCoordinator }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Registros" value={overview.total_records} helper={`${overview.total_students} alunos mapeados`} icon={BarChart3} tone="blue" />
            <MetricCard title="Media de notas" value={overview.avg_grade?.toFixed(2)} helper={`${overview.total_classes} turmas observadas`} icon={CheckCircle2} tone="indigo" />
            <MetricCard title="Presenca media" value={formatPercent(overview.avg_attendance)} helper="Leitura consolidada da base" icon={Users} tone="emerald" />
            <MetricCard title="Atividade media" value={formatPercent(overview.avg_activity)} helper="Engajamento e entregas avaliativas" icon={BookOpen} tone="purple" />
            <MetricCard
                title={isCoordinator ? 'Turmas criticas' : 'Risco medio'}
                value={isCoordinator ? overview.critical_classes : formatRisk(overview.avg_risk)}
                helper={isCoordinator ? 'Turmas exigindo intervencao no curso' : `${overview.working_students || 0} alunos conciliam trabalho e estudo`}
                icon={ShieldAlert}
                tone="amber"
            />
        </div>
    );
}

function OverviewPanel({ workspace, isCoordinator }) {
    const chartData = workspace.analysis_data.high_risk_classes.slice(0, 6).map((item) => ({
        turma: item.label,
        risco: Math.round(item.risk_score * 100),
        nota: item.avg_grade,
        presenca: item.avg_attendance,
    }));
    const topTopics = workspace.analysis_data.risk_topics.slice(0, 4);

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                    <CardHeader
                        title="Mapa executivo de risco"
                        subtitle="Leitura priorizada das turmas com maior necessidade de acompanhamento."
                        icon={BrainCircuit}
                    />
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="turma" tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} fontSize={12} width={34} />
                                <Tooltip />
                                <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title={isCoordinator ? 'Leituras prioritarias do curso' : 'Leituras prioritarias do professor'}
                        subtitle="Sinais combinados de nota, presenca, atividades e contexto."
                        icon={Lightbulb}
                    />
                    <div className="space-y-4">
                        {topTopics.map((item) => (
                            <div key={item.id} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                        <p className="mt-1 text-sm text-text-secondary">{item.type}</p>
                                    </div>
                                    <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-text-secondary">{item.signal}</p>
                                <p className="mt-2 text-sm text-text-secondary">{item.evidence}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function ClassesPanel({ title, subtitle, rows, comparison = false, onSelectRow }) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} icon={Users} />
            <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            <th className="px-4">Turma</th>
                            <th className="px-4">Semestre</th>
                            <th className="px-4">Nota</th>
                            <th className="px-4">Presenca</th>
                            <th className="px-4">Atividade</th>
                            <th className="px-4">Trabalho</th>
                            <th className="px-4">Nivel</th>
                            <th className="px-4">{comparison ? 'Delta de risco' : 'Indice de risco'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item) => (
                            <tr
                                key={item.id}
                                className={[
                                    'rounded-[22px] border border-border-subtle bg-white shadow-sm',
                                    onSelectRow ? 'cursor-pointer transition hover:border-border-hover hover:bg-bg-secondary/40' : '',
                                ].join(' ')}
                                onClick={onSelectRow ? () => onSelectRow(item) : undefined}
                            >
                                <td className="rounded-l-[20px] px-4 py-4">
                                    <p className="font-semibold text-text-primary">{item.label}</p>
                                    <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                </td>
                                <td className="px-4 py-4 text-text-secondary">{item.semester}</td>
                                <td className="px-4 py-4 font-semibold text-text-primary">{item.avg_grade.toFixed(2)}</td>
                                <td className="px-4 py-4 text-text-secondary">{formatPercent(item.avg_attendance)}</td>
                                <td className="px-4 py-4 text-text-secondary">{formatPercent(item.avg_activity)}</td>
                                <td className="px-4 py-4 text-text-secondary">{formatPercent(item.working_share)}</td>
                                <td className="px-4 py-4"><Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge></td>
                                <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                    {comparison ? `${(item.risk_delta * 100).toFixed(1)}%` : formatRisk(item.risk_score)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function SemesterPanel({ rows }) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="Evolucao por semestre"
                    subtitle="Mudancas de nota, risco, engajamento e contexto ao longo dos periodos."
                    icon={CalendarRange}
                />
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={rows}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="semester" tickLine={false} axisLine={false} fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} fontSize={12} width={34} />
                            <Tooltip />
                            <Line type="monotone" dataKey="avg_grade" stroke="#0B57D0" strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="avg_risk" stroke="#6A1BFF" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((item) => (
                    <Card key={item.id}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-text-primary">{item.semester}</p>
                                <p className="mt-1 text-sm text-text-secondary">{item.records} registros analisados</p>
                            </div>
                            <Badge variant={getRiskVariant(item.avg_risk >= 0.75 ? 'critical' : item.avg_risk >= 0.58 ? 'high' : item.avg_risk >= 0.38 ? 'medium' : 'low')}>
                                {formatRisk(item.avg_risk)}
                            </Badge>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                            <StatBox label="Nota" value={item.avg_grade.toFixed(2)} helper={`${item.grade_delta.toFixed(2)} de delta`} />
                            <StatBox label="Trabalho" value={formatPercent(item.working_share)} helper="Alunos que conciliam trabalho" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function RiskTopicsPanel({ rows }) {
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((item) => (
                <Card key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-base font-semibold text-text-primary">{item.label}</p>
                            <p className="mt-1 text-sm text-text-secondary">
                                {item.type} • {item.semester}
                            </p>
                        </div>
                        <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-text-secondary">{item.signal}</p>
                    <p className="mt-3 text-sm text-text-secondary">{item.evidence}</p>
                    <div className="mt-4 rounded-2xl bg-bg-secondary/50 p-4 text-sm leading-6 text-text-secondary">
                        {item.recommendation}
                    </div>
                </Card>
            ))}
        </div>
    );
}

function DisciplinePanel({ rows }) {
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((item) => (
                <Card key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-base font-semibold text-text-primary">{item.label}</p>
                            <p className="mt-1 text-sm text-text-secondary">{item.records} registros consolidados</p>
                        </div>
                        <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <StatBox label="Nota media" value={item.avg_grade.toFixed(2)} />
                        <StatBox label="Presenca" value={formatPercent(item.avg_attendance)} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-text-secondary">{item.recommended_focus}</p>
                </Card>
            ))}
        </div>
    );
}

function PrioritiesPanel({ rows }) {
    return (
        <div className="space-y-4">
            {rows.map((item, index) => (
                <Card key={item.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-semibold text-white">
                                    {index + 1}
                                </span>
                                <div>
                                    <p className="text-base font-semibold text-text-primary">{item.label}</p>
                                    <p className="mt-1 text-sm text-text-secondary">{item.course_name} • {item.semester}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {item.recommended_actions.map((action) => (
                                    <Badge key={action} variant="info">{action}</Badge>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
                            <StatBox label="Prioridade" value={item.priority_index.toFixed(2)} />
                            <StatBox label="Risco" value={formatRisk(item.risk_score)} />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function StatBox({ label, value, helper }) {
    return (
        <div className="rounded-2xl bg-bg-secondary/50 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
            {helper && <p className="mt-1 text-sm text-text-secondary">{helper}</p>}
        </div>
    );
}

export function AnalysisCenter() {
    const { user } = useAuth();
    const role = user?.role?.toLowerCase();
    const isCoordinator = role === 'coordinator';
    const historyRoute = isProfessorLikeRole(role) ? buildRolePath(role, 'historical-data') : '/coordinator/dashboard';
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const [workspace, setWorkspace] = useState(null);
    const [selectedAnalysis, setSelectedAnalysis] = useState(searchParams.get('analysis') || 'overview');
    const [selectedSemester, setSelectedSemester] = useState(searchParams.get('semester') || '');
    const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course_name') || '');
    const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exportingFormat, setExportingFormat] = useState('');
    const [exportError, setExportError] = useState('');

    const [selectedClass, setSelectedClass] = useState(null);
    const [atRiskLoading, setAtRiskLoading] = useState(false);
    const [atRiskError, setAtRiskError] = useState('');
    const [atRiskStudents, setAtRiskStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    const [criteriaModalItem, setCriteriaModalItem] = useState(null);

    const [showDetails, setShowDetails] = useState(false);
    const [openSection, setOpenSection] = useState('action');

    const detailsResultRef = useRef(null);

    const [intentQuery, setIntentQuery] = useState('');
    const [analysisFilterQuery, setAnalysisFilterQuery] = useState('');
    const [intentAllowedAnalyses, setIntentAllowedAnalyses] = useState(null);

    const [showIntro, setShowIntro] = useState(false);

    const analyses = workspace?.available_analyses || [];
    const hasRecords = Number(workspace?.overview?.total_records || 0) > 0;

    const analysesById = useMemo(() => {
        const map = new Map();
        (analyses || []).forEach((item) => map.set(item.id, item));
        return map;
    }, [analyses]);

    const analysisGroups = useMemo(() => {
        const sections = [
            {
                id: 'action',
                title: 'Acao (o que fazer agora)',
                description: 'Para agir agora: localizar alunos/turmas com risco e decidir quem priorizar.',
                analysisIds: ['by_class', 'early_alerts', 'intervention_priorities'],
            },
            {
                id: 'explain',
                title: 'Explicacao (por que isso esta acontecendo?)',
                description: 'Entenda os motivos: quais fatores estao puxando o risco e quais perfis de alunos existem.',
                analysisIds: ['risk_factors', 'student_segments', 'intervention_simulator'],
            },
            {
                id: 'trend',
                title: 'Tendencia e previsao',
                description: 'Veja evolucao e previsao simples para agir cedo antes do risco virar critico.',
                analysisIds: ['student_trends', 'risk_projection', 'by_semester'],
            },
            {
                id: 'compare',
                title: 'Comparacao',
                description: 'Compare turmas/semestres e visualize rapidamente onde estao os problemas.',
                analysisIds: ['between_classes', 'discipline_risk', 'heatmap', 'risk_topics', 'discipline_bottlenecks'],
            },
        ];

        const allowedSet = intentAllowedAnalyses?.length ? new Set(intentAllowedAnalyses) : null;

        return sections
            .map((section) => {
                const available = section.analysisIds
                    .map((id) => analysesById.get(id))
                    .filter(Boolean);
                const filteredAvailable = allowedSet
                    ? available.filter((item) => allowedSet.has(item.id))
                    : available;
                return {
                    ...section,
                    available: filteredAvailable,
                };
            })
            .filter((section) => section.available.length > 0);
    }, [analysesById, intentAllowedAnalyses]);

    const analysisCounts = useMemo(() => {
        const data = workspace?.analysis_data;
        return {
            early_alerts: Array.isArray(data?.early_alerts) ? data.early_alerts.length : 0,
            by_class: Array.isArray(data?.by_class) ? data.by_class.length : 0,
            between_classes: Array.isArray(data?.between_classes) ? data.between_classes.length : 0,
            risk_topics: Array.isArray(data?.risk_topics) ? data.risk_topics.length : 0,
        };
    }, [workspace]);

    const filteredAnalysisData = useMemo(() => {
        const data = workspace?.analysis_data;
        const query = (analysisFilterQuery || '').trim().toLowerCase();
        if (!data || !query) return data;

        function includesText(value) {
            return String(value || '').toLowerCase().includes(query);
        }

        return {
            ...data,
            early_alerts: (data.early_alerts || []).filter((row) => {
                const tagsText = Array.isArray(row.tags) ? row.tags.join(' ') : '';
                return includesText(row.student_name) || includesText(row.class_label) || includesText(tagsText) || includesText(row.course_name);
            }),
            risk_projection: (data.risk_projection || []).filter((row) => includesText(row.student_name)),
            student_trends: (data.student_trends || []).filter((row) => includesText(row.student_name)),
            risk_factors: (data.risk_factors || []).filter((row) => includesText(row.label) || includesText(row.key)),
            student_segments: (data.student_segments || []).filter((row) => includesText(row.label)),
            by_class: (data.by_class || []).filter((row) => includesText(row.label) || includesText(row.subject) || includesText(row.semester)),
            between_classes: (data.between_classes || []).filter((row) => includesText(row.label) || includesText(row.subject) || includesText(row.semester)),
            risk_topics: (data.risk_topics || []).filter((row) => includesText(row.title) || includesText(row.subject) || includesText(row.label)),
            discipline_bottlenecks: (data.discipline_bottlenecks || []).filter((row) => includesText(row.label) || includesText(row.subject)),
            heatmap: {
                ...(data.heatmap || {}),
                classes: (data.heatmap?.classes || []).filter((row) => includesText(row.label) || includesText(row.semester)),
            },
        };
    }, [workspace, analysisFilterQuery]);

    useEffect(() => {
        if (selectedAnalysis !== 'by_class') return;
        if (selectedClass?.id) return;

        const firstClass = (filteredAnalysisData?.by_class || workspace?.analysis_data?.by_class || [])[0];
        if (firstClass?.id) {
            handleSelectClass(firstClass);
        }
    }, [filteredAnalysisData, selectedAnalysis, selectedClass, workspace]);

    function routeIntent(rawQuery) {
        const q = String(rawQuery || '').toLowerCase();
        const rules = [
            {
                keys: ['precoce', 'precoces', 'alerta', 'alertas'],
                section: 'action',
                analysis: 'early_alerts',
                allowed: ['early_alerts', 'by_class', 'risk_factors'],
            },
            {
                keys: ['risco alto', 'alto risco', 'critico', 'criticos'],
                section: 'action',
                analysis: 'by_class',
                allowed: ['by_class', 'early_alerts', 'intervention_priorities', 'risk_topics', 'discipline_risk'],
            },
            { keys: ['turma', 'turmas'], section: 'action', analysis: 'by_class' },
            {
                keys: ['fator', 'fatores', 'motivo', 'causa', 'porque', 'por que'],
                section: 'explain',
                analysis: 'risk_factors',
                allowed: ['risk_factors', 'early_alerts', 'by_class', 'risk_topics', 'discipline_risk'],
            },
            {
                keys: ['segmento', 'segmentos', 'perfil', 'perfis'],
                section: 'explain',
                analysis: 'student_segments',
                allowed: ['student_segments', 'risk_factors', 'early_alerts'],
            },
            { keys: ['simulador', 'intervencao', 'intervenção', 'impacto'], section: 'explain', analysis: 'intervention_simulator' },
            { keys: ['tendencia', 'tendencias', 'evolucao', 'evolução'], section: 'trend', analysis: 'student_trends' },
            { keys: ['projecao', 'projetar', 'futuro', '8 semanas', '4 semanas'], section: 'trend', analysis: 'risk_projection' },
            { keys: ['semestre', 'semestres'], section: 'trend', analysis: 'by_semester' },
            { keys: ['comparar', 'comparacao', 'entre turmas'], section: 'compare', analysis: 'between_classes' },
            {
                keys: ['mapa', 'calor', 'heatmap'],
                section: 'compare',
                analysis: 'heatmap',
                allowed: ['heatmap', 'between_classes', 'by_class'],
            },
            {
                keys: ['assunto', 'assuntos', 'topico', 'topicos'],
                section: 'compare',
                analysis: 'risk_topics',
                allowed: ['risk_topics', 'discipline_risk', 'discipline_bottlenecks', 'heatmap', 'by_class'],
            },
            { keys: ['gargalo', 'gargalos', 'disciplina', 'disciplinas'], section: 'compare', analysis: 'discipline_bottlenecks' },
        ];

        const match = rules.find((rule) => rule.keys.some((key) => q.includes(key)));
        if (match) return match;
        return { section: 'action', analysis: 'early_alerts' };
    }

    function handleIntentSearch(nextQuery) {
        const trimmed = String(nextQuery || '').trim();
        if (!trimmed) {
            setAnalysisFilterQuery('');
            setIntentAllowedAnalyses(null);
            return;
        }

        const { section, analysis } = routeIntent(trimmed);
        const resolved = routeIntent(trimmed);
        setIntentAllowedAnalyses(Array.isArray(resolved.allowed) ? resolved.allowed : null);
        setAnalysisFilterQuery(trimmed);
        setShowDetails(true);
        setOpenSection(section);
        setSelectedAnalysis(analysis);
    }

    const visibleAnalyses = useMemo(() => {
        if (!intentAllowedAnalyses?.length) return analyses;
        const allow = new Set(intentAllowedAnalyses);
        return (analyses || []).filter((item) => allow.has(item.id));
    }, [analyses, intentAllowedAnalyses]);

    useEffect(() => {
        async function fetchWorkspace() {
            setLoading(true);
            setError('');
            try {
                const response = await api.get('/historical-data/analysis-workspace', {
                    params: {
                        semester: selectedSemester || undefined,
                        course_name: selectedCourse || undefined,
                        subject: selectedSubject || undefined,
                    },
                });
                setWorkspace(response.data);
            } catch (requestError) {
                setError(requestError.response?.data?.detail || 'Nao foi possivel carregar a central analitica.');
            } finally {
                setLoading(false);
            }
        }

        fetchWorkspace();
    }, [selectedSemester, selectedCourse, selectedSubject]);

    useEffect(() => {
        const shouldOpen = Boolean(location?.state?.openAnalysisIntro);
        if (!shouldOpen) return;
        if (!workspace || !hasRecords) return;
        setShowIntro(true);
        window.history.replaceState({}, document.title);
    }, [location?.state?.openAnalysisIntro, workspace, hasRecords]);

    useEffect(() => {
        setSelectedClass(null);
        setAtRiskStudents([]);
        setAtRiskError('');
    }, [selectedSemester, selectedCourse, selectedSubject, selectedAnalysis]);

    function scrollToResults() {
        if (!detailsResultRef.current) return;
        requestAnimationFrame(() => {
            detailsResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    async function handleOpenStudent(item) {
        const directId = item?.student_id;
        if (directId) {
            setSelectedStudentId(directId);
            return;
        }

        const name = String(item?.student_name || '').trim();
        if (!name) return;

        try {
            const response = await api.get('/api/students', {
                params: {
                    search: name,
                    limit: 1,
                },
            });
            const resolvedId = response.data?.students?.[0]?.id;
            if (resolvedId) setSelectedStudentId(resolvedId);
        } catch (requestError) {
            // silently ignore (no access / no match)
        }
    }

    async function handleSelectClass(item) {
        setSelectedClass(item);
        setAtRiskError('');
        if (!item?.id) return;

        if (Array.isArray(item.at_risk_students) && item.at_risk_students.length) {
            setAtRiskStudents(item.at_risk_students.slice(0, 4));
            setAtRiskLoading(false);
            return;
        }

        setAtRiskStudents([]);

        setAtRiskLoading(true);
        try {
            const response = await api.get('/historical-data/analysis-workspace/at-risk-students', {
                params: {
                    class_key: item.id,
                    semester: selectedSemester || undefined,
                    course_name: selectedCourse || undefined,
                    subject: selectedSubject || undefined,
                    limit: 4,
                },
            });
            setAtRiskStudents((response.data?.students || []).slice(0, 4));
        } catch (requestError) {
            setAtRiskError(requestError.response?.data?.detail || 'Nao foi possivel carregar alunos em risco.');
        } finally {
            setAtRiskLoading(false);
        }
    }

    useEffect(() => {
        const next = {};
        if (selectedAnalysis) next.analysis = selectedAnalysis;
        if (selectedSemester) next.semester = selectedSemester;
        if (selectedCourse) next.course_name = selectedCourse;
        if (selectedSubject) next.subject = selectedSubject;
        setSearchParams(next, { replace: true });
    }, [selectedAnalysis, selectedSemester, selectedCourse, selectedSubject, setSearchParams]);

    useEffect(() => {
        if (!workspace?.available_analyses?.length) return;
        const exists = workspace.available_analyses.some((item) => item.id === selectedAnalysis);
        if (!exists) setSelectedAnalysis(workspace.available_analyses[0].id);
    }, [workspace, selectedAnalysis]);

    async function handleExport(format) {
        try {
            setExportingFormat(format);
            setExportError('');
            const response = await api.get('/historical-data/analysis-workspace/export', {
                params: {
                    analysis_id: selectedAnalysis,
                    export_format: format,
                    semester: selectedSemester || undefined,
                    course_name: selectedCourse || undefined,
                    subject: selectedSubject || undefined,
                },
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const contentDisposition = response.headers['content-disposition'] || '';
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
            link.href = url;
            link.download = filenameMatch?.[1] || `nexora-${selectedAnalysis}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (requestError) {
            setExportError(requestError.response?.data?.detail || 'Nao foi possivel exportar a analise selecionada.');
        } finally {
            setExportingFormat('');
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Analises academicas" subtitle="Consolidando notas, presenca, atividades e risco em uma leitura unica." icon={BarChart3} />
                <Card className="min-h-[320px]">
                    <div className="flex flex-1 items-center justify-center gap-3 text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
                        Carregando analises...
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={AlertTriangle}
                title="Nao foi possivel abrir as analises academicas"
                description={error}
                action={<Button onClick={() => window.location.reload()}>Tentar novamente</Button>}
            />
        );
    }

    return (
        <div className="space-y-6">
            <AnalysisIntroModal
                open={showIntro}
                analyses={analyses}
                onSelect={(nextId) => {
                    setSelectedAnalysis(nextId);
                    setShowIntro(false);
                }}
                onClose={() => {
                    setShowIntro(false);
                }}
            />
            <PageHeader
                title={isCoordinator ? 'Analises academicas do curso' : 'Analises academicas'}
                subtitle={workspace?.scope?.description || 'Leitura comparativa baseada nos arquivos historicos enviados.'}
                icon={BarChart3}
                actions={(
                    <>
                        <Badge variant="info">{workspace?.scope?.label}</Badge>
                        {hasRecords && (
                            <div className="relative group">
                                <Button variant="outline" icon={Filter} aria-label="Filtros" />
                                <div className="absolute right-0 top-full z-50 mt-2 w-[min(520px,calc(100vw-2rem))] translate-y-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                                    <div className="rounded-[22px] border border-border-subtle bg-white p-4 shadow-card">
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <FilterSelect label="Semestre" value={selectedSemester} onChange={setSelectedSemester} options={workspace?.filters?.semesters || []} />
                                            <FilterSelect label="Curso" value={selectedCourse} onChange={setSelectedCourse} options={workspace?.filters?.courses || []} />
                                            <FilterSelect label="Disciplina" value={selectedSubject} onChange={setSelectedSubject} options={workspace?.filters?.subjects || []} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {workspace?.scope?.can_upload && (
                            <Link to={historyRoute}>
                                <Button variant="secondary" icon={Upload}>Subir novo arquivo</Button>
                            </Link>
                        )}
                    </>
                )}
            />

            {hasRecords && (
                <Card>
                    <CardHeader
                        title="Escolha a analise"
                        subtitle="Selecione o tipo de leitura que deseja ver agora."
                        icon={Layers3}
                    />
                    <div className="flex flex-wrap gap-3">
                        {(visibleAnalyses || []).slice(0, 6).map((tab) => (
                            <Button
                                key={tab.id}
                                variant={selectedAnalysis === tab.id ? 'secondary' : 'outline'}
                                onClick={() => {
                                    setSelectedAnalysis(tab.id);
                                    setShowDetails(true);
                                }}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>
                </Card>
            )}

            {hasRecords && (
                <Card>
                    <CardHeader title="Area de exportacao" subtitle="Exporte o recorte atual em diferentes formatos." icon={Download} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3">
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'pdf'} onClick={() => handleExport('pdf')}>Exportar PDF</Button>
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'csv'} onClick={() => handleExport('csv')}>Exportar CSV</Button>
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'xlsx'} onClick={() => handleExport('xlsx')}>Exportar XLSX</Button>
                            <Button variant="outline" icon={Download} loading={exportingFormat === 'json'} onClick={() => handleExport('json')}>Exportar JSON</Button>
                        </div>
                    </div>
                    {exportError && <p className="mt-4 text-sm text-danger">{exportError}</p>}
                </Card>
            )}

            {!hasRecords ? (
                <EmptyState
                    icon={Upload}
                    title={workspace?.scope?.can_upload ? 'Nenhum arquivo historico foi analisado ainda' : 'Ainda nao ha base historica disponivel para este recorte'}
                    description={workspace?.scope?.can_upload
                        ? 'Envie um PDF ou planilha historica para liberar as cinco analises academicas do professor.'
                        : 'Quando os professores enviarem bases historicas, a coordenacao podera comparar turmas e priorizar intervencoes.'}
                    action={workspace?.scope?.can_upload ? (
                        <Link to={historyRoute}>
                            <Button icon={Upload}>Ir para upload historico</Button>
                        </Link>
                    ) : null}
                />
            ) : (
                <>
                    <MinimalOverview overview={workspace.overview} classes={workspace.analysis_data.high_risk_classes} />

                    <motion.div
                        ref={detailsResultRef}
                        key={selectedAnalysis}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24 }}
                        className="space-y-6"
                    >
                        {selectedAnalysis === 'overview' && <OverviewPanel workspace={workspace} isCoordinator={isCoordinator} />}
                        {selectedAnalysis === 'by_class' && (
                            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                                <ClassesPanel
                                    title="Analise por turma"
                                    subtitle="Clique em uma turma para ver os alunos com maior risco de evasao."
                                    rows={filteredAnalysisData?.by_class || workspace.analysis_data.by_class}
                                    onSelectRow={handleSelectClass}
                                />
                                <AtRiskStudentsPanel
                                    title="Alunos em risco"
                                    subtitle="Ate quatro alunos com maior necessidade de intervencao neste recorte."
                                    classLabel={selectedClass ? formatClassLabel(selectedClass) : ''}
                                    rows={atRiskStudents}
                                    loading={atRiskLoading}
                                    error={atRiskError}
                                    onSelectStudent={(student) => {
                                        if (student?.student_id) setSelectedStudentId(student.student_id);
                                    }}
                                    onViewCriteria={(item) => setCriteriaModalItem(item)}
                                />
                            </div>
                        )}
                        {selectedAnalysis === 'between_classes' && (
                            <BetweenClassesPanel
                                title="Analise entre turmas"
                                subtitle="Selecione duas turmas do seu recorte para comparar."
                                rows={filteredAnalysisData?.between_classes || workspace.analysis_data.between_classes}
                            />
                        )}
                        {selectedAnalysis === 'by_semester' && <SemesterPanel rows={workspace.analysis_data.by_semester} />}
                        {selectedAnalysis === 'risk_topics' && <RiskTopicsPanel rows={filteredAnalysisData?.risk_topics || workspace.analysis_data.risk_topics} />}
                        {selectedAnalysis === 'discipline_risk' && <DisciplineRiskPanel rows={workspace.analysis_data.discipline_risk} />}
                        {selectedAnalysis === 'discipline_bottlenecks' && <DisciplinePanel rows={filteredAnalysisData?.discipline_bottlenecks || workspace.analysis_data.discipline_bottlenecks} />}
                        {selectedAnalysis === 'intervention_priorities' && <PrioritiesPanel rows={workspace.analysis_data.intervention_priorities} />}
                        {selectedAnalysis === 'student_trends' && <StudentTrendsPanel rows={filteredAnalysisData?.student_trends || workspace.analysis_data.student_trends} />}
                        {selectedAnalysis === 'risk_factors' && (
                            <RiskFactorsPanel
                                rows={filteredAnalysisData?.risk_factors || workspace.analysis_data.risk_factors}
                                diagnostics={workspace.analysis_data.model_diagnostics || workspace.overview?.model_diagnostics}
                            />
                        )}
                        {selectedAnalysis === 'early_alerts' && (
                            <EarlyAlertsPanel
                                rows={filteredAnalysisData?.early_alerts || workspace.analysis_data.early_alerts}
                                onSelectStudent={(item) => handleOpenStudent(item)}
                                onViewCriteria={(item) => setCriteriaModalItem(item)}
                            />
                        )}
                        {selectedAnalysis === 'intervention_simulator' && <InterventionSimulatorPanel data={workspace.analysis_data.intervention_simulator} />}
                        {selectedAnalysis === 'student_segments' && <StudentSegmentsPanel rows={filteredAnalysisData?.student_segments || workspace.analysis_data.student_segments} />}
                        {selectedAnalysis === 'risk_projection' && <RiskProjectionPanel rows={filteredAnalysisData?.risk_projection || workspace.analysis_data.risk_projection} />}
                        {selectedAnalysis === 'heatmap' && <HeatmapPanel data={filteredAnalysisData?.heatmap || workspace.analysis_data.heatmap} />}
                    </motion.div>

                    <Card>
                        <CardHeader
                            title="Detalhes complementares"
                            subtitle="Abra somente o que voce precisa agora (evita excesso de informacao)."
                            icon={Layers3}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant={showDetails ? 'secondary' : 'outline'}
                                onClick={() => setShowDetails((prev) => !prev)}
                            >
                                {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </Button>

                            <div className="flex flex-1 flex-wrap items-center gap-2">
                                <div className="relative min-w-[260px] flex-1">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                    <input
                                        value={intentQuery}
                                        onChange={(e) => setIntentQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleIntentSearch(intentQuery);
                                            }
                                        }}
                                        placeholder="Buscar: 'precoces', 'alto risco', 'presenca baixa', 'projecao'..."
                                        className="h-11 w-full rounded-2xl border border-border-subtle bg-white pl-11 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleIntentSearch(intentQuery)}
                                >
                                    Buscar
                                </Button>
                                {analysisFilterQuery && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIntentQuery('');
                                            setAnalysisFilterQuery('');
                                            setIntentAllowedAnalyses(null);
                                        }}
                                    >
                                        Limpar
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Badge variant="info" className="cursor-pointer" onClick={() => { setIntentQuery('precoces'); handleIntentSearch('precoces'); }}>Precoces</Badge>
                            <Badge variant="info" className="cursor-pointer" onClick={() => { setIntentQuery('alto risco'); handleIntentSearch('alto risco'); }}>Alto risco</Badge>
                            <Badge variant="info" className="cursor-pointer" onClick={() => { setIntentQuery('fatores'); handleIntentSearch('fatores'); }}>Fatores</Badge>
                            <Badge variant="info" className="cursor-pointer" onClick={() => { setIntentQuery('mapa de calor'); handleIntentSearch('mapa de calor'); }}>Mapa de calor</Badge>
                        </div>
                    </Card>

                    {showDetails && (
                        <div className="space-y-4">
                            {analysisGroups.map((section) => {
                                const isOpen = openSection === section.id;
                                const hasSelectedInsideSection = section.available.some((item) => item.id === selectedAnalysis);
                                const sectionBadges = [];
                                if (section.id === 'action') {
                                    if (analysisCounts.early_alerts) sectionBadges.push({ id: 'alerts', label: `${analysisCounts.early_alerts} alertas` });
                                    if (analysisCounts.by_class) sectionBadges.push({ id: 'classes', label: `${analysisCounts.by_class} turmas` });
                                }
                                if (section.id === 'compare') {
                                    if (analysisCounts.between_classes) sectionBadges.push({ id: 'between', label: `${analysisCounts.between_classes} turmas` });
                                    if (analysisCounts.risk_topics) sectionBadges.push({ id: 'topics', label: `${analysisCounts.risk_topics} assuntos` });
                                }
                                return (
                                    <Card key={section.id}>
                                        <div className="flex flex-col gap-4 rounded-[24px] px-6 py-6 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Secao</p>
                                                <h3 className="mt-2 text-lg font-semibold text-text-primary">{section.title}</h3>
                                                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{section.description}</p>
                                                {sectionBadges.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {sectionBadges.map((badge) => (
                                                            <Badge key={badge.id} variant="info">{badge.label}</Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant={isOpen ? 'secondary' : 'outline'}
                                                onClick={() => {
                                                    const nextOpen = isOpen ? '' : section.id;
                                                    setOpenSection(nextOpen);
                                                    if (!isOpen) setShowDetails(true);
                                                }}
                                            >
                                                {isOpen ? 'Fechar' : 'Abrir'}
                                            </Button>
                                        </div>

                                        {isOpen && (
                                            <div className="space-y-4 px-6 pb-6">
                                                <div className="flex flex-wrap gap-2">
                                                    {section.available.map((item) => (
                                                        <Button
                                                            key={item.id}
                                                            variant={selectedAnalysis === item.id ? 'secondary' : 'outline'}
                                                            onClick={() => {
                                                                setSelectedAnalysis(item.id);
                                                                setShowDetails(true);
                                                                setOpenSection(section.id);
                                                                scrollToResults();
                                                            }}
                                                        >
                                                            {item.label}
                                                        </Button>
                                                    ))}
                                                </div>

                                                {analysesById.get(selectedAnalysis)?.description && (
                                                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                                                        <span className="font-semibold text-text-primary">Esta analise mostra:</span> {analysesById.get(selectedAnalysis)?.description}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />

            {criteriaModalItem && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-border-subtle bg-white shadow-card-hover">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-white p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Criterios do risco</p>
                                <h2 className="mt-2 text-xl font-semibold text-text-primary">{criteriaModalItem.student_name}</h2>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Mostra quais fatores puxaram o risco para cima neste registro.</p>
                            </div>
                            <Button variant="outline" onClick={() => setCriteriaModalItem(null)}>Fechar</Button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-6">
                            <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                                <span className="font-semibold text-text-primary">Risco:</span> {formatRisk(criteriaModalItem.risk_score)}
                                {criteriaModalItem.priority !== undefined && criteriaModalItem.priority !== null && (
                                    <>
                                        {'  '}<span className="font-semibold text-text-primary">Prioridade:</span> {criteriaModalItem.priority}
                                    </>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                            <th className="px-4">Fator</th>
                                            <th className="px-4">Peso no risco</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(criteriaModalItem.risk_breakdown || {})
                                            .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
                                            .map(([key, value]) => {
                                                const labels = {
                                                    nota: 'Nota',
                                                    primeira_avaliacao: 'Primeira avaliacao',
                                                    presenca: 'Presenca',
                                                    queda_presenca: 'Queda de presenca',
                                                    atividade: 'Atividade',
                                                    oscilacao: 'Oscilacao de notas',
                                                    aprovacao: 'Reprovacao',
                                                    historico: 'Historico de reprovacoes',
                                                    carga: 'Carga de disciplinas',
                                                    dificuldade_disciplina: 'Dificuldade da disciplina',
                                                    trabalho: 'Trabalho',
                                                };
                                                return (
                                                    <tr key={key} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                                        <td className="min-w-[220px] whitespace-normal break-words rounded-l-[20px] px-5 py-5 text-sm font-semibold leading-6 text-text-primary">{labels[key] || key}</td>
                                                        <td className="rounded-r-[20px] px-5 py-5 text-sm leading-6 text-text-secondary">{(Number(value || 0) * 100).toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
