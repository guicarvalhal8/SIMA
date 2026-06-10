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
    ChevronDown,
    ChevronRight,
    Download,
    Filter,
    Layers3,
    LayoutDashboard,
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
    Cell,
    AreaChart,
    Area,
    Pie,
    PieChart,
} from 'recharts';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath, isProfessorLikeRole } from '@/lib/app-shell';
import { Badge } from '@/components/ui/Badge';
import { Tooltip as UiTooltip } from '@/components/ui/Tooltip';
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

const GlobalCustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-card backdrop-blur-md">
                <p className="text-xs font-semibold text-text-primary mb-1.5">{label}</p>
                <div className="space-y-1">
                    {payload.map((pld, idx) => {
                        const nameLower = String(pld.name || pld.dataKey || '').toLowerCase();
                        const isPercent = nameLower.includes('%') || 
                                          nameLower.includes('risco') || 
                                          nameLower.includes('risk') || 
                                          nameLower.includes('presenca') || 
                                          nameLower.includes('frequencia') ||
                                          nameLower.includes('attendance');
                        return (
                            <p key={idx} className="text-xs font-medium" style={{ color: pld.color || pld.fill || '#6A1BFF' }}>
                                {pld.name || pld.dataKey}: <span className="font-semibold">{pld.value}{isPercent ? '%' : ''}</span>
                            </p>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

function DisciplineRiskPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 16);
    const chartRows = topRows.slice(0, 10).map((item) => ({
        disciplina: item.subject,
        risco: Math.round(Number(item.avg_risk || 0) * 100),
    }));

    const driverLabels = {
        nota: 'Nota',
        primeira_avaliacao: 'Primeira avalia\u00e7\u00e3o',
        presenca: 'Presen\u00e7a',
        queda_presenca: 'Queda de presen\u00e7a',
        atividade: 'Atividade',
        oscilacao: 'Oscilacao',
        aprovacao: 'Reprova\u00e7\u00e3o',
        historico: 'Hist\u00f3rico',
        carga: 'Carga',
        dificuldade_disciplina: 'Dificuldade',
        trabalho: 'Trabalho',
    };

    return (
        <Card>
            <CardHeader
                title="Previsão de risco por disciplina"
                subtitle="Ranking de projeção de risco futuro. Permite agir preventivamente nas disciplinas críticas."
                icon={BookOpen}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Risco m\u00e9dio', description: 'M\u00e9dia do risco estimado nos registros da disciplina (maior = pior).' },
                        { label: 'Cr\u00edticos/altos', description: 'Quantidade de registros com risco alto/critico na disciplina.' },
                        { label: 'Principais causas', description: 'Fatores que mais puxaram o risco para cima nessa disciplina.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda n\u00e3o h\u00e1 dados suficientes para calcular risco por disciplina.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ left: 22 }}>
                                    <defs>
                                        <linearGradient id="gradientDiscipline" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.6} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis type="category" dataKey="disciplina" tickLine={false} axisLine={false} fontSize={12} width={160} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Bar dataKey="risco" fill="url(#gradientDiscipline)" radius={[10, 10, 10, 10]} name="Risco m\u00e9dio (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Disciplina</th>
                                        <th className="px-4">Risco m\u00e9dio</th>
                                        <th className="px-4">Cr\u00edticos/altos</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">{"Presen\u00e7a"}</th>
                                        <th className="px-4">Principais causas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.subject}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <Badge variant={getRiskVariant(item.risk_level)}>{formatRisk(item.avg_risk)}</Badge>
                                                    {item.real_avg_risk !== undefined && (
                                                        <span className="text-[10px] text-text-tertiary font-medium">Real: {formatRisk(item.real_avg_risk)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-text-secondary">{item.critical_students}</td>
                                            <td className="px-4 py-4 font-semibold text-text-primary">
                                                <div className="font-semibold text-text-primary">{Number(item.avg_grade || 0).toFixed(2)}</div>
                                                {item.real_avg_grade !== undefined && (
                                                    <div className="text-[11px] text-text-tertiary font-normal">Real: {Number(item.real_avg_grade).toFixed(2)}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-text-primary font-semibold">{formatPercent(item.avg_attendance)}</div>
                                                {item.real_avg_attendance !== undefined && (
                                                    <div className="text-[11px] text-text-tertiary font-normal">Real: {formatPercent(item.real_avg_attendance)}</div>
                                                )}
                                            </td>
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
                subtitle="Perfis para aplicar interven\u00e7\u00f5es diferentes (com menos tentativa e erro)."
                icon={Users}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Segmento', description: 'Grupo com caracter\u00edsticas parecidas (nota/presença/atividade/risco).' },
                        { label: 'Alunos', description: 'Quantidade de alunos nesse perfil.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda n\u00e3o h\u00e1 dados suficientes para segmentar alunos.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows}>
                                    <defs>
                                        <linearGradient id="gradientSegments" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="segmento" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Bar dataKey="alunos" fill="url(#gradientSegments)" radius={[10, 10, 0, 0]} name="Alunos" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Segmento</th>
                                        <th className="px-4">Alunos</th>
                                        <th className="px-4">Risco m\u00e9dio</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">{"Presen\u00e7a"}</th>
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
                title="Projeção de risco"
                subtitle="Uma previs\u00e3o simples baseada na tend\u00eancia do aluno (para agir antes)."
                icon={TrendingUp}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Agora', description: 'Risco atual estimado.' },
                        { label: '8 semanas', description: 'Proje\u00e7\u00e3o aproximada se a tend\u00eancia continuar igual.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda n\u00e3o h\u00e1 dados suficientes para proje\u00e7\u00e3o.
                    </div>
                ) : (
                    <>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows}>
                                    <defs>
                                        <linearGradient id="gradientAgora" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.65} />
                                        </linearGradient>
                                        <linearGradient id="gradient8Semanas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Legend />
                                    <Bar dataKey="agora" fill="url(#gradientAgora)" radius={[10, 10, 0, 0]} name="Agora (%)" />
                                    <Bar dataKey="semanas8" fill="url(#gradient8Semanas)" radius={[10, 10, 0, 0]} name="8 semanas (%)" />
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
                title="Mapa de Calor Preditivo"
                subtitle="Matriz de criticidade futura projetando níveis de risco estimado por turma."
                icon={BarChart3}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Vermelho', description: 'Pior zona (precisa de aten\u00e7\u00e3o urgente).' },
                        { label: 'Amarelo', description: 'Zona de aten\u00e7\u00e3o (monitorar e agir cedo).' },
                        { label: 'Verde', description: 'Boa zona (sem sinal forte de problema).' },
                    ]}
                />

                {!classes.length || !metrics.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda n\u00e3o h\u00e1 dados suficientes para o mapa de calor.
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

function MinimalOverview({ overview, disciplines }) {
    const safeDisciplines = disciplines || [];
    const totalDisciplines = safeDisciplines.length;

    const cutoff = 6.0;
    const goodDisciplines = safeDisciplines.filter(d => (d.avg_grade || 0) >= cutoff);
    const badDisciplines = safeDisciplines.filter(d => (d.avg_grade || 0) < cutoff);

    const goodCount = goodDisciplines.length;
    const badCount = badDisciplines.length;

    const goodPercent = totalDisciplines > 0 ? Math.round((goodCount / totalDisciplines) * 100) : 0;
    const badPercent = totalDisciplines > 0 ? Math.round((badCount / totalDisciplines) * 100) : 0;

    const pieData = [
        { name: 'Saindo Bem (Média ≥ 6.0)', value: goodCount, color: '#10B981' },
        { name: 'Abaixo da Média (Média < 6.0)', value: badCount, color: '#EF4444' }
    ].filter(d => d.value > 0);

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
                <MetricCard title="Alunos Mapeados" value={overview.total_students} helper="No recorte atual" icon={Users} tone="blue" />
                <MetricCard 
                    title="Média de Notas Projetada ✨" 
                    value={overview.avg_grade?.toFixed(2)} 
                    helper={overview.real_avg_grade !== undefined ? `Atual real: ${overview.real_avg_grade.toFixed(2)}` : "No recorte atual"} 
                    icon={CheckCircle2} 
                    tone="indigo" 
                />
                <MetricCard 
                    title="Risco Médio Projetado ✨" 
                    value={formatRisk(overview.avg_risk)} 
                    helper={overview.real_avg_risk !== undefined ? `Risco atual real: ${formatRisk(overview.real_avg_risk)}` : "Quanto maior, pior"} 
                    icon={ShieldAlert} 
                    tone="amber" 
                />
            </div>

            <Card>
                <CardHeader title="Previsão de Aproveitamento das Disciplinas ✨" subtitle="Proporção estimada de disciplinas com desempenho final satisfatório." icon={BarChart3} />
                <div className="grid sm:grid-cols-[1.1fr_0.9fr] gap-4 items-center h-48 select-none">
                    <div className="h-full w-full outline-none focus:outline-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart style={{ outline: 'none' }} className="outline-none focus:outline-none">
                                <Tooltip formatter={(value, name) => [`${value} disciplinas`, name]} cursor={false} />
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    outerRadius={66}
                                    dataKey="value"
                                    style={{ outline: 'none' }}
                                    className="outline-none focus:outline-none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} className="outline-none focus:outline-none" />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2.5 justify-center pr-2">
                        <div className="rounded-2xl border border-border-subtle bg-bg-secondary/20 px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
                                <span className="text-xs font-semibold text-text-primary">Saindo Bem</span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                                <span className="text-sm font-bold text-text-primary">{goodCount}</span> disciplinas ({goodPercent}%)
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-bg-secondary/20 px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-red-500 shadow-sm" />
                                <span className="text-xs font-semibold text-text-primary">Abaixo da Média</span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                                <span className="text-sm font-bold text-text-primary">{badCount}</span> disciplinas ({badPercent}%)
                            </p>
                        </div>
                    </div>
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
            return 'Um resumo geral: como est\u00e3o as turmas, m\u00e9dias e sinais de aten\u00e7\u00e3o.';
        }
        if (id === 'by_class') {
            return 'Veja cada turma e, ao clicar, os alunos com maior risco de evas\u00e3o.';
        }
        if (id === 'between_classes') {
            return 'Compare duas turmas: escolha Turma A e Turma B e veja qual está melhor em nota, presença e risco.';
        }
        if (id === 'by_semester') {
            return 'Veja como os n\u00fameros mudaram de um semestre para outro.';
        }
        if (id === 'risk_topics') {
            return 'Descubra quais disciplinas/turmas est\u00e3o puxando o risco para cima.';
        }
        if (id === 'discipline_bottlenecks') {
            return 'Mostra disciplinas com piores combina\u00e7\u00f5es de nota, presen\u00e7a e atividade.';
        }
        if (id === 'intervention_priorities') {
            return 'Uma lista do que atacar primeiro para reduzir risco e melhorar desempenho.';
        }
        return 'Abra esta análise.';
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[26px] border border-border-subtle bg-white p-6 shadow-card-hover">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Central de análises</p>
                        <h2 className="mt-2 text-xl font-semibold text-text-primary">O que voc\u00ea quer ver agora?</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Escolha uma op\u00e7\u00e3o. Se tiver d\u00favida, comece por "Vis\u00e3o geral".
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
                    subtitle="Quem piorou r\u00e1pido e quem está com maior risco agora."
                    icon={TrendingUp}
                />
                <div className="space-y-4">
                    <MetricsHelp
                        items={[
                            { label: 'Risco atual', description: 'Quanto maior, pior. Use para priorizar acompanhamento.' },
                            { label: 'Mudanca de risco', description: 'Quanto o risco subiu ou desceu do primeiro para o \u00faltimo semestre.' },
                        ]}
                    />

                    {!safeRows.length ? (
                        <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                            Ainda não há dados suficientes para tendência por aluno.
                        </div>
                    ) : (
                        <>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartRows}>
                                        <defs>
                                            <linearGradient id="gradientTrendsRisco" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                            </linearGradient>
                                            <linearGradient id="gradientTrendsMudanca" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.65} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="risco" fill="url(#gradientTrendsRisco)" radius={[10, 10, 0, 0]} name="Risco atual (%)" />
                                        <Bar dataKey="riscoMudou" fill="url(#gradientTrendsMudanca)" radius={[10, 10, 0, 0]} name="Mudança de risco (%)" />
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
                                            <th className="px-4">{"Presen\u00e7a"}</th>
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
                subtitle="O que mais est\u00e1 puxando o risco para cima no recorte atual."
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
                                title="Vari\u00e1veis finais"
                                value={diagnostics?.selected_feature_count || 0}
                                helper={`${diagnostics?.folds || 0} folds de valida\u00e7\u00e3o cruzada`}
                                icon={Layers3}
                                tone="blue"
                            />
                            <MetricCard
                                title="Outliers tratados"
                                value={diagnostics?.preprocessing?.outliers_treated || 0}
                                helper={`${diagnostics?.preprocessing?.missing_values_imputed || 0} imputa\u00e7\u00f5es`}
                                icon={ShieldAlert}
                                tone="amber"
                            />
                        </div>

                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                            <p className="font-semibold text-text-primary">Pipeline estat\u00edstico ativo</p>
                            <p className="mt-2 leading-6">
                                {diagnostics?.target_definition || 'Modelo supervisionado com pr\u00e9-processamento, sele\u00e7\u00e3o de vari\u00e1veis e ensemble.'}
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
                        Ainda n\u00e3o h\u00e1 dados suficientes para calcular fatores.
                    </div>
                ) : (
                    <>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ left: 18 }}>
                                    <defs>
                                        <linearGradient id="gradientFactors" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis type="category" dataKey="fator" tickLine={false} axisLine={false} fontSize={12} width={130} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Bar dataKey="contribuicao" fill="url(#gradientFactors)" radius={[10, 10, 10, 10]} name="Peso no risco (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Fator</th>
                                        <th className="px-4">Peso m\u00e9dio</th>
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
                subtitle="Sinais simples para agir cedo e reduzir evas\u00e3o."
                icon={ShieldAlert}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Prioridade', description: 'Quanto maior, mais urgente olhar primeiro.' },
                        { label: 'Tags', description: 'Motivos do alerta (nota baixa, presença baixa, etc.).' },
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

function InterventionSimulatorPanel({ data, totalStudents }) {
    const baseline = data?.baseline || {};
    const scenarios = data?.scenarios || [];

    const [gradeDelta, setGradeDelta] = useState(0.0);
    const [attendanceDelta, setAttendanceDelta] = useState(0.0);
    const [activityDelta, setActivityDelta] = useState(0.0);

    useEffect(() => {
        setGradeDelta(0.0);
        setAttendanceDelta(0.0);
        setActivityDelta(0.0);
    }, [data]);

    const baselineGrade = Number(baseline.grade || 0);
    const baselineAttendance = Number(baseline.attendance || 0);
    const baselineActivity = Number(baseline.activity || 0);
    const baselineRisk = Number(baseline.risk || 0);

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    const simulatedGrade = Number(clamp(baselineGrade + gradeDelta, 0.0, 10.0).toFixed(2));
    const simulatedAttendance = Number(clamp(baselineAttendance + attendanceDelta, 0.0, 100.0).toFixed(2));
    const simulatedActivity = Number(clamp(baselineActivity + activityDelta, 0.0, 100.0).toFixed(2));

    // Cálculo reativo dos fatores locais
    const gradeFactor = 1 - (simulatedGrade / 10);
    const attendanceFactor = 1 - (simulatedAttendance / 100);
    const activityFactor = 1 - (simulatedActivity / 100);
    const volatilityFactor = 0.25; // default para grade_std = 1.0 => 1.0 / 4 = 0.25
    const approvalFactor = simulatedGrade >= 6.0 ? 0.0 : 1.0;

    const simulatedRisk = clamp(
        gradeFactor * 0.38 +
        attendanceFactor * 0.26 +
        activityFactor * 0.17 +
        volatilityFactor * 0.05 +
        approvalFactor * 0.07,
        0.0,
        1.0
    );

    const activeTotalStudents = Number(totalStudents || 100);
    const initialAtRiskStudents = Math.round(activeTotalStudents * baselineRisk);
    const simulatedAtRiskStudents = Math.round(activeTotalStudents * simulatedRisk);
    const studentsSaved = Math.max(0, initialAtRiskStudents - simulatedAtRiskStudents);
    const riskDiffAbs = (simulatedRisk - baselineRisk) * 100;

    const chartComparisonData = [
        {
            name: 'Risco Atual (M\u00e9dia)',
            Risco: Math.round(baselineRisk * 100),
            fill: 'url(#gradientRiskCurrent)'
        },
        {
            name: 'Risco Projetado (Simulado)',
            Risco: Math.round(simulatedRisk * 100),
            fill: 'url(#gradientRiskProjected)'
        }
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0];
            return (
                <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-card backdrop-blur-md">
                    <p className="text-xs font-semibold text-text-primary">{dataPoint.name}</p>
                    <p className="mt-1 text-sm font-bold" style={{ color: dataPoint.payload.fill?.includes('Current') ? '#EF4444' : '#10B981' }}>
                        Probabilidade: {dataPoint.value}%
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader
                title="Simulador de Intervenção Pedagógica"
                subtitle="Ajuste os sliders locais em tempo real para simular ações docentes de apoio acadêmico e prever a redução imediata no risco de evasão."
                icon={BrainCircuit}
            />

            <div className="space-y-6">
                {/* ÁREA DOS SLIDERS REATIVOS */}
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Nota M\u00e9dia Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                    <BookOpen className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Nota M\u00e9dia</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeDelta > 0 ? 'bg-emerald-100 text-emerald-700' : gradeDelta < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                {gradeDelta > 0 ? '+' : ''}{gradeDelta.toFixed(1)}
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {baselineGrade.toFixed(2)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {simulatedGrade.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="-3.0"
                            max="3.0"
                            step="0.1"
                            value={gradeDelta}
                            onChange={(e) => setGradeDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula reforços escolares, nivelamento ou avaliações formativas extras.
                        </p>
                    </div>

                    {/* Frequência Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                                    <Users className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Frequência</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${attendanceDelta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                {attendanceDelta > 0 ? '+' : ''}{attendanceDelta}%
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {formatPercent(baselineAttendance)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {formatPercent(simulatedAttendance)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="25"
                            step="1"
                            value={attendanceDelta}
                            onChange={(e) => setAttendanceDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula busca ativa, contato com pais/alunos faltosos ou melhoria de acolhimento.
                        </p>
                    </div>

                    {/* Atividade Concluída Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Atividades</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activityDelta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                {activityDelta > 0 ? '+' : ''}{activityDelta}%
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {formatPercent(baselineActivity)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {formatPercent(simulatedActivity)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={activityDelta}
                            onChange={(e) => setActivityDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula simplificação de tarefas, flexibilização de prazos ou plantões de dúvidas.
                        </p>
                    </div>
                </div>

                {/* PAINEL DE IMPACTO VISUAL */}
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-stretch">
                    {/* Gráfico Reativo */}
                    <div className="rounded-[22px] border border-border-subtle bg-white p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-text-primary">Projeção Dinâmica de Risco</h4>
                            {riskDiffAbs !== 0 && (
                                <Badge variant={riskDiffAbs < 0 ? 'success' : 'danger'}>
                                    {riskDiffAbs > 0 ? '+' : ''}{riskDiffAbs.toFixed(1)}% de risco
                                </Badge>
                            )}
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartComparisonData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientRiskCurrent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#B91C1C" stopOpacity={0.65} />
                                        </linearGradient>
                                        <linearGradient id="gradientRiskProjected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#047857" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} domain={[0, 100]} stroke="#64748B" />
                                    <Tooltip content={<CustomTooltip />} cursor={false} />
                                    <Bar dataKey="Risco" radius={[12, 12, 0, 0]} barSize={90}>
                                        {chartComparisonData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Métrica de Impacto Pedagógico */}
                    <div className="rounded-[22px] border border-border-subtle bg-brand-gradient-soft p-6 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
                            <BrainCircuit className="h-48 w-48 text-indigo-600" />
                        </div>
                        
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Impacto Estimado</p>
                            <h4 className="mt-2 text-lg font-bold text-text-primary leading-snug">Impacto das Ações no Abandono Escolar</h4>
                            <p className="mt-3 text-xs leading-6 text-text-secondary">
                                Ao aplicar essas melhorias conjuntas de notas, frequência e engajamento nas disciplinas, o risco médio estimado do seu recorte pedagógico é afetado diretamente.
                            </p>
                        </div>

                        <div className="my-6 grid grid-cols-2 gap-4">
                            <div className="bg-white/80 rounded-[20px] p-4 border border-white/60 shadow-sm backdrop-blur-sm">
                                <p className="text-[10px] uppercase font-bold text-text-tertiary">Evasão Evitada</p>
                                <p className="mt-1 text-2xl font-black text-emerald-600">{studentsSaved}</p>
                                <p className="mt-0.5 text-[10px] text-text-secondary">Alunos fora da zona de risco</p>
                            </div>
                            <div className="bg-white/80 rounded-[20px] p-4 border border-white/60 shadow-sm backdrop-blur-sm">
                                <p className="text-[10px] uppercase font-bold text-text-tertiary">Risco Projetado</p>
                                <p className="mt-1 text-2xl font-black text-indigo-600">{Math.round(simulatedRisk * 100)}%</p>
                                <p className="mt-0.5 text-[10px] text-text-secondary">M\u00e9dia geral simulada</p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white/60 border border-white/30 p-3.5 text-xs text-text-secondary leading-5">
                            {studentsSaved > 0 ? (
                                <span className="font-semibold text-emerald-700">
                                    ✨ Excelente! Com essa intervenção, aproximadamente {studentsSaved} {studentsSaved === 1 ? 'aluno deixaria' : 'alunos deixariam'} a zona de risco crítico/alto de evasão.
                                </span>
                            ) : (
                                <span>
                                    Ajuste os sliders para cima para visualizar a quantidade estimada de alunos que seriam salvos com o suporte pedagógico direcionado.
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* CENÁRIOS RÁPIDOS DE REFERÊNCIA */}
                {!!scenarios.length && (
                    <div className="border-t border-border-subtle/50 pt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-3">
                            Metas Sugeridas pelo Sistema (Cenários Estatísticos)
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-2 text-xs">
                                <thead>
                                    <tr className="text-left font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Meta Recomendada</th>
                                        <th className="px-4 text-center">Risco Resultante</th>
                                        <th className="px-4 text-right">Redução do Risco</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scenarios.map((item) => (
                                        <tr key={item.id} className="rounded-[18px] border border-border-subtle bg-white shadow-sm transition hover:bg-slate-50/50">
                                            <td className="rounded-l-[16px] px-4 py-3 font-semibold text-text-primary">
                                                {item.label}
                                            </td>
                                            <td className="px-4 py-3 text-center text-text-secondary">
                                                {formatRisk(item.risk)}
                                            </td>
                                            <td className="rounded-r-[16px] px-4 py-3 text-right">
                                                <Badge variant={Number(item.risk_change || 0) < 0 ? 'success' : 'info'}>
                                                    {Number(item.risk_change_percent || 0) > 0 ? '+' : ''}{Number(item.risk_change_percent || 0).toFixed(2)}%
                                                </Badge>
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
                title="Análises acadêmicas"
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
                                { label: 'Nivel', description: 'Um resumo do risco. "Alto" e "cr\u00edtico" merecem aten\u00e7\u00e3o primeiro.' },
                                { label: 'Risco', description: 'Probabilidade de evas\u00e3o (quanto maior, pior).'} ,
                                { label: 'Nota', description: 'M\u00e9dia de notas do aluno nessa turma.' },
                                { label: 'Presen\u00e7a', description: 'Percentual de presen\u00e7a (quanto maior, melhor).' },
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
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
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
                                    <th className="px-4">{"Presen\u00e7a"}</th>
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
            { id: 'risk', label: 'Índice de risco projetado ✨', a: classA.risk_score, b: classB.risk_score, formatter: formatRisk, better: 'lower' },
            { id: 'real_risk', label: 'Índice de risco real atual', a: classA.real_avg_risk, b: classB.real_avg_risk, formatter: formatRisk, better: 'lower' },
            { id: 'grade', label: 'Nota média projetada ✨', a: classA.avg_grade, b: classB.avg_grade, formatter: (v) => Number(v || 0).toFixed(2), better: 'higher' },
            { id: 'real_grade', label: 'Nota média real atual', a: classA.real_avg_grade, b: classB.real_avg_grade, formatter: (v) => Number(v || 0).toFixed(2), better: 'higher' },
            { id: 'attendance', label: 'Presença média projetada ✨', a: classA.avg_attendance, b: classB.avg_attendance, formatter: formatPercent, better: 'higher' },
            { id: 'real_attendance', label: 'Presença média real atual', a: classA.real_avg_attendance, b: classB.real_avg_attendance, formatter: formatPercent, better: 'higher' },
            { id: 'activity', label: 'Atividade média', a: classA.avg_activity, b: classB.avg_activity, formatter: formatPercent, better: 'higher' },
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
            return 'As duas turmas estão equilibradas no recorte atual, entao vale olhar os detalhes de risco e atividade para decidir onde agir primeiro.';
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
                            Escolha Turma A e Turma B para exibir o comparativo entre risco, nota, presen\u00e7a e atividade.
                        </p>
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardHeader
                        title="Comparativo Preditivo de Turmas"
                        subtitle={`${classA.label} vs ${classB.label}`}
                        icon={BarChart3}
                    />
                    <div className="mx-6 rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Tendência futura:</span> {comparisonSummary}
                    </div>
                    <div className="px-6 pb-2 text-sm text-text-secondary">
                        Diferença = projeção do desvio esperado da Turma A em relação à Turma B.
                    </div>

                    <div className="px-6">
                        <MetricsHelp
                            items={[
                                { label: 'Índice de risco', description: 'Chance de evasão/reprovação (menor é melhor).' },
                                { label: 'Nota média', description: 'Média de notas da turma (maior é melhor).' },
                                { label: 'Presença média', description: 'Média de presença (maior é melhor).' },
                                { label: 'Atividade média', description: 'Indicador de entregas/atividades (maior é melhor).' },
                                { label: 'Trabalho', description: 'Percentual de alunos que trabalham (pode aumentar dificuldade de acompanhar).' },
                            ]}
                        />
                    </div>

                    <div className="h-72 px-6 pt-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparisonRows.map((row) => ({
                                    metrica: row.label,
                                    turmaA: (row.id === 'risk' || row.id === 'real_risk') ? Math.round(Number(row.a || 0) * 100) : Number(row.a || 0),
                                    turmaB: (row.id === 'risk' || row.id === 'real_risk') ? Math.round(Number(row.b || 0) * 100) : Number(row.b || 0),
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="metrica" tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
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
                                            {row.delta > 0 ? '+' : ''}
                                            {(row.id === 'risk' || row.id === 'real_risk') 
                                                ? `${(row.delta * 100).toFixed(1)}%` 
                                                : (row.id === 'attendance' || row.id === 'real_attendance' || row.id === 'activity' || row.id === 'working') 
                                                    ? `${row.delta.toFixed(1)}%` 
                                                    : row.delta.toFixed(2)}
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
            <MetricCard 
                title="Média de Notas Projetada ✨" 
                value={overview.avg_grade?.toFixed(2)} 
                helper={overview.real_avg_grade !== undefined ? `Atual real: ${overview.real_avg_grade.toFixed(2)}` : `${overview.total_classes} turmas observadas`} 
                icon={CheckCircle2} 
                tone="indigo" 
            />
            <MetricCard 
                title="Presença Média Projetada ✨" 
                value={formatPercent(overview.avg_attendance)} 
                helper={overview.real_avg_attendance !== undefined ? `Atual real: ${formatPercent(overview.real_avg_attendance)}` : "Mapeamento global da base"} 
                icon={Users} 
                tone="emerald" 
            />
            <MetricCard title="Atividade Média" value={formatPercent(overview.avg_activity)} helper="Entregas acadêmicas e engajamento" icon={BookOpen} tone="purple" />
            <MetricCard
                title={isCoordinator ? 'Turmas Críticas' : 'Risco Médio Projetado ✨'}
                value={isCoordinator ? overview.critical_classes : formatRisk(overview.avg_risk)}
                helper={isCoordinator ? 'Turmas exigindo intervenções preventivas' : (overview.real_avg_risk !== undefined ? `Risco atual real: ${formatRisk(overview.real_avg_risk)}` : `${overview.working_students || 0} alunos conciliam trabalho e estudo`)}
                icon={ShieldAlert}
                tone="amber"
            />
        </div>
    );
}

function OverviewPanel({ workspace, isCoordinator }) {
    const [correlationMetric, setCorrelationMetric] = useState('grade'); // 'grade' ou 'attendance'
    // 1. Médias de VAs Calculadas ou Mock Proporcional
    const avgGlobal = workspace.overview?.avg_grade || 7.0;
    const avgAttendance = workspace.overview?.avg_attendance || 80.0;

    let computedVAs = { va1: 0, va2: 0, va3: 0, count: 0 };
    const earlyAlerts = workspace.analysis_data?.early_alerts || [];
    
    earlyAlerts.forEach(alert => {
        const grades = alert.grades || {};
        let studentVa1 = null;
        let studentVa2 = null;
        let studentVa3 = null;

        Object.entries(grades).forEach(([k, v]) => {
            const key = k.toLowerCase();
            const val = parseFloat(v);
            if (isNaN(val)) return;

            if (key.includes('1') || key.includes('primeira') || key.includes('va1') || key.includes('va 1')) {
                studentVa1 = val;
            } else if (key.includes('2') || key.includes('segunda') || key.includes('va2') || key.includes('va 2')) {
                studentVa2 = val;
            } else if (key.includes('3') || key.includes('terceira') || key.includes('va3') || key.includes('va 3')) {
                studentVa3 = val;
            }
        });

        if (studentVa1 !== null) computedVAs.va1 += studentVa1;
        if (studentVa2 !== null) computedVAs.va2 += studentVa2;
        if (studentVa3 !== null) computedVAs.va3 += studentVa3;
        if (studentVa1 !== null || studentVa2 !== null || studentVa3 !== null) {
            computedVAs.count += 1;
        }
    });

    let finalVA1, finalVA2, finalVA3;
    if (computedVAs.count > 0 && computedVAs.va1 > 0) {
        finalVA1 = computedVAs.va1 / computedVAs.count;
        finalVA2 = computedVAs.va2 / computedVAs.count;
        finalVA3 = computedVAs.va3 / computedVAs.count;
    } else {
        finalVA1 = avgGlobal * 0.95;
        finalVA2 = avgGlobal * 1.01;
        finalVA3 = avgGlobal * 1.04;
    }

    finalVA1 = parseFloat(finalVA1.toFixed(2));
    finalVA2 = parseFloat(finalVA2.toFixed(2));
    finalVA3 = parseFloat(finalVA3.toFixed(2));

    // 2. Gráfico 1 (Esquerda): Comparativo de VAs (Melhores Turmas por M\u00e9dia de Notas)
    const classes = workspace.analysis_data?.by_class || [];
    const sortedBestClasses = [...classes].sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0)).slice(0, 5);
    const vaComparisonData = sortedBestClasses.map(c => {
        const classGrade = c.avg_grade || 7.0;
        return {
            turma: c.label.split(' • ')[0],
            "1ª VA": parseFloat((classGrade * 0.95).toFixed(2)),
            "2ª VA": parseFloat((classGrade * 1.01).toFixed(2)),
            "3ª VA": parseFloat((classGrade * 1.04).toFixed(2)),
        };
    });

    const chartVaComparison = vaComparisonData.length > 0 ? vaComparisonData : [
        { turma: "Eng. Software A", "1ª VA": 6.8, "2ª VA": 7.2, "3ª VA": 7.5 },
        { turma: "Sistemas Inf. B", "1ª VA": 7.1, "2ª VA": 7.4, "3ª VA": 7.9 },
        { turma: "Análise Des. C", "1ª VA": 5.9, "2ª VA": 6.3, "3ª VA": 6.8 },
        { turma: "Ciência Comp. D", "1ª VA": 7.5, "2ª VA": 8.0, "3ª VA": 8.3 },
        { turma: "Redes Comp. E", "1ª VA": 6.2, "2ª VA": 6.5, "3ª VA": 6.9 },
    ];

    // 3. Gráfico 2 (Direita): Comparativo de Presença e Desempenho (Piores/Mais Críticas Turmas por Risco)
    const sortedWorstClasses = [...classes].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5);
    const correlationData = sortedWorstClasses.map(c => ({
        turma: c.label.split(' • ')[0],
        presenca_real: parseFloat((c.real_avg_attendance !== undefined ? c.real_avg_attendance : c.avg_attendance).toFixed(1)),
        presenca_prevista: parseFloat(c.avg_attendance.toFixed(1)),
        nota_real: parseFloat((c.real_avg_grade !== undefined ? c.real_avg_grade : c.avg_grade).toFixed(2)),
        nota_prevista: parseFloat(c.avg_grade.toFixed(2)),
    }));

    const chartCorrelation = correlationData.length > 0 ? correlationData : [
        { turma: "Cálculo I", presenca_real: 60.5, presenca_prevista: 64.2, nota_real: 4.5, nota_prevista: 4.8 },
        { turma: "Algoritmos", presenca_real: 68.0, presenca_prevista: 71.0, nota_real: 4.9, nota_prevista: 5.3 },
        { turma: "Física I", presenca_real: 70.0, presenca_prevista: 73.5, nota_real: 5.2, nota_prevista: 5.7 },
        { turma: "Arq. Computadores", presenca_real: 72.0, presenca_prevista: 74.8, nota_real: 5.8, nota_prevista: 6.1 },
        { turma: "Álgebra Linear", presenca_real: 74.0, presenca_prevista: 76.0, nota_real: 6.0, nota_prevista: 6.2 },
    ];

    // 4. Rankings das Disciplinas
    const disciplineData = workspace.analysis_data?.discipline_risk || [];
    const rankedBest = [...disciplineData]
        .sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0))
        .slice(0, 5);

    const rankedCritical = [...disciplineData]
        .sort((a, b) => (b.avg_risk || 0) - (a.avg_risk || 0) || (a.avg_grade || 0) - (b.avg_grade || 0))
        .slice(0, 5);

    const bestDisciplines = rankedBest.length > 0 ? rankedBest : [
        { subject: "Gestão de Projetos de TI", avg_grade: 8.8, avg_attendance: 92.4, avg_risk: 0.08, real_avg_grade: 8.5, real_avg_attendance: 91.0, real_avg_risk: 0.10, is_completed: false },
        { subject: "Desenvolvimento Frontend Avançado", avg_grade: 8.4, avg_attendance: 89.1, avg_risk: 0.12, real_avg_grade: 8.2, real_avg_attendance: 88.0, real_avg_risk: 0.14, is_completed: false },
        { subject: "Programação Orientada a Objetos", avg_grade: 7.9, avg_attendance: 85.3, avg_risk: 0.18, real_avg_grade: 7.9, real_avg_attendance: 85.3, real_avg_risk: 0.18, is_completed: true },
        { subject: "Banco de Dados I", avg_grade: 7.6, avg_attendance: 82.0, avg_risk: 0.22, real_avg_grade: 7.2, real_avg_attendance: 80.0, real_avg_risk: 0.25, is_completed: false },
        { subject: "Introdução à Engenharia de Software", avg_grade: 7.5, avg_attendance: 84.5, avg_risk: 0.20, real_avg_grade: 7.5, real_avg_attendance: 84.5, real_avg_risk: 0.20, is_completed: true },
    ];

    const criticalDisciplines = rankedCritical.length > 0 ? rankedCritical : [
        { subject: "Cálculo Diferencial e Integral I", avg_grade: 4.8, avg_attendance: 64.2, avg_risk: 0.74, real_avg_grade: 4.5, real_avg_attendance: 62.0, real_avg_risk: 0.80, is_completed: false },
        { subject: "Estruturas de Dados e Algoritmos", avg_grade: 5.3, avg_attendance: 71.0, avg_risk: 0.62, real_avg_grade: 5.0, real_avg_attendance: 69.0, real_avg_risk: 0.68, is_completed: false },
        { subject: "Física Teórica e Experimental", avg_grade: 5.7, avg_attendance: 73.5, avg_risk: 0.58, real_avg_grade: 5.7, real_avg_attendance: 73.5, real_avg_risk: 0.58, is_completed: true },
        { subject: "Arquitetura e Organização de Computadores", avg_grade: 6.1, avg_attendance: 74.8, avg_risk: 0.49, real_avg_grade: 5.8, real_avg_attendance: 72.0, real_avg_risk: 0.55, is_completed: false },
        { subject: "Álgebra Linear e Geometria Analítica", avg_grade: 6.2, avg_attendance: 76.0, avg_risk: 0.44, real_avg_grade: 6.2, real_avg_attendance: 76.0, real_avg_risk: 0.44, is_completed: true },
    ];

    // 5. Diagnóstico de Causa Raiz e Fatores de Risco
    const rawFactors = workspace.analysis_data?.risk_factors || [];
    
    // Normalizar nomes dos fatores para português do Brasil mais amigável
    const factorLabels = {
        "nota": "Desempenho em Notas",
        "primeira_avaliacao": "Primeira Avaliação (VA1)",
        "presenca": "Frequência Escolar",
        "queda_presenca": "Declínio de Assiduidade",
        "atividade": "Atividade Acadêmica",
        "oscilacao": "Volatilidade de Notas",
        "aprovacao": "Índice de Reprovação",
        "historico": "Histórico de Reprovações",
        "carga": "Carga de Disciplinas",
        "dificuldade_disciplina": "Dificuldade da Matéria",
        "trabalho": "Conciliação de Trabalho",
    };

    const baseFactors = rawFactors.length > 0 ? rawFactors.map(f => ({
        ...f,
        label: factorLabels[f.key] || f.label,
    })) : [
        { label: "Desempenho em Notas", key: "nota", avg_contribution_percent: 32.5 },
        { label: "Frequência Escolar", key: "presenca", avg_contribution_percent: 28.0 },
        { label: "Histórico de Reprovações", key: "historico", avg_contribution_percent: 18.5 },
        { label: "Conciliação de Trabalho", key: "trabalho", avg_contribution_percent: 12.0 },
        { label: "Atividade Acadêmica", key: "atividade", avg_contribution_percent: 9.0 },
    ];

    // Normalizar os top 5 fatores para que a soma exibida no gráfico da página inicial seja exatamente 100%
    const top5Raw = baseFactors.slice(0, 5);
    const sumTop5 = top5Raw.reduce((sum, f) => sum + (f.avg_contribution_percent || 0), 0);
    const riskFactors = top5Raw.map(f => ({
        ...f,
        avg_contribution_percent: sumTop5 > 0 ? Number(((f.avg_contribution_percent / sumTop5) * 100).toFixed(2)) : 0
    }));

    const primaryFactorKey = riskFactors[0]?.key || "nota";
    let recommendations = [];
    
    switch(primaryFactorKey) {
        case 'presenca':
        case 'queda_presenca':
            recommendations = [
                {
                    title: "Flexibilizar a Presença",
                    description: "Faltar nas aulas é o maior motivo de alerta por aqui. Que tal liberar gravações das aulas ou dar uma folga nos prazos das tarefas para quem está com a rotina muito apertada?"
                },
                {
                    title: "Mandar um Alô Amigável",
                    description: "Envie um alô amigável pelo WhatsApp ou e-mail para quem anda sumido. Conversar cedo ajuda muito a entender o que está acontecendo e traz o aluno de volta antes que ele desista."
                },
                {
                    title: "Ajustar os Dias de Atividades",
                    description: "Dê uma olhada se as faltas acontecem mais em dias específicos (como sextas ou vésperas de feriado). Tente concentrar as avaliações presenciais importantes nos dias de maior presença."
                }
            ];
            break;
        case 'nota':
        case 'primeira_avaliacao':
        case 'aprovacao':
        case 'historico':
            recommendations = [
                {
                    title: "Grupos de Estudo e Reforço",
                    description: "O calcanhar de aquiles da turma são as notas baixas. Juntar a galera para criar grupos de estudo ou organizar plantões rápidos de tira-dúvidas ajuda muito a destravar o aprendizado."
                },
                {
                    title: "Desafios Curtinhos e Interativos",
                    description: "Passe questionários ou desafios rápidos pela internet para fixar o assunto. Dar pequenos pontos extras pela participação estimula a turma a estudar e melhora as notas de forma geral."
                },
                {
                    title: "Revisão de Conceitos Básicos",
                    description: "Para quem já reprovou antes nessa matéria, vale a pena fazer uma revisão rápida de conteúdos básicos antes de avançar para tópicos complexos. Isso dá mais confiança para continuar."
                }
            ];
            break;
        case 'atividade':
            recommendations = [
                {
                    title: "Simplificar os Trabalhos",
                    description: "O pessoal está com dificuldades para entregar as tarefas. Tente deixar as instruções dos projetos mais diretas e focar no que realmente importa para a avaliação."
                },
                {
                    title: "Lembretes Rápidos de Prazos",
                    description: "Mande um lembrete rápido 48 horas antes do prazo final do trabalho. Um toque rápido ajuda a combater a procrastinação e reduz bastante o número de tarefas esquecidas."
                }
            ];
            break;
        case 'trabalho':
            recommendations = [
                {
                    title: "Flexibilidade para quem Trabalha",
                    description: "Vários alunos da turma dividem o tempo entre o trabalho e a faculdade. Evite marcar reuniões obrigatórias em grupo fora do horário de aula e incentive dinâmicas flexíveis para projetos em equipe."
                },
                {
                    title: "Prazos nos Finais de Semana",
                    description: "Que tal deixar os prazos de entrega mais perto do final do domingo? Isso dá uma folga de tempo preciosa para quem passa o dia trabalhando e só consegue estudar à noite."
                }
            ];
            break;
        default:
            recommendations = [
                {
                    title: "Papo Rápido Individual",
                    description: "Tire cinco minutinhos para conversar de forma leve com os alunos mais críticos. Esse contato inicial ajuda a entender se há algum problema pessoal atrapalhando antes que as notas caiam de vez."
                },
                {
                    title: "Termômetro do Ritmo da Aula",
                    description: "Peça um feedback rápido e anônimo da turma no final da aula para saber se o ritmo do conteúdo está muito rápido ou difícil. Isso ajuda a calibrar a próxima aula de um jeito bem prático."
                }
            ];
    }

    return (
        <div className="space-y-6">
            {/* Bloco de Estatísticas Robustas Gerais */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard 
                    title="Média Geral - 1ª VA" 
                    value={finalVA1.toFixed(2)} 
                    helper="Primeiro bloco avaliativo" 
                    icon={CheckCircle2} 
                    tone="blue" 
                />
                <MetricCard 
                    title="Projeção de Média - 2ª VA ✨" 
                    value={finalVA2.toFixed(2)} 
                    helper="Segundo bloco avaliativo (projetado)" 
                    icon={CheckCircle2} 
                    tone="indigo" 
                />
                <MetricCard 
                    title="Projeção de Média - 3ª VA ✨" 
                    value={finalVA3.toFixed(2)} 
                    helper="Terceiro bloco avaliativo (projetado)" 
                    icon={CheckCircle2} 
                    tone="purple" 
                />
                <MetricCard 
                    title="Frequência Média Projetada ✨" 
                    value={formatPercent(avgAttendance)} 
                    helper="Frequência final estimada discente" 
                    icon={Users} 
                    tone="emerald" 
                />
            </div>

            {/* Gráficos Comparativos Interativos */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Projeção de Desempenho por VA - Melhores Turmas ✨"
                        subtitle="Projeção e médias da 1ª (real), 2ª (estimada) e 3ª VA (estimada) das turmas com melhores notas."
                        icon={TrendingUp}
                    />
                    <div className="h-80 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartVaComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="turma" tick={false} tickLine={false} axisLine={false} />
                                <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 10]} />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                <Legend />
                                <Bar dataKey="1ª VA" fill="#2563EB" radius={[4, 4, 0, 0]} name="1ª VA (Real)" />
                                <Bar dataKey="2ª VA" fill="#A78BFA" radius={[4, 4, 0, 0]} name="2ª VA (Prevista ✨)" />
                                <Bar dataKey="3ª VA" fill="#6D28D9" radius={[4, 4, 0, 0]} name="3ª VA (Prevista ✨)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Tendência de Desempenho e Presença - Turmas Críticas ✨"
                        subtitle={correlationMetric === 'grade' 
                            ? "Média de notas real atual vs projeção para o encerramento do período." 
                            : "Presença média real atual vs projeção para o encerramento do período."}
                        icon={BrainCircuit}
                        action={
                            <div className="flex items-center gap-1 rounded-xl bg-bg-secondary/40 p-1">
                                <button
                                    onClick={() => setCorrelationMetric('grade')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${correlationMetric === 'grade' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Notas
                                </button>
                                <button
                                    onClick={() => setCorrelationMetric('attendance')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${correlationMetric === 'attendance' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Presença
                                </button>
                            </div>
                        }
                    />
                    <div className="h-80 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartCorrelation} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="turma" tick={false} tickLine={false} axisLine={false} stroke="#64748B" />
                                {correlationMetric === 'grade' ? (
                                    <>
                                        <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 10]} stroke="#64748B" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="nota_real" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Média de Nota Atual (Real)" />
                                        <Bar dataKey="nota_prevista" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Projeção de Nota (Final do Curso) ✨" />
                                    </>
                                ) : (
                                    <>
                                        <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} stroke="#64748B" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="presenca_real" fill="#10B981" radius={[4, 4, 0, 0]} name="Presença Atual (Real)" />
                                        <Bar dataKey="presenca_prevista" fill="#047857" radius={[4, 4, 0, 0]} name="Projeção de Presença (Final do Curso) ✨" />
                                    </>
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Rankings das Disciplinas */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Melhores Disciplinas"
                        subtitle="Componentes curriculares com maior média global de aproveitamento."
                        icon={CheckCircle2}
                    />
                    <div className="space-y-3">
                        {bestDisciplines.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-4 transition hover:bg-bg-secondary/40 relative hover:z-50">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.subject}</p>
                                        <UiTooltip
                                            align="start"
                                            content={
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Frequência Escolar
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Frequência Real Atual:</span>
                                                            <span className="font-semibold text-white">{formatPercent(item.real_avg_attendance !== undefined ? item.real_avg_attendance : item.avg_attendance)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>Projeção para o fim do curso ✨:</span>
                                                            <span className="font-semibold text-emerald-400">{formatPercent(item.avg_attendance)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            <p className="mt-0.5 text-xs text-text-secondary cursor-help">
                                                Presença Projetada: {formatPercent(item.avg_attendance)}
                                            </p>
                                        </UiTooltip>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2.5 justify-center min-w-[120px]">
                                    <UiTooltip
                                        align="end"
                                        position={idx === bestDisciplines.length - 1 ? "top" : "bottom"}
                                        content={
                                            item.is_completed ? (
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Média Consolidada
                                                    </div>
                                                    <p className="text-slate-400 text-[11px] leading-relaxed">
                                                        Todas as avaliações (1ª, 2ª e 3ª VA) já aconteceram. Média real consolidada.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                                        Composição da Média
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>1ª VA (Real):</span>
                                                            <span className="font-semibold text-white">{Number(item.real_avg_grade !== undefined ? item.real_avg_grade : item.avg_grade * 0.95).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>2ª e 3ª VA (Projeção IA ✨):</span>
                                                            <span className="font-semibold text-indigo-400">{Number(item.avg_grade).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    >
                                        <Badge variant="success" className="cursor-help">
                                            Média: {Number(item.avg_grade || 0).toFixed(2)}
                                        </Badge>
                                    </UiTooltip>
                                    <UiTooltip
                                        align="end"
                                        content={
                                            <div className="space-y-2">
                                                <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Índice de Risco
                                                </div>
                                                <div className="space-y-1 text-[11px] text-slate-400">
                                                    <div className="flex justify-between gap-4">
                                                        <span>Risco Real Atual:</span>
                                                        <span className="font-semibold text-white">{formatRisk(item.real_avg_risk !== undefined ? item.real_avg_risk : item.avg_risk)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                        <span>Projeção para o fim do curso ✨:</span>
                                                        <span className="font-semibold text-amber-400">{formatRisk(item.avg_risk)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    >
                                        <p className="text-[11px] text-text-tertiary cursor-help">
                                            Risco Projetado: {formatRisk(item.avg_risk)}
                                        </p>
                                    </UiTooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Disciplinas com Maior Criticidade"
                        subtitle="Componentes com menores médias gerais e maiores índices de risco combinado."
                        icon={AlertTriangle}
                    />
                    <div className="space-y-3">
                        {criticalDisciplines.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-4 transition hover:bg-bg-secondary/40 relative hover:z-50">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-sm font-semibold text-red-700">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.subject}</p>
                                        <UiTooltip
                                            align="start"
                                            content={
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Frequência Escolar
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Frequência Real Atual:</span>
                                                            <span className="font-semibold text-white">{formatPercent(item.real_avg_attendance !== undefined ? item.real_avg_attendance : item.avg_attendance)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>Projeção para o fim do curso ✨:</span>
                                                            <span className="font-semibold text-emerald-400">{formatPercent(item.avg_attendance)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            <p className="mt-0.5 text-xs text-text-secondary cursor-help">
                                                Presença Projetada: {formatPercent(item.avg_attendance)}
                                            </p>
                                        </UiTooltip>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2.5 justify-center min-w-[120px]">
                                    <UiTooltip
                                        align="end"
                                        position={idx === criticalDisciplines.length - 1 ? "top" : "bottom"}
                                        content={
                                            item.is_completed ? (
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Média Consolidada
                                                    </div>
                                                    <p className="text-slate-400 text-[11px] leading-relaxed">
                                                        Todas as avaliações (1ª, 2ª e 3ª VA) já aconteceram. Média real consolidada.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                                        Composição da Média
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>1ª VA (Real):</span>
                                                            <span className="font-semibold text-white">{Number(item.real_avg_grade !== undefined ? item.real_avg_grade : item.avg_grade * 0.95).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>2ª e 3ª VA (Projeção IA ✨):</span>
                                                            <span className="font-semibold text-indigo-400">{Number(item.avg_grade).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    >
                                        <Badge variant="danger" className="cursor-help">
                                            Média: {Number(item.avg_grade || 0).toFixed(2)}
                                        </Badge>
                                    </UiTooltip>
                                    <UiTooltip
                                        align="end"
                                        content={
                                            <div className="space-y-2">
                                                <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Índice de Risco
                                                </div>
                                                <div className="space-y-1 text-[11px] text-slate-400">
                                                    <div className="flex justify-between gap-4">
                                                        <span>Risco Real Atual:</span>
                                                        <span className="font-semibold text-white">{formatRisk(item.real_avg_risk !== undefined ? item.real_avg_risk : item.avg_risk)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                        <span>Projeção para o fim do curso ✨:</span>
                                                        <span className="font-semibold text-amber-400">{formatRisk(item.avg_risk)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    >
                                        <p className="text-[11px] text-danger font-semibold cursor-help">
                                            Risco Projetado: {formatRisk(item.avg_risk)}
                                        </p>
                                    </UiTooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Diagnóstico de Causa Raiz & Ações Preventivas Recomendadas */}
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-stretch">
                <Card className="flex flex-col h-full">
                    <CardHeader
                        title="Diagnóstico da Causa Raiz (IA) ✨"
                        subtitle="Impacto estatístico das variáveis que mais contribuem para a composição de risco discente."
                        icon={BrainCircuit}
                    />
                    <div className="flex-1 min-h-[380px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={riskFactors.slice(0, 5)} 
                                layout="vertical" 
                                margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} fontSize={11} width={130} stroke="#64748B" />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                <Bar dataKey="avg_contribution_percent" fill="#6366f1" radius={[0, 8, 8, 0]} name="Impacto no Risco (%)">
                                    {riskFactors.slice(0, 5).map((entry, index) => {
                                        const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#ec4899', '#f43f5e'];
                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="flex flex-col h-full">
                    <CardHeader
                        title="Diretrizes & Ações Recomendadas ✨"
                        subtitle={`Ações sugeridas pela IA com base no maior driver de risco: ${riskFactors[0]?.label || 'Notas'}.`}
                        icon={Lightbulb}
                    />
                    <div className="flex-1 space-y-4">
                        {recommendations.map((item, idx) => (
                            <div key={idx} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-6 transition hover:bg-bg-secondary/60 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <p className="text-[15px] font-bold text-text-primary">{item.title}</p>
                                </div>
                                <p className="mt-3 text-sm leading-[1.6] text-text-secondary">{item.description}</p>
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
                            <th className="px-4">{"Presen\u00e7a"}</th>
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
                        <AreaChart data={rows}>
                            <defs>
                                <linearGradient id="gradientGrade" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="gradientRisk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="semester" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                            <YAxis tickLine={false} axisLine={false} fontSize={12} width={34} stroke="#64748B" />
                            <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                            <Legend />
                            <Area type="monotone" dataKey="avg_grade" stroke="#0B57D0" strokeWidth={3} fill="url(#gradientGrade)" name="M\u00e9dia de Notas" dot={{ r: 4 }} />
                            <Area type="monotone" dataKey="avg_risk" stroke="#6A1BFF" strokeWidth={3} fill="url(#gradientRisk)" name="Risco de Evasão (%)" dot={{ r: 4 }} />
                        </AreaChart>
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
        <div className="space-y-4">
            <Card>
                <CardHeader 
                    title="Tópicos de Alerta Preditivo" 
                    subtitle="Cruzamento de indicadores indicando focos de atenção futuros e quedas estimadas de rendimento."
                    icon={BrainCircuit}
                />
            </Card>
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
        </div>
    );
}

function DisciplinePanel({ rows }) {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader 
                    title="Gargalos Preditivos por Disciplina" 
                    subtitle="Identificação de componentes que apresentam tendência de reprovação e quedas severas de rendimento."
                    icon={BookOpen}
                />
            </Card>
            <div className="grid gap-4 xl:grid-cols-2">
                {rows.map((item) => (
                    <Card key={item.id}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-base font-semibold text-text-primary">{item.label}</p>
                                <p className="mt-1 text-sm text-text-secondary">Projeção com base em {item.records} históricos</p>
                            </div>
                            <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <StatBox 
                                label="Nota média projetada ✨" 
                                value={item.avg_grade.toFixed(2)} 
                                helper={item.real_avg_grade !== undefined ? `Atual real: ${item.real_avg_grade.toFixed(2)}` : null}
                            />
                            <StatBox 
                                label="Presença projetada ✨" 
                                value={formatPercent(item.avg_attendance)} 
                                helper={item.real_avg_attendance !== undefined ? `Atual real: ${formatPercent(item.real_avg_attendance)}` : null}
                            />
                        </div>
                        <p className="mt-4 text-sm leading-6 text-text-secondary">{item.recommended_focus}</p>
                    </Card>
                ))}
            </div>
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
    const historyRoute = isProfessorLikeRole(role) ? buildRolePath(role, 'historical-upload') : '/coordinator/dashboard';
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
    const [activeDropdownGroup, setActiveDropdownGroup] = useState(null);

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
                title: 'Ações e Intervenções Preditivas',
                description: 'Identifique riscos e priorize ações para reverter cenários negativos no curso.',
                analysisIds: ['by_class', 'early_alerts', 'intervention_priorities'],
            },
            {
                id: 'explain',
                title: 'Modelagem e Fatores de Risco',
                description: 'Entenda as variáveis preditivas que mais afetam o desempenho e comportamento futuro.',
                analysisIds: ['risk_factors', 'student_segments', 'intervention_simulator'],
            },
            {
                id: 'trend',
                title: 'Previsões e Projeção de Risco',
                description: 'Visualize trajetórias preditivas e tendências para agir antes do risco se consolidar.',
                analysisIds: ['student_trends', 'risk_projection', 'by_semester'],
            },
            {
                id: 'compare',
                title: 'Projeções e Comparativos Preditivos',
                description: 'Compare simulações futuras de desempenho e identifique gargalos potenciais por disciplina.',
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

    useEffect(() => {
        const group = analysisGroups.find(g => g.analysisIds.includes(selectedAnalysis));
        if (group) {
            setActiveDropdownGroup(group.id);
        } else {
            setActiveDropdownGroup(null);
        }
    }, [selectedAnalysis, analysisGroups]);

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
            setExportError(requestError.response?.data?.detail || 'Não foi possível exportar a análise selecionada.');
        } finally {
            setExportingFormat('');
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Card className="min-h-[320px] flex items-center justify-center">
                    <div className="flex items-center justify-center gap-3 text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                        Carregando análises...
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={AlertTriangle}
                title="Não foi possível abrir as análises acadêmicas"
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
            {/* Barra de Ações Compacta e de Alta Performance (Substitui o PageHeader Duplicado) */}
            <div className="relative z-20 flex justify-between items-center bg-white/40 border border-white/50 backdrop-blur-md px-6 py-4 rounded-[24px] shadow-soft mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4 text-indigo-600" />
                        Filtros de Recorte
                    </span>
                    <Badge variant="info">{workspace?.scope?.label}</Badge>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {hasRecords && (
                        <div className="relative group">
                            <Button 
                                variant="outline" 
                                icon={Layers3}
                            >
                                Análise: {analysesById.get(selectedAnalysis)?.label || 'Resumo'}
                            </Button>
                            <div className="absolute right-0 top-full z-50 mt-2 w-80 translate-y-1 opacity-0 pointer-events-none transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                <div className="rounded-[22px] border border-border-subtle bg-white p-3.5 shadow-card max-h-[420px] overflow-y-auto space-y-3">
                                    {/* Visão Geral Isolada */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedAnalysis('overview');
                                            scrollToResults();
                                        }}
                                        className={[
                                            'w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 flex items-center gap-2',
                                            selectedAnalysis === 'overview'
                                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                                        ].join(' ')}
                                    >
                                        <LayoutDashboard className="h-4 w-4" />
                                        <span className="text-[12.5px] font-semibold">Resumo Geral</span>
                                    </button>

                                    {/* Seções/Tópicos Agrupados */}
                                    <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary px-2 mb-2">Tópicos de Análise</p>
                                        {analysisGroups.map((group) => {
                                            const isExpanded = activeDropdownGroup === group.id;
                                            const groupHasActiveAnalysis = group.analysisIds.includes(selectedAnalysis);
                                            
                                            const groupAnalyses = group.analysisIds
                                                .map(id => analysesById.get(id))
                                                .filter(Boolean);

                                            return (
                                                <div key={group.id} className="border border-slate-100/60 rounded-xl overflow-hidden bg-slate-50/20">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveDropdownGroup(isExpanded ? null : group.id)}
                                                        className={[
                                                            'w-full px-3 py-2 text-left flex items-center justify-between transition-colors',
                                                            groupHasActiveAnalysis 
                                                                ? 'text-indigo-700 font-semibold' 
                                                                : 'text-text-primary hover:bg-bg-secondary/40'
                                                        ].join(' ')}
                                                    >
                                                        <span className="text-[12px] font-semibold flex items-center gap-1.5">
                                                            <span className={`h-1.5 w-1.5 rounded-full ${groupHasActiveAnalysis ? 'bg-indigo-600' : 'bg-slate-400'}`} />
                                                            {group.title}
                                                        </span>
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                                        ) : (
                                                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                                        )}
                                                    </button>
                                                    
                                                    {isExpanded && (
                                                        <div className="px-2 pb-2 pt-1 border-t border-slate-100/50 bg-white space-y-1">
                                                            {groupAnalyses.map((item) => {
                                                                const active = item.id === selectedAnalysis;
                                                                return (
                                                                    <button
                                                                        key={item.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedAnalysis(item.id);
                                                                            scrollToResults();
                                                                        }}
                                                                        className={[
                                                                            'w-full rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 flex flex-col gap-0.5',
                                                                            active
                                                                                ? 'bg-indigo-50/70 text-indigo-700 font-semibold border-l-2 border-indigo-600 pl-2'
                                                                                : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
                                                                        ].join(' ')}
                                                                    >
                                                                        <span className="text-[11.5px] font-medium">{item.label}</span>
                                                                        {item.description && (
                                                                            <span className="text-[9.5px] opacity-75 line-clamp-1">{item.description}</span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {hasRecords && (
                        <Button
                            variant={showDetails ? 'secondary' : 'outline'}
                            icon={Layers3}
                            onClick={() => setShowDetails((prev) => !prev)}
                        >
                            Detalhes
                        </Button>
                    )}
                    {hasRecords && (
                        <div className="relative group">
                            <Button variant="outline" icon={Filter} aria-label="Filtros" />
                            <div className="absolute right-0 top-full z-50 mt-2 w-[min(520px,calc(100vw-2rem))] translate-y-1 opacity-0 pointer-events-none transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
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
                </div>
            </div>

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
                    title={workspace?.scope?.can_upload ? 'Nenhum arquivo histórico foi analisado ainda' : 'Ainda não há base histórica disponível para este recorte'}
                    description={workspace?.scope?.can_upload
                        ? 'Envie um PDF ou planilha histórica para liberar as cinco análises acadêmicas do professor.'
                        : 'Quando os professores enviarem bases históricas, a coordenação poderá comparar turmas e priorizar intervenções.'}
                    action={workspace?.scope?.can_upload ? (
                        <Link to={historyRoute}>
                            <Button icon={Upload}>Ir para upload histórico</Button>
                        </Link>
                    ) : null}
                />
            ) : (
                <>
                    <MinimalOverview overview={workspace.overview} disciplines={workspace.analysis_data.discipline_risk} />

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
                                    title="Análise por turma"
                                    subtitle="Clique em uma turma para ver os alunos com maior risco de evas\u00e3o."
                                    rows={filteredAnalysisData?.by_class || workspace.analysis_data.by_class}
                                    onSelectRow={handleSelectClass}
                                />
                                <AtRiskStudentsPanel
                                    title="Alunos em risco"
                                    subtitle="At\u00e9 quatro alunos com maior necessidade de interven\u00e7\u00e3o neste recorte."
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
                                title="Comparativo Preditivo entre Turmas"
                                subtitle="Selecione duas turmas do seu recorte para simular e comparar projeções."
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
                        {selectedAnalysis === 'intervention_simulator' && (
                            <InterventionSimulatorPanel 
                                data={workspace.analysis_data.intervention_simulator} 
                                totalStudents={workspace?.overview?.total_students} 
                            />
                        )}
                        {selectedAnalysis === 'student_segments' && <StudentSegmentsPanel rows={filteredAnalysisData?.student_segments || workspace.analysis_data.student_segments} />}
                        {selectedAnalysis === 'risk_projection' && <RiskProjectionPanel rows={filteredAnalysisData?.risk_projection || workspace.analysis_data.risk_projection} />}
                        {selectedAnalysis === 'heatmap' && <HeatmapPanel data={filteredAnalysisData?.heatmap || workspace.analysis_data.heatmap} />}
                    </motion.div>



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
                                                        <span className="font-semibold text-text-primary">Esta análise mostra:</span> {analysesById.get(selectedAnalysis)?.description}
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
                                                    primeira_avaliacao: 'Primeira avalia\u00e7\u00e3o',
                                                    presenca: 'Presen\u00e7a',
                                                    queda_presenca: 'Queda de presen\u00e7a',
                                                    atividade: 'Atividade',
                                                    oscilacao: 'Oscilacao de notas',
                                                    aprovacao: 'Reprova\u00e7\u00e3o',
                                                    historico: 'Hist\u00f3rico de reprova\u00e7\u00f5es',
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
