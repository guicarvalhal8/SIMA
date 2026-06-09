import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    BookOpen,
    Calendar,
    CheckCircle,
    Clock,
    Info,
    Lightbulb,
    Lock,
    RefreshCw,
    Shield,
    Sparkles,
    TrendingUp,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';

const riskLabels = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

export function StudentDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [grades, setGrades] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [schedule, setSchedule] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const insightsCacheKey = useMemo(() => (user?.id ? `sima_insights_${user.id}` : null), [user?.id]);
    const [aiInsights, setAiInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle');
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [hasCredentials, setHasCredentials] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [lyceumPassword, setLyceumPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const pollingRef = useRef(null);
    const autoSyncTriggered = useRef(false);

    const fetchStudentData = useCallback(async () => {
        try {
            const [profileRes, gradesRes, attendanceRes, scheduleRes, analyticsRes] = await Promise.allSettled([
                api.get('/students/me'),
                api.get('/students/me/grades'),
                api.get('/students/me/attendance'),
                api.get('/students/me/schedule'),
                api.get('/analytics/me'),
            ]);

            if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
            if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
            if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value.data);
            if (scheduleRes.status === 'fulfilled') setSchedule(scheduleRes.value.data);
            if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
        } catch (error) {
            console.error('Erro ao carregar dados do aluno', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAiInsights = async () => {
        setLoadingInsights(true);
        try {
            const response = await api.get('/analytics/me/ai-insights');
            setAiInsights(response.data);
            if (insightsCacheKey) {
                localStorage.setItem(insightsCacheKey, JSON.stringify(response.data));
            }
        } catch (error) {
            console.error('Erro ao buscar insights', error);
        } finally {
            setLoadingInsights(false);
        }
    };

    const fetchSyncStatus = useCallback(async () => {
        try {
            const response = await api.get('/students/me/sync-status');
            setSyncStatus(response.data.sync_status);
            setLastSyncAt(response.data.last_sync_at);
            setSyncError(response.data.sync_error);
            setHasCredentials(response.data.has_lyceum_credentials);
            return response.data;
        } catch (error) {
            console.error('Erro ao verificar sync', error);
            return null;
        }
    }, []);

    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            const data = await fetchSyncStatus();
            if (data && data.sync_status !== 'syncing') {
                clearInterval(pollingRef.current);
                pollingRef.current = null;

                if (data.sync_status === 'done') {
                    fetchStudentData();
                }
            }
        }, 3000);
    }, [fetchSyncStatus, fetchStudentData]);

    const startSync = async () => {
        try {
            setSyncError(null);
            await api.post('/students/me/sync');
            setSyncStatus('syncing');
            startPolling();
        } catch (error) {
            setSyncError(error.response?.data?.detail || 'Erro ao iniciar sincronizacao');
            if (error.response?.status === 400) {
                setShowPasswordModal(true);
            }
        }
    };

    const savePassword = async () => {
        if (!lyceumPassword) return;

        setSavingPassword(true);
        try {
            await api.post('/students/me/lyceum-credentials', { lyceum_password: lyceumPassword });
            setHasCredentials(true);
            setShowPasswordModal(false);
            setLyceumPassword('');
            await startSync();
        } catch (error) {
            setSyncError(error.response?.data?.detail || 'Erro ao salvar credenciais');
        } finally {
            setSavingPassword(false);
        }
    };

    useEffect(() => {
        setProfile(null);
        setGrades(null);
        setAttendance(null);
        setSchedule(null);
        setAnalytics(null);
        setAiInsights(null);
        setLoading(true);
        setLoadingInsights(false);
        setSyncStatus('idle');
        setLastSyncAt(null);
        setSyncError(null);
        setHasCredentials(false);
        autoSyncTriggered.current = false;

        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, [user?.id]);

    useEffect(() => {
        if (!insightsCacheKey) {
            setAiInsights(null);
            return;
        }

        try {
            const cached = localStorage.getItem(insightsCacheKey);
            setAiInsights(cached ? JSON.parse(cached) : null);
            localStorage.removeItem('sima_insights_undefined');
        } catch {
            setAiInsights(null);
        }
    }, [insightsCacheKey]);

    useEffect(() => {
        fetchStudentData();
        fetchSyncStatus().then((data) => {
            if (data && !data.last_sync_at && data.has_lyceum_credentials && !autoSyncTriggered.current) {
                autoSyncTriggered.current = true;
                startSync();
            } else if (data && !data.last_sync_at && !data.has_lyceum_credentials && !autoSyncTriggered.current) {
                autoSyncTriggered.current = true;
                setShowPasswordModal(true);
            } else if (data && data.sync_status === 'syncing') {
                startPolling();
            }
        });

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [fetchStudentData, fetchSyncStatus, startPolling]);

    const risk = getRiskConfig(analytics?.kpis?.risk_level);
    const gpa = analytics?.kpis?.gpa ?? getAverage(grades?.grades, 'media');
    const attendanceRate = analytics?.kpis?.attendance_rate ?? getAverage(attendance?.attendance, 'percentual_presenca');
    const recommendations = analytics?.recommendations || [];
    const flaggedAttendance = buildAttendanceAlerts(attendance?.attendance || []);
    const scheduleItems = useMemo(() => (
        schedule?.schedule || schedule?.subjects || schedule?.classes || schedule?.items || []
    ), [schedule]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Olá, ${profile?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Aluno'}`}
                subtitle="Acompanhe desempenho, risco acadêmico e próximos passos em uma interface mais clara e objetiva."
                icon={BookOpen}
                actions={(
                    <>
                        {!hasCredentials && (
                            <Button variant="secondary" icon={Lock} onClick={() => setShowPasswordModal(true)}>
                                Configurar Lyceum
                            </Button>
                        )}
                        <Button icon={RefreshCw} onClick={startSync} loading={syncStatus === 'syncing'} disabled={syncStatus === 'syncing' || !hasCredentials}>
                            {syncStatus === 'syncing' ? 'Sincronizando' : 'Sincronizar dados'}
                        </Button>
                    </>
                )}
            />

            <Card variant="hero">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${risk.wrapper}`}>
                            <risk.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Conexão com o portal acadêmico</p>
                            <h3 className="mt-2 text-lg font-semibold text-text-primary">
                                {syncStatus === 'syncing' ? 'Atualizando dados no Lyceum' : syncStatus === 'done' ? 'Dados sincronizados com sucesso' : 'Sincronização pendente'}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                                {lastSyncAt ? `Última sincronização em ${formatDate(lastSyncAt)}.` : 'Nenhuma sincronização concluída até o momento.'}
                                {syncError ? ` ${syncError}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusChip
                            icon={syncStatus === 'error' ? WifiOff : Wifi}
                            tone={syncStatus === 'error' ? 'danger' : syncStatus === 'done' ? 'success' : 'info'}
                            label={syncStatus === 'syncing' ? 'Sincronizando' : syncStatus === 'done' ? 'Atualizado' : 'Aguardando'}
                        />
                        <StatusChip icon={risk.icon} tone={risk.badge} label={risk.label} />
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Disciplinas" value={grades?.total_disciplinas || 0} icon={BookOpen} tone="blue" helper="Componentes acompanhados no período" />
                <MetricCard title="Média geral" value={Number(gpa || 0).toFixed(1)} icon={TrendingUp} tone="emerald" helper="Desempenho consolidado do semestre" />
                <MetricCard title="Frequência" value={`${Number(attendanceRate || 0).toFixed(0)}%`} icon={Calendar} tone="amber" helper="Presença média nas disciplinas" />
                <MetricCard title="Risco acadêmico" value={risk.shortLabel} icon={risk.icon} tone={risk.metricTone} helper="Classificação atual da jornada" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card>
                    <CardHeader
                        title="Leitura inteligente da jornada"
                        subtitle="Resumo gerado a partir do seu histórico acadêmico mais recente"
                        icon={Sparkles}
                        action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchAiInsights} loading={loadingInsights}>Atualizar</Button>}
                    />

                    {loadingInsights ? (
                        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40">
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
                            <p className="text-sm text-text-secondary">A NEXORA está sintetizando seus dados acadêmicos.</p>
                        </div>
                    ) : aiInsights && !aiInsights.error ? (
                        <div className="space-y-5">
                            <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-5">
                                <p className="text-sm leading-7 text-text-primary">{aiInsights.summary || 'Sem resumo disponível no momento.'}</p>
                            </div>

                            <InsightGroup title="Pontos fortes" icon={CheckCircle} tone="success" items={aiInsights.strengths} />
                            <InsightGroup title="Pontos de atenção" icon={AlertTriangle} tone="warning" items={aiInsights.alerts} />
                            <InsightGroup title="Dicas de estudo" icon={Lightbulb} tone="info" items={aiInsights.study_tips} />
                        </div>
                    ) : (
                        <EmptyState
                            icon={Sparkles}
                            title="Ainda não há insights gerados"
                            description="Gere a primeira leitura automática para destacar avanços, riscos e estratégias recomendadas."
                            action={<Button onClick={fetchAiInsights}>Gerar insight</Button>}
                        />
                    )}
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader
                            title="Prioridades do momento"
                            subtitle="Ações sugeridas para organizar sua rotina"
                            icon={Shield}
                        />
                        <div className="space-y-3">
                            {recommendations.length > 0 ? recommendations.slice(0, 4).map((rec) => (
                                <div key={`${rec.title}-${rec.message}`} className="rounded-[22px] border border-border-subtle bg-bg-secondary/50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-text-primary">{rec.title}</p>
                                        <Badge variant={rec.priority === 'critical' ? 'danger' : rec.priority === 'high' ? 'warning' : 'info'}>
                                            {riskLabels[rec.priority] || rec.priority}
                                        </Badge>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">{rec.message}</p>
                                </div>
                            )) : (
                                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/50 p-4 text-sm text-text-secondary">
                                    Nenhuma recomendação crítica no momento. Continue acompanhando seu desempenho regularmente.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="Agenda acadêmica" subtitle="Referências rápidas do seu contexto atual" icon={Clock} />
                        {scheduleItems.length > 0 ? (
                            <div className="space-y-3">
                                {scheduleItems.slice(0, 4).map((item, index) => (
                                    <div key={index} className="rounded-[20px] border border-border-subtle bg-bg-secondary/45 p-4">
                                        <p className="text-sm font-semibold text-text-primary">
                                            {item.disciplina || item.course_name || item.name || 'Disciplina'}
                                        </p>
                                        <p className="mt-1 text-sm text-text-secondary">
                                            {item.horario || item.time || item.schedule || item.turno || 'Horário não informado'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 p-5 text-sm text-text-secondary">
                                O horário de aulas ainda não foi sincronizado para exibição neste painel.
                            </div>
                        )}
                    </Card>

                    <Card>
                        <CardHeader title="Atenção à frequência" subtitle="Limite de 20 faltas por disciplina e 4 faltas por dia completo" icon={Calendar} />
                        <div className="space-y-3">
                            {flaggedAttendance.length > 0 ? flaggedAttendance.map((item) => (
                                <div key={item.disciplina} className="rounded-[20px] border border-border-subtle bg-bg-secondary/45 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.summary}</p>
                                        </div>
                                        <span className={`text-sm font-semibold ${item.toneClass}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-white">
                                        <div
                                            className={`h-2 rounded-full ${item.barClass}`}
                                            style={{ width: `${Math.min(item.progress || 0, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4 text-sm text-success">
                                    Sua frequência está em margem segura nas disciplinas monitoradas.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader title="Notas por disciplina" subtitle="Visão detalhada das avaliações lançadas no período" icon={BookOpen} />
                {grades?.grades?.length > 0 ? (
                    <div className="table-shell overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-subtle bg-bg-secondary/55 text-left text-text-tertiary">
                                    <th className="px-6 py-4 font-semibold">Disciplina</th>
                                    <th className="px-6 py-4 text-center font-semibold">VA1</th>
                                    <th className="px-6 py-4 text-center font-semibold">VA2</th>
                                    <th className="px-6 py-4 text-center font-semibold">VA3</th>
                                    <th className="px-6 py-4 text-center font-semibold">Média</th>
                                    <th className="px-6 py-4 text-center font-semibold">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grades.grades.map((grade, index) => (
                                    <motion.tr
                                        key={`${grade.disciplina}-${index}`}
                                        className="table-row-hover border-b border-border-subtle/60 last:border-none"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                    >
                                        <td className="px-6 py-4 font-semibold text-text-primary">{grade.disciplina}</td>
                                        <td className="px-6 py-4 text-center text-text-secondary">{formatGrade(grade.va1)}</td>
                                        <td className="px-6 py-4 text-center text-text-secondary">{formatGrade(grade.va2)}</td>
                                        <td className="px-6 py-4 text-center text-text-secondary">{formatGrade(grade.va3)}</td>
                                        <td className={`px-6 py-4 text-center font-semibold ${getGradeColor(grade.media)}`}>{formatGrade(grade.media)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={grade.situacao === 'Aprovado' ? 'success' : grade.situacao === 'Reprovado' ? 'danger' : 'warning'}>
                                                {grade.situacao || 'Em andamento'}
                                            </Badge>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={BookOpen}
                        title="Sem notas sincronizadas"
                        description="Sincronize seus dados do Lyceum para visualizar notas e situação de cada disciplina."
                    />
                )}
            </Card>

            <Card>
                <CardHeader title="Frequência por disciplina" subtitle="Presença acumulada e faltas registradas no período" icon={Calendar} />
                {attendance?.attendance?.length > 0 ? (
                    <div className="space-y-3">
                        {attendance.attendance.map((item, index) => (
                            <motion.div
                                key={`${item.disciplina}-${index}`}
                                className="rounded-[22px] border border-border-subtle bg-bg-secondary/50 p-4"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                                        <p className="mt-1 text-sm text-text-secondary">
                                            {formatAttendanceSummary(item)}
                                        </p>
                                    </div>
                                    <Badge variant={item.percentual_presenca >= 75 ? 'success' : item.percentual_presenca >= 50 ? 'warning' : 'danger'}>
                                        {item.percentual_presenca?.toFixed(0)}%
                                    </Badge>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Calendar}
                        title="Sem frequência disponível"
                        description="A frequência será exibida aqui após a sincronização do seu portal acadêmico."
                    />
                )}
            </Card>

            <AnimatePresence>
                {showPasswordModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowPasswordModal(false)}
                    >
                        <motion.div
                            className="w-full max-w-lg"
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.98 }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <Card className="shadow-card-hover">
                                <CardHeader
                                    title="Configurar acesso ao Lyceum"
                                    subtitle="Informe a senha do portal acadêmico para liberar a sincronização automática de notas, frequências e horário."
                                    icon={Lock}
                                />
                                <div className="space-y-5">
                                    <Input
                                        label="Senha do portal"
                                        type="password"
                                        icon={Lock}
                                        value={lyceumPassword}
                                        onChange={(event) => setLyceumPassword(event.target.value)}
                                        placeholder="Digite sua senha do Lyceum"
                                    />

                                    <div className="rounded-[20px] border border-border-subtle bg-bg-secondary/45 p-4 text-sm leading-6 text-text-secondary">
                                        Seus dados são usados apenas para sincronizar informações acadêmicas dentro da NEXORA.
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                        <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
                                            Cancelar
                                        </Button>
                                        <Button onClick={savePassword} loading={savingPassword} disabled={!lyceumPassword}>
                                            Salvar e sincronizar
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function InsightGroup({ title, icon: Icon, tone, items = [] }) {
    if (!items.length) return null;

    const toneClasses = {
        success: 'bg-success/10 text-success border-success/15',
        warning: 'bg-warning/10 text-warning border-warning/15',
        info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/15',
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${toneClasses[tone]}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                    <div key={item.title} className="rounded-[20px] border border-border-subtle bg-bg-secondary/45 p-4">
                        <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusChip({ icon: Icon, tone, label }) {
    const variants = {
        success: 'bg-success/10 text-success border-success/15',
        danger: 'bg-danger/10 text-danger border-danger/15',
        info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/15',
        warning: 'bg-warning/10 text-warning border-warning/15',
    };

    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${variants[tone] || variants.info}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
        </span>
    );
}

function getRiskConfig(level) {
    switch (level) {
        case 'critical':
            return { label: 'Risco crítico', shortLabel: 'Crítico', wrapper: 'bg-danger/10 text-danger', badge: 'danger', metricTone: 'rose', icon: AlertTriangle };
        case 'high':
            return { label: 'Risco alto', shortLabel: 'Alto', wrapper: 'bg-warning/10 text-warning', badge: 'warning', metricTone: 'amber', icon: AlertTriangle };
        case 'medium':
            return { label: 'Risco moderado', shortLabel: 'Médio', wrapper: 'bg-accent-blue/10 text-accent-blue', badge: 'info', metricTone: 'blue', icon: Info };
        default:
            return { label: 'Risco controlado', shortLabel: 'Controlado', wrapper: 'bg-success/10 text-success', badge: 'success', metricTone: 'emerald', icon: CheckCircle };
    }
}

const MAX_ABSENCES_PER_SUBJECT = 20;
const ABSENCES_PER_FULL_DAY = 4;

function buildAttendanceAlerts(items = []) {
    return items
        .map((item) => buildAttendanceAlert(item))
        .filter(Boolean)
        .sort((a, b) => b.absences - a.absences)
        .slice(0, 4);
}

function buildAttendanceAlert(item) {
    const absences = Number(item?.total_faltas ?? 0);
    if (!Number.isFinite(absences) || absences < 8) {
        return null;
    }

    const remainingAbsences = Math.max(0, MAX_ABSENCES_PER_SUBJECT - absences);
    const remainingFullDays = Math.floor(remainingAbsences / ABSENCES_PER_FULL_DAY);
    const progress = (absences / MAX_ABSENCES_PER_SUBJECT) * 100;

    let toneClass = 'text-warning';
    let barClass = 'bg-warning';
    if (absences >= 16) {
        toneClass = 'text-danger';
        barClass = 'bg-danger';
    }

    const label = `${absences}/${MAX_ABSENCES_PER_SUBJECT} faltas`;
    const summary = remainingAbsences === 0
        ? 'Você atingiu o limite de faltas da disciplina.'
        : `${remainingAbsences} faltas restantes até o limite, cerca de ${remainingFullDays} dia${remainingFullDays === 1 ? '' : 's'} completo${remainingFullDays === 1 ? '' : 's'} de margem.`;

    return {
        ...item,
        absences,
        remainingAbsences,
        remainingFullDays,
        progress,
        label,
        summary,
        toneClass,
        barClass,
    };
}

function getAverage(items = [], key) {
    if (!items.length) return 0;
    return items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / items.length;
}

function formatAttendanceSummary(item) {
    const totalClasses = item?.total_aulas;
    const absences = item?.total_faltas;
    const hasConfirmedAbsences = item?.faltas_confirmadas !== false && absences != null;

    if (hasConfirmedAbsences && totalClasses != null) {
        return `${absences} faltas em ${totalClasses} aulas`;
    }

    if (totalClasses != null) {
        return `${totalClasses} aulas registradas no portal`;
    }

    return 'Presença sincronizada do portal acadêmico';
}

function getGradeColor(value) {
    if (value >= 7) return 'text-success';
    if (value >= 5) return 'text-warning';
    return 'text-danger';
}

function formatGrade(value) {
    return value == null ? '--' : Number(value).toFixed(1);
}

function formatDate(value) {
    if (!value) return '--';
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}



