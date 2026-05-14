import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/Button';
import { GraduationCap, BookOpen, Shield, ArrowLeft } from 'lucide-react';

export function RegisterSelect() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
            <AnimatedBackground variant="login" />

            <motion.div
                className="w-full max-w-lg relative z-10 px-4"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                <div className="glass-card p-10 border-border-subtle">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-10"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <div className="relative inline-block">
                            <motion.div
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold text-2xl shadow-glow mx-auto"
                                animate={{ rotate: [0, 2, -2, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                N
                            </motion.div>
                            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-accent-blue/15 to-accent-purple/15 blur-xl -z-10 animate-pulse-glow" />
                        </div>

                        <h1 className="text-3xl font-bold mt-6 gradient-text">Entrar na NEXORA</h1>
                        <p className="text-gray-500 mt-2 text-sm tracking-wide">
                            Selecione seu perfil institucional para criar sua conta
                        </p>
                    </motion.div>

                    {/* Options */}
                    <div className="flex flex-col gap-4">
                        <motion.button
                            onClick={() => navigate('/register/student')}
                            className="w-full p-6 rounded-2xl border border-border-subtle bg-bg-elevated/50 hover:bg-bg-elevated hover:border-accent-blue/40 transition-all duration-300 text-left group cursor-pointer"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-cyan/20 border border-accent-blue/20 flex items-center justify-center group-hover:border-accent-blue/40 transition-colors">
                                    <GraduationCap className="w-7 h-7 text-accent-blue" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">Sou Aluno</h3>
                                    <p className="text-sm text-text-secondary mt-0.5">
                                        Acompanhe suas notas, faltas e horários
                                    </p>
                                </div>
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/register/professor')}
                            className="w-full p-6 rounded-2xl border border-border-subtle bg-bg-elevated/50 hover:bg-bg-elevated hover:border-accent-purple/40 transition-all duration-300 text-left group cursor-pointer"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4, duration: 0.4 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-rose/20 border border-accent-purple/20 flex items-center justify-center group-hover:border-accent-purple/40 transition-colors">
                                    <BookOpen className="w-7 h-7 text-accent-purple" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">Sou Professor</h3>
                                    <p className="text-sm text-text-secondary mt-0.5">
                                        Acompanhe seus alunos e turmas
                                    </p>
                                </div>
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/register/coordinator')}
                            className="w-full p-6 rounded-2xl border border-border-subtle bg-bg-elevated/50 hover:bg-bg-elevated hover:border-accent-amber/40 transition-all duration-300 text-left group cursor-pointer"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.4 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-amber/20 to-accent-rose/20 border border-accent-amber/20 flex items-center justify-center group-hover:border-accent-amber/40 transition-colors">
                                    <Shield className="w-7 h-7 text-accent-amber" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">Sou Coordenador</h3>
                                    <p className="text-sm text-text-secondary mt-0.5">
                                        Gerencie alunos e disciplinas do seu curso
                                    </p>
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    {/* Back to login */}
                    <motion.div
                        className="text-center mt-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm text-gray-500 hover:text-accent-blue transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Voltar para o login
                        </button>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
