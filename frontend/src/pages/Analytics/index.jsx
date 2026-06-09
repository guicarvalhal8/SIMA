import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon, TrendingUp, BarChart3, Percent } from 'lucide-react';
import api from '@/services/api';

/* Count Up Hook */
function useCountUp(end, duration = 1200) {
    const [value, setValue] = useState(0);
    const ref = useRef(null);

    useEffect(() => {
        if (end == null) return;
        const target = typeof end === 'string' ? parseFloat(end) : end;
        if (isNaN(target)) { setValue(end); return; }

        const startTime = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setValue(target * ease);
            if (progress < 1) ref.current = requestAnimationFrame(tick);
        };

        ref.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(ref.current);
    }, [end, duration]);

    return value;
}

/* Custom Tooltip */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-card-static p-3 text-xs border border-border-subtle !rounded-lg">
            <p className="text-gray-400 mb-1 font-medium">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-gray-200 font-semibold">
                    {entry.name}: <span style={{ color: entry.color }}>{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

/* Stat Box */
function StatBox({ label, value, icon: Icon, color = 'blue', loading, index = 0 }) {
    const animatedValue = useCountUp(loading ? 0 : parseFloat(value), 1500);
    const isPercent = typeof value === 'string' && value.includes('%');

    const colorMap = {
        blue: 'text-accent-blue-light',
        purple: 'text-accent-purple-light',
        emerald: 'text-accent-emerald',
        amber: 'text-accent-amber',
        cyan: 'text-accent-cyan',
    };

    return (
        <motion.div
            className="bg-bg-secondary/50 p-5 rounded-xl border border-border-subtle hover:border-border-hover transition-all duration-300 group"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
        >
            <div className="flex items-center gap-2 mb-3">
                {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
                <p className="text-[11px] text-gray-500 uppercase font-semibold tracking-wider">{label}</p>
            </div>
            <p className={`text-3xl font-bold ${colorMap[color]} transition-colors`}>
                {loading ? '—' : (
                    <>
                        {isPercent
                            ? `${Math.round(animatedValue || 0)}%`
                            : (animatedValue ?? 0).toFixed(2)
                        }
                    </>
                )}
            </p>
        </motion.div>
    );
}

/* Analytics Page */
export function Analytics() {
    const [gradeStats, setGradeStats] = useState(null);
    const [correlations, setCorrelations] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsRes, corrRes] = await Promise.all([
                    api.get('/analytics/grades/stats'),
                    api.get('/analytics/correlations')
                ]);
                setGradeStats(statsRes.data);
                setCorrelations(corrRes.data);
            } catch (error) {
                console.error("Error fetching analytics", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const histData = gradeStats?.histogram?.counts?.map((count, i) => ({
        range: `${gradeStats.histogram.bin_edges[i]?.toFixed(1) ?? '?'}-${gradeStats.histogram.bin_edges[i + 1]?.toFixed(1) ?? '?'}`,
        Frequência: count
    })) || [];

    return (
        <div className="space-y-8">
            <PageHeader
                title="Análise Estatística"
                subtitle="Distribuição de notas e correlações entre variáveis"
                icon={PieIcon}
            />

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatBox label="Média Geral" value={gradeStats?.summary?.mean?.toFixed(2)} icon={TrendingUp} color="blue" loading={loading} index={0} />
                <StatBox label="Mediana" value={gradeStats?.summary?.median?.toFixed(2)} icon={BarChart3} color="purple" loading={loading} index={1} />
                <StatBox label="Desvio Padrão" value={gradeStats?.summary?.std?.toFixed(2)} icon={BarChart3} color="amber" loading={loading} index={2} />
                <StatBox label="Assimetria" value={gradeStats?.summary?.skewness?.toFixed(2)} icon={BarChart3} color="cyan" loading={loading} index={3} />
                <StatBox label="Taxa Aprovação" value={`${gradeStats?.pass_rate?.pass_rate?.toFixed(0)}%`} icon={Percent} color="emerald" loading={loading} index={4} />
            </div>

            {/* Chart */}
            <Card delay={0.5}>
                <h3 className="text-sm font-semibold text-gray-300 mb-1">Distribuição de Notas</h3>
                <p className="text-xs text-gray-600 mb-6">Histograma das notas de todos os alunos</p>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histData} barSize={32}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="range"
                                stroke="#4b5563"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#4b5563"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                width={30}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                            <Bar
                                dataKey="Frequência"
                                fill="url(#barGradient)"
                                radius={[6, 6, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
