import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Brain, Target, Users, Lightbulb,
    AlertTriangle, TrendingUp, Shield, BookOpen,
    ChevronRight, Loader2, WifiOff, Zap, Paperclip, X
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/services/api';
import { StudentDetailModal } from '@/components/StudentDetailModal';

/* ─── Severity / Impact Badges ─── */
const severityConfig = {
    high: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Alta' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Média' },
    low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Baixa' },
};

const categoryIcons = {
    academic: BookOpen,
    support: Users,
    institutional: Shield,
    monitoring: TrendingUp,
};

/* ─── Empty State ─── */
function EmptyState({ onGenerate, loading }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
        >
            <div className="relative mb-8">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-purple-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-purple-500/30 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-200 mb-3">Insights com Inteligência Artificial</h2>
            <p className="text-gray-500 text-center max-w-md mb-8 leading-relaxed">
                Analise os dados acadêmicos com o poder da IA. O Gemini irá identificar padrões,
                destacar alunos que precisam de atenção e sugerir ações estratégicas.
            </p>
            <button
                onClick={onGenerate}
                disabled={loading}
                className="group relative px-8 py-3.5 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-purple-600 to-blue-600
                           hover:from-purple-500 hover:to-blue-500
                           transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center gap-2"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analisando dados...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Gerar Análise com IA
                    </>
                )}
            </button>
        </motion.div>
    );
}

/* ─── Error State ─── */
function ErrorState({ message, onRetry }) {
    const isConfigError = message?.includes('GEMINI_API_KEY');
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16"
        >
            <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                {isConfigError ? <WifiOff className="w-8 h-8 text-amber-400" /> : <AlertTriangle className="w-8 h-8 text-amber-400" />}
            </div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">
                {isConfigError ? 'API Key não configurada' : 'Erro na análise'}
            </h3>
            <p className="text-gray-500 text-center max-w-md mb-6">{message}</p>
            {isConfigError ? (
                <div className="glass-card-static p-4 rounded-xl text-xs text-gray-400 max-w-md">
                    <p className="font-medium text-gray-300 mb-2">Como configurar:</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Acesse <span className="text-purple-400">aistudio.google.com/apikey</span></li>
                        <li>Crie uma API key gratuita</li>
                        <li>Adicione <code className="bg-white/5 px-1.5 py-0.5 rounded">GEMINI_API_KEY=sua-chave</code> no arquivo <code className="bg-white/5 px-1.5 py-0.5 rounded">.env</code></li>
                        <li>Reinicie o backend</li>
                    </ol>
                </div>
            ) : (
                <button onClick={onRetry}
                    className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 
                               font-medium transition-colors flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Tentar novamente
                </button>
            )}
        </motion.div>
    );
}

