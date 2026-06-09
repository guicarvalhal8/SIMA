import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Loader2,
    ShieldAlert,
    Sparkles,
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
import { buildRolePath, getRoleMeta } from '@/lib/app-shell';

function getRiskVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

const riskLabels = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

function buildAnalysisLink(role, analysis, params = {}) {
    const query = new URLSearchParams({ analysis });
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            query.set(key, String(value));
        }
    });
    return `${buildRolePath(role, 'analysis-center')}?${query.toString()}`;
}

export function ProfessorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [overview, setOverview] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    // Identificação de Papel de Pró-Reitor (Admin)
    const isProReitor = user?.role === 'admin';

    // Estados Técnicos de Insights de IA e Dados do Pró-Reitor
    const [proreitorStats, setProreitorStats] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    // Estados adicionais para planilhas individuais e insights locais
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [selectedDashboardSpreadsheetId, setSelectedDashboardSpreadsheetId] = useState('general');
    const [singleSpreadsheetInsights, setSingleSpreadsheetInsights] = useState(null);
    const [singleSpreadsheetLoading, setSingleSpreadsheetLoading] = useState(false);
    const [singleSpreadsheetData, setSingleSpreadsheetData] = useState(null);

    const handleGenerateAiInsights = async () => {
        setAiLoading(true);
        try {
            const endpoint = isProReitor 
                ? '/analytics/proreitor/ai-insights' 
                : '/analytics/ai-insights';
            const res = await api.get(endpoint);
            setAiInsights(res.data.insights || res.data.response);
        } catch (err) {
            console.error('Erro ao gerar insights de IA', err);
        } finally {
            setAiLoading(false);
        }
    };

    const handleLoadSingleSpreadsheetInsights = async (spreadsheetId) => {
        if (!spreadsheetId) {
            setSingleSpreadsheetData(null);
            setSingleSpreadsheetInsights(null);
            return;
        }

        const selectedSheet = spreadsheets.find(s => s.id === Number(spreadsheetId));
        if (selectedSheet) {
            setSingleSpreadsheetData(selectedSheet);
        }

        setSingleSpreadsheetLoading(true);
        setSingleSpreadsheetInsights(null);
        try {
            const response = await api.post(`/historical-data/spreadsheets/${spreadsheetId}/ai-insights`);
            if (response.data && response.data.insights) {
                setSingleSpreadsheetInsights(response.data.insights);
            } else {
                setSingleSpreadsheetInsights('O Gemini não retornou insights para esta planilha.');
            }
        } catch (error) {
            console.error('Erro ao carregar insights de planilha única no dashboard', error);
            setSingleSpreadsheetInsights('Não foi possível gerar os insights com IA para a planilha selecionada. Verifique as configurações da GEMINI_API_KEY no arquivo .env.');
        } finally {
            setSingleSpreadsheetLoading(false);
        }
    };

    const roleMeta = useMemo(() => getRoleMeta(user?.role), [user?.role]);
    const historicalDataRoute = buildRolePath(user?.role, 'historical-data');
    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    const [realDataLoaded, setRealDataLoaded] = useState(false);
    const [realDataLoading, setRealDataLoading] = useState(false);

    const fetchRealData = async () => {
        if (realDataLoaded || realDataLoading) return;
        setRealDataLoading(true);
        try {
            const [overviewRes, studentsRes] = await Promise.allSettled([
                api.get('/professors/me/overview'),
                api.get('/professors/me/students'),
            ]);

            if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
            if (studentsRes.status === 'fulfilled') setSubjectStudents(studentsRes.value.data);
            setRealDataLoaded(true);
        } catch (error) {
            console.error('Erro ao carregar dados em tempo real', error);
        } finally {
            setRealDataLoading(false);
        }
    };

    useEffect(() => {
        async function fetchInitialData() {
            setLoading(true);
            try {
                if (isProReitor) {
                    const [statsRes, workspaceRes] = await Promise.allSettled([
                        api.get('/analytics/proreitor/stats'),
                        api.get('/historical-data/analysis-workspace'),
                    ]);

                    if (statsRes.status === 'fulfilled') setProreitorStats(statsRes.value.data);
                    if (workspaceRes.status === 'fulfilled') setWorkspace(workspaceRes.value.data);
                    setProfile({ user_name: 'Pró-Reitor' });
                } else {
                    const [profileRes, workspaceRes] = await Promise.allSettled([
                        api.get('/professors/me'),
                        api.get('/historical-data/analysis-workspace'),
                    ]);

                    if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                    if (workspaceRes.status === 'fulfilled') setWorkspace(workspaceRes.value.data);
                }

                // Buscar planilhas disponíveis para o professor ou pró-reitor
                try {
                    const spreadsheetsRes = await api.get('/historical-data/spreadsheets');
                    if (spreadsheetsRes.data && spreadsheetsRes.data.spreadsheets) {
                        setSpreadsheets(spreadsheetsRes.data.spreadsheets);
                    }
                } catch (spErr) {
                    console.error('Erro ao buscar planilhas no dashboard', spErr);
                }
            } catch (error) {
                console.error('Erro ao carregar dashboard docente', error);
            } finally {
                setLoading(false);
            }
        }

        fetchInitialData();
    }, [isProReitor]);

    const [dataSource, setDataSource] = useState('real'); // 'real' ou 'historical'

    // Sempre que o dataSource mudar para 'real', carregar os dados se necessário
    useEffect(() => {
        if (dataSource === 'real' && !isProReitor) {
            fetchRealData();
        }
    }, [dataSource, isProReitor]);

    // Chaveia automaticamente para 'historical' se houver dados históricos subidos no banco
    useEffect(() => {
        if (workspace?.overview?.total_records > 0) {
            setDataSource('historical');
        }
    }, [workspace]);


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

    // Mapeamento dinâmico e reativo baseado na fonte de dados ativa
    const displayedTotalSubjects = useMemo(() => {
        if (dataSource === 'historical') {
            return workspace?.overview?.total_classes || 0;
        }
        return subjectStudents.length;
    }, [dataSource, subjectStudents, workspace]);

    const displayedTotalStudents = useMemo(() => {
        if (dataSource === 'historical') {
            return workspace?.overview?.total_students || 0;
        }
        return totalStudents;
    }, [dataSource, totalStudents, workspace]);

    const displayedAtRiskCount = useMemo(() => {
        if (dataSource === 'historical') {
            return workspace?.analysis_data?.by_class?.reduce((sum, cls) => sum + (cls.critical_students || 0), 0) || 0;
        }
        return overview?.kpis?.at_risk_count || 0;
    }, [dataSource, overview, workspace]);

    const displayedCriticalClassesCount = useMemo(() => {
        if (dataSource === 'historical') {
            return workspace?.overview?.critical_classes || 0;
        }
        return 0;
    }, [dataSource, workspace]);

    const displayedTopAtRisk = useMemo(() => {
        if (dataSource === 'historical') {
            const allRiskStudents = [];
            const seen = new Set();
            workspace?.analysis_data?.by_class?.forEach((cls) => {
                cls.at_risk_students?.forEach((stud) => {
                    const uniqueKey = stud.student_name + '-' + stud.subject;
                    if (!seen.has(uniqueKey)) {
                        seen.add(uniqueKey);
                        allRiskStudents.push({
                            student_id: stud.student_id || stud.record_id,
                            student_name: stud.student_name,
                            registration_number: stud.record_id ? `REG-${stud.record_id}` : 'Histórico',
                            gpa: stud.grade_average,
                            attendance_rate: stud.attendance,
                            risk_score: stud.risk_score,
                            risk_level: stud.risk_level,
                            is_historical: true,
                            course_name: stud.course_name || cls.course_name,
                        });
                    }
                });
            });
            return allRiskStudents.sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
        }
        return topAtRisk;
    }, [dataSource, topAtRisk, workspace]);

    const displayedCriticalClasses = useMemo(() => {
        if (dataSource === 'historical') {
            return criticalClasses;
        }
        return [];
    }, [dataSource, criticalClasses]);

    const displayedCriticalSubjects = useMemo(() => {
        if (dataSource === 'historical') {
            return criticalSubjects;
        }
        return [];
    }, [dataSource, criticalSubjects]);

    const displayedUrgentAlerts = useMemo(() => {
        if (dataSource === 'historical') {
            return urgentAlerts;
        }
        return [];
    }, [dataSource, urgentAlerts]);

    return (
        <div className="space-y-6">

            {isProReitor ? (
                <div className="space-y-6">
                    {/* KPIs do Pró-Reitor */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <MetricCard
                            title="Cursos monitorados"
                            value={loading ? '...' : proreitorStats?.ranking_courses?.length || 0}
                            helper="Cursos ativos acompanhados no campus"
                            icon={Layers3}
                            tone="indigo"
                        />
                        <MetricCard
                            title="Total de alunos ativos"
                            value={loading ? '...' : proreitorStats?.ranking_courses?.reduce((sum, item) => sum + item.student_count, 0) || 0}
                            helper="Matrículas ativas consolidadas"
                            icon={Users}
                            tone="blue"
                        />
                        <MetricCard
                            title="Disciplinas monitoradas"
                            value={loading ? '...' : proreitorStats?.ranking_subjects?.length || 0}
                            helper="Componentes curriculares em escopo"
                            icon={BookOpen}
                            tone="amber"
                        />
                    </div>

                    {/* Insights da IA para Pró-Reitoria */}
                    {aiInsights && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr] mb-6">
                            <Card>
                                <CardHeader
                                    title="Diretrizes e Insights da IA (Gemini)"
                                    subtitle="Plano estratégico de governança e ações de retenção institucional"
                                    icon={BrainCircuit}
                                />
                                <div className="p-6 border-t border-border-subtle bg-bg-secondary/10 rounded-b-[24px]">
                                    <MarkdownRenderer text={aiInsights} />
                                </div>
                            </Card>

                            <DashboardAIChat 
                                endpoint="/api/analytics/proreitor/chat"
                                title="Chat de IA - Pró-Reitoria"
                                placeholder="Pergunte sobre rankings de disciplinas, cursos críticos ou governança..."
                            />
                        </div>
                    )}

                    {/* Rankings Institucionais */}
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <Card>
                            <CardHeader
                                title="Ranking de desempenho por curso"
                                subtitle="Desempenho agregado ordenado pelo GPA geral do curso"
                                icon={Layers3}
                            />
                            <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                                {proreitorStats?.ranking_courses?.map((course, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-bg-secondary/40 border border-border-subtle">
                                        <div>
                                            <p className="text-xs font-semibold text-text-primary">{course.course_name}</p>
                                            <p className="text-[10px] text-text-secondary mt-1">{course.student_count} alunos</p>
                                        </div>
                                        <div className="flex gap-4 text-right">
                                            <div className="px-3 py-1 bg-white rounded-xl">
                                                <p className="text-[9px] text-text-tertiary">GPA</p>
                                                <p className="text-xs font-bold text-text-primary mt-0.5">{course.average_gpa != null ? Number(course.average_gpa).toFixed(2) : '--'}</p>
                                            </div>
                                            <div className="px-3 py-1 bg-white rounded-xl">
                                                <p className="text-[9px] text-text-tertiary">Frequência</p>
                                                <p className="text-xs font-bold text-text-primary mt-0.5">{course.average_attendance != null ? Number(course.average_attendance).toFixed(1) : '--'}%</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Ranking de disciplinas críticas"
                                subtitle="Componentes com menores médias e taxas de aprovação"
                                icon={AlertTriangle}
                            />
                            <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                                {proreitorStats?.ranking_subjects?.map((sub, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-bg-secondary/40 border border-border-subtle">
                                        <div>
                                            <p className="text-xs font-semibold text-text-primary">{sub.subject_name}</p>
                                            <p className="text-[10px] text-text-secondary mt-1">{sub.records_count} lançamentos</p>
                                        </div>
                                        <div className="flex gap-4 text-right">
                                            <div className="px-3 py-1 bg-white rounded-xl">
                                                <p className="text-[9px] text-text-tertiary">Média</p>
                                                <p className="text-xs font-bold text-text-primary mt-0.5">{sub.average_grade != null ? Number(sub.average_grade).toFixed(2) : '--'}</p>
                                            </div>
                                            <div className="px-3 py-1 bg-white rounded-xl">
                                                <p className="text-[9px] text-text-tertiary">Aprovação</p>
                                                <p className="text-xs font-bold text-text-primary mt-0.5">{sub.pass_rate != null ? Number(sub.pass_rate).toFixed(1) : '--'}%</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            ) : (
                // RENDERING DO PROFESSOR (LÓGICA ORIGINAL CLÁSSICA COM SUGESTÃO DE LAYOUT DUPLO E BLINDAGEM)
                <>
                    {/* CHAVEADOR DE CONTEXTO DE DADOS PREMIUM GLASSMORPHIC */}
                    <div className="flex justify-between items-center bg-white/40 border border-white/50 backdrop-blur-md px-6 py-4 rounded-[24px] shadow-soft mb-6 flex-wrap gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                                <BrainCircuit className="h-4 w-4 text-indigo-600 animate-pulse" />
                                Fonte Ativa de Análise e Monitoramento
                            </h3>
                            <p className="text-[11px] text-text-secondary mt-0.5">
                                Escolha visualizar os dados em tempo real (Lyceum) ou as análises dos dashboards de planilhas.
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-1 bg-white/80 p-1 rounded-xl shadow-inner border border-black/5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setDataSource('real')}
                                className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                    dataSource === 'real'
                                        ? 'bg-indigo-600 text-white shadow-soft'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                                }`}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Dados em Tempo Real (Lyceum)
                            </button>
                            <button
                                type="button"
                                onClick={() => setDataSource('historical')}
                                className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                    dataSource === 'historical'
                                        ? 'bg-indigo-600 text-white shadow-soft'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                                }`}
                            >
                                <BrainCircuit className="h-3.5 w-3.5" />
                                Dashboard de Planilhas
                            </button>
                        </div>
                    </div>

                    <Card variant="hero">
                        <div className={`rounded-[28px] border border-white/70 dark:border-white/5 bg-gradient-to-br ${roleMeta.softAccent} dark:from-accent-indigo/5 dark:via-accent-purple/5 dark:to-accent-blue/5 px-6 py-6 shadow-[0_24px_48px_-36px_rgba(11,87,208,0.45)]`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${roleMeta.badge}`}>
                                {roleMeta.label}
                            </span>
                            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
                                {roleMeta.area}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                                Monitoramento institucional com foco em desempenho, risco e tomada de decisão.
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

            {/* CONTEÚDO DINÂMICO DOS MODOS DE DADOS E INSIGHTS */}
            {dataSource === 'real' && (
                <>
                    {/* Alerta de Modo de Dados em Tempo Real Ativo com Aviso de Tempo de Carregamento */}
                    <div className="rounded-[24px] border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-yellow-500/5 backdrop-blur-md px-6 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-700">
                                <AlertTriangle className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-amber-900 tracking-wide uppercase">
                                    Modo de Dados em Tempo Real (Lyceum)
                                </h4>
                                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                                    Extraindo informações diretamente do Lyceum. <strong>Este processo pode demorar um pouco mais, pois os dados são extraídos em tempo real.</strong>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-500/30 animate-pulse">
                                Conexão Ativa
                            </span>
                        </div>
                    </div>

                    {realDataLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3 bg-white/40 border border-white/50 backdrop-blur-md rounded-[28px] shadow-soft">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                            <p className="text-sm font-bold animate-pulse text-indigo-900">
                                Sincronizando dados em tempo real com o Lyceum...
                            </p>
                            <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl mt-2 font-medium max-w-md text-center">
                                ⚠️ Atenção: Esta operação pode demorar um pouco mais para carregar por completo, pois os dados são extraídos em tempo real.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* KPIs Reais */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                                <MetricCard
                                    title="Disciplinas ativas"
                                    value={loading ? '...' : displayedTotalSubjects}
                                    helper={`${academicCourses.length} cursos acadêmicos vinculados`}
                                    icon={BookOpen}
                                    tone="indigo"
                                />
                                <MetricCard
                                    title="Alunos monitorados"
                                    value={loading ? '...' : displayedTotalStudents}
                                    helper="Base atual das turmas que você acompanha"
                                    icon={Users}
                                    tone="blue"
                                />
                                <MetricCard
                                    title="Casos em alerta"
                                    value={loading ? '...' : displayedAtRiskCount}
                                    helper="Alunos reais com necessidade de intervenção"
                                    icon={AlertTriangle}
                                    tone="rose"
                                />
                                <MetricCard
                                    title="Turmas críticas"
                                    value={loading ? '...' : displayedCriticalClassesCount}
                                    helper="Disciplinas ativas do Lyceum sob alerta"
                                    icon={ShieldAlert}
                                    tone="amber"
                                />
                            </div>

                            {/* Alunos que pedem ação imediata e Chat de IA em Duas Colunas (Real) */}
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                                <Card>
                                    <CardHeader
                                        title="Alunos que pedem ação imediata"
                                        subtitle="Clique no aluno para abrir o painel completo com notas, frequência e indicadores do Lyceum."
                                        icon={CheckCircle2}
                                    />
                                    {displayedTopAtRisk.length > 0 ? (
                                        <div className="space-y-3">
                                            {displayedTopAtRisk.slice(0, 8).map((student, index) => (
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
                                                        <div className="flex flex-col gap-1 mt-1">
                                                            <p className="text-[11px] text-text-secondary">Matrícula: {student.registration_number}</p>
                                                            <p className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 w-max">
                                                                Curso: {student.course_name || 'Não informado'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <InlineMetric label="GPA" value={student.gpa != null ? Number(student.gpa).toFixed(2) : '--'} />
                                                    <InlineMetric label="Presença" value={student.attendance_rate != null ? `${Number(student.attendance_rate).toFixed(0)}%` : '--'} />
                                                    <InlineMetric label="Risco" value={student.risk_score != null ? `${(Number(student.risk_score) * 100).toFixed(0)}%` : '--'} />
                                                    <div className="flex items-center lg:justify-end">
                                                        <Badge variant={getRiskVariant(student.risk_level)}>{riskLabels[student.risk_level] || student.risk_level}</Badge>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Users}
                                            title="Sem alunos em alerta relevante"
                                            description="Quando houver combinação preocupante entre nota e presença no Lyceum, os alunos aparecerão aqui."
                                        />
                                    )}
                                </Card>

                                <DashboardAIChat 
                                    endpoint="/api/analytics/ai-insights/chat"
                                    title="Chat de IA - Dados em Tempo Real"
                                    placeholder="Pergunte sobre alunos, notas, faltas no Lyceum..."
                                />
                            </div>


                        </>
                    )}
                </>
            )}

            {dataSource === 'historical' && (
                <div className="space-y-6">
                    {/* BARRA DE SELEÇÃO LOCAL DE HISTÓRICO DE PLANILHAS */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 border border-white/50 backdrop-blur-md px-6 py-4 rounded-[24px] shadow-soft mb-6">
                        <div>
                            <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                                <BrainCircuit className="h-4 w-4 text-indigo-600 animate-pulse" />
                                Foco da Análise Histórica
                            </h4>
                            <p className="text-[11px] text-text-secondary mt-0.5">
                                Escolha fazer uma análise geral do histórico ou selecione uma planilha específica para gerar análises e diagnósticos pedagógicos de IA.
                            </p>
                        </div>
                        <div className="min-w-[280px]">
                            <select
                                value={selectedDashboardSpreadsheetId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedDashboardSpreadsheetId(val);
                                    if (val && val !== 'general') {
                                        handleLoadSingleSpreadsheetInsights(val);
                                    }
                                }}
                                className="h-10 w-full rounded-xl border border-border-subtle bg-white px-4 text-xs font-semibold text-text-primary outline-none focus:border-indigo-500 transition"
                            >
                                <option value="general">📊 Análise Geral (Todas as Planilhas)</option>
                                {spreadsheets.map((sheet) => (
                                    <option key={sheet.id} value={sheet.id}>
                                        📄 {sheet.filename} ({sheet.semester} - {sheet.course_name})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* SUB-SEÇÃO CONDICIONAL: ANALISE GERAL */}
                    {(selectedDashboardSpreadsheetId === 'general' || !selectedDashboardSpreadsheetId) && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Alerta de Modo de Analise Geral com Botão de IA */}
                            <div className="rounded-[24px] border border-white/40 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-md px-6 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 text-indigo-700">
                                        <BrainCircuit className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-bold text-indigo-900 tracking-wide uppercase">
                                            Análise Geral do Histórico
                                        </h4>
                                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed flex-wrap">
                                            As métricas abaixo consolidam os dados históricos importados via upload. Ao todo, foram extraídos <strong>{displayedTotalStudents} alunos</strong> e <strong>{displayedTotalSubjects} disciplinas/turmas</strong> de <strong>{workspace?.overview?.total_records || 0} registros</strong>.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        icon={Sparkles}
                                        onClick={handleGenerateAiInsights}
                                        loading={aiLoading}
                                    >
                                        {aiInsights ? 'Reanalisar Inteligência Geral' : 'Gerar Análise de Insights'}
                                    </Button>
                                </div>
                            </div>

                            {/* Exibição dos Insights Consolidados de IA do Professor */}
                            {aiInsights && (
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr] mb-6">
                                    <Card>
                                        <CardHeader
                                            title="Diretrizes e Insights de IA (Consolidado de Todas as Planilhas)"
                                            subtitle="Análise pedagógica sistêmica baseada nos dados agregados do histórico acadêmico"
                                            icon={BrainCircuit}
                                        />
                                        <div className="p-6 border-t border-border-subtle bg-bg-secondary/10 rounded-b-[24px]">
                                            <MarkdownRenderer text={aiInsights} />
                                        </div>
                                    </Card>

                                    <DashboardAIChat 
                                        endpoint="/api/historical-data/chat"
                                        title="Chat de IA - Histórico Geral"
                                        placeholder="Pergunte sobre turmas antigas, evasão histórica ou médias..."
                                    />
                                </div>
                            )}

                            {/* KPIs das Planilhas */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                                <MetricCard
                                    title="Disciplinas das Planilhas"
                                    value={loading ? '...' : displayedTotalSubjects}
                                    helper="Total agregando todas as planilhas subidas"
                                    icon={BookOpen}
                                    tone="indigo"
                                />
                                <MetricCard
                                    title="Alunos das Planilhas"
                                    value={loading ? '...' : displayedTotalStudents}
                                    helper="Estudantes processados no histórico"
                                    icon={Users}
                                    tone="blue"
                                />
                                <MetricCard
                                    title="Alertas das Planilhas"
                                    value={loading ? '...' : displayedAtRiskCount}
                                    helper="Soma de alunos de alto risco nas turmas"
                                    icon={AlertTriangle}
                                    tone="rose"
                                />
                                <MetricCard
                                    title="Turmas Críticas Planilhas"
                                    value={loading ? '...' : displayedCriticalClassesCount}
                                    helper="Turmas com risco estatístico alto/crítico"
                                    icon={ShieldAlert}
                                    tone="amber"
                                />
                            </div>

                            {/* Indicadores de Risco, Turmas Críticas, Disciplinas Críticas do histórico */}
                            <div className="grid gap-6 xl:grid-cols-2 mb-6">
                                {/* Seção de Alertas do Histórico */}
                                <div className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-card space-y-4">
                                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                                        Alertas de Risco do Histórico
                                    </h4>
                                    <div className="space-y-3">
                                        {displayedUrgentAlerts.length > 0 ? displayedUrgentAlerts.map((alert, idx) => (
                                            <div key={idx} className="p-4 rounded-[20px] bg-rose-500/5 border border-rose-500/10">
                                                <p className="text-xs font-bold text-rose-700">{alert.label || alert.topic} ({alert.semester})</p>
                                                <p className="mt-2 text-xs leading-5 text-text-secondary">{alert.signal}</p>
                                                <p className="mt-1 text-xs text-text-secondary">{alert.evidence}</p>
                                            </div>
                                        )) : (
                                            <div className="rounded-[22px] border border-dashed border-border-subtle p-4 text-xs text-text-secondary">
                                                Nenhum alerta crítico no momento.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Seção de Turmas e Assuntos Críticos */}
                                <div className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-card space-y-4">
                                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        <Layers3 className="h-4 w-4 text-indigo-500" />
                                        Turmas e Assuntos em Risco
                                    </h4>
                                    <div className="space-y-3">
                                        {displayedCriticalClasses.slice(0, 4).map((item) => (
                                            <Link
                                                key={item.id}
                                                to={buildRolePath(user?.role, `analysis-center?analysis=by_class&class_id=${item.id}`)}
                                                className="flex items-center justify-between p-3.5 rounded-[20px] border border-border-subtle bg-bg-secondary/40 hover:bg-white transition"
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-text-primary">{item.name}</p>
                                                    <p className="text-[10px] text-text-secondary mt-1">
                                                        GPA: {item.gpa != null ? Number(item.gpa).toFixed(2) : '--'} | Freq: {item.attendance != null ? `${Number(item.attendance).toFixed(0)}%` : '--'}
                                                    </p>
                                                </div>
                                                <Badge variant={getRiskVariant(item.risk_level)}>{riskLabels[item.risk_level] || item.risk_level}</Badge>
                                            </Link>
                                        ))}
                                        {displayedCriticalClasses.length === 0 && (
                                            <div className="rounded-[22px] border border-dashed border-border-subtle p-4 text-xs text-text-secondary">
                                                Ainda não há dados históricos suficientes.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Distribuição por Curso se houver */}
                            {workspace?.overview?.course_distribution && (
                                <div className="mb-6">
                                    <Card>
                                        <CardHeader
                                            title="Distribuição de Alunos por Curso"
                                            subtitle="Contagem consolidada de estudantes únicos cadastrados em cada curso a partir das planilhas subidas."
                                            icon={Layers3}
                                        />
                                        <div className="p-6 border-t border-border-subtle bg-bg-secondary/10 rounded-b-[24px]">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {Object.entries(workspace.overview.course_distribution).map(([course, count], idx) => (
                                                    <motion.div
                                                        key={course}
                                                        className="p-4 rounded-[20px] bg-white/60 border border-white/80 backdrop-blur-sm shadow-soft flex flex-col justify-between"
                                                        initial={{ opacity: 0, y: 12 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                    >
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold tracking-[0.14em] text-indigo-600">Curso Acadêmico</p>
                                                            <h4 className="text-xs font-semibold text-text-primary mt-1 line-clamp-2">{course}</h4>
                                                        </div>
                                                        <div className="mt-4 flex items-baseline justify-between border-t border-black/5 pt-3">
                                                            <p className="text-[11px] text-text-secondary">Estudantes</p>
                                                            <span className="text-base font-bold text-indigo-600">{count}</span>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Alunos que pedem ação imediata (Planilhas) */}
                            <Card>
                                <CardHeader
                                    title="Alunos do Histórico que pedem ação imediata"
                                    subtitle="Clique no aluno para abrir o painel completo com notas, frequência e indicadores do histórico."
                                    icon={CheckCircle2}
                                />
                                {displayedTopAtRisk.length > 0 ? (
                                    <div className="space-y-3">
                                        {displayedTopAtRisk.slice(0, 8).map((student, index) => (
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
                                                        className="text-left text-sm font-semibold text-text-primary transition-colors hover:text-accent-blue block"
                                                    >
                                                        {student.student_name}
                                                    </button>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <p className="text-[11px] text-text-secondary">Matrícula: {student.registration_number}</p>
                                                        <p className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 w-max">
                                                            Curso: {student.course_name || 'Não informado'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <InlineMetric label="GPA" value={student.gpa != null ? Number(student.gpa).toFixed(2) : '--'} />
                                                <InlineMetric label="Presença" value={student.attendance_rate != null ? `${Number(student.attendance_rate).toFixed(0)}%` : '--'} />
                                                <InlineMetric label="Risco" value={student.risk_score != null ? `${(Number(student.risk_score) * 100).toFixed(0)}%` : '--'} />
                                                <div className="flex items-center lg:justify-end">
                                                    <Badge variant={getRiskVariant(student.risk_level)}>{riskLabels[student.risk_level] || student.risk_level}</Badge>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={Users}
                                        title="Sem alunos em alerta relevante"
                                        description="Quando houver combinação preocupante entre nota e presença nas planilhas, os alunos aparecerão aqui."
                                    />
                                )}
                            </Card>
                        </div>
                    )}

                    {/* SUB-SEÇÃO CONDICIONAL: ANALISE ESPECÍFICA (PLANILHA SELECIONADA) */}
                    {selectedDashboardSpreadsheetId && selectedDashboardSpreadsheetId !== 'general' && (
                        <div className="space-y-6 animate-fade-in">
                            <Card>
                                <CardHeader
                                    title="Análise e Insights por Planilha Única"
                                    subtitle="Leitura de dicas de intervenção e indicadores específicos do arquivo selecionado"
                                    icon={Sparkles}
                                />
                                <div className="p-6 border-t border-border-subtle space-y-6">
                                    {singleSpreadsheetLoading && (
                                        <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                                            <p className="text-xs font-medium animate-pulse">
                                                NEXORA analisando dados e gerando insights locais específicos...
                                            </p>
                                        </div>
                                    )}

                                    {!singleSpreadsheetLoading && singleSpreadsheetData && (
                                        <div className="space-y-6">
                                            {/* Indicadores Rápidos da Planilha Selecionada */}
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                <div className="rounded-2xl border border-border-subtle bg-bg-secondary/40 p-4">
                                                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Quantidade de Alunos</p>
                                                    <p className="text-lg font-bold text-text-primary mt-1">{singleSpreadsheetData.records_count} alunos</p>
                                                </div>
                                                <div className="rounded-2xl border border-border-subtle bg-bg-secondary/40 p-4">
                                                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Média Geral de Notas</p>
                                                    <p className="text-lg font-bold text-indigo-600 mt-1">{singleSpreadsheetData.avg_grade != null ? Number(singleSpreadsheetData.avg_grade).toFixed(2) : '--'}</p>
                                                </div>
                                                <div className="rounded-2xl border border-border-subtle bg-bg-secondary/40 p-4">
                                                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Frequência Média</p>
                                                    <p className="text-lg font-bold text-emerald-600 mt-1">{singleSpreadsheetData.avg_attendance != null ? `${Number(singleSpreadsheetData.avg_attendance).toFixed(1)}%` : '--'}</p>
                                                </div>
                                            </div>

                                            {/* Insights Textuais Gerados */}
                                            {singleSpreadsheetInsights && (
                                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr] mt-6">
                                                    <div className="rounded-2xl border border-border-subtle bg-white/80 p-5 shadow-soft">
                                                        <h4 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
                                                            <BrainCircuit className="h-4 w-4 text-accent-purple" />
                                                            Dicas de Intervenção e Diagnóstico da Planilha
                                                        </h4>
                                                        <div className="border-t border-border-subtle/60 pt-4 leading-relaxed">
                                                            <MarkdownRenderer text={singleSpreadsheetInsights} />
                                                        </div>
                                                    </div>

                                                    <DashboardAIChat 
                                                        endpoint="/api/historical-data/chat"
                                                        extraBody={{ spreadsheet_id: Number(selectedDashboardSpreadsheetId) }}
                                                        title="Chat de IA - Planilha Selecionada"
                                                        placeholder="Pergunte sobre notas e frequências desta planilha..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!singleSpreadsheetLoading && !singleSpreadsheetData && (
                                        <div className="rounded-2xl border border-dashed border-border-subtle bg-white/40 p-8 text-center text-text-secondary text-sm">
                                            Selecione um arquivo de histórico no topo da seção para carregar as métricas e os insights correspondentes.
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}
            </>
            )}

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
        <div className="rounded-2xl bg-bg-secondary border border-border-subtle/50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function MarkdownRenderer({ text }) {
    if (!text) return null;
    
    const lines = text.split('\n');
    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('###')) {
                    return <h4 key={idx} className="text-base font-bold text-text-primary mt-4">{trimmed.replace('###', '').trim()}</h4>;
                }
                if (trimmed.startsWith('##')) {
                    return <h3 key={idx} className="text-lg font-bold text-text-primary mt-6">{trimmed.replace('##', '').trim()}</h3>;
                }
                if (trimmed.startsWith('#')) {
                    return <h2 key={idx} className="text-xl font-bold text-text-primary mt-6 border-b pb-2">{trimmed.replace('#', '').trim()}</h2>;
                }
                if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    const cleanText = trimmed.substring(1).trim();
                    return <li key={idx} className="ml-5 list-disc text-sm text-text-secondary">{parseBold(cleanText)}</li>;
                }
                if (trimmed) {
                    return <p key={idx} className="text-sm leading-6 text-text-secondary">{parseBold(trimmed)}</p>;
                }
                return <div key={idx} className="h-2" />;
            })}
        </div>
    );
}

function parseBold(text) {
    const parts = text.split('**');
    return parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="font-semibold text-text-primary">{part}</strong> : part
    );
}

function DashboardAIChat({ endpoint, placeholder = "Pergunte algo...", title = "Chat de IA", extraBody = {} }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.post(endpoint, {
                message: text,
                ...extraBody
            });
            
            setMessages(prev => [...prev, { role: 'ai', content: res.data.response }]);
        } catch (error) {
            console.error('Erro no chat de IA do dashboard:', error);
            setMessages(prev => [...prev, { role: 'ai', content: 'Desculpe, ocorreu um erro ao obter a resposta da IA. Verifique sua conexão e chaves de API.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[400px] rounded-3xl border border-border-subtle bg-white/40 backdrop-blur-md overflow-hidden shadow-soft">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border-subtle bg-white/60 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-indigo-600 animate-pulse" />
                <span className="text-xs font-bold text-text-primary">{title}</span>
            </div>

            {/* Mensagens */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-4 bg-white/10 scrollbar-thin"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2.5 text-indigo-600">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <p className="text-text-primary text-xs font-bold">Interaja com o Assistente de IA</p>
                        <p className="text-text-secondary text-[10px] mt-1 max-w-[200px] leading-relaxed">Tire dúvidas sobre os indicadores acadêmicos, médias ou peça orientações pedagógicas.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                            msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-500/15'
                                : 'bg-white border border-border-subtle text-text-primary rounded-tl-none shadow-sm'
                        }`}>
                            {msg.role === 'user' ? msg.content : <MarkdownRenderer text={msg.content} />}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-border-subtle px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-white/60 border-t border-border-subtle flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-white border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 shadow-inner"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-500/10 flex items-center justify-center"
                >
                    <ArrowRight className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
