import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    GraduationCap,
    Shield,
    TrendingUp,
    Users,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChartTooltip } from '@/components/ui/ChartTooltip';

export function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    if (user?.role?.toLowerCase() === 'student') {
        return <Navigate to="/student/dashboard" replace />;
    }

    useEffect(() => {
        async function fetchOverview() {
            try {
                const response = await api.get('/analytics/overview');
                setData(response.data);
            } catch (error) {
                console.error('Failed to fetch overview', error);
            } finally {
                setLoading(false);
            }
        }

        fetchOverview();
    }, []);

    const kpis = data?.kpis || {};

    const trendData = useMemo(() => (
        [
            { month: 'Ago', gpa: 6.5, attendance: 81 },
            { month: 'Set', gpa: 6.8, attendance: 83 },
            { month: 'Out', gpa: 6.9, attendance: 84 },
            { month: 'Nov', gpa: 7.0, attendance: 85 },
            { month: 'Dez', gpa: 7.1, attendance: 86 },
            {
                month: 'Atual',
                gpa: Number(kpis.average_gpa || 0),
                attendance: Number(kpis.average_attendance_rate || 0),
            },
        ]
    ), [kpis.average_attendance_rate, kpis.average_gpa]);

    const riskData = [
        {
            name: 'Baixo risco',
            value: Math.max((kpis.active_students || 0) - (kpis.at_risk_count || 0), 0),
            color: '#0B57D0',
        },
        {
            name: 'Em risco',
            value: kpis.at_risk_count || 0,
            color: '#6A1BFF',
        },
    ];

    const executiveHighlights = [
        {
            title: 'Estabilidade academica',
            description: `${Number(kpis.pass_rate || 0).toFixed(0)}% da base apresenta desempenho satisfatorio no recorte atual.`,
        },
        {
            title: 'Ponto de atencao',
            description: `${kpis.at_risk_count || 0} alunos exigem monitoramento prioritario por risco academico.`,
        },
        {
            title: 'Capacidade institucional',
            description: `${kpis.total_courses || 0} disciplinas compoem o mapa atual de acompanhamento institucional.`,
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Visao institucional da NEXORA"
                subtitle="Indicadores globais para reitoria, com foco em risco academico, desempenho medio e capacidade de resposta institucional."
                icon={Shield}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="Alunos ativos"
                    value={loading ? '...' : kpis.active_students || 0}
                    icon={Users}
                    tone="dark"
                    helper="Base monitorada pela plataforma"
                />
                <MetricCard
                    title="Disciplinas monitoradas"
                    value={loading ? '...' : kpis.total_courses || 0}
                    icon={BookOpen}
                    tone="purple"
                    helper="Oferta academica vinculada ao painel"
                />
                <MetricCard
                    title="GPA medio"
                    value={loading ? '...' : Number(kpis.average_gpa || 0).toFixed(2)}
                    icon={TrendingUp}
                    tone="blue"
                    helper="Desempenho consolidado do periodo"
                />
                <MetricCard
                    title="Taxa de aprovacao"
                    value={loading ? '...' : `${Number(kpis.pass_rate || 0).toFixed(0)}%`}
                    icon={GraduationCap}
                    tone="emerald"
                    helper="Resultado institucional agregado"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.85fr]">
                <Card>
                    <CardHeader
                        title="Evolucao dos indicadores prioritarios"
                        subtitle="Leitura executiva de desempenho medio e frequencia institucional"
                        icon={TrendingUp}
                    />
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="nexoraAreaBlue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0B57D0" stopOpacity={0.24} />
                                        <stop offset="95%" stopColor="#0B57D0" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="nexoraAreaPurple" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6A1BFF" stopOpacity={0.22} />
                                        <stop offset="95%" stopColor="#6A1BFF" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} width={36} />
                                <ChartTooltip />
                                <Area
                                    type="monotone"
                                    dataKey="gpa"
                                    name="GPA medio"
                                    stroke="#0B57D0"
                                    strokeWidth={2.5}
                                    fill="url(#nexoraAreaBlue)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="attendance"
                                    name="Frequencia media"
                                    stroke="#6A1BFF"
                                    strokeWidth={2.5}
                                    fill="url(#nexoraAreaPurple)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader
                            title="Distribuicao de risco"
                            subtitle="Base institucional segmentada por exposicao"
                            icon={AlertTriangle}
                        />
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskData}
                                            innerRadius={42}
                                            outerRadius={66}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {riskData.map((item) => (
                                                <Cell key={item.name} fill={item.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-4">
                                {riskData.map((item) => (
                                    <div key={item.name} className="rounded-2xl border border-border-subtle bg-bg-secondary/55 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                                            </div>
                                            <span className="text-lg font-semibold text-text-primary">{item.value}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-text-secondary">
                                            {item.name === 'Em risco'
                                                ? 'Demandam acao imediata de monitoramento e apoio.'
                                                : 'Mantem trajetoria academica considerada estavel.'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Card variant="hero">
                        <CardHeader
                            title="Leituras executivas"
                            subtitle="Sintese para priorizacao institucional"
                            icon={Shield}
                        />
                        <div className="space-y-4">
                            {executiveHighlights.map((item) => (
                                <div key={item.title} className="rounded-2xl border border-white/60 bg-white/78 p-4">
                                    <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
