import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    FileSpreadsheet,
    Filter,
    GraduationCap,
    Lightbulb,
    Loader2,
    Search,
    Send,
    Upload,
    Users,
} from 'lucide-react';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath } from '@/lib/app-shell';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';

function buildAnalysisLink(basePath, analysis, params = {}) {
    const query = new URLSearchParams({ analysis });
    Object.entries(params).forEach(([key, value]) => {
        if (value) query.set(key, String(value));
    });
    return `${basePath}?${query.toString()}`;
}

export function HistoricalData() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [filters, setFilters] = useState({ semesters: [], courses: [], subjects: [] });
    const [workspace, setWorkspace] = useState(null);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [insightsPrompt, setInsightsPrompt] = useState('');
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsResponse, setInsightsResponse] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAttentionOnly, setShowAttentionOnly] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [selectedSemester, selectedCourse, selectedSubject]);

    async function fetchData() {
        setLoading(true);
        try {
            const params = {
                semester: selectedSemester || undefined,
                course_name: selectedCourse || undefined,
                subject: selectedSubject || undefined,
            };
            const [filtersRes, recordsRes, workspaceRes] = await Promise.all([
                api.get('/historical-data/filters'),
                api.get('/historical-data', { params: { ...params, page: 1, page_size: 100 } }),
                api.get('/historical-data/analysis-workspace', { params }),
            ]);

            setFilters(filtersRes.data);
            setRecords(recordsRes.data?.records || []);
            setWorkspace(workspaceRes.data);
        } catch (error) {
            console.error('Erro ao carregar dados historicos', error);
        } finally {
            setLoading(false);
        }
    }

    function openFilePicker() {
        fileInputRef.current?.click();
    }

    function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setUploadStatus(null);
        event.target.value = '';
    }

    async function handleUpload() {
        if (!pendingFile || uploading) return;

        setUploading(true);
        setUploadStatus({ type: 'info', message: 'Normalizando colunas, organizando turmas e preparando a leitura dos alunos...' });

        try {
            const formData = new FormData();
            formData.append('file', pendingFile);

            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setUploadStatus({
                type: 'success',
                message: `${response.data.records_count} registros processados com sucesso.`,
                payload: response.data,
            });
            setPendingFile(null);
            await fetchData();
        } catch (error) {
            setUploadStatus({
                type: 'error',
                message: error.response?.data?.detail || 'Nao foi possivel processar o arquivo selecionado.',
            });
        } finally {
            setUploading(false);
        }
    }

    async function handleGenerateInsights() {
        setInsightsLoading(true);
        try {
            const response = await api.post('/historical-data/insights', {
                message: insightsPrompt.trim() || 'Gere uma analise geral completa dos dados historicos enviados pelo professor.',
            });
            setInsightsResponse(response.data?.response || '');
        } catch (error) {
            setInsightsResponse(error.response?.data?.detail || 'Nao foi possivel gerar os insights agora.');
        } finally {
            setInsightsLoading(false);
        }
    }

    const highlightedTopics = workspace?.analysis_data?.risk_topics?.slice(0, 4) || [];
    const highRiskClasses = workspace?.analysis_data?.high_risk_classes?.slice(0, 4) || [];
    const uploadSummary = uploadStatus?.payload?.summary;
    const uploadWarnings = uploadStatus?.payload?.warnings || [];
    const uploadNormalizationSteps = uploadStatus?.payload?.normalization_steps || [];
    const organizedUploadGroups = uploadStatus?.payload?.class_groups?.slice(0, 6) || [];
    const totalRecords = workspace?.overview?.total_records || 0;
    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    const groupedRecords = useMemo(
        () => buildGroupedRecords(records, { searchTerm, showAttentionOnly }),
        [records, searchTerm, showAttentionOnly],
    );

    const normalizationSteps = useMemo(() => ([
        'Reconhece colunas fora de ordem e nomes diferentes para semestre, aluno, nota e frequencia.',
        'Converte CSV, XLSX, TXT e PDF para uma estrutura unica antes da leitura analitica.',
        'Agrupa os registros por turma, curso e semestre para facilitar a leitura docente.',
    ]), []);
    const normalizationChecklist = uploadNormalizationSteps.length ? uploadNormalizationSteps : normalizationSteps;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Subir planilhas e PDFs"
                subtitle="Envie bases de turmas anteriores. O sistema organiza o arquivo, corrige estrutura e devolve as principais analises."
                icon={Upload}
                actions={(
                    <div className="flex flex-wrap gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".csv,.xlsx,.xls,.txt,.pdf"
                            onChange={handleFileSelect}
                        />
                        <Button icon={FileSpreadsheet} onClick={openFilePicker}>
                            {pendingFile ? 'Trocar arquivo' : 'Selecionar arquivo'}
                        </Button>
                        {pendingFile && (
                            <Button onClick={handleUpload} loading={uploading} icon={Upload}>
                                Subir e organizar arquivo
                            </Button>
                        )}
                    </div>
                )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="Registros na base"
                    value={loading ? '...' : totalRecords}
                    helper="Historico consolidado disponivel para analise"
                    icon={BarChart3}
                    tone="blue"
                />
                <MetricCard
                    title="Semestres"
                    value={loading ? '...' : workspace?.overview?.total_semesters || 0}
                    helper="Periodos historicos mapeados"
                    icon={BookOpen}
                    tone="indigo"
                />
                <MetricCard
                    title="Turmas criticas"
                    value={loading ? '...' : workspace?.overview?.critical_classes || 0}
                    helper="Recortes com risco alto ou critico"
                    icon={AlertCircle}
                    tone="amber"
                />
                <MetricCard
                    title="Alunos mapeados"
                    value={loading ? '...' : workspace?.overview?.total_students || 0}
                    helper="Base pronta para comparacoes docentes"
                    icon={CheckCircle2}
                    tone="emerald"
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Card variant="hero">
                    <CardHeader
                        title="Como a NEXORA trata o arquivo"
                        subtitle="A area de upload organiza a base antes de calcular risco e comparativos."
                        icon={Upload}
                    />
                    <div className="space-y-3">
                        {normalizationChecklist.map((step) => (
                            <div key={step} className="rounded-[22px] border border-border-subtle bg-white/75 px-4 py-4 text-sm leading-6 text-text-secondary">
                                {step}
                            </div>
                        ))}
                    </div>

                    {!pendingFile && (
                        <button
                            type="button"
                            onClick={openFilePicker}
                            className="mt-5 flex w-full items-center justify-between rounded-[24px] border border-dashed border-accent-blue/25 bg-white/70 px-5 py-4 text-left transition hover:border-accent-blue/45 hover:bg-white"
                        >
                            <div>
                                <p className="text-sm font-semibold text-text-primary">Clique para selecionar planilha ou PDF</p>
                                <p className="mt-1 text-sm text-text-secondary">Aceita CSV, XLSX, XLS, TXT e PDF. A NEXORA tenta organizar dados fora de ordem antes da analise.</p>
                            </div>
                            <Badge variant="info">Upload docente</Badge>
                        </button>
                    )}

                    {pendingFile && (
                        <div className="mt-5 rounded-[24px] border border-accent-blue/20 bg-white/80 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">{pendingFile.name}</p>
                                    <p className="mt-1 text-sm text-text-secondary">
                                        Arquivo pronto para tratamento, padronizacao e leitura historica.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="info">{(pendingFile.size / 1024).toFixed(1)} KB</Badge>
                                    <Badge variant="neutral">{pendingFile.name.split('.').pop()?.toUpperCase() || 'ARQ'}</Badge>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Button onClick={handleUpload} loading={uploading} icon={Upload}>
                                    Processar arquivo
                                </Button>
                                <Button variant="secondary" onClick={openFilePicker}>
                                    Escolher outro
                                </Button>
                                <Button variant="secondary" onClick={() => setPendingFile(null)}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Resposta imediata do upload"
                        subtitle="Assim que a base entra, a pagina destaca os primeiros sinais da analise."
                        icon={CheckCircle2}
                    />

                    {uploadStatus ? (
                        <div className={[
                            'rounded-[24px] border px-4 py-4 text-sm',
                            uploadStatus.type === 'success'
                                ? 'border-success/20 bg-success/5 text-success'
                                : uploadStatus.type === 'error'
                                    ? 'border-danger/20 bg-danger/5 text-danger'
                                    : 'border-accent-blue/20 bg-accent-blue/5 text-accent-blue',
                        ].join(' ')}>
                            {uploadStatus.message}
                        </div>
                    ) : (
                        <div className="rounded-[24px] border border-dashed border-border-subtle px-4 py-5 text-sm text-text-secondary">
                            Selecione um arquivo para ver o resumo de processamento e as primeiras leituras.
                        </div>
                    )}

                    {uploadSummary && (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Alunos</p>
                                <p className="mt-1 text-lg font-semibold text-text-primary">{uploadSummary.students || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Nota media</p>
                                <p className="mt-1 text-lg font-semibold text-text-primary">
                                    {uploadSummary.avg_grade?.toFixed?.(2) || uploadSummary.avg_grade || '--'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Presenca media</p>
                                <p className="mt-1 text-lg font-semibold text-text-primary">
                                    {uploadSummary.avg_attendance?.toFixed?.(1) || uploadSummary.avg_attendance || '--'}%
                                </p>
                            </div>
                        </div>
                    )}

                    {uploadStatus?.payload?.subjects?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {uploadStatus.payload.subjects.map((subject) => (
                                <Badge key={subject} variant="neutral">{subject}</Badge>
                            ))}
                        </div>
                    )}

                    {uploadWarnings.length > 0 && (
                        <div className="mt-4 rounded-[24px] border border-warning/20 bg-warning/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">Avisos de normalizacao</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {uploadWarnings.map((warning) => (
                                    <Badge key={warning} variant="warning">{warning}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {organizedUploadGroups.length > 0 && (
                        <div className="mt-4 rounded-[24px] border border-border-subtle bg-bg-secondary/35 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Turmas organizadas no upload</p>
                                    <p className="mt-1 text-sm text-text-secondary">Resumo imediato das turmas reconhecidas antes mesmo de abrir a analise profunda.</p>
                                </div>
                                <Badge variant="info">{organizedUploadGroups.length} visiveis</Badge>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {organizedUploadGroups.map((group) => (
                                    <div key={group.key} className="rounded-[20px] border border-border-subtle bg-white/85 p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="neutral">{group.semester}</Badge>
                                            <Badge variant="info">{group.course_name}</Badge>
                                            <Badge variant="neutral">{group.period_label}</Badge>
                                        </div>
                                        <p className="mt-3 text-sm font-semibold text-text-primary">{group.subject}</p>
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                                            <div>Alunos: <span className="font-semibold text-text-primary">{group.student_count}</span></div>
                                            <div>Em alerta: <span className="font-semibold text-text-primary">{group.attention_count}</span></div>
                                            <div>Nota media: <span className="font-semibold text-text-primary">{formatGrade(group.avg_grade)}</span></div>
                                            <div>Presenca media: <span className="font-semibold text-text-primary">{formatAttendance(group.avg_attendance)}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            <Card>
                <CardHeader
                    title="Filtros da base historica"
                    subtitle="Refine a leitura antes de abrir comparativos ou exportar analises."
                    icon={Filter}
                />
                <div className="grid gap-4 md:grid-cols-3">
                    <FilterSelect label="Semestre" value={selectedSemester} onChange={setSelectedSemester} options={filters.semesters} />
                    <FilterSelect label="Curso" value={selectedCourse} onChange={setSelectedCourse} options={filters.courses} />
                    <FilterSelect label="Disciplina" value={selectedSubject} onChange={setSelectedSubject} options={filters.subjects} />
                </div>
            </Card>

            {loading ? (
                <Card>
                    <div className="flex min-h-[220px] items-center justify-center gap-3 text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
                        Carregando base historica...
                    </div>
                </Card>
            ) : totalRecords === 0 ? (
                <EmptyState
                    icon={Upload}
                    title="Nenhuma base historica carregada"
                    description="Envie uma planilha ou PDF de turmas anteriores para liberar analise por turma, comparacao entre turmas, leitura por semestre e assuntos em risco."
                />
            ) : (
                <>
                    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                        <Card>
                            <CardHeader
                                title="Primeiros assuntos em risco"
                                subtitle="Leituras automaticas logo apos a organizacao da base."
                                icon={Lightbulb}
                            />
                            <div className="space-y-3">
                                {highlightedTopics.map((item) => (
                                    <Link
                                        key={item.id}
                                        to={buildAnalysisLink(analysisRoute, 'risk_topics', item.type === 'Disciplina' ? { subject: item.label } : { semester: item.semester })}
                                        className="block rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                            <Badge variant="info">{item.type}</Badge>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.signal}</p>
                                    </Link>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Turmas com maior risco"
                                subtitle="Atalho rapido para abrir a leitura profunda por turma."
                                icon={BarChart3}
                            />
                            <div className="space-y-3">
                                {highRiskClasses.map((item) => (
                                    <Link
                                        key={item.id}
                                        to={buildAnalysisLink(analysisRoute, 'by_class', { subject: item.subject, semester: item.semester })}
                                        className="block rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4 transition hover:border-border-hover hover:bg-white"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                            <Badge variant="warning">{Math.round(item.risk_score * 100)}%</Badge>
                                        </div>
                                        <p className="mt-2 text-sm text-text-secondary">{item.recommended_focus}</p>
                                    </Link>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader
                            title="Gerar comentario academico"
                            subtitle="Peca uma leitura automatica sobre a base atual, incluindo riscos recorrentes e oportunidades de melhoria."
                            icon={Lightbulb}
                        />
                        <div className="flex flex-col gap-3 lg:flex-row">
                            <input
                                value={insightsPrompt}
                                onChange={(event) => setInsightsPrompt(event.target.value)}
                                placeholder="Ex.: Quais disciplinas merecem reforco imediato?"
                                className="h-11 flex-1 rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                            />
                            <Button onClick={handleGenerateInsights} loading={insightsLoading} icon={Send}>
                                Gerar comentario
                            </Button>
                        </div>
                        {insightsResponse && (
                            <div className="mt-4 rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5 text-sm leading-7 text-text-secondary whitespace-pre-wrap">
                                {insightsResponse}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <CardHeader
                            title="Registros organizados"
                            subtitle="Base organizada por turma, com dados do aluno, situacao academica e atalhos para abrir o perfil."
                            icon={FileSpreadsheet}
                        />
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="neutral">{groupedRecords.length} turmas organizadas</Badge>
                                <Badge variant="info">{sumStudents(groupedRecords)} alunos no recorte visivel</Badge>
                                <Badge variant={showAttentionOnly ? 'warning' : 'neutral'}>
                                    {showAttentionOnly ? 'Somente em atencao' : 'Todos os alunos'}
                                </Badge>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <label className="relative">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="Buscar aluno, turma ou disciplina..."
                                        className="h-11 w-full rounded-2xl border border-border-subtle bg-white pl-11 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40 sm:w-[320px]"
                                    />
                                </label>
                                <Button
                                    variant={showAttentionOnly ? 'primary' : 'secondary'}
                                    onClick={() => setShowAttentionOnly((current) => !current)}
                                >
                                    {showAttentionOnly ? 'Mostrar todos' : 'Filtrar atencao'}
                                </Button>
                            </div>
                        </div>

                        {groupedRecords.length ? (
                            <div className="mt-5 space-y-4">
                                {groupedRecords.map((group) => (
                                <div key={group.key} className="rounded-[26px] border border-border-subtle bg-bg-secondary/35 p-5">
                                    <div className="flex flex-col gap-4 border-b border-border-subtle/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="neutral">{group.semester}</Badge>
                                                <Badge variant="info">{group.courseName}</Badge>
                                                <Badge variant="neutral">{group.periodLabel}</Badge>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-text-primary">{group.subject}</h3>
                                                <p className="mt-1 text-sm text-text-secondary">
                                                    Turma organizada com alunos, notas, frequencia e situacao academica.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Link to={buildAnalysisLink(analysisRoute, 'by_class', { subject: group.subject, semester: group.semester })}>
                                                    <Button size="sm" variant="secondary">
                                                        Abrir analise da turma
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <GroupMetric label="Alunos" value={group.studentCount} icon={Users} />
                                            <GroupMetric label="Presenca media" value={formatAttendance(group.avgAttendance)} icon={CheckCircle2} />
                                            <GroupMetric label="Nota media" value={formatGrade(group.avgGrade)} icon={GraduationCap} />
                                            <GroupMetric label="Em alerta" value={group.attentionCount} icon={AlertCircle} />
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {group.students.map((record) => (
                                            <div
                                                key={record.id}
                                                className="rounded-[22px] border border-border-subtle bg-white/90 px-4 py-4 shadow-soft"
                                            >
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="space-y-3">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            {record.student_id ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedStudentId(record.student_id)}
                                                                    className="inline-flex items-center gap-2 text-left text-sm font-semibold text-text-primary transition hover:text-accent-blue"
                                                                >
                                                                    <span>{record.student_name}</span>
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </button>
                                                            ) : (
                                                                <p className="text-sm font-semibold text-text-primary">{record.student_name}</p>
                                                            )}
                                                            <Badge variant={getStudentStatusVariant(record.status_label, record.attendance, record.grade_average)}>
                                                                {record.status_label || getAttendanceSignal(record.attendance, record.grade_average)}
                                                            </Badge>
                                                            {record.is_working && <Badge variant="warning">Trabalha</Badge>}
                                                        </div>

                                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">
                                                            <span>Matricula: {record.registration_number || '--'}</span>
                                                            <span>Periodo: {record.current_period ? `${record.current_period}o` : '--'}</span>
                                                            <span>Turno: {record.class_schedule || '--'}</span>
                                                            <span>Status: {record.student_status || '--'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                                                        <StudentMetric label="Presenca" value={formatAttendance(record.attendance)} />
                                                        <StudentMetric label="Media" value={formatGrade(record.grade_average)} />
                                                        <StudentMetric label="Avaliacoes" value={record.grade_items?.length || 0} />
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                                                    <div className="rounded-[20px] bg-bg-secondary/55 p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Resumo das notas</p>
                                                        {record.grade_items?.length ? (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {record.grade_items.map((item) => (
                                                                    <Badge key={`${record.id}-${item.label}`} variant="neutral">
                                                                        {item.label}: {Number(item.value).toFixed(1)}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="mt-3 text-sm text-text-secondary">Nenhuma nota numerica identificada nesse registro.</p>
                                                        )}
                                                    </div>

                                                    <div className="rounded-[20px] bg-bg-secondary/55 p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Leitura rapida</p>
                                                        <p className="mt-3 text-sm leading-6 text-text-secondary">
                                                            {buildStudentSnapshot(record)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-5">
                                <EmptyState
                                    icon={Search}
                                    title="Nenhum registro encontrado"
                                    description="Ajuste a busca ou remova o filtro de atencao para voltar a visualizar as turmas organizadas."
                                />
                            </div>
                        )}
                    </Card>
                </>
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={Boolean(selectedStudentId)}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}

function FilterSelect({ label, value, onChange, options = [] }) {
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

function buildGroupedRecords(records = [], filters = {}) {
    const normalizedSearch = normalizeText(filters.searchTerm || '');
    const groups = new Map();

    records.forEach((record) => {
        const matchesSearch = !normalizedSearch || [
            record.student_name,
            record.subject,
            record.course_name,
            record.registration_number,
            record.class_schedule,
        ].some((value) => normalizeText(value).includes(normalizedSearch));

        if (!matchesSearch) {
            return;
        }

        if (filters.showAttentionOnly && !isAttentionStudent(record)) {
            return;
        }

        const semester = record.semester || 'Sem semestre';
        const subject = record.subject || 'Turma sem disciplina';
        const courseName = record.course_name || 'Curso nao informado';
        const periodLabel = record.period ? `${record.period}o periodo` : 'Periodo nao informado';
        const key = record.class_key || `${semester}::${courseName}::${subject}::${periodLabel}`;

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                semester,
                subject,
                courseName,
                periodLabel,
                students: [],
            });
        }

        groups.get(key).students.push(record);
    });

    return Array.from(groups.values())
        .map((group) => {
            const uniqueStudents = new Set(group.students.map((item) => item.student_name).filter(Boolean));
            const attendanceValues = group.students.map((item) => toNumber(item.attendance)).filter((value) => value != null);
            const gradeValues = group.students.map((item) => toNumber(item.grade_average)).filter((value) => value != null);
            const attentionCount = group.students.filter((item) => isAttentionStudent(item)).length;

            return {
                ...group,
                studentCount: uniqueStudents.size,
                avgAttendance: average(attendanceValues),
                avgGrade: average(gradeValues),
                attentionCount,
                students: [...group.students].sort((left, right) => {
                    const leftScore = scoreStudentAttention(left);
                    const rightScore = scoreStudentAttention(right);
                    return rightScore - leftScore || String(left.student_name || '').localeCompare(String(right.student_name || ''));
                }),
            };
        })
        .sort((left, right) => right.attentionCount - left.attentionCount || String(left.subject).localeCompare(String(right.subject)));
}

function GroupMetric({ label, value, icon: Icon }) {
    return (
        <div className="rounded-[20px] border border-border-subtle bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 text-accent-blue" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function StudentMetric({ label, value }) {
    return (
        <div className="rounded-[18px] border border-border-subtle bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function buildStudentSnapshot(record) {
    const notes = [];

    if (record.current_period) {
        notes.push(`Aluno do ${record.current_period}o periodo`);
    }
    if (record.class_schedule) {
        notes.push(`turno ${String(record.class_schedule).toLowerCase()}`);
    }
    if (record.attendance != null) {
        notes.push(`presenca em ${formatAttendance(record.attendance)}`);
    }
    if (record.grade_average != null) {
        notes.push(`media ${formatGrade(record.grade_average)}`);
    }
    if (record.is_working) {
        notes.push(record.work_schedule ? `trabalha em ${record.work_schedule}` : 'possui rotina de trabalho');
    }

    if (!notes.length) {
        return 'Registro organizado sem dados complementares suficientes para montar um resumo automatico.';
    }

    return `${notes.join(', ')}.`;
}

function scoreStudentAttention(record) {
    const attendance = toNumber(record.attendance);
    const gradeAverage = toNumber(record.grade_average);
    let score = 0;

    if (attendance != null) {
        score += Math.max(0, 100 - attendance);
    }
    if (gradeAverage != null) {
        score += Math.max(0, (10 - gradeAverage) * 10);
    }
    if (record.status_label && /reprov|risco|alerta/i.test(record.status_label)) {
        score += 25;
    }

    return score;
}

function isAttentionStudent(record) {
    const attendance = toNumber(record.attendance);
    const gradeAverage = toNumber(record.grade_average);
    return (
        (attendance != null && attendance < 75) ||
        (gradeAverage != null && gradeAverage < 6) ||
        Boolean(record.status_label && /reprov|risco|alerta/i.test(record.status_label))
    );
}

function getAttendanceSignal(attendance, gradeAverage) {
    const attendanceValue = toNumber(attendance);
    const gradeValue = toNumber(gradeAverage);

    if ((attendanceValue != null && attendanceValue < 75) || (gradeValue != null && gradeValue < 6)) {
        return 'Atenção';
    }
    if ((attendanceValue != null && attendanceValue < 85) || (gradeValue != null && gradeValue < 7)) {
        return 'Monitorar';
    }
    return 'Estavel';
}

function getStudentStatusVariant(statusLabel, attendance, gradeAverage) {
    if (statusLabel && /reprov/i.test(statusLabel)) {
        return 'danger';
    }

    const signal = getAttendanceSignal(attendance, gradeAverage);
    if (signal === 'Atenção') {
        return 'warning';
    }
    if (signal === 'Monitorar') {
        return 'info';
    }
    return 'success';
}

function formatAttendance(value) {
    const numericValue = toNumber(value);
    return numericValue != null ? `${numericValue.toFixed(1)}%` : '--';
}

function formatGrade(value) {
    const numericValue = toNumber(value);
    return numericValue != null ? numericValue.toFixed(1) : '--';
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function average(values = []) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function sumStudents(groups = []) {
    return groups.reduce((sum, group) => sum + Number(group.studentCount || 0), 0);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}





