import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { HeartPulse, AlertTriangle, Zap, Shield, BookOpen, ChevronRight, Users, TrendingUp, Target } from 'lucide-react';
import api from '@/services/api';
import clsx from 'clsx';
import { StudentDetailModal } from '@/components/StudentDetailModal';

/* ─── Priority Config ─── */
const priorityConfig = {
    critical: {
        badge: 'danger',
        border: 'border-l-accent-rose',
        icon: AlertTriangle,
        glow: 'hover:shadow-glow-rose',
        color: '#fb7185',
        label: 'Crítica',
    },
    high: {
        badge: 'warning',
        border: 'border-l-orange-500',
        icon: Zap,
        glow: 'hover:shadow-glow-amber',
        color: '#fbbf24',
        label: 'Alta',
    },
    medium: {
        badge: 'info',
        border: 'border-l-accent-amber',
        icon: Shield,
        glow: '',
        color: '#60a5fa',
        label: 'Média',
    },
    low: {
        badge: 'cyan',
        border: 'border-l-accent-blue',
        icon: BookOpen,
        glow: '',
        color: '#34d399',
        label: 'Baixa',
    },
};

/* ─── Stat Card ─── */
function StatCard({ label, value, icon: Icon, color, delay = 0 }) {
    return (
        <motion.div
            className="glass-card p-5 flex items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
        >
            <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
        </motion.div>
    );
}

/* ─── Recommendations Page ─── */
export function Recommendations() {
    const [recommendations, setRecommendations] = useState([]);
    const [stats, setStats] = useState({ total: 0, by_priority: {} });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await api.get('/analytics/recommendations');
                const data = res.data;
                setRecommendations(data.recommendations || []);
                setStats({
                    total: data.total_recommendations || 0,
                    by_priority: data.by_priority || {},
                });
            } catch (error) {
                console.error("Error fetching recommendations", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const filteredRecs = filter === 'all'
        ? recommendations
        : recommendations.filter(r => r.priority === filter);

    const filterButtons = [
        { key: 'all', label: 'Todas' },
        { key: 'critical', label: 'Críticas' },
        { key: 'high', label: 'Altas' },
        { key: 'medium', label: 'Médias' },
        { key: 'low', label: 'Baixas' },
    ];

    return (
        <div className="space-y-8">
            <PageHeader
                title="Recomendações Estratégicas"
                subtitle="Ações sugeridas baseadas no perfil acadêmico dos alunos"
                icon={HeartPulse}
            />

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total de Recomendações"
                    value={loading ? '—' : stats.total}
                    icon={Target}
                    color="#8b5cf6"
                    delay={0.1}
                />
                <StatCard
                    label="Críticas"
                    value={loading ? '—' : (stats.by_priority.critical || 0)}
                    icon={AlertTriangle}
                    color="#fb7185"
                    delay={0.15}
                />
                <StatCard
                    label="Alta Prioridade"
                    value={loading ? '—' : (stats.by_priority.high || 0)}
                    icon={Zap}
                    color="#fbbf24"
                    delay={0.2}
                />
                <StatCard
                    label="Alunos Impactados"
                    value={loading ? '—' : new Set(recommendations.map(r => r.target_id)).size}
                    icon={Users}
                    color="#60a5fa"
                    delay={0.25}
                />
            </div>

            {/* ── Filter Tabs ── */}
            <motion.div
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                {filterButtons.map((btn) => (
                    <button
                        key={btn.key}
                        onClick={() => setFilter(btn.key)}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border",
                            filter === btn.key
                                ? "bg-accent-blue/15 text-accent-blue-light border-accent-blue/30"
                                : "bg-white/[0.02] text-gray-500 border-border-subtle hover:text-gray-300 hover:bg-white/[0.04]"
                        )}
                    >
                        {btn.label}
                        {btn.key !== 'all' && stats.by_priority[btn.key] != null && (
                            <span className="ml-1.5 text-[10px] opacity-60">
                                ({stats.by_priority[btn.key]})
                            </span>
                        )}
                    </button>
                ))}
            </motion.div>

            {/* ── Loading State ── */}
            {loading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Card key={i} delay={i * 0.05}>
                            <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                                    <div className="h-3 w-72 bg-white/5 rounded animate-pulse" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                /* ── Recommendations List ── */
                <div className="flex flex-col gap-3">
                    {filteredRecs.length === 0 ? (
                        <motion.div
                            className="glass-card p-10 text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">Nenhuma recomendação encontrada</p>
                            <p className="text-xs text-gray-600 mt-1">Tente selecionar outro filtro</p>
                        </motion.div>
                    ) : (
                        filteredRecs.map((rec, i) => {
                            const config = priorityConfig[rec.priority] || priorityConfig.low;
                            const PriorityIcon = config.icon;

                            return (
                                <motion.div
                                    key={i}
                                    className={clsx(
                                        "glass-card p-5 border-l-[3px] flex flex-col md:flex-row gap-4 items-start md:items-center group cursor-pointer transition-all duration-300",
                                        config.border,
                                        config.glow
                                    )}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 + 0.3, duration: 0.35 }}
                                >
                                    <div className="p-2.5 rounded-lg bg-white/[0.03]">
                                        <PriorityIcon className="w-4 h-4 text-gray-500" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1.5">
                                            <Badge variant={config.badge}>
                                                {config.label}
                                            </Badge>
                                            <p className="font-semibold text-gray-200 text-sm">{rec.title}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">{rec.message}</p>
                                    </div>

                                    <div className="flex items-center gap-3 min-w-[160px]">
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Aluno Alvo</p>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStudentId(rec.target_id)}
                                                className="text-sm font-medium text-gray-300 transition-colors hover:text-accent-blue-light"
                                            >
                                                {rec.target_name}
                                            </button>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Summary Footer ── */}
            {!loading && filteredRecs.length > 0 && (
                <motion.div
                    className="glass-card-static p-4 flex items-center justify-between text-xs text-gray-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <span>
                        Exibindo <span className="text-gray-300 font-semibold">{filteredRecs.length}</span> de{' '}
                        <span className="text-gray-300 font-semibold">{recommendations.length}</span> recomendações
                    </span>
                    <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Ordenado por prioridade
                    </span>
                </motion.div>
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
