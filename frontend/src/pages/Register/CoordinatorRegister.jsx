import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    User, Lock, Mail, Phone, BookOpen, Hash,
    ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Shield
} from 'lucide-react';

export function CoordinatorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Mesma lista de cursos acadêmicos usada no cadastro de aluno
    const availableAcademicCourses = [
        "Administração",
        "Agronomia",
        "Análise e Desenvolvimento de Sistemas",
        "Arquitetura e Urbanismo",
        "Biomedicina",
        "Ciências Contábeis",
        "Comunicação Social: Publicidade e Propaganda",
        "Design Gráfico",
        "Direito",
        "Educação Física",
        "Enfermagem",
        "Engenharia Civil",
        "Engenharia de Software",
        "Engenharia Elétrica",
        "Engenharia Mecânica",
        "Estética e Cosmética",
        "Farmácia",
        "Fisioterapia",
        "Gastronomia",
        "Inteligência Artificial",
        "Medicina",
        "Medicina Veterinária",
        "Nutrição",
        "Odontologia",
        "Psicologia",
        "Relações Internacionais",
    ];

    const [form, setForm] = useState({
        registration_code: '',
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        phone: '',
        academic_course_name: '',
    });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.registration_code || form.registration_code.length !== 5) { setError('O código de matrícula deve ter exatamente 5 dígitos'); return; }
        if (!form.password || form.password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return; }
        if (form.password !== form.confirmPassword) { setError('As senhas não coincidem'); return; }
        if (!form.name || form.name.length < 2) { setError('Nome é obrigatório'); return; }
        if (!form.email) { setError('E-mail é obrigatório'); return; }
        if (!form.academic_course_name) { setError('Selecione o curso que você coordena'); return; }

        setLoading(true);

        try {
            await api.post('/auth/register/coordinator', {
                registration_code: form.registration_code,
                password: form.password,
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                academic_course_name: form.academic_course_name,
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.detail || 'Erro ao cadastrar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
                <AnimatedBackground variant="login" />
                <motion.div
                    className="w-full max-w-md relative z-10 px-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="glass-card p-10 border-border-subtle text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        >
                            <CheckCircle className="w-20 h-20 text-accent-emerald mx-auto" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mt-6 text-text-primary">Cadastro Realizado!</h2>
                        <p className="text-text-secondary mt-3">
                            Seu cadastro de coordenador foi concluído com sucesso.
                            Faça login para acessar o sistema.
                        </p>
                        <div className="mt-4 p-3 rounded-xl bg-accent-emerald/8 border border-accent-emerald/20">
                            <p className="text-sm text-accent-emerald font-medium">
                                ✓ Conta ativada automaticamente
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="mt-8 w-full py-3"
                            icon={ArrowRight}
                        >
                            Ir para o Login
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
            <AnimatedBackground variant="login" />

            <motion.div
                className="w-full max-w-lg relative z-10 px-4"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="glass-card p-8 border-border-subtle">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-amber to-accent-rose flex items-center justify-center mx-auto">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold mt-4 gradient-text">Cadastro de Coordenador</h1>
                        <p className="text-sm text-text-secondary mt-1">
                            Informe seu código de matrícula institucional
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            className="bg-accent-rose/8 border border-accent-rose/20 text-accent-rose text-sm p-3 rounded-xl flex items-center gap-2 mb-5"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            label="Código de Matrícula"
                            placeholder="Ex: 10001 (5 dígitos)"
                            icon={Hash}
                            value={form.registration_code}
                            onChange={e => updateField('registration_code', e.target.value.replace(/\D/g, '').slice(0, 5))}
                            required
                            maxLength={5}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Senha"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                icon={Lock}
                                value={form.password}
                                onChange={e => updateField('password', e.target.value)}
                                required
                            />
                            <Input
                                label="Confirmar Senha"
                                type="password"
                                placeholder="Repita a senha"
                                icon={Lock}
                                value={form.confirmPassword}
                                onChange={e => updateField('confirmPassword', e.target.value)}
                                required
                            />
                        </div>
                        <Input
                            label="Nome Completo"
                            placeholder="Seu nome completo"
                            icon={User}
                            value={form.name}
                            onChange={e => updateField('name', e.target.value)}
                            required
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            placeholder="coordenador@email.com"
                            icon={Mail}
                            value={form.email}
                            onChange={e => updateField('email', e.target.value)}
                            required
                        />
                        <Input
                            label="Telefone"
                            placeholder="(00) 00000-0000"
                            icon={Phone}
                            value={form.phone}
                            onChange={e => updateField('phone', e.target.value)}
                        />

                        {/* Seleção do Curso que Coordena */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Curso que você coordena
                            </label>
                            {availableAcademicCourses.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {availableAcademicCourses.map(courseName => (
                                        <label
                                            key={courseName}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-200 ${form.academic_course_name === courseName
                                                ? 'border-accent-amber/40 bg-accent-amber/8'
                                                : 'border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated/60'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="academic_course"
                                                checked={form.academic_course_name === courseName}
                                                onChange={() => updateField('academic_course_name', courseName)}
                                                className="w-4 h-4 accent-accent-amber"
                                            />
                                            <span className="text-sm text-text-primary">{courseName}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-text-secondary italic p-4 text-center glass-card">
                                    Carregando cursos disponíveis...
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-4 gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/register')}
                                className="text-sm text-gray-500 hover:text-accent-blue transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Voltar
                            </button>
                            <Button type="submit" loading={loading} icon={CheckCircle} className="px-6">
                                Cadastrar
                            </Button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
