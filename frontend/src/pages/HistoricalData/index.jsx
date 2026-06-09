import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
    Trash2,
    MessageSquare,
    ArrowLeft,
    Calendar,
    Sparkles,
    Copy,
    Check,
    X,
    Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    AreaChart,
    Area,
    Cell,
    ReferenceLine,
} from 'recharts';


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

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        if (payload[0]?.payload?.isSeparator) return null;
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

export function HistoricalData({ defaultTab = 'history' }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Estados das Abas
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [correctData, setCorrectData] = useState(false); // Ativar limpeza e correção inteligente por IA
    const [analysisTab, setAnalysisTab] = useState('overview'); // 'overview' ou 'students'
    
    // Listagem de planilhas e Resumo
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [globalSummary, setGlobalSummary] = useState({
        total_spreadsheets: 0,
        total_records: 0,
        avg_grade: 0.0,
        avg_attendance: 0.0,
    });
    
    // Planilha selecionada e sua Analise Específica
    const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [records, setRecords] = useState([]);
    
    // Filtros e UI
    const [filters, setFilters] = useState({ semesters: [], courses: [], subjects: [] });
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    
    // Upload de arquivos
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Chat de IA da Planilha
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const updateFileInputRef = useRef(null);

    // Relatório de Analise com IA
    const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
    const [copiedReport, setCopiedReport] = useState(false);

    // Insights Locais da Planilha (Quadro Inferior Esquerdo)
    const [sheetIaInsights, setSheetIaInsights] = useState(null);
    const [sheetIaInsightsLoading, setSheetIaInsightsLoading] = useState(false);

    // Modal de aluno e busca
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null); // null = Adicionar, {...record} = Editar
    const [addEditLoading, setAddEditLoading] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAttentionOnly, setShowAttentionOnly] = useState(false);

    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    // Inicialização
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    useEffect(() => {
        fetchSpreadsheets();
        fetchFilters();
    }, []);

    // Auto-seleção inteligente pós-upload
    useEffect(() => {
        if (location.state?.autoSelectSpreadsheetId && spreadsheets.length > 0) {
            const targetSheet = spreadsheets.find(s => s.id === location.state.autoSelectSpreadsheetId);
            if (targetSheet) {
                handleSelectSpreadsheet(targetSheet);
            }
            // Limpa o state para não re-selecionar ao recarregar a página
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, spreadsheets]);

    // Scroll do chat de IA
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatLoading]);

    // Buscar lista de planilhas
    async function fetchSpreadsheets() {
        setLoading(true);
        try {
            const response = await api.get('/historical-data/spreadsheets');
            const list = response.data.spreadsheets || [];
            setSpreadsheets(list);
            setGlobalSummary(response.data.global_summary || {
                total_spreadsheets: 0,
                total_records: 0,
                avg_grade: 0.0,
                avg_attendance: 0.0,
            });
            return list;
        } catch (error) {
            console.error('Erro ao buscar planilhas', error);
            return [];
        } finally {
            setLoading(false);
        }
    }

    // Buscar filtros estruturais
    async function fetchFilters() {
        try {
            const response = await api.get('/historical-data/filters');
            setFilters(response.data || { semesters: [], courses: [], subjects: [] });
        } catch (error) {
            console.error('Erro ao buscar filtros', error);
        }
    }

    // Abrir planilha específica
    async function handleSelectSpreadsheet(spreadsheet) {
        setAnalysisLoading(true);
        setSelectedSpreadsheet(spreadsheet);
        setSheetIaInsights(null);
        setSheetIaInsightsLoading(false);
        setAnalysisTab('overview');
        setChatMessages([
            {
                role: 'system',
                content: `Olá! Sou a IA assistente da NEXORA. Carreguei os dados da planilha **${spreadsheet.filename}** (${spreadsheet.records_count} alunos). O que gostaria de analisar ou esclarecer sobre este semestre?`
            }
        ]);
        setActiveTab('history');

        try {
            const response = await api.get(`/historical-data/spreadsheets/${spreadsheet.id}/analysis`);
            setSelectedWorkspace(response.data.workspace);
            
            // Buscar os registros filtrados para a listagem
            const recordsRes = await api.get('/historical-data', {
                params: { page: 1, page_size: 150 }
            });
            // Filtrar os registros que pertencem estritamente a essa planilha
            const filteredRecords = (recordsRes.data?.records || []).filter(
                r => r.spreadsheet_id === spreadsheet.id
            );
            setRecords(filteredRecords);
        } catch (error) {
            console.error('Erro ao carregar dados da planilha', error);
        } finally {
            setAnalysisLoading(false);
        }
    }

    // Deletar planilha específica
    async function handleDeleteSpreadsheet(spreadsheetId, event) {
        event.stopPropagation();
        if (!confirm('Deseja realmente remover esta planilha e todos os seus registros de alunos correspondentes? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await api.delete(`/historical-data/spreadsheets/${spreadsheetId}`);
            if (selectedSpreadsheet?.id === spreadsheetId) {
                setSelectedSpreadsheet(null);
                setSelectedWorkspace(null);
                setRecords([]);
                setActiveTab('history');
            }
            await fetchSpreadsheets();
        } catch (error) {
            console.error('Erro ao deletar planilha', error);
            alert('Não foi possível remover a planilha selecionada.');
        }
    }

    // Abrir modal de criação
    function handleOpenAddModal() {
        setEditingRecord(null);
        setIsAddEditModalOpen(true);
    }

    // Abrir modal de edição
    function handleOpenEditModal(record) {
        setEditingRecord(record);
        setIsAddEditModalOpen(true);
    }

    // Excluir registro acadêmico
    async function handleDeleteStudentRecord(recordId) {
        if (!confirm('Deseja realmente remover este registro de aluno? Esta ação atualizará as médias gerais da planilha e não pode ser desfeita.')) {
            return;
        }

        try {
            await api.delete(`/historical-data/records/${recordId}`);
            
            // Recarregar os registros locais
            if (selectedSpreadsheet) {
                const recordsRes = await api.get('/historical-data', {
                    params: { page: 1, page_size: 150 }
                });
                const filteredRecords = (recordsRes.data?.records || []).filter(
                    r => r.spreadsheet_id === selectedSpreadsheet.id
                );
                setRecords(filteredRecords);

                // Recarregar as estatísticas da planilha
                const sheetsRes = await api.get('/historical-data/spreadsheets');
                const updatedSheet = (sheetsRes.data || []).find(s => s.id === selectedSpreadsheet.id);
                if (updatedSheet) {
                    setSelectedSpreadsheet(updatedSheet);
                }
            }
        } catch (error) {
            console.error('Erro ao deletar registro de aluno', error);
            alert('Não foi possível remover o registro de aluno selecionado.');
        }
    }

    // Tratar seleção de arquivo
    function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setUploadStatus(null);
        event.target.value = '';
    }

    // Manipuladores de Drag & Drop para Upload de Arquivos
    function handleDragOver(e) {
        e.preventDefault();
        setIsDragging(true);
    }

    // Remover feedback visual ao sair
    function handleDragLeave() {
        setIsDragging(false);
    }

    // Processar arquivo solto na Dropzone
    function handleDrop(e) {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const allowedExtensions = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            if (allowedExtensions.includes(fileExtension)) {
                setPendingFile(file);
                setUploadStatus(null);
            } else {
                alert('Formato de arquivo não suportado. Por favor, envie CSV, XLSX, XLS, TXT ou PDF.');
            }
        }
    }

    // Subir planilha
    async function handleUpload() {
        if (!pendingFile || uploading) return;

        setUploading(true);
        setUploadStatus({ type: 'info', message: 'Tratando dados, estruturando colunas e consolidando no banco local...' });

        try {
            const formData = new FormData();
            formData.append('file', pendingFile);
            formData.append('correct_data', String(correctData));

            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000, // 10 minutos para uploads gigantescos
            });

            setUploadStatus({
                type: 'success',
                message: `${response.data.records_count} registros processados e vinculados à planilha com sucesso.`,
                payload: response.data,
            });
            setPendingFile(null);
            
            const latestSpreadsheets = await fetchSpreadsheets();
            await fetchFilters();

            // Redireciona inteligentemente para a página física do histórico com a planilha selecionada no state
            const createdSpreadsheetId = response.data.spreadsheet_id;
            navigate(buildRolePath(user?.role, 'historical-data'), {
                state: { autoSelectSpreadsheetId: createdSpreadsheetId }
            });
        } catch (error) {
            setUploadStatus({
                type: 'error',
                message: error.response?.data?.detail || 'Não foi possível processar o arquivo selecionado.',
            });
        } finally {
            setUploading(false);
        }
    }

    // Atualizar planilha por cima com um novo arquivo
    async function handleUpdateSpreadsheetFile(e) {
        const file = e.target.files?.[0];
        if (!file || !selectedSpreadsheet) return;

        const allowedExtensions = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
        const nameLower = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => nameLower.endsWith(ext));

        if (!isValid) {
            alert('Formato de arquivo não suportado. Por favor, envie CSV, XLSX, XLS, TXT ou PDF.');
            return;
        }

        const confirmSubstitute = window.confirm(
            `Deseja realmente carregar os dados do arquivo "${file.name}" por cima de "${selectedSpreadsheet.filename}"?\n\nIsso apagará permanentemente todos os registros de alunos antigos desta planilha e os substituirá pelos dados do novo arquivo.`
        );

        if (!confirmSubstitute) {
            e.target.value = ''; // Limpar o input
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('correct_data', String(correctData));
            formData.append('target_spreadsheet_id', String(selectedSpreadsheet.id));

            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000, // 10 minutos
            });

            alert(`Planilha atualizada com sucesso! ${response.data.records_count} novos registros processados.`);
            
            // Recarregar os dados
            const sheets = await fetchSpreadsheets();
            await fetchFilters();
            
            // Re-selecionar a mesma planilha para atualizar os dados na tela
            const updatedSheet = sheets.find(s => s.id === selectedSpreadsheet.id);
            if (updatedSheet) {
                setSelectedSpreadsheet(updatedSheet);
                // Buscar registros atualizados na aba de turmas
                await fetchRecords(updatedSheet.id);
            }
        } catch (error) {
            alert(error.response?.data?.detail || 'Não foi possível atualizar a planilha com o arquivo selecionado.');
        } finally {
            setUploading(false);
            e.target.value = ''; // Limpar o input
        }
    }

    // Enviar mensagem no chat da planilha
    async function handleSendSheetChatMessage(messageText) {
        const text = messageText || chatInput.trim();
        if (!text || chatLoading || !selectedSpreadsheet) return;

        setChatMessages(prev => [...prev, { role: 'user', content: text }]);
        if (!messageText) setChatInput('');
        setChatLoading(true);

        try {
            const response = await api.post(`/historical-data/spreadsheets/${selectedSpreadsheet.id}/chat`, {
                message: text
            });
            setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
        } catch (error) {
            console.error('Erro no chat da planilha', error);
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao contatar a inteligência artificial para este documento.' }]);
        } finally {
            setChatLoading(false);
        }
    }

    // Disparar analise profunda de IA da planilha
    async function handleTriggerAiAnalysis(spreadsheetToAnalyze) {
        const targetSheet = spreadsheetToAnalyze || selectedSpreadsheet;
        if (!targetSheet) return;

        setAiAnalysisLoading(true);
        setShowAiAnalysisModal(true);
        setAiAnalysisResult(null);
        try {
            const response = await api.post(`/historical-data/spreadsheets/${targetSheet.id}/ai-analysis`);
            if (response.data && response.data.success) {
                setAiAnalysisResult(response.data);
            } else {
                setAiAnalysisResult({
                    analysis_report: 'Desculpe, a IA retornou uma resposta incompleta. Tente novamente mais tarde.'
                });
            }
        } catch (error) {
            console.error('Erro ao gerar analise profunda da IA', error);
            setAiAnalysisResult({
                analysis_report: 'Ocorreu um erro técnico ao processar esta planilha com o serviço do Google Gemini. Verifique se a chave GEMINI_API_KEY está configurada no .env na raiz do projeto.'
            });
        } finally {
            setAiAnalysisLoading(false);
        }
    }

    // Gerar insights pedagógicos táticos locais para a pior turma do histórico
    async function handleGenerateSheetInsights() {
        if (!selectedSpreadsheet) return;

        setSheetIaInsightsLoading(true);
        setSheetIaInsights(null);

        try {
            const response = await api.post(`/historical-data/spreadsheets/${selectedSpreadsheet.id}/ai-insights`);
            if (response.data && response.data.insights) {
                setSheetIaInsights(response.data.insights);
            } else {
                setSheetIaInsights('Desculpe, ocorreu uma falha ao gerar as recomendações pedagógicas locais. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao gerar insights pedagógicos locais da planilha', error);
            setSheetIaInsights('Ocorreu um erro técnico ao processar as dicas de intervenção com a IA.');
        } finally {
            setSheetIaInsightsLoading(false);
        }
    }

    // Exportar plano de intervenção pedagógica gerado pela IA em Markdown
    const handleExportMarkdownInsights = () => {
        if (!sheetIaInsights) return;
        const blob = new Blob([sheetIaInsights], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `Plano_de_Intervencao_NEXORA_${dateStr}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Sugestões de perguntas rápidas
    const quickQuestions = [
        "Quais disciplinas apresentam o pior rendimento?",
        "Identifique os alunos que precisam de intervenção imediata.",
        "Qual é a relação entre a presença e a nota geral?",
        "Dê sugestões pedagógicas com base neste semestre."
    ];

    const highlightedTopics = selectedWorkspace?.analysis_data?.risk_topics?.slice(0, 3) || [];
    const highRiskClasses = selectedWorkspace?.analysis_data?.high_risk_classes?.slice(0, 3) || [];
    
    // Algoritmo de fallback para identificar e destacar a pior turma caso nenhuma esteja em alto risco
    const allSpreadsheetClasses = selectedWorkspace?.analysis_data?.by_class || [];

    const worstClassByGrade = useMemo(() => {
        if (!allSpreadsheetClasses.length) return null;
        return [...allSpreadsheetClasses].sort((a, b) => (a.avg_grade || 0) - (b.avg_grade || 0))[0];
    }, [allSpreadsheetClasses]);

    const classesForGradeChart = useMemo(() => {
        if (!allSpreadsheetClasses || allSpreadsheetClasses.length === 0) return [];
        const sorted = [...allSpreadsheetClasses].sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0));
        
        let best = [];
        let worst = [];
        
        if (sorted.length <= 10) {
            const half = Math.ceil(sorted.length / 2);
            best = sorted.slice(0, half).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(half).map(c => ({ ...c, isWorst: true }));
        } else {
            best = sorted.slice(0, 5).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(-5).map(c => ({ ...c, isWorst: true }));
        }
        
        const separator = {
            id: 'separator-grade',
            label: ' ➔ | ➔ ',
            avg_grade: 0.001,
            isSeparator: true,
            isWorst: false
        };
        
        return [...best, separator, ...worst];
    }, [allSpreadsheetClasses]);

    const classesForAttendanceChart = useMemo(() => {
        if (!allSpreadsheetClasses || allSpreadsheetClasses.length === 0) return [];
        const sorted = [...allSpreadsheetClasses].sort((a, b) => (b.avg_attendance || 0) - (a.avg_attendance || 0));
        
        let best = [];
        let worst = [];
        
        if (sorted.length <= 10) {
            const half = Math.ceil(sorted.length / 2);
            best = sorted.slice(0, half).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(half).map(c => ({ ...c, isWorst: true }));
        } else {
            best = sorted.slice(0, 5).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(-5).map(c => ({ ...c, isWorst: true }));
        }
        
        const separator = {
            id: 'separator-attendance',
            label: ' ➔ | ➔ ',
            avg_attendance: 0.001,
            isSeparator: true,
            isWorst: false
        };
        
        return [...best, separator, ...worst];
    }, [allSpreadsheetClasses]);

    const displayedHighRiskClasses = useMemo(() => {
        const hasHighRisk = highRiskClasses.some(c => c.risk_score >= 0.38 || c.critical_students > 0);
        if (hasHighRisk) {
            return highRiskClasses;
        }
        if (worstClassByGrade) {
            return [
                {
                    id: worstClassByGrade.id,
                    label: worstClassByGrade.label,
                    risk_score: worstClassByGrade.risk_score || 0.1,
                    risk_level: 'medium',
                    recommended_focus: `Destaque Acadêmico (Pior Desempenho): Esta turma obteve o menor aproveitamento acadêmico do arquivo (média: ${worstClassByGrade.avg_grade?.toFixed(1) || '--'}). Recomenda-se ações preventivas de reforço.`,
                    is_fallback: true
                }
            ];
        }
        return [];
    }, [highRiskClasses, worstClassByGrade]);

    const displayedHighlightedTopics = useMemo(() => {
        const hasRiskTopics = highlightedTopics.some(t => t.risk_score >= 0.38);
        if (hasRiskTopics) {
            return highlightedTopics;
        }
        if (worstClassByGrade) {
            return [
                {
                    id: `fallback-topic-${worstClassByGrade.id}`,
                    type: 'Alerta Preventivo',
                    label: worstClassByGrade.label,
                    signal: `A turma apresenta a menor média geral de notas (${worstClassByGrade.avg_grade?.toFixed(1) || '--'}), exigindo atenção pedagógica dos professores.`,
                    is_fallback: true
                }
            ];
        }
        return [];
    }, [highlightedTopics, worstClassByGrade]);

    const uploadSummary = uploadStatus?.payload?.summary;
    const uploadWarnings = uploadStatus?.payload?.warnings || [];
    const uploadNormalizationSteps = uploadStatus?.payload?.normalization_steps || [];
    const organizedUploadGroups = uploadStatus?.payload?.class_groups?.slice(0, 4) || [];

    const groupedRecords = useMemo(
        () => buildGroupedRecords(records, { searchTerm, showAttentionOnly }),
        [records, searchTerm, showAttentionOnly],
    );

    const filteredRecordsList = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm || '');
        return records.filter((r) => {
            const matchesSearch = !normalizedSearch || [
                r.student_name,
                r.subject,
                r.course_name,
                r.registration_number,
            ].some((value) => normalizeText(value).includes(normalizedSearch));

            if (!matchesSearch) return false;

            if (showAttentionOnly && !isAttentionStudent(r)) return false;

            return true;
        }).sort((a, b) => String(a.student_name || '').localeCompare(String(b.student_name || '')));
    }, [records, searchTerm, showAttentionOnly]);

    const normalizationSteps = useMemo(() => ([
        'Reconhece colunas fora de ordem e nomes diferentes para semestre, aluno, nota e frequência.',
        'Converte CSV, XLSX, TXT e PDF para uma estrutura única antes da leitura analítica.',
        'Vincula registros diretamente a um documento rastreável na aba de histórico.',
    ]), []);
    const normalizationChecklist = uploadNormalizationSteps.length ? uploadNormalizationSteps : normalizationSteps;

    return (
        <div className="space-y-6">
            {/* ABA 1: SUBIR PLANILHA */}
            {activeTab === 'upload' && (
                <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        {/* Seção de Upload */}
                        <Card variant="hero">
                            <CardHeader
                                title="Tratamento Inteligente de Arquivos"
                                subtitle="Envie planilhas e PDFs de notas ou frequências anteriores. A NEXORA padroniza os arquivos, limpa inconsistências usando IA e estrutura a base de dados automaticamente."
                                icon={Upload}
                            />

                            {/* Input de Arquivos Principal - Sempre Montado para Acesso por Ref e ID */}
                            <input
                                id="central-file-upload"
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".csv,.xlsx,.xls,.txt,.pdf"
                                onChange={handleFileSelect}
                            />

                            <div className="space-y-3">
                                {normalizationChecklist.map((step) => (
                                    <div key={step} className="rounded-[22px] border border-border-subtle bg-white/75 px-4 py-3.5 text-sm leading-6 text-text-secondary">
                                        {step}
                                    </div>
                                ))}
                            </div>

                            {/* Novo Seletor Premium de Modo da IA */}
                            <div className="mt-5 space-y-3">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                                    Modo de Operação por IA (NEXORA Copilot)
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Opção A: Apenas Leitura */}
                                    <div
                                        onClick={() => setCorrectData(false)}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col gap-1.5 ${
                                            !correctData
                                                ? 'border-indigo-500 bg-indigo-50/10 shadow-soft'
                                                : 'border-border-subtle bg-white/60 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-text-primary">Apenas Leitura e Análise</span>
                                            <Badge variant={!correctData ? "primary" : "neutral"} className="text-[9px]">Padrão</Badge>
                                        </div>
                                        <p className="text-[10.5px] text-text-secondary leading-5">
                                            A IA analisa os dados para gerar insights pedagógicos e alertas, mas mantém as notas e presenças originais intocadas no banco.
                                        </p>
                                    </div>

                                    {/* Opção B: Limpeza e Ajuste por IA */}
                                    <div
                                        onClick={() => setCorrectData(true)}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col gap-1.5 ${
                                            correctData
                                                ? 'border-indigo-500 bg-indigo-50/10 shadow-soft'
                                                : 'border-border-subtle bg-white/60 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-text-primary">Limpeza e Ajuste por IA</span>
                                            <Badge variant={correctData ? "warning" : "neutral"} className="text-[9px]">Ativo</Badge>
                                        </div>
                                        <p className="text-[10.5px] text-text-secondary leading-5">
                                            A IA conserta ativamente acentuação quebrada (ex: "JoÆo" para "João"), normaliza escalas de notas e frequências decimais na base antes de salvar.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {!pendingFile && (
                                <label 
                                    htmlFor="central-file-upload"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`relative mt-6 flex flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-12 text-center transition-all duration-300 cursor-pointer ${
                                        isDragging
                                            ? 'border-indigo-600 bg-indigo-50/40 shadow-soft scale-[1.01] dark:bg-indigo-950/50 dark:border-indigo-500'
                                            : 'border-indigo-200 bg-gradient-to-br from-indigo-50/30 via-white/80 to-indigo-50/10 hover:border-indigo-400 hover:bg-white hover:shadow-md dark:border-border-subtle dark:from-indigo-950/30 dark:via-bg-card/90 dark:to-indigo-950/10 dark:hover:border-indigo-500/30 dark:hover:bg-bg-card-hover'
                                    }`}
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className={`p-4 rounded-full transition-all duration-300 ${
                                            isDragging ? 'bg-indigo-600 text-white animate-bounce' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 group-hover:scale-110'
                                        }`}>
                                            <Upload className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-text-primary">
                                                Arraste sua planilha aqui ou clique para selecionar
                                            </p>
                                            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed max-w-[420px] mx-auto">
                                                Suporta arquivos nos formatos <span className="font-semibold text-indigo-600 dark:text-indigo-400">CSV, XLSX, XLS, TXT e PDF</span>. A IA estruturará os dados e corrigirá inconsistências automaticamente.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="primary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 animate-pulse">IA Nexora</Badge>
                                            <span className="text-[10px] text-text-tertiary">Normalização inteligente de dados ativa</span>
                                        </div>
                                    </div>
                                </label>
                            )}

                            {pendingFile && (
                                <div className="mt-5 rounded-[24px] border border-accent-blue/20 bg-white/80 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{pendingFile.name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                Pronto para estruturar, associar e analisar.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="info">{(pendingFile.size / 1024).toFixed(1)} KB</Badge>
                                            <Badge variant="neutral">{pendingFile.name.split('.').pop()?.toUpperCase() || 'ARQ'}</Badge>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <Button onClick={handleUpload} loading={uploading} icon={Sparkles}>
                                            Confirmar e Analisar com IA
                                        </Button>
                                        <Button 
                                            variant="secondary"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            Trocar
                                        </Button>
                                        <Button variant="secondary" onClick={() => setPendingFile(null)}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Resposta do Upload */}
                        <Card>
                            <CardHeader
                                title="Status de Processamento"
                                subtitle="Sinais iniciais e turmas geradas a partir do último envio."
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
                                    Aguardando envio para apresentar os primeiros sinais.
                                </div>
                            )}

                            {uploadSummary && (
                                <div className="mt-4 grid gap-3 grid-cols-3">
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Alunos</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">{uploadSummary.students || 0}</p>
                                    </div>
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Nota Média</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">
                                            {uploadSummary.avg_grade?.toFixed?.(2) || uploadSummary.avg_grade || '--'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Presença Média</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">
                                            {uploadSummary.avg_attendance?.toFixed?.(1) || uploadSummary.avg_attendance || '--'}%
                                        </p>
                                    </div>
                                </div>
                            )}

                            {uploadWarnings.length > 0 && (
                                <div className="mt-4 rounded-[24px] border border-warning/20 bg-warning/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">Alertas</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {uploadWarnings.map((warning) => (
                                            <Badge key={warning} variant="warning">{warning}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ABA 2: HISTÓRICO DE PLANILHAS E ANALISES INTEGRADAS */}
            {activeTab === 'history' && (
                <div>
                    {!selectedSpreadsheet ? (
                        <div className="space-y-6">
                            {/* KPIs Macro Acumulados */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricCard
                                    title="Planilhas integradas"
                                    value={loading ? '...' : globalSummary.total_spreadsheets}
                                    helper="Total de documentos históricos salvos"
                                    icon={FileSpreadsheet}
                                    tone="indigo"
                                />
                                <MetricCard
                                    title="Registros consolidados"
                                    value={loading ? '...' : globalSummary.total_records}
                                    helper="Alunos processados no histórico"
                                    icon={Users}
                                    tone="blue"
                                />
                                <MetricCard
                                    title="Média Geral de Notas"
                                    value={loading ? '...' : (globalSummary.avg_grade?.toFixed?.(2) || globalSummary.avg_grade || '--')}
                                    helper="Desempenho acadêmico acumulado"
                                    icon={GraduationCap}
                                    tone="emerald"
                                />
                                <MetricCard
                                    title="Média de Frequência"
                                    value={loading ? '...' : (globalSummary.avg_attendance?.toFixed?.(1) || globalSummary.avg_attendance || '--') + '%'}
                                    helper="Taxa média de presença discente"
                                    icon={CheckCircle2}
                                    tone="amber"
                                />
                            </div>

                            {/* Tabela de Planilhas Subidas */}
                            <Card>
                        <CardHeader
                            title="Planilhas e Históricos Enviados"
                            subtitle="Acompanhe e analise planilhas consolidadas no banco de dados. Utilize a central pedagógica de IA de forma integrada clicando em um arquivo para abrir o painel de análise."
                            icon={FileSpreadsheet}
                        />

                        {loading ? (
                            <div className="flex min-h-[200px] items-center justify-center gap-3 text-text-secondary">
                                <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
                                Carregando planilhas...
                            </div>
                        ) : spreadsheets.length === 0 ? (
                            <EmptyState
                                icon={Upload}
                                title="Nenhuma planilha cadastrada"
                                description="Realize o upload de sua primeira planilha para começar a usufruir das análises e predições com IA."
                            />
                        ) : (
                            <div className="space-y-8">
                                {/* Seção: Em Andamento */}
                                {spreadsheets.filter(s => !s.is_completed).length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-2 px-1">
                                            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
                                            ⚡ Planilhas em Andamento (Previsões por IA Ativas)
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {spreadsheets.filter(s => !s.is_completed).map((sheet) => {
                                                const isPdf = sheet.filename.toLowerCase().endsWith('.pdf');
                                                return (
                                                    <motion.div
                                                        key={sheet.id}
                                                        whileHover={{ y: -4 }}
                                                        onClick={() => handleSelectSpreadsheet(sheet)}
                                                        className="cursor-pointer flex flex-col rounded-[26px] border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/20 to-white p-5 shadow-soft hover:bg-white hover:border-indigo-400 hover:shadow-indigo-100/50 transition-all group relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5">
                                                            <span>✨ IA Preditiva</span>
                                                        </div>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600`}>
                                                                <FileSpreadsheet className="h-5 w-5" />
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDeleteSpreadsheet(sheet.id, e)}
                                                                className="p-2 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-xl transition mr-8"
                                                                title="Excluir arquivo"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <h4 className="mt-4 text-xs font-bold text-text-primary group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                            {sheet.filename}
                                                        </h4>
                                                        <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(sheet.uploaded_at).toLocaleDateString('pt-BR')}
                                                        </p>
                                                        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant="neutral">{sheet.semester || 'Semestre N/A'}</Badge>
                                                            <Badge variant="neutral" className="line-clamp-1 max-w-[120px]">{sheet.course_name || 'Geral'}</Badge>
                                                            <Badge variant="neutral" className="bg-indigo-50 text-indigo-700 border-indigo-200">Em Andamento</Badge>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-secondary">
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Alunos</span>
                                                                <span className="font-semibold text-text-primary mt-0.5 block">{sheet.records_count}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Média Proj.</span>
                                                                <span className="font-semibold text-indigo-600 mt-0.5 block">{sheet.avg_grade ? sheet.avg_grade.toFixed(1) : '--'} ✨</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Presença</span>
                                                                <span className="font-semibold text-text-primary mt-0.5 block">{sheet.avg_attendance ? `${sheet.avg_attendance.toFixed(0)}%` : '--'}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Seção: Concluídas */}
                                <div className="space-y-4">
                                    {spreadsheets.filter(s => !s.is_completed).length > 0 && (
                                        <h3 className="text-xs font-bold text-text-secondary flex items-center gap-2 pt-4 border-t border-border-subtle px-1">
                                            📂 Planilhas Concluídas (Históricas)
                                        </h3>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {spreadsheets.filter(s => s.is_completed).map((sheet) => {
                                            const isPdf = sheet.filename.toLowerCase().endsWith('.pdf');
                                            return (
                                                <motion.div
                                                    key={sheet.id}
                                                    whileHover={{ y: -4 }}
                                                    onClick={() => handleSelectSpreadsheet(sheet)}
                                                    className="cursor-pointer flex flex-col rounded-[26px] border border-border-subtle bg-white/70 p-5 shadow-soft hover:bg-white hover:border-indigo-200 transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                            isPdf ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                        }`}>
                                                            <FileSpreadsheet className="h-5 w-5" />
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteSpreadsheet(sheet.id, e)}
                                                            className="p-2 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-xl transition"
                                                            title="Excluir arquivo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <h4 className="mt-4 text-xs font-bold text-text-primary group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                        {sheet.filename}
                                                    </h4>
                                                    <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(sheet.uploaded_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                                                        <Badge variant="neutral">{sheet.semester || 'Semestre N/A'}</Badge>
                                                        <Badge variant="neutral" className="line-clamp-1 max-w-[120px]">{sheet.course_name || 'Geral'}</Badge>
                                                        <Badge variant="neutral" className="bg-emerald-50 text-emerald-700 border-emerald-200">Concluído</Badge>
                                                    </div>
                                                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-secondary">
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Alunos</span>
                                                            <span className="font-semibold text-text-primary mt-0.5 block">{sheet.records_count}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Média</span>
                                                            <span className="font-semibold text-emerald-600 mt-0.5 block">{sheet.avg_grade ? sheet.avg_grade.toFixed(1) : '--'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Presença</span>
                                                            <span className="font-semibold text-text-primary mt-0.5 block">{sheet.avg_attendance ? `${sheet.avg_attendance.toFixed(0)}%` : '--'}</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Voltar e Header da Planilha Selecionada */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-secondary/40 border border-border-subtle p-4 rounded-3xl">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setSelectedSpreadsheet(null);
                                    setSelectedWorkspace(null);
                                }}
                                icon={ArrowLeft}
                            >
                                Voltar
                            </Button>
                            <div>
                                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-accent-blue" />
                                    {selectedSpreadsheet.filename}
                                </h2>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Semestre: <strong>{selectedSpreadsheet.semester}</strong> | Curso: <strong>{selectedSpreadsheet.course_name}</strong>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <Badge variant="info">{selectedSpreadsheet.records_count} alunos</Badge>
                                <Badge variant="success">Média: {selectedSpreadsheet.avg_grade?.toFixed(1) || '--'}</Badge>
                                <Badge variant="warning">Presença: {selectedSpreadsheet.avg_attendance?.toFixed(1) || '--'}%</Badge>
                            </div>
                            
                            <input
                                type="file"
                                ref={updateFileInputRef}
                                onChange={handleUpdateSpreadsheetFile}
                                accept=".csv,.xlsx,.xls,.txt,.pdf"
                                className="hidden"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                icon={Upload}
                                onClick={() => updateFileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? 'Processando...' : 'Carregar Dados por Cima'}
                            </Button>
                        </div>
                    </div>

                    {analysisLoading ? (
                        <Card>
                            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-text-secondary">
                                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                                <span>Processando inteligência de risco e modelando o workspace para {selectedSpreadsheet.filename}...</span>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.15fr_0.85fr]">
                                    
                                    {/* COLUNA ESQUERDA: ANALISE E INDICADORES DA PLANILHA EM ABAS */}
                                    <div className="space-y-4">
                                        {/* Seleção de Abas do Painel Acadêmico */}
                                        <div className="flex border-b border-border-subtle gap-4 px-1 bg-white/40 p-2 rounded-2xl border border-white/50 backdrop-blur-sm shadow-soft">
                                            <button
                                                type="button"
                                                onClick={() => setAnalysisTab('overview')}
                                                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                                    analysisTab === 'overview'
                                                        ? 'bg-indigo-600 text-white shadow-soft'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                                                }`}
                                            >
                                                Visão Geral & Alertas
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAnalysisTab('students')}
                                                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                                    analysisTab === 'students'
                                                        ? 'bg-indigo-600 text-white shadow-soft'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                                                }`}
                                            >
                                                Turmas & Alunos ({records.length})
                                            </button>
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {analysisTab === 'overview' && (
                                                <motion.div
                                                    key="overview"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="grid gap-4 sm:grid-cols-2"
                                                >
                                                    <Card>
                                                        <CardHeader
                                                            title="Sinais Rápidos de Risco"
                                                            subtitle="Temas pedagógicos que exigem foco."
                                                            icon={Lightbulb}
                                                        />
                                                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                                            {displayedHighlightedTopics.length > 0 ? (
                                                                displayedHighlightedTopics.map((item) => (
                                                                    <div key={item.id} className="rounded-2xl border border-border-subtle bg-bg-secondary/20 p-4 text-xs">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="font-semibold text-text-primary">{item.label}</p>
                                                                            <Badge variant="neutral">{item.type}</Badge>
                                                                        </div>
                                                                        <p className="mt-2 text-text-secondary leading-5">{item.signal}</p>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-xs text-text-secondary px-2">Nenhum sinal acadêmico pendente.</p>
                                                            )}
                                                        </div>
                                                    </Card>

                                                    <Card>
                                                        <CardHeader
                                                            title="Turmas com Maior Alerta"
                                                            subtitle="Prioridade alta de intervenção pedagógica."
                                                            icon={BarChart3}
                                                        />
                                                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                                            {displayedHighRiskClasses.length > 0 ? (
                                                                displayedHighRiskClasses.map((item) => (
                                                                    <div key={item.id} className="rounded-2xl border border-border-subtle bg-bg-secondary/20 p-4 text-xs">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="font-semibold text-text-primary">{item.label}</p>
                                                                            <Badge variant={item.is_fallback ? "info" : "warning"}>
                                                                                {item.is_fallback ? "Atenção" : `${Math.round(item.risk_score * 100)}%`}
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="mt-2 text-text-secondary leading-5">{item.recommended_focus}</p>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-xs text-text-secondary px-2">Sem turmas em risco alto na planilha.</p>
                                                            )}
                                                        </div>
                                                    </Card>

                                                    {/* CARD DE ANALISE GRÁFICA COMPARATIVA */}
                                                    <div className="col-span-1 sm:col-span-2 mt-2">
                                                    <Card>
                                                             <CardHeader
                                                                 title="Análise Comparativa (Abismo de Rendimento)"
                                                                 subtitle="Compare o desempenho das melhores vs as piores turmas para identificar disparidades críticas"
                                                                 icon={BarChart3}
                                                             />
                                                             {allSpreadsheetClasses.length > 0 ? (
                                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                                                     {/* Gráfico 1: Notas Médias */}
                                                                     <div className="bg-bg-secondary/20 p-4 rounded-2xl border border-border-subtle">
                                                                         <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                                                                             <span>Melhores vs Piores Turmas (Média de Notas)</span>
                                                                             <Badge variant="info">Nota Média</Badge>
                                                                         </h4>
                                                                         <div className="h-64">
                                                                             <ResponsiveContainer width="100%" height="100%">
                                                                                 <BarChart data={classesForGradeChart}>
                                                                                     <defs>
                                                                                         <linearGradient id="gradientHistoricalGrades" x1="0" y1="0" x2="0" y2="1">
                                                                                             <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                                                                             <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.5} />
                                                                                         </linearGradient>
                                                                                         <linearGradient id="gradientHistoricalGradesWorst" x1="0" y1="0" x2="0" y2="1">
                                                                                             <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                                                                                             <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.5} />
                                                                                         </linearGradient>
                                                                                     </defs>
                                                                                     <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                                                     <XAxis dataKey="label" tick={false} stroke="#94a3b8" tickLine={false} axisLine={false} />
                                                                                     <YAxis domain={[0, 10]} stroke="#94a3b8" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                                                                     <Tooltip content={<CustomTooltip />} />
                                                                                     <ReferenceLine x=" ➔ | ➔ " stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
                                                                                     <Bar dataKey="avg_grade" radius={[10, 10, 0, 0]} name="Média de Notas" minPointSize={8}>
                                                                                         {classesForGradeChart.map((entry, index) => (
                                                                                             <Cell 
                                                                                                 key={`cell-grade-${index}`} 
                                                                                                 fill={entry.isSeparator ? "transparent" : (entry.isWorst ? "url(#gradientHistoricalGradesWorst)" : "url(#gradientHistoricalGrades)")} 
                                                                                             />
                                                                                         ))}
                                                                                     </Bar>
                                                                                 </BarChart>
                                                                             </ResponsiveContainer>
                                                                         </div>
                                                                         <p className="text-[10px] text-text-secondary mt-2 text-center">
                                                                             * Comparativo direto das melhores turmas (Roxo) vs as piores turmas (Vermelho) evidenciando o abismo pedagógico.
                                                                         </p>
                                                                     </div>

                                                                    {/* Gráfico 2: Presença Média */}
                                                                    <div className="bg-bg-secondary/20 p-4 rounded-2xl border border-border-subtle">
                                                                        <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                                                                            <span>Melhores vs Piores Turmas (Média de Presença)</span>
                                                                            <Badge variant="purple">Frequência</Badge>
                                                                        </h4>
                                                                        <div className="h-64">
                                                                            <ResponsiveContainer width="100%" height="100%">
                                                                                <BarChart data={classesForAttendanceChart}>
                                                                                    <defs>
                                                                                        <linearGradient id="gradientHistoricalAttendance" x1="0" y1="0" x2="0" y2="1">
                                                                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                                                                            <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
                                                                                        </linearGradient>
                                                                                        <linearGradient id="gradientHistoricalAttendanceWorst" x1="0" y1="0" x2="0" y2="1">
                                                                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                                                                                            <stop offset="100%" stopColor="#c2410c" stopOpacity={0.5} />
                                                                                        </linearGradient>
                                                                                    </defs>
                                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                                                    <XAxis dataKey="label" tick={false} stroke="#94a3b8" tickLine={false} axisLine={false} />
                                                                                    <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                                                                    <Tooltip content={<CustomTooltip />} />
                                                                                    <ReferenceLine x=" ➔ | ➔ " stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
                                                                                    <Bar dataKey="avg_attendance" radius={[10, 10, 0, 0]} name="Presença (%)" minPointSize={8}>
                                                                                        {classesForAttendanceChart.map((entry, index) => (
                                                                                            <Cell 
                                                                                                key={`cell-attendance-${index}`} 
                                                                                                fill={entry.isSeparator ? "transparent" : (entry.isWorst ? "url(#gradientHistoricalAttendanceWorst)" : "url(#gradientHistoricalAttendance)")} 
                                                                                            />
                                                                                        ))}
                                                                                    </Bar>
                                                                                </BarChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                        <p className="text-[10px] text-text-secondary mt-2 text-center">
                                                                            * Comparativo direto das melhores turmas em frequência (Verde) vs as piores turmas (Laranja/Coral) evidenciando a disparidade de engajamento.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-6 text-center text-xs text-text-secondary">
                                                                    Aguardando processamento analítico para exibir gráficos.
                                                                </div>
                                                            )}
                                                        </Card>
                                                    </div>

                                                    {/* CARD DE INSIGHTS E DICAS DA IA CO-PILOT */}
                                                    <div className="col-span-1 sm:col-span-2">
                                                        <Card variant="hero">
                                                            <CardHeader
                                                                title="Insights & Dicas Pedagógicas da IA (NEXORA Copilot)"
                                                                subtitle="Análise acadêmica preditiva baseada nos dados consolidados desta planilha"
                                                                icon={Sparkles}
                                                            />
                                                            <div className="p-5 border-t border-border-subtle bg-white/70 min-h-[140px] flex flex-col justify-center">
                                                                {sheetIaInsightsLoading ? (
                                                                    <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                                                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                            <span className="text-xs text-text-secondary">Processando dicas pedagógicas e estruturando plano de intervenção com a IA...</span>
                                                                    </div>
                                                                ) : sheetIaInsights ? (
                                                                    <div className="space-y-4">
                                                                        <div className="prose max-w-none text-text-primary bg-white/40 border border-white/30 p-5 rounded-[22px] shadow-sm text-xs leading-6">
                                                                            <MarkdownRenderer text={sheetIaInsights} />
                                                                        </div>
                                                                        <div className="flex justify-end gap-2 border-t border-border-subtle/50 pt-3">
                                                                            <Button
                                                                                size="xs"
                                                                                variant="secondary"
                                                                                icon={Copy}
                                                                                onClick={() => {
                                                                                    navigator.clipboard.writeText(sheetIaInsights);
                                                                                    alert('Dicas pedagógicas copiadas para a área de transferência!');
                                                                                }}
                                                                            >
                                                                                Copiar Dicas
                                                                            </Button>
                                                                            <Button
                                                                                size="xs"
                                                                                variant="secondary"
                                                                                icon={Download}
                                                                                onClick={handleExportMarkdownInsights}
                                                                            >
                                                                                Exportar Relatório (.md)
                                                                            </Button>
                                                                            <Button
                                                                                size="xs"
                                                                                variant="secondary"
                                                                                icon={Sparkles}
                                                                                onClick={handleGenerateSheetInsights}
                                                                            >
                                                                                Gerar Novamente
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                                        <div className="space-y-1.5 flex-1">
                                                                            <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                                                                                <Lightbulb className="h-4 w-4" />
                                                                                Diagnóstico Geral de Aproveitamento
                                                                            </p>
                                                                            <p className="text-xs text-text-secondary leading-5">
                                                                                {worstClassByGrade ? (
                                                                                    <span>
                                                                                        Identificamos que a disciplina/turma <strong>{worstClassByGrade.label}</strong> obteve o menor desempenho de notas gerais (<strong>{worstClassByGrade.avg_grade?.toFixed(1)}</strong>) e uma taxa de aprovação de <strong>{worstClassByGrade.pass_rate}%</strong> no curso de <strong>{selectedSpreadsheet?.course_name || 'Engenharia de Software'}</strong>. Clique no botão ao lado para que a IA gere sugestões personalizadas de intervenção pedagógica conectando esta matéria à realidade profissional de {selectedSpreadsheet?.course_name || 'tecnologia'}.
                                                                                    </span>
                                                                                ) : (
                                                                                    <span>A base de notas histórica apresenta ótimos índices de aproveitamento geral no semestre selecionado.</span>
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                        {worstClassByGrade && (
                                                                            <Button
                                                                                size="sm"
                                                                                icon={Sparkles}
                                                                                onClick={handleGenerateSheetInsights}
                                                                            >
                                                                                Gerar Dicas de Intervenção com IA
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {analysisTab === 'students' && (
                                                <motion.div
                                                    key="students"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                >
                                                    <Card>
                                                        <CardHeader
                                                            title="Alunos e Desempenho Acadêmico"
                                                            subtitle="Gerencie alunos, notas e presenças de forma interativa nesta planilha."
                                                            icon={Users}
                                                            action={
                                                                <Button
                                                                    size="sm"
                                                                    variant="primary"
                                                                    onClick={handleOpenAddModal}
                                                                >
                                                                    + Adicionar Aluno
                                                                </Button>
                                                            }
                                                        />
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Badge variant="neutral">{groupedRecords.length} turmas</Badge>
                                                                <Badge variant="info">{records.length} registros</Badge>
                                                            </div>
                                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                                <label className="relative">
                                                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                                                    <input
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        placeholder="Buscar aluno..."
                                                                        className="h-10 w-full sm:w-[200px] rounded-xl border border-border-subtle bg-white pl-10 pr-4 text-xs outline-none focus:border-indigo-500"
                                                                    />
                                                                </label>
                                                                <Button
                                                                    size="sm"
                                                                    variant={showAttentionOnly ? 'primary' : 'secondary'}
                                                                    onClick={() => setShowAttentionOnly(prev => !prev)}
                                                                >
                                                                    {showAttentionOnly ? 'Todos' : 'Em Risco'}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {filteredRecordsList.length > 0 ? (
                                                            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-white shadow-soft max-h-[460px] overflow-y-auto">
                                                                <table className="w-full text-left border-collapse text-xs">
                                                                    <thead>
                                                                        <tr className="bg-bg-secondary/50 border-b border-border-subtle text-text-secondary font-semibold">
                                                                            <th className="p-3.5">Nome do Aluno</th>
                                                                            <th className="p-3.5">Curso</th>
                                                                            <th className="p-3.5">Disciplina</th>
                                                                            <th className="p-3.5 text-center">Média</th>
                                                                            <th className="p-3.5 text-center">Frequência</th>
                                                                            <th className="p-3.5 text-center">Situação</th>
                                                                            <th className="p-3.5 text-center">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-subtle">
                                                                        {filteredRecordsList.map((r) => (
                                                                            <tr key={r.id} className="hover:bg-bg-secondary/20 transition">
                                                                                <td className="p-3.5 font-bold text-text-primary">{r.student_name}</td>
                                                                                <td className="p-3.5">
                                                                                    <Badge variant="neutral">{r.course_name || selectedSpreadsheet.course_name}</Badge>
                                                                                </td>
                                                                                <td className="p-3.5 text-text-secondary">{r.subject || 'Geral'}</td>
                                                                                <td className="p-3.5 text-center font-semibold">
                                                                                    <span className={r.grade_average < 6.0 ? 'text-danger' : 'text-success'}>
                                                                                        {formatGrade(r.grade_average)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-3.5 text-center font-semibold">
                                                                                    <span className={r.attendance < 75.0 ? 'text-warning' : 'text-text-primary'}>
                                                                                        {formatAttendance(r.attendance)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-3.5 text-center">
                                                                                    <Badge variant={getStudentStatusVariant(r.status_label, r.attendance, r.grade_average)}>
                                                                                        {r.status_label || getAttendanceSignal(r.attendance, r.grade_average)}
                                                                                    </Badge>
                                                                                </td>
                                                                                <td className="p-3.5 text-center">
                                                                                    <div className="flex items-center justify-center gap-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleOpenEditModal(r)}
                                                                                            className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-855 transition text-base"
                                                                                            title="Editar Aluno"
                                                                                        >
                                                                                            ✏️
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleDeleteStudentRecord(r.id)}
                                                                                            className="rounded-lg p-1.5 text-danger hover:bg-danger/8 hover:text-danger/90 transition"
                                                                                            title="Excluir Aluno"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <EmptyState
                                                                icon={Search}
                                                                title="Nenhum registro correspondente"
                                                                description="Tente redefinir a sua busca ou adicione um novo aluno de forma interativa."
                                                            />
                                                        )}
                                                    </Card>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* COLUNA DIREITA: PAINEL INTEGRADO DO CHAT DE IA */}
                                    <div className="flex flex-col">
                                        <Card className="flex flex-col h-[650px] bg-white border border-border-subtle rounded-3xl overflow-hidden shadow-medium">
                                            {/* Header do Chat */}
                                            <div className="flex items-center justify-between border-b border-border-subtle bg-gradient-to-r from-indigo-50/50 to-purple-50/30 px-5 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-soft">
                                                        <Sparkles className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1">
                                                            NEXORA IA Assistente
                                                        </h3>
                                                        <p className="text-[11px] text-text-secondary mt-0.5">Focado em: {selectedSpreadsheet.filename}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="info">Conectado</Badge>
                                            </div>

                                            {/* Histórico do Chat */}
                                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                                {chatMessages.map((msg, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={[
                                                            'flex w-full',
                                                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                                                        ].join(' ')}
                                                    >
                                                        <div className={[
                                                            'max-w-[85%] rounded-[24px] px-4 py-3 text-xs leading-6 shadow-soft border',
                                                            msg.role === 'user'
                                                                ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none'
                                                                : msg.role === 'system'
                                                                    ? 'bg-neutral-50 text-text-secondary border-neutral-200/60'
                                                                    : 'bg-indigo-50/30 text-text-primary border-indigo-100 rounded-tl-none'
                                                        ].join(' ')}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Indicador de carregamento */}
                                                {chatLoading && (
                                                    <div className="flex justify-start">
                                                        <div className="bg-indigo-50/30 text-text-secondary border border-indigo-100 rounded-[24px] rounded-tl-none px-4 py-3 text-xs flex items-center gap-2">
                                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                                            <span>Analisando o histórico acadêmico...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={chatEndRef} />
                                            </div>

                                            {/* Perguntas Rápidas */}
                                            {chatMessages.length <= 2 && !chatLoading && (
                                                <div className="border-t border-border-subtle bg-bg-secondary/20 p-4">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-2">Sugestões de Perguntas</p>
                                                    <div className="grid gap-2">
                                                        {quickQuestions.map((q) => (
                                                            <button
                                                                key={q}
                                                                onClick={() => handleSendSheetChatMessage(q)}
                                                                className="text-left bg-white border border-border-subtle hover:border-indigo-400 hover:bg-indigo-50/20 text-[11px] text-text-secondary hover:text-indigo-700 px-3.5 py-2.5 rounded-2xl transition"
                                                            >
                                                                {q}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Input do Chat */}
                                            <div className="border-t border-border-subtle p-4 bg-white">
                                                <form
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        handleSendSheetChatMessage();
                                                    }}
                                                    className="flex gap-2"
                                                >
                                                    <input
                                                        value={chatInput}
                                                        onChange={(e) => setChatInput(e.target.value)}
                                                        placeholder="Pergunte sobre alunos, rendimentos ou disciplinas..."
                                                        className="h-11 flex-1 rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500"
                                                        disabled={chatLoading}
                                                    />
                                                    <Button
                                                        type="submit"
                                                        disabled={!chatInput.trim() || chatLoading}
                                                        icon={Send}
                                                    >
                                                        Enviar
                                                    </Button>
                                                </form>
                                            </div>
                                        </Card>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Criação e Edição de Aluno na Planilha */}
            <AnimatePresence>
                {isAddEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !addEditLoading && setIsAddEditModalOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="relative w-full max-w-lg rounded-3xl border border-border-subtle bg-white p-6 shadow-heavy z-10"
                        >
                            <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-4">
                                <h3 className="text-sm font-bold text-text-primary">
                                    {editingRecord ? '✏️ Editar Aluno' : '✨ Adicionar Aluno na Planilha'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => !addEditLoading && setIsAddEditModalOpen(false)}
                                    className="rounded-xl p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary transition"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setAddEditLoading(true);
                                const formData = new FormData(e.target);
                                const payload = {
                                    spreadsheet_id: selectedSpreadsheet.id,
                                    student_name: formData.get('student_name'),
                                    course_name: formData.get('course_name'),
                                    subject: formData.get('subject'),
                                    attendance: formData.get('attendance') ? parseFloat(formData.get('attendance')) : null,
                                    grades: { "média": formData.get('grade') ? parseFloat(formData.get('grade')) : 0.0 },
                                    period: formData.get('period') ? parseInt(formData.get('period')) : null,
                                    semester: selectedSpreadsheet.semester
                                };

                                try {
                                    if (editingRecord) {
                                        await api.put(`/historical-data/records/${editingRecord.id}`, payload);
                                    } else {
                                        await api.post('/historical-data/records', payload);
                                    }

                                    // Recarregar dados locais
                                    const recordsRes = await api.get('/historical-data', {
                                        params: { page: 1, page_size: 150 }
                                    });
                                    const filteredRecords = (recordsRes.data?.records || []).filter(
                                        r => r.spreadsheet_id === selectedSpreadsheet.id
                                    );
                                    setRecords(filteredRecords);

                                    // Recarregar planilhas
                                    const sheetsRes = await api.get('/historical-data/spreadsheets');
                                    const updatedSheet = (sheetsRes.data || []).find(s => s.id === selectedSpreadsheet.id);
                                    if (updatedSheet) {
                                        setSelectedSpreadsheet(updatedSheet);
                                    }

                                    setIsAddEditModalOpen(false);
                                } catch (err) {
                                    console.error('Erro ao salvar registro de aluno', err);
                                    alert('Erro ao salvar dados do aluno. Verifique se os campos foram preenchidos corretamente.');
                                } finally {
                                    setAddEditLoading(false);
                                }
                            }} className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Nome do Aluno</label>
                                    <input
                                        required
                                        name="student_name"
                                        defaultValue={editingRecord?.student_name || ''}
                                        placeholder="Ex: João da Silva"
                                        className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Curso Acadêmico</label>
                                        <input
                                            required
                                            name="course_name"
                                            defaultValue={editingRecord?.course_name || selectedSpreadsheet?.course_name || ''}
                                            placeholder="Ex: Engenharia de Software"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Disciplina / Matéria</label>
                                        <input
                                            required
                                            name="subject"
                                            defaultValue={editingRecord?.subject || ''}
                                            placeholder="Ex: Banco de Dados"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Média Final (0-10)</label>
                                        <input
                                            required
                                            name="grade"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            defaultValue={editingRecord?.grade_average != null ? editingRecord.grade_average : ''}
                                            placeholder="Ex: 7.5"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Frequência % (0-100)</label>
                                        <input
                                            required
                                            name="attendance"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            defaultValue={editingRecord?.attendance != null ? editingRecord.attendance : ''}
                                            placeholder="Ex: 85"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Período Acadêmico</label>
                                        <input
                                            name="period"
                                            type="number"
                                            min="1"
                                            max="16"
                                            defaultValue={editingRecord?.period != null ? editingRecord.period : ''}
                                            placeholder="Ex: 2"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4 mt-6">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={addEditLoading}
                                        onClick={() => setIsAddEditModalOpen(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        loading={addEditLoading}
                                    >
                                        {editingRecord ? 'Salvar' : 'Adicionar'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Aluno */}
            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={Boolean(selectedStudentId)}
                onClose={() => setSelectedStudentId(null)}
            />

            {/* Modal de Analise com IA Premium */}
            <AnimatePresence>
                {showAiAnalysisModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: 'spring', duration: 0.5 }}
                            className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[28px] border border-white/20 bg-white/70 backdrop-blur-md shadow-2xl flex flex-col z-10"
                        >
                            {/* Decorative background gradients */}
                            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[80px]" />
                            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-violet-500/10 blur-[80px]" />

                            {/* Header */}
                            <div className="relative border-b border-border-subtle p-6 flex items-center justify-between bg-white/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                            Inteligência Pedagógica NEXORA
                                        </h3>
                                        <p className="text-xs text-text-secondary mt-0.5">
                                            Varredura analítica de IA sobre **{selectedSpreadsheet?.filename || 'Planilha'}**
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}
                                    className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/50 transition-all border border-transparent hover:border-white/20"
                                    disabled={aiAnalysisLoading}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="relative flex-1 p-6 overflow-y-auto min-h-[300px]">
                                {aiAnalysisLoading ? (
                                    <div className="flex flex-col items-center justify-center min-h-[350px] gap-4 text-center">
                                        <div className="relative h-16 w-16 flex items-center justify-center">
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600/10" />
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                                            <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
                                        </div>
                                        <div className="space-y-2 max-w-md">
                                            <h4 className="text-sm font-bold text-text-primary">
                                                Processando Inteligência Generativa...
                                            </h4>
                                            <p className="text-xs text-text-secondary leading-5">
                                                <LoadingTextRotator />
                                            </p>
                                        </div>
                                    </div>
                                ) : aiAnalysisResult ? (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* KPIs rápidos no topo do relatório */}
                                        {aiAnalysisResult.kpis && (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-white/30 p-3 rounded-2xl border border-white/40">
                                                <div className="text-center p-2">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Alunos</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.total_records}</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Média Geral</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.avg_grade}</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Presença Média</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.avg_attendance}%</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Alunos em Risco</p>
                                                    <p className="text-sm font-bold text-red-600 mt-0.5">{aiAnalysisResult.kpis.at_risk_count}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Relatório formatado em Markdown */}
                                        <div className="prose max-w-none text-text-primary bg-white/40 border border-white/30 p-6 rounded-[24px] shadow-sm">
                                            <MarkdownRenderer text={aiAnalysisResult.analysis_report} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary gap-3">
                                        <AlertCircle className="h-8 w-8 text-red-500" />
                                        <span>Nenhum relatório pôde ser gerado para este arquivo.</span>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="relative border-t border-border-subtle p-5 bg-white/20 backdrop-blur-sm flex items-center justify-between">
                                <div className="text-[10px] text-text-secondary flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Google Gemini Integrado | Respostas e análises 100% em pt-BR
                                </div>
                                <div className="flex gap-2">
                                    {aiAnalysisResult && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if (aiAnalysisResult?.analysis_report) {
                                                    navigator.clipboard.writeText(aiAnalysisResult.analysis_report);
                                                    setCopiedReport(true);
                                                    setTimeout(() => setCopiedReport(false), 2000);
                                                }
                                            }}
                                            icon={copiedReport ? Check : Copy}
                                        >
                                            {copiedReport ? 'Copiado!' : 'Copiar Relatório'}
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleTriggerAiAnalysis()}
                                        disabled={aiAnalysisLoading}
                                        icon={Sparkles}
                                    >
                                        Gerar Novamente
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={() => setShowAiAnalysisModal(false)}
                                        disabled={aiAnalysisLoading}
                                    >
                                        Concluído
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
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
        ].some((value) => normalizeText(value).includes(normalizedSearch));

        if (!matchesSearch) {
            return;
        }

        if (filters.showAttentionOnly && !isAttentionStudent(record)) {
            return;
        }

        const semester = record.semester || 'Sem semestre';
        const subject = record.subject || 'Turma sem disciplina';
        const courseName = record.course_name || 'Curso não informado';
        const periodLabel = record.period ? `${record.period}o período` : 'Período não informado';
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
    return 'Estável';
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

function LoadingTextRotator() {
    const messages = [
        'Realizando varredura pedagógica nos registros do arquivo...',
        'Analisando notas médias das avaliações (VAs)...',
        'Computando taxas de assiduidade e presenças...',
        'Calculando correlações estatísticas entre frequência e aproveitamento...',
        'Mapeando estudantes em situação crítica de risco pedagógico...',
        'Estruturando planos de intervenção acadêmica com o Google Gemini...',
        'Sugerindo ferramentas e tecnologias educacionais sob medida para o docente...',
        'Refinando relatório final em Português do Brasil...'
    ];
    
    const [msgIndex, setMsgIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);
    
    return <span>{messages[msgIndex]}</span>;
}

function MarkdownRenderer({ text }) {
    if (!text) return null;
    
    const lines = text.split('\n');
    return (
        <div className="space-y-4">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                
                // Tratar títulos
                if (trimmed.startsWith('###')) {
                    return (
                        <h4 key={idx} className="text-sm font-extrabold text-indigo-700 mt-5 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600" />
                            {trimmed.replace('###', '').replace(/[\*#]/g, '').trim()}
                        </h4>
                    );
                }
                if (trimmed.startsWith('##')) {
                    return (
                        <h3 key={idx} className="text-base font-bold text-text-primary mt-6 mb-3 border-b border-border-subtle pb-1">
                            {trimmed.replace('##', '').replace(/[\*#]/g, '').trim()}
                        </h3>
                    );
                }
                if (trimmed.startsWith('#')) {
                    return (
                        <h2 key={idx} className="text-lg font-extrabold text-indigo-800 mt-6 mb-4 border-l-4 border-indigo-600 pl-3">
                            {trimmed.replace('#', '').replace(/[\*#]/g, '').trim()}
                        </h2>
                    );
                }
                
                // Tratar listas
                if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    const cleanText = trimmed.substring(1).trim();
                    return (
                        <li key={idx} className="ml-5 list-disc text-xs leading-6 text-text-secondary">
                            {parseBold(cleanText)}
                        </li>
                    );
                }
                
                // Tratar numeradas
                const matchNumber = trimmed.match(/^(\d+)\.\s(.*)/);
                if (matchNumber) {
                    return (
                        <div key={idx} className="ml-2 text-xs leading-6 text-text-secondary my-1">
                            <span className="font-bold text-indigo-600">{matchNumber[1]}. </span>
                            {parseBold(matchNumber[2])}
                        </div>
                    );
                }
                
                // Parágrafos vazios ou normais
                if (trimmed) {
                    return (
                        <p key={idx} className="text-xs leading-6 text-text-secondary">
                            {parseBold(trimmed)}
                        </p>
                    );
                }
                return <div key={idx} className="h-1" />;
            })}
        </div>
    );
}

function parseBold(text) {
    const parts = text.split('**');
    return parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="font-extrabold text-text-primary">{part}</strong> : part
    );
}
