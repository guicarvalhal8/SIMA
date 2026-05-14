import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Award,
    BookOpen,
    CalendarRange,
    CheckCircle2,
    Clock,
    GraduationCap,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    User,
    X,
} from 'lucide-react';
import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';

const TAB_ITEMS = [
    { id: 'overview', label: 'Visao geral', icon: TrendingUp },
    { id: 'grades', label: 'Notas', icon: Award },
    { id: 'attendance', label: 'Frequencia', icon: Clock },
    { id: 'subjects', label: 'Disciplinas', icon: BookOpen },
    { id: 'schedule', label: 'Horarios', icon: CalendarRange },
];

export function StudentDetailModal({ studentId, isOpen, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (isOpen && studentId) {
            setLoading(true);
            setError('');
            setActiveTab('overview');
            api.get(`/students/${studentId}/detail`)
                .then((response) => setData(response.data))
                .catch((requestError) => {
                    console.error('Erro ao buscar detalhes do aluno', requestError);
                    setError(requestError.response?.data?.detail || 'Nao foi possivel carregar os dados do aluno.');
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, studentId]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const analytics = data?.analytics || {};
    const kpis = analytics?.kpis || {};
    const grades = data?.grades || [];
    const attendance = data?.attendance || [];
    const subjects = data?.subjects || [];
    const schedule = data?.schedule || [];
    const recommendations = analytics?.recommendations || [];
    const history = analytics?.history || [];

    const headerStats = {
        subjects: grades.length || subjects.length || 0,
        avgGrade: grades.length
            ? (grades.reduce((sum, item) => sum + Number(item.media || 0), 0) / grades.length).toFixed(1)
            : Number(kpis.gpa || 0).toFixed(1),
        avgAttendance: attendance.length
            ? `${(attendance.reduce((sum, item) => sum + Number(item.percentual_presenca || 0), 0) / attendance.length).toFixed(0)}%`
            : `${Number(kpis.attendance_rate || 0).toFixed(0)}%`,
        riskScore: `${Math.round(Number(kpis.risk_score || 0) * 100)}%`,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[100] bg-slate-950/28 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed right-0 top-0 z-[101] flex h-full w-full max-w-[960px] flex-col border-l border-border-subtle bg-white shadow-card-hover"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                    >
                        <div className="border-b border-border-subtle bg-brand-gradient-soft px-6 py-6">
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-5 w-48 animate-pulse rounded-full bg-white/60" />
                                    <div className="h-4 w-32 animate-pulse rounded-full bg-white/50" />
                                </div>
                            ) : data && (
                                <div className="space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-gradient text-lg font-bold text-white">
                                                {getInitials(data.student.name)}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-semibold text-text-primary">{data.student.name}</h2>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                                                    <span>{data.student.registration_number}</span>
                                                    <span>{data.student.course_name || '--'}</span>
                                                    <span>{data.student.current_period ? `${data.student.current_period}o periodo` : 'Periodo nao informado'}</span>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Badge variant={getRiskBadgeVariant(kpis.risk_level)} dot>
                                                        {formatRiskLabel(kpis.risk_level)}
                                                    </Badge>
                                                    <Badge variant="info">
                                                        {data.student.class_schedule || 'Turno nao informado'}
                                                    </Badge>
                                                    <Badge variant={data.student.sync_status === 'done' ? 'success' : data.student.sync_status === 'error' ? 'danger' : 'neutral'}>
                                                        Sync {data.student.sync_status || 'indisponivel'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle bg-white text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                        <QuickStat label="Disciplinas" value={headerStats.subjects} icon={BookOpen} />
                                        <QuickStat label="Media geral" value={headerStats.avgGrade} icon={TrendingUp} />
                                        <QuickStat label="Frequencia" value={headerStats.avgAttendance} icon={Clock} />
                                        <QuickStat label="Risco" value={headerStats.riskScore} icon={ShieldAlert} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-b border-border-subtle px-6 pt-4">
                            <div className="flex flex-wrap gap-2">
                                {TAB_ITEMS.map((tab) => (
                                    <TabButton
                                        key={tab.id}
                                        active={activeTab === tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        icon={tab.icon}
                                        label={tab.label}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div key={index} className="h-24 animate-pulse rounded-[22px] bg-bg-secondary" />
                                    ))}
                                </div>
                            ) : error ? (
                                <EmptyPanel icon={ShieldAlert} title="Nao foi possivel abrir o aluno" description={error} />
                            ) : (
                                <>
                                    {activeTab === 'overview' && (
                                        <OverviewTab
                                            student={data?.student}
                                            kpis={kpis}
                                            history={history}
                                            recommendations={recommendations}
                                        />
                                    )}
                                    {activeTab === 'grades' && <GradesTab grades={grades} />}
                                    {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}
                                    {activeTab === 'subjects' && <SubjectsTab subjects={subjects} />}
                                    {activeTab === 'schedule' && <ScheduleTab schedule={schedule} />}
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function QuickStat({ label, value, icon: Icon }) {
    return (
        <div className="rounded-[20px] border border-border-subtle bg-white/78 p-4">
            <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 text-accent-blue" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                active ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-text-secondary hover:text-text-primary'
            }`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function OverviewTab({ student, kpis, history, recommendations }) {
    return (
        <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-accent-blue" />
                        <p className="text-sm font-semibold text-text-primary">Dados do aluno</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <InfoLine icon={User} label="Matricula" value={student?.registration_number} />
                        <InfoLine icon={GraduationCap} label="Curso" value={student?.course_name} />
                        <InfoLine icon={CalendarRange} label="Periodo atual" value={student?.current_period ? `${student.current_period}o periodo` : '--'} />
                        <InfoLine icon={Clock} label="Turno" value={student?.class_schedule} />
                        <InfoLine icon={CalendarRange} label="Ingresso" value={formatDate(student?.enrollment_date)} />
                        <InfoLine icon={CheckCircle2} label="Status" value={student?.status} />
                        <InfoLine
                            icon={ShieldAlert}
                            label="Trabalho"
                            value={student?.is_working ? (student?.work_schedule ? `Sim • ${student.work_schedule}` : 'Sim') : 'Nao'}
                        />
                    </div>
                </div>

                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-accent-purple" />
                        <p className="text-sm font-semibold text-text-primary">Indicadores estatisticos</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MetricMini label="GPA" value={Number(kpis.gpa || 0).toFixed(2)} />
                        <MetricMini label="Frequencia" value={`${Number(kpis.attendance_rate || 0).toFixed(0)}%`} />
                        <MetricMini label="Reprovacoes" value={kpis.failures ?? 0} />
                        <MetricMini label="Tendencia" value={formatTrend(kpis.grade_trend)} />
                    </div>
                </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-accent-blue" />
                        <p className="text-sm font-semibold text-text-primary">Historico sintetico</p>
                    </div>
                    {history?.length ? (
                        <div className="mt-4 space-y-3">
                            {history.map((item) => (
                                <div key={`${item.disciplina}-${item.media}`} className="rounded-2xl bg-white px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.situacao || 'Em andamento'}</p>
                                        </div>
                                        <span className={getGradeColorClass(item.media)}>
                                            {Number(item.media || 0).toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyInline text="Nenhum historico de notas encontrado." />
                    )}
                </div>

                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-accent-purple" />
                        <p className="text-sm font-semibold text-text-primary">Recomendacoes academicas</p>
                    </div>
                    {recommendations?.length ? (
                        <div className="mt-4 space-y-3">
                            {recommendations.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={mapPriorityToBadge(item.priority)}>{item.priority || 'prioridade'}</Badge>
                                        <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.message}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyInline text="Sem recomendacoes adicionais para este aluno no momento." />
                    )}
                </div>
            </div>
        </div>
    );
}

function GradesTab({ grades }) {
    if (!grades.length) {
        return <EmptyPanel icon={Award} title="Nenhuma nota encontrada" description="As notas do aluno serao exibidas aqui apos a sincronizacao." />;
    }

    return (
        <div className="space-y-3">
            {grades.map((grade, index) => (
                <motion.div
                    key={`${grade.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{grade.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">Avaliacao consolidada da disciplina</p>
                        </div>
                        <Badge variant={grade.situacao === 'Aprovado' ? 'success' : grade.situacao === 'Reprovado' ? 'danger' : 'warning'}>
                            {grade.situacao || 'Em andamento'}
                        </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                        <ScoreCell label="VA1" value={grade.va1} />
                        <ScoreCell label="VA2" value={grade.va2} />
                        <ScoreCell label="VA3" value={grade.va3} />
                        <ScoreCell label="Media" value={grade.media} highlight />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function AttendanceTab({ attendance }) {
    if (!attendance.length) {
        return <EmptyPanel icon={Clock} title="Nenhuma frequencia encontrada" description="Os dados de frequencia serao exibidos aqui apos a sincronizacao." />;
    }

    return (
        <div className="space-y-3">
            {attendance.map((item, index) => (
                <motion.div
                    key={`${item.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{item.total_faltas} faltas em {item.total_aulas} aulas</p>
                        </div>
                        <Badge variant={item.percentual_presenca >= 75 ? 'success' : item.percentual_presenca >= 60 ? 'warning' : 'danger'}>
                            {item.percentual_presenca?.toFixed(0)}%
                        </Badge>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white">
                        <div
                            className={`h-2 rounded-full ${item.percentual_presenca >= 75 ? 'bg-success' : item.percentual_presenca >= 60 ? 'bg-warning' : 'bg-danger'}`}
                            style={{ width: `${Math.min(item.percentual_presenca || 0, 100)}%` }}
                        />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function SubjectsTab({ subjects }) {
    if (!subjects.length) {
        return <EmptyPanel icon={BookOpen} title="Nenhuma disciplina encontrada" description="As disciplinas do aluno aparecerao aqui quando houver sincronizacao ou vinculo academico." />;
    }

    return (
        <div className="space-y-3">
            {subjects.map((subject, index) => (
                <motion.div
                    key={`${subject.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{subject.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{subject.docente || 'Docente nao informado'}</p>
                        </div>
                        <Badge variant={subject.situacao === 'Aprovado' || subject.situacao === 'Matriculado' ? 'success' : 'warning'}>
                            {subject.situacao || 'Em andamento'}
                        </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <InfoTile label="Periodo" value={subject.periodo} />
                        <InfoTile label="Inicio" value={subject.data_inicial} />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function ScheduleTab({ schedule }) {
    if (!schedule.length) {
        return <EmptyPanel icon={CalendarRange} title="Nenhum horario encontrado" description="O quadro de horarios sera exibido aqui quando o aluno tiver dados sincronizados." />;
    }

    return (
        <div className="space-y-3">
            {schedule.map((item, index) => (
                <motion.div
                    key={`${item.dia_nome}-${item.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{item.dia_nome} • {item.horario_inicio} - {item.horario_fim}</p>
                        </div>
                        <Badge variant="info">{item.local || 'Sem sala'}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">Professor: {item.professor || 'Nao informado'}</p>
                </motion.div>
            ))}
        </div>
    );
}

function MetricMini({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function InfoLine({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 text-accent-blue" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-text-primary">{value || '--'}</p>
        </div>
    );
}

function InfoTile({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-2 text-sm font-medium text-text-primary">{value || '--'}</p>
        </div>
    );
}

function ScoreCell({ label, value, highlight = false }) {
    return (
        <div className={`rounded-2xl p-3 text-center ${highlight ? 'border border-border-subtle bg-white' : 'bg-white/70'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className={`mt-2 text-lg font-semibold ${highlight ? getGradeColorClass(value) : 'text-text-primary'}`}>
                {value == null ? '--' : Number(value).toFixed(1)}
            </p>
        </div>
    );
}

function EmptyPanel({ icon: Icon, title, description }) {
    return (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue">
                <Icon className="h-6 w-6" />
            </div>
            <p className="mt-5 text-lg font-semibold text-text-primary">{title}</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
        </div>
    );
}

function EmptyInline({ text }) {
    return (
        <div className="rounded-[22px] border border-dashed border-border-subtle bg-white/60 px-5 py-10 text-center text-sm text-text-secondary">
            {text}
        </div>
    );
}

function getInitials(name = '') {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getGradeColorClass(value) {
    const numericValue = Number(value || 0);
    if (numericValue >= 7) return 'text-success';
    if (numericValue >= 5) return 'text-warning';
    return 'text-danger';
}

function getRiskBadgeVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function formatRiskLabel(level) {
    if (level === 'critical') return 'Risco critico';
    if (level === 'high') return 'Risco alto';
    if (level === 'medium') return 'Risco moderado';
    return 'Risco controlado';
}

function mapPriorityToBadge(priority) {
    if (priority === 'critical') return 'danger';
    if (priority === 'high') return 'warning';
    if (priority === 'medium') return 'info';
    return 'success';
}

function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
}

function formatTrend(value) {
    const numericValue = Number(value || 0);
    if (numericValue > 0) return `+${numericValue.toFixed(2)}`;
    return numericValue.toFixed(2);
}
