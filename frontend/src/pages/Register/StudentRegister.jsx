import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    User, Lock, Mail, Phone, Hash, BookOpen, Calendar,
    Briefcase, ArrowLeft, ArrowRight, CheckCircle, AlertCircle,
    GraduationCap
} from 'lucide-react';

const STEPS = [
    { title: 'Dados Pessoais', subtitle: 'Informações pessoais' },
    { title: 'Credenciais', subtitle: 'Dados de acesso' },
    { title: 'Acadêmico', subtitle: 'Informações acadêmicas' },
];

const AVAILABLE_COURSES = [
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
    "Relações Internacionais"
];


export function StudentRegister() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);


    const [form, setForm] = useState({
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        phone: '',
        age: '',
        gender: '',
        cpf: '',
        registration_number: '',
        course_name: '',
        current_period: '',
        class_schedule: '',
        is_working: false,
        work_schedule: '',
        lyceum_password: '',
    });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const validateStep = () => {
        if (step === 0) {
            if (!form.name || form.name.length < 2) return 'Nome é obrigatório';
            if (!form.email) return 'E-mail é obrigatório';
            if (!form.cpf || form.cpf.length < 11) return 'CPF é obrigatório (mínimo 11 dígitos)';
        }
        if (step === 1) {
            if (!form.password || form.password.length < 6) return 'Senha deve ter no mínimo 6 caracteres';
            if (form.password !== form.confirmPassword) return 'As senhas não coincidem';
        }
        if (step === 2) {
            if (!form.registration_number) return 'Matrícula é obrigatória';
        }
        return null;
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) { setError(err); return; }
        setError('');
        setStep(s => Math.min(s + 1, STEPS.length - 1));
    };

    const prevStep = () => {
        setError('');
        setStep(s => Math.max(s - 1, 0));
    };

    const handleSubmit = async () => {
        const err = validateStep();
        if (err) { setError(err); return; }

        setLoading(true);
        setError('');

        try {
            const payload = {
                password: form.password,
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone || null,
                age: form.age ? parseInt(form.age) : null,
                gender: form.gender || null,
                cpf: form.cpf,
                registration_number: form.registration_number,
                course_name: form.course_name || null,
                current_period: form.current_period ? parseInt(form.current_period) : null,
                class_schedule: form.class_schedule || null,
                is_working: form.is_working,
                work_schedule: form.work_schedule || null,
                lyceum_password: form.lyceum_password || null,
            };

            await api.post('/auth/register/student', payload);
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
                            Sua conta foi criada com sucesso. Agora você pode fazer login.
                        </p>
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
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center mx-auto">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold mt-4 gradient-text">Cadastro de Aluno</h1>

                        {/* Step indicator */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                            {STEPS.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${i <= step
                                        ? 'bg-gradient-to-br from-accent-blue to-accent-purple text-white'
                                        : 'bg-bg-elevated text-text-secondary'
                                        }`}>
                                        {i < step ? '✓' : i + 1}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-8 h-0.5 transition-all duration-300 ${i < step ? 'bg-accent-blue' : 'bg-border-subtle'
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-text-secondary mt-2">{STEPS[step].subtitle}</p>
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

                    {/* Form Steps */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col gap-4"
                        >
                            {step === 0 && (
                                <>
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
                                        placeholder="seu@email.com"
                                        icon={Mail}
                                        value={form.email}
                                        onChange={e => updateField('email', e.target.value)}
                                        required
                                    />
                                    <Input
                                        label="CPF"
                                        placeholder="000.000.000-00"
                                        icon={Hash}
                                        value={form.cpf}
                                        onChange={e => updateField('cpf', e.target.value)}
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Telefone"
                                            placeholder="(00) 00000-0000"
                                            icon={Phone}
                                            value={form.phone}
                                            onChange={e => updateField('phone', e.target.value)}
                                        />
                                        <Input
                                            label="Idade"
                                            type="number"
                                            placeholder="18"
                                            value={form.age}
                                            onChange={e => updateField('age', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Gênero</label>
                                        <div className="relative">
                                            <select
                                                value={form.gender}
                                                onChange={e => updateField('gender', e.target.value)}
                                                className="w-full rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none transition-all duration-200 cursor-pointer appearance-none"
                                                style={{
                                                    backgroundColor: '#1a1a2e',
                                                    border: '1px solid rgba(139, 92, 246, 0.25)',
                                                    color: form.gender ? '#e2e8f0' : '#64748b',
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'}
                                                onBlur={e => e.target.style.borderColor = 'rgba(139, 92, 246, 0.25)'}
                                            >
                                                <option value="" style={{ backgroundColor: '#1a1a2e', color: '#64748b' }}>Selecione...</option>
                                                <option value="masculino" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Masculino</option>
                                                <option value="feminino" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Feminino</option>
                                                <option value="outro" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Outro</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 1 && (
                                <>
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
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <Input
                                        label="Matrícula"
                                        placeholder="Número da matrícula"
                                        icon={Hash}
                                        value={form.registration_number}
                                        onChange={e => updateField('registration_number', e.target.value)}
                                        required
                                    />
                                    <div className="relative">
                                        <Input
                                            label="Curso"
                                            placeholder="Comece a digitar o nome do curso..."
                                            icon={BookOpen}
                                            value={form.course_name}
                                            onChange={e => updateField('course_name', e.target.value)}
                                            onFocus={() => setShowCourseDropdown(true)}
                                        />
                                        <AnimatePresence>
                                            {showCourseDropdown && (
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setShowCourseDropdown(false)}
                                                />
                                            )}
                                        </AnimatePresence>
                                        <AnimatePresence>
                                            {showCourseDropdown && form.course_name && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-border-subtle bg-white/95 shadow-card-hover backdrop-blur-xl custom-scrollbar"
                                                >
                                                    {AVAILABLE_COURSES.filter(c =>
                                                        c.toLowerCase().includes(form.course_name.toLowerCase())
                                                    ).map((course, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                updateField('course_name', course);
                                                                setShowCourseDropdown(false);
                                                            }}
                                                            className="w-full text-left px-5 py-3.5 text-sm text-text-primary hover:bg-accent-blue/20 hover:text-white transition-all border-b border-border-subtle/20 last:border-0 flex items-center justify-between group"
                                                        >
                                                            <span>{course}</span>
                                                            <div className="w-5 h-5 rounded-lg bg-accent-blue/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <ArrowRight className="w-3 h-3 text-accent-blue" />
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {AVAILABLE_COURSES.filter(c =>
                                                        c.toLowerCase().includes(form.course_name.toLowerCase())
                                                    ).length === 0 && (
                                                            <div className="px-6 py-6 text-center">
                                                                <BookOpen className="w-8 h-8 mx-auto mb-2 text-text-secondary/20" />
                                                                <p className="text-xs text-text-secondary italic">
                                                                    Nenhum curso encontrado
                                                                </p>
                                                            </div>
                                                        )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Período Grid */}
                                    <div className="space-y-3">
                                        <label className="text-xs text-text-secondary font-medium uppercase tracking-wider block px-1">
                                            Período Atual
                                        </label>
                                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                                            {[...Array(12)].map((_, i) => {
                                                const p = i + 1;
                                                const isSelected = form.current_period === String(p);
                                                return (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => updateField('current_period', String(p))}
                                                        className={`h-10 rounded-xl border text-sm font-bold transition-all duration-300 flex items-center justify-center ${isSelected
                                                            ? 'bg-accent-blue text-white border-accent-blue shadow-glow-sm scale-105'
                                                            : 'bg-bg-elevated/20 border-border-subtle/30 text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
                                                            }`}
                                                    >
                                                        {p}º
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Horário Selector */}
                                    <div className="mt-4">
                                        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 px-1">Horário das Aulas</label>
                                        <div className="relative">
                                            <select
                                                value={form.class_schedule}
                                                onChange={e => updateField('class_schedule', e.target.value)}
                                                className="w-full rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none transition-all duration-200 cursor-pointer appearance-none"
                                                style={{
                                                    backgroundColor: '#1a1a2e',
                                                    border: '1px solid rgba(139, 92, 246, 0.25)',
                                                    color: form.class_schedule ? '#e2e8f0' : '#64748b',
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'}
                                                onBlur={e => e.target.style.borderColor = 'rgba(139, 92, 246, 0.25)'}
                                            >
                                                <option value="" style={{ backgroundColor: '#1a1a2e', color: '#64748b' }}>Selecione o horário...</option>
                                                <option value="MORNING" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Matutino (Manhã)</option>
                                                <option value="INTEGRAL" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Integral (Dia todo)</option>
                                                <option value="NIGHT" style={{ backgroundColor: '#1a1a2e', color: '#e2e8f0' }}>Noturno (Noite)</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>


                                    {/* Trabalho */}
                                    <div className="mt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={form.is_working}
                                                onChange={e => updateField('is_working', e.target.checked)}
                                                className="w-5 h-5 rounded border-border-subtle bg-bg-elevated accent-accent-blue"
                                            />
                                            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                                                <Briefcase className="w-4 h-4 inline mr-1.5" />
                                                Trabalho atualmente
                                            </span>
                                        </label>
                                        {form.is_working && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-3"
                                            >
                                                <Input
                                                    label="Horário de Trabalho"
                                                    placeholder="Ex: 08:00 às 17:00"
                                                    icon={Calendar}
                                                    value={form.work_schedule}
                                                    onChange={e => updateField('work_schedule', e.target.value)}
                                                />
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Senha Lyceum */}
                                    <div className="mt-3 p-4 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
                                        <p className="text-xs text-accent-blue mb-2 font-medium">
                                            🔐 Senha do Portal Lyceum (opcional)
                                        </p>
                                        <Input
                                            label="Senha personalizada do Portal"
                                            type="password"
                                            placeholder="Somente se você alterou a senha padrão"
                                            icon={Lock}
                                            value={form.lyceum_password}
                                            onChange={e => updateField('lyceum_password', e.target.value)}
                                        />
                                        <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                                            <strong>Preencha apenas se você alterou a senha padrão do portal.</strong>
                                            {' '}A senha padrão do Lyceum são os 9 primeiros dígitos do seu CPF.
                                            Como já coletamos seu CPF, não precisa preencher se não tiver alterado.
                                            O login no portal será feito automaticamente com sua matrícula.
                                        </p>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 gap-3">
                        {step > 0 ? (
                            <Button
                                onClick={prevStep}
                                variant="ghost"
                                className="px-6"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
                            </Button>
                        ) : (
                            <button
                                onClick={() => navigate('/register')}
                                className="text-sm text-gray-500 hover:text-accent-blue transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Voltar
                            </button>
                        )}

                        {step < STEPS.length - 1 ? (
                            <Button onClick={nextStep} icon={ArrowRight} className="px-6">
                                Próximo
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} loading={loading} icon={CheckCircle} className="px-6">
                                Finalizar Cadastro
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
