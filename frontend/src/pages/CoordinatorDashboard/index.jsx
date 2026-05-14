import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    GraduationCap,
    Shield,
    TrendingUp,
    Users,
} from 'lucide-react';
import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDetailModal } from '@/components/StudentDetailModal';

const riskStyles = {
    low: 'bg-success/10 text-success border-success/15',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    high: 'bg-danger/10 text-danger border-danger/15',
    critical: 'bg-danger/10 text-danger border-danger/15',
};

export function CoordinatorDashboard() {
    const [overview, setOverview] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, overviewRes, subjectsRes] = await Promise.allSettled([
                    api.get('/coordinators/me'),
                    api.get('/coordinators/me/overview'),
                    api.get('/coordinators/me/subjects'),
                ]);

                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
                if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
            } catch (error) {
                console.error('Erro ao carregar painel do coordenador', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const kpis = overview?.kpis || {};
    const riskSummary = overview?.risk_summary || {};
    const topAtRisk = overview?.top_at_risk || [];
    const riskBlocks = useMemo(() => ([
        { key: 'low', label: 'Baixo risco', value: riskSummary.low || 0 },
        { key: 'medium', label: 'Risco moderado', value: riskSummary.medium || 0 },
        { key: 'high', label: 'Risco alto', value: riskSummary.high || 0 },
        { key: 'critical', label: 'Risco critico', value: riskSummary.critical || 0 },
    ]), [riskSummary.critical, riskSummary.high, riskSummary.low, riskSummary.medium]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Coordenacao de curso"
                subtitle={profile?.academic_course_name
                    ? `Visao academica consolidada do curso ${profile.academic_course_name}, com leitura de desempenho, risco e disciplinas prioritarias.`
                    : 'Visao academica consolidada do curso, com leitura de desempenho, risco e disciplinas prioritarias.'}
                icon={Shield}
                actions={profile?.academic_course_name ? (
                    <Badge variant="purple">{profile.academic_course_name}</Badge>
                ) : null}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Total de alunos" value={loading ? '...' : kpis.total_students || 0} icon={Users} tone="purple" helper="Base vinculada a coordenacao" />
                <MetricCard title="GPA medio" value={loading ? '...' : Number(kpis.average_gpa || 0).toFixed(2)} icon={TrendingUp} tone="blue" helper="Desempenho agregado do curso" />
                <MetricCard title="Disciplinas monitoradas" value={loading ? '...' : kpis.total_subjects || 0} icon={BookOpen} tone="amber" helper="Oferta academica acompanhada" />
                <MetricCard title="Casos em risco" value={loading ? '...' : kpis.at_risk_count || 0} icon={AlertTriangle} tone="rose" helper="Alunos com prioridade de intervencao" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <Card>
                    <CardHeader
                        title="Mapa de risco do curso"
                        subtitle="Distribuicao atual dos niveis de atencao academica"
                        icon={BarChart3}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {riskBlocks.map((item) => (
                            <div key={item.key} className={`rounded-[22px] border p-4 ${riskStyles[item.key]}`}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{item.label}</p>
                                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Indicadores estruturantes"
                        subtitle="Taxa de aprovacao e frequencia media do curso"
                        icon={GraduationCap}
                    />
                    <div className="space-y-6">
                        <ProgressLine
                            label="Taxa de aprovacao"
                            value={Number(kpis.pass_rate || 0)}
                            tone="emerald"
                        />
                        <ProgressLine
                            label="Frequencia media"
                            value={Number(kpis.average_attendance_rate || 0)}
                            tone="blue"
                        />
                    </div>
                </Card>
            </div>

            <Card>
                <CardHeader
                    title="Alunos em maior prioridade"
                    subtitle="Casos com maior necessidade de acao da coordenacao"
                    icon={AlertTriangle}
                />

                {topAtRisk.length > 0 ? (
                    <div className="space-y-3">
                        {topAtRisk.slice(0, 10).map((student, index) => (
                            <motion.div
                                key={student.student_id}
                                className="grid gap-4 rounded-[22px] border border-border-subtle bg-bg-secondary/50 p-4 lg:grid-cols-[1.5fr_repeat(3,0.55fr)_0.55fr]"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStudentId(student.student_id)}
                                        className="text-left text-sm font-semibold text-text-primary transition-colors hover:text-accent-blue"
                                    >
                                        {student.student_name}
                                    </button>
                                    <p className="mt-1 text-sm text-text-secondary">{student.registration_number}</p>
                                </div>
                                <InlineMetric label="GPA" value={student.gpa?.toFixed(1) || '--'} />
                                <InlineMetric label="Frequencia" value={`${student.attendance_rate?.toFixed(1) || '--'}%`} />
                                <InlineMetric label="Score" value={`${((student.risk_score || 0) * 100).toFixed(0)}%`} />
                                <div className="flex items-center lg:justify-end">
                                    <Badge variant={student.risk_level === 'critical' ? 'danger' : student.risk_level === 'high' ? 'purple' : student.risk_level === 'medium' ? 'warning' : 'success'}>
                                        {student.risk_level}
                                    </Badge>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Nenhum caso prioritario no momento"
                        description="A base atual nao possui alunos classificados com necessidade imediata de intervencao."
                    />
                )}
            </Card>

            <Card>
                <CardHeader
                    title="Disciplinas do curso"
                    subtitle="Visao rapida da oferta monitorada pela coordenacao"
                    icon={BookOpen}
                />

                {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {subjects.map((subject, index) => (
                            <motion.div
                                key={subject.course_id}
                                className="rounded-[22px] border border-border-subtle bg-bg-secondary/55 p-5"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{subject.course_name}</p>
                                        <p className="mt-1 text-sm text-text-secondary">{subject.course_code}</p>
                                    </div>
                                    <Badge variant="info">{subject.students.length} alunos</Badge>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={BookOpen}
                        title="Sem disciplinas disponiveis"
                        description="As disciplinas vinculadas ao curso serao exibidas aqui assim que forem carregadas pelo backend."
                    />
                )}
            </Card>

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}

function ProgressLine({ label, value, tone }) {
    const tones = {
        emerald: 'from-success to-accent-blue',
        blue: 'from-accent-blue to-accent-purple',
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{label}</span>
                <span className="text-sm text-text-secondary">{value.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-bg-secondary">
                <div
                    className={`h-3 rounded-full bg-gradient-to-r ${tones[tone]}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        </div>
    );
}

function InlineMetric({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}
