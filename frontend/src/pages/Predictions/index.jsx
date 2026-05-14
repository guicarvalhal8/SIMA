import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertTriangle, UserX, HeartPulse, Shield, Zap, BookOpen, ChevronRight, Target } from 'lucide-react';
import api from '@/services/api';
import clsx from 'clsx';
import { StudentDetailModal } from '@/components/StudentDetailModal';

/* ─── Risk Ring (SVG Circular Progress) ─── */
function RiskRing({ score, size = 56, strokeWidth = 4 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percent = score * 100;

    const getColor = (p) => {
        if (p >= 70) return '#fb7185';
        if (p >= 40) return '#fbbf24';
        return '#34d399';
    };

    const color = getColor(percent);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={strokeWidth}
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference * (1 - score) }}
                    transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                    style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color }}>
                    {Math.round(percent)}%
                </span>
            </div>
        </div>
    );
}

/* ─── Priority Config ─── */
const priorityConfig = {
    critical: {
        badge: 'danger',
        border: 'border-l-accent-rose',
        icon: AlertTriangle,
        glow: 'hover:shadow-glow-rose',
    },
    high: {
        badge: 'warning',
        border: 'border-l-orange-500',
        icon: Zap,
        glow: 'hover:shadow-glow-amber',
    },
    medium: {
        badge: 'info',
        border: 'border-l-accent-amber',
        icon: Shield,
        glow: '',
    },
    low: {
        badge: 'cyan',
        border: 'border-l-accent-blue',
        icon: BookOpen,
        glow: '',
    },
};

/* ─── Predictions Page ─── */
export function Predictions() {
    const [predictions, setPredictions] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [predRes, recRes] = await Promise.all([
                    api.get('/analytics/predictions'),
                    api.get('/analytics/recommendations')
                ]);
                setPredictions(predRes.data.predictions || []);
                setRecommendations(recRes.data.recommendations || []);
            } catch (error) {
                console.error("Error fetching predictions", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="space-y-10">
            {/* ── Predictions Section ── */}
            <div>
                <PageHeader
                    title="Risco de Evasão"
                    subtitle="Assinalados pelo modelo de Regressão Logística"
                    icon={UserX}
                />

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} delay={i * 0.05}>
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                                        <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                                    </div>
                                    <div className="w-14 h-14 bg-white/5 rounded-full animate-pulse" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {predictions.slice(0, 6).map((pred, index) => (
                            <Card key={pred.student_id} delay={index * 0.08} className="group cursor-pointer" animate>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-rose/20 to-accent-rose/5 flex items-center justify-center text-[10px] font-bold text-accent-rose">
                                                {pred.student_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStudentId(pred.student_id)}
                                                    className="font-semibold text-gray-200 text-sm truncate transition-colors hover:text-accent-blue-light"
                                                >
                                                    {pred.student_name}
                                                </button>
                                                <p className="text-[10px] text-gray-600 font-mono">ID: {pred.student_id}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <RiskRing score={pred.risk_score} />
                                </div>

                                {/* Risk bar */}
                                <div className="mt-4">
                                    <div className="bg-white/5 rounded-full h-1.5 w-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{
                                                background: `linear-gradient(90deg, #fbbf24, #fb7185)`,
                                            }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pred.risk_score * 100}%` }}
                                            transition={{ duration: 1, delay: 0.5 + index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-600 mt-1.5 font-medium">Probabilidade de Evasão</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Recommendations Section ── */}
            <div>
                <PageHeader
                    title="Recomendações Estratégicas"
                    subtitle="Ações sugeridas baseadas no perfil do aluno"
                    icon={HeartPulse}
                />

                <div className="flex flex-col gap-3">
                    {recommendations.slice(0, 10).map((rec, i) => {
                        const config = priorityConfig[rec.priority] || priorityConfig.low;
                        const PriorityIcon = config.icon;

                        return (
                            <motion.div
                                key={i}
                                className={clsx(
                                    "glass-card p-5 border-l-[3px] flex flex-col md:flex-row gap-4 items-start md:items-center group cursor-pointer",
                                    config.border,
                                    config.glow
                                )}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 + 0.2, duration: 0.35 }}
                            >
                                <div className="p-2 rounded-lg bg-white/[0.03]">
                                    <PriorityIcon className="w-4 h-4 text-gray-500" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-1.5">
                                        <Badge variant={config.badge}>
                                            {rec.priority}
                                        </Badge>
                                        <p className="font-semibold text-gray-200 text-sm">{rec.title}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">{rec.message}</p>
                                </div>

                                <div className="flex items-center gap-3 min-w-[140px]">
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
                    })}
                </div>
            </div>

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
