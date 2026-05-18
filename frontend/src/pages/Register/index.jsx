import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, GraduationCap, Shield } from 'lucide-react';

import { AuthCard, AuthLayout } from '@/components/auth/AuthLayout';

const REGISTER_OPTIONS = [
    {
        icon: GraduationCap,
        title: 'Sou Aluno',
        description: 'Acompanhe notas, frequencia, horarios e sincronizacao academica.',
        tone: 'border-accent-blue/20 bg-accent-blue/6 text-accent-blue',
        route: '/register/student',
    },
    {
        icon: BookOpen,
        title: 'Sou Professor',
        description: 'Gerencie turmas, riscos e analises por curso com base automatica.',
        tone: 'border-accent-purple/20 bg-accent-purple/8 text-accent-purple',
        route: '/register/professor',
    },
    {
        icon: Shield,
        title: 'Sou Coordenador',
        description: 'Visualize o curso, acompanhe tendencias e coordene intervencoes.',
        tone: 'border-warning/20 bg-warning/8 text-warning',
        route: '/register/coordinator',
    },
];

export function RegisterSelect() {
    const navigate = useNavigate();

    return (
        <AuthLayout>
            <AuthCard
                title="Escolha seu perfil"
                subtitle="Selecione o papel institucional para abrir o fluxo de cadastro correspondente."
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    {REGISTER_OPTIONS.map((option, index) => (
                        <motion.button
                            key={option.route}
                            type="button"
                            onClick={() => navigate(option.route)}
                            className="w-full rounded-[24px] border border-border-subtle bg-bg-elevated/60 p-6 text-left transition-all duration-300 hover:border-border-hover hover:bg-white"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.08 * index }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.995 }}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${option.tone}`}>
                                    <option.icon className="h-7 w-7" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">{option.title}</h3>
                                    <p className="mt-1 text-sm text-text-secondary">{option.description}</p>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-accent-blue"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para o login
                    </button>
                </div>
            </AuthCard>
        </AuthLayout>
    );
}