/* ─── Pattern Card ─── */
function PatternCard({ pattern, index }) {
    const sev = severityConfig[pattern.severity] || severityConfig.medium;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Card className="group hover:border-purple-500/30 transition-colors">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 
                                    group-hover:scale-110 transition-transform">
                        <Brain className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-200 text-sm">{pattern.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${sev.bg} ${sev.text}`}>
                                {sev.label}
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">{pattern.description}</p>
                        {pattern.affected_percentage != null && (
                            <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-purple-500/60 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(pattern.affected_percentage, 100)}%` }}
                                        transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                                    />
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium w-10 text-right">
                                    {pattern.affected_percentage}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

/* ─── Focus Student Card ─── */
function FocusStudentCard({ student, index, onOpenStudent }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Card className="group hover:border-rose-500/30 transition-colors">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400
                                    group-hover:scale-110 transition-transform">
                        <Target className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-200 text-sm mb-1">
                            <button
                                type="button"
                                onClick={() => onOpenStudent?.(student.student_id)}
                                className="transition-colors hover:text-accent-blue-light"
                            >
                                {student.student_name}
                            </button>
                            <span className="text-gray-600 font-normal ml-2 text-xs">ID: {student.student_id}</span>
                        </h4>
                        <p className="text-gray-500 text-xs mb-2">{student.reason}</p>
                        <div className="flex items-center gap-2 text-xs">
                            <ChevronRight className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400/80">{student.suggested_action}</span>
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

/* ─── Strategic Recommendation Card ─── */
function StrategyCard({ rec, index }) {
    const imp = severityConfig[rec.impact] || severityConfig.medium;
    const Icon = categoryIcons[rec.category] || Lightbulb;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Card className="group hover:border-blue-500/30 transition-colors">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400
                                    group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-200 text-sm">{rec.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${imp.bg} ${imp.text}`}>
                                {imp.label}
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">{rec.description}</p>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

/* ─── Main Page ─── */
export function AIInsights() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    async function generateInsights() {
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const response = await api.get('/analytics/ai-insights');
            const result = response.data;
            if (result.error) {
                setError(result.error);
            } else {
                setData(result);
            }
        } catch (err) {
            setError('Falha ao conectar com o servidor. Verifique se o backend está rodando.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Insights IA"
                    subtitle="Análise inteligente dos dados acadêmicos com Google Gemini"
                    icon={Sparkles}
                />
                {data && (
                    <button
                        onClick={generateInsights}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl font-medium text-sm text-white
                                   bg-gradient-to-r from-purple-600 to-blue-600
                                   hover:from-purple-500 hover:to-blue-500
                                   transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Reanalisar
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {/* Loading Overlay */}
                {loading && !data && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20"
                    >
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 
                                            flex items-center justify-center animate-pulse">
                                <Brain className="w-10 h-10 text-purple-400" />
                            </div>
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin absolute -bottom-2 -right-2" />
                        </div>
                        <p className="text-gray-400 mt-6 font-medium animate-pulse">Analisando dados com IA...</p>
                        <p className="text-gray-600 text-sm mt-2">Isso pode levar alguns segundos</p>
                    </motion.div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <ErrorState key="error" message={error} onRetry={generateInsights} />
                )}

                {/* Empty State */}
                {!data && !error && !loading && (
                    <EmptyState key="empty" onGenerate={generateInsights} loading={loading} />
                )}

                {/* Results */}
                {data && !loading && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-8 pb-12"
                    >
                        {/* Summary */}
                        {data.summary && (
                            <Card delay={0}>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/15 to-blue-500/15">
                                        <Sparkles className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Resumo da Análise</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed">{data.summary}</p>
                                        {data.model && (
                                            <p className="text-gray-700 text-[10px] mt-3 uppercase tracking-wider">
                                                Gerado por {data.model}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Patterns */}
                        {data.patterns?.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Brain className="w-5 h-5 text-purple-400" />
                                    <h3 className="text-sm font-semibold text-gray-300">Padrões Identificados</h3>
                                    <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                                        {data.patterns.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {data.patterns.map((p, i) => (
                                        <PatternCard key={i} pattern={p} index={i} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Focus Students */}
                        {data.focus_students?.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-5 h-5 text-rose-400" />
                                    <h3 className="text-sm font-semibold text-gray-300">Alunos em Foco</h3>
                                    <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-semibold">
                                        {data.focus_students.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {data.focus_students.map((s, i) => (
                                        <FocusStudentCard key={i} student={s} index={i} onOpenStudent={setSelectedStudentId} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Strategic Recommendations */}
                        {data.strategic_recommendations?.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Lightbulb className="w-5 h-5 text-blue-400" />
                                    <h3 className="text-sm font-semibold text-gray-300">Recomendações Estratégicas</h3>
                                    <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                                        {data.strategic_recommendations.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {data.strategic_recommendations.map((r, i) => (
                                        <StrategyCard key={i} rec={r} index={i} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* IA Chat - Permanent section */}
            <div className="mt-8 pt-12 border-t border-white/5 pb-20">
                <div className="flex items-center gap-2 mb-6">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-gray-300">Conversar com o Consultor de IA</h3>
                </div>
                <AIChat />
            </div>

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}

/* ─── AI Chat Component ─── */
function AIChat({ data }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            setFileContent(event.target.result);
        };
        reader.readAsText(file);
    }

    async function sendMessage(e) {
        e.preventDefault();
        if ((!input.trim() && !selectedFile) || loading) return;

        const userMsg = {
            role: 'user',
            content: input + (selectedFile ? `\n[Arquivo: ${selectedFile.name}]` : '')
        };
        setMessages(prev => [...prev, userMsg]);

        const currentInput = input;
        const currentFileContent = fileContent;

        setInput('');
        setSelectedFile(null);
        setFileContent(null);
        setLoading(true);

        try {
            const response = await api.post('/analytics/ai-insights/chat', {
                message: currentInput || "Analise este arquivo para mim.",
                history: messages,
                file_content: currentFileContent
            });
            setMessages(prev => [...prev, { role: 'ai', content: response.data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', content: 'Desculpe, tive um problema ao processar sua mensagem.' }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="!p-0 overflow-hidden flex flex-col h-[500px]">
            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-500">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-gray-400 text-sm font-medium">Como posso ajudar você hoje?</p>
                        <p className="text-gray-600 text-xs mt-1">Pergunte sobre tendências, alunos em risco ou peça dicas pedagógicas.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-purple-600 text-white rounded-tr-none'
                            : 'bg-white/5 text-gray-300 border border-white/5 rounded-tl-none'
                            }`}>
                            {msg.content}
                        </div>
                    </motion.div>
                ))}

                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* File selection indicator */}
            {selectedFile && (
                <div className="mx-4 mb-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Paperclip className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-purple-300 truncate">{selectedFile.name}</span>
                    </div>
                    <button
                        onClick={() => { setSelectedFile(null); setFileContent(null); }}
                        className="p-1 hover:bg-purple-500/20 rounded-md transition-colors"
                    >
                        <X className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".csv,.txt,.json"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-purple-400 hover:border-purple-500/30 transition-all shadow-inner"
                    title="Anexar arquivo para análise temporária"
                >
                    <Paperclip className="w-5 h-5" />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={selectedFile ? "Pergunte sobre o arquivo..." : "Sua pergunta acadêmica..."}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 shadow-inner"
                />
                <button
                    disabled={loading || (!input.trim() && !selectedFile)}
                    className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </form>
        </Card>
    );
}
