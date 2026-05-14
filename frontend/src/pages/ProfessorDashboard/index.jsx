import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    GraduationCap,
    Layers3,
    ShieldAlert,
    Upload,
    Users,
} from 'lucide-react';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { getRoleMeta } from '@/lib/app-shell';

function getRiskVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function buildAnalysisLink(analysis, params = {}) {
    const query = new URLSearchParams({ analysis });
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            query.set(key, String(value));
        }
    });
    return `/professor/analysis-center?${query.toString()}`;
}

export function ProfessorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [overview, setOverview] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    const roleMeta = useMemo(() => getRoleMeta(user?.role), [user?.role]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [profileRes, overviewRes, studentsRes, workspaceRes] = await Promise.allSettled([
                    api.get('/professors/me'),
                    api.get('/professors/me/overview'),
                    api.get('/professors/me/students'),
                    api.get('/historical-data/analysis-workspace'),
                ]);

                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
                if (studentsRes.status === 'fulfilled') setSubjectStudents(studentsRes.value.data);
                if (workspaceRes.status === 'fulfilled') setWorkspace(workspaceRes.value.data);
            } catch (error) {
                console.error('Erro ao carregar dashboard docente', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const topAtRisk = overview?.top_at_risk || [];
    const riskTopics = workspace?.analysis_data?.risk_topics || [];
    const criticalClasses = workspace?.analysis_data?.high_risk_classes || [];
    const criticalSubjects = useMemo(() => (
        riskTopics.filter((item) => item.type === 'Disciplina').slice(0, 4)
    ), [riskTopics]);
    const urgentAlerts = useMemo(() => (
        riskTopics.slice(0, 3)
    ), [riskTopics]);
    const academicCourses = profile?.academic_courses || [];
    const totalStudents = subjectStudents.reduce((sum, item) => sum + (item.students?.length || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Dashboard docente${profile?.user_name ? ` de ${profile.user_name.split(' ')[0]}` : ''}`}
                subtitle="Avisos importantes, turmas criticas e leituras historicas para priorizar a sua acao academica."
                icon={GraduationCap}
                actions={(
                    <>
                        <Link to="/professor/historical-data">
                            <Button variant="secondary" icon={Upload}>
                                Subir nova base
                            </Button>
                        </Link>
                        <Link to="/professor/analysis-center?analysis=overview">
                            <Button icon={BrainCircuit}>
                                Abrir analises
                            </Button>
                        </Link>
                    </>
                )}
            />

            <Card variant="hero">
                <div className={`rounded-[28px] border border-white/70 bg-gradient-to-br ${roleMeta.softAccent} px-6 py-6 shadow-[0_24px_48px_-36px_rgba(11,87,208,0.45)]`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${roleMeta.badge}`}>
                                {roleMeta.label}
                            </span>
                            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
                                {roleMeta.area}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                                Monitoramento institucional com foco em desempenho, risco e tomada de decisao.
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary shadow-sm">
                                    Ambiente ativo
                                </span>
                                <span className={`h-2.5 w-2.5 rounded-full ${roleMeta.dot}`} />
                            </div>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                            <ShieldAlert className="h-5 w-5 text-accent-blue-dark/75" />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="Disciplinas ativas"
                    value={loading ? '...' : subjectStudents.length}
                    helper={`${academicCourses.length} cursos academicos vinculados`}
                    icon={BookOpen}
                    tone="indigo"
                />
                <MetricCard
                    title="Alunos monitorados"
                    value={loading ? '...' : totalStudents}
                    helper="Base atual das turmas que voce acompanha"
                    icon={Users}
                    tone="blue"
                />
                <MetricCard
                    title="Casos em alerta"
                    value={loading ? '...' : overview?.kpis?.at_risk_count || 0}
                    helper="Alunos com necessidade de intervencao"
                    icon={AlertTriangle}
                    tone="rose"
                />
                <MetricCard
                    title="Turmas criticas"
                    value={loading ? '...' : workspace?.overview?.critical_classes || 0}
                    helper="Recortes historicos com risco alto ou critico"
                    icon={ShieldAlert}
                    tone="amber"
                />
            </div>

            <Card variant="hero">
                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                                Avisos importantes
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">
                                O que merece sua atencao agora
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                                Este painel cruza alertas atuais com as analises historicas ja enviadas para apontar
                                turmas, disciplinas e alunos com maior chance de piora.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {urgentAlerts.length > 0 ? urgentAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="rounded-[24px] border border-border-subtle bg-white/75 px-5 py-4 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge variant={getRiskVariant(alert.risk_level)}>{alert.type}</Badge>
                                        <p className="text-sm font-semibold text-text-primary">{alert.label}</p>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">{alert.signal}</p>
                                    <p className="mt-2 text-sm text-text-secondary">{alert.evidence}</p>
                                </div>
                            )) : (
                                <div className="rounded-[24px] border border-dashed border-border-subtle bg-white/60 px-5 py-5 text-sm text-text-secondary">
                                    Assim que voce subir uma base historica, este bloco passa a destacar os principais
                                    avisos de risco por turma, disciplina e semestre.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-card">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                            Proximos passos
                        </p>
                        <div className="mt-4 space-y-3">
                            <Link
                                to="/professor/analysis-center?analysis=risk_topics"
                                className="flex items-center justify-between rounded-[20px] border border-border-subtle bg-bg-secondary/50 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Abrir assuntos em risco</p>
                                    <p className="mt-1 text-sm text-text-secondary">Leituras comentadas com foco em melhoria.</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-accent-blue" />
                            </Link>
                            <Link
                                to="/professor/analysis-center?analysis=by_class"
                                className="flex items-center justify-between rounded-[20px] border border-border-subtle bg-bg-secondary/50 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Comparar turmas</p>
                                    <p className="mt-1 text-sm text-text-secondary">Veja qual turma esta melhor e por qual motivo.</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-accent-blue" />
                            </Link>
                            <Link
                                to="/professor/historical-data"
                                className="flex items-center justify-between rounded-[20px] border border-border-subtle bg-bg-secondary/50 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Subir novas planilhas</p>
                                    <p className="mt-1 text-sm text-text-secondary">Normalizar PDF ou planilha e gerar nova leitura.</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-accent-blue" />
                            </Link>
                        </div>
                    </div>
                </div>
            </Card>

            {criticalClasses.length === 0 && (
                <EmptyState
                    icon={Upload}
                    title="Falta a base historica para destravar o melhor dashboard docente"
                    description="Suba planilhas ou PDFs de turmas anteriores para liberar comparativos, turmas criticas, assuntos em risco e analises por semestre."
                    action={(
                        <Link to="/professor/historical-data">
                            <Button icon={Upload}>Ir para upload</Button>
                        </Link>
                    )}
                />
            )}

            {criticalClasses.length > 0 && (
                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <Card>
                        <CardHeader
                            title="Turmas em estado critico"
                            subtitle="Clique para aprofundar a leitura na analise por turma."
                            icon={Layers3}
                        />
                        <div className="space-y-3">
                            {criticalClasses.slice(0, 5).map((item) => (
                                <Link
                                    key={item.id}
                                    to={buildAnalysisLink('by_class', { subject: item.subject, semester: item.semester })}
                                    className="block rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                {item.course_name} • {item.semester}
                                            </p>
                                        </div>
                                        <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-text-secondary">
                                        <div className="rounded-2xl bg-white px-3 py-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Nota</p>
                                            <p className="mt-1 font-semibold text-text-primary">{item.avg_grade.toFixed(2)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Presenca</p>
                                            <p className="mt-1 font-semibold text-text-primary">{item.avg_attendance.toFixed(1)}%</p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Alerta</p>
                                            <p className="mt-1 font-semibold text-text-primary">{item.critical_students} alunos</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader
                            title="Disciplinas mais sensiveis"
                            subtitle="Clique para abrir os assuntos em risco daquela disciplina."
                            icon={BrainCircuit}
                        />
                        <div className="space-y-3">
                            {criticalSubjects.map((item) => (
                                <Link
                                    key={item.id}
                                    to={buildAnalysisLink('risk_topics', { subject: item.label })}
                                    className="block rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.signal}</p>
                                        </div>
                                        <Badge variant={getRiskVariant(item.risk_level)}>{item.type}</Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-text-secondary">{item.evidence}</p>
                                </Link>
                            ))}

                            {criticalSubjects.length === 0 && (
                                <div className="rounded-[22px] border border-dashed border-border-subtle px-4 py-6 text-sm text-text-secondary">
                                    Ainda nao ha leitura historica suficiente para classificar disciplinas criticas.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader
                    title="Alunos que pedem acao imediata"
                    subtitle="Clique no aluno para abrir o painel completo com notas, frequencia e indicadores."
                    icon={CheckCircle2}
                />

                {topAtRisk.length > 0 ? (
                    <div className="space-y-3">
                        {topAtRisk.slice(0, 8).map((student, index) => (
                            <motion.div
                                key={student.student_id}
                                className="grid gap-4 rounded-[22px] border border-border-subtle bg-bg-secondary/50 p-4 lg:grid-cols-[1.45fr_repeat(3,0.55fr)_0.6fr]"
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
                                <InlineMetric label="GPA" value={student.gpa?.toFixed(2) || '--'} />
                                <InlineMetric label="Presenca" value={`${student.attendance_rate?.toFixed(0) || '--'}%`} />
                                <InlineMetric label="Risco" value={`${((student.risk_score || 0) * 100).toFixed(0)}%`} />
                                <div className="flex items-center lg:justify-end">
                                    <Badge variant={getRiskVariant(student.risk_level)}>{student.risk_level}</Badge>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Users}
                        title="Sem alunos em alerta relevante"
                        description="Quando houver combinacao preocupante entre nota e presenca, os alunos aparecerao aqui."
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

function InlineMetric({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}
