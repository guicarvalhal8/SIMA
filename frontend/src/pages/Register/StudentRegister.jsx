import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Briefcase,
    Calendar,
    CheckCircle,
    GraduationCap,
    Hash,
    Lock,
    Mail,
    Phone,
    User,
} from 'lucide-react';

import api from '@/services/api';
import { fetchAcademicCourses } from '@/constants/academicCourses';
import { AuthAlert, AuthBackButton, AuthCard, AuthLayout, AuthSuccessState } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { digitsOnly, isValidCpf, isValidEmail, isValidPhone } from '@/lib/formValidation';

const STEPS = [
    { title: 'Dados pessoais', subtitle: 'Identificação e contato institucional.' },
    { title: 'Acesso', subtitle: 'Senha de acesso ao sistema.' },
    { title: 'Acadêmico', subtitle: 'Curso, período e rotina do aluno.' },
];

export function StudentRegister() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [availableCourses, setAvailableCourses] = useState([]);

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

    useEffect(() => {
        fetchAcademicCourses(api).then(setAvailableCourses);
    }, []);

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
    };

    const validateStep = () => {
        if (step === 0) {
            if (!form.name || form.name.trim().length < 2) return 'Informe o nome completo.';
            if (!isValidEmail(form.email)) return 'Informe um e-mail válido com @.';
            if (form.phone && !isValidPhone(form.phone)) return 'Informe um celular apenas com números e 10 ou 11 dígitos.';
            if (!isValidCpf(form.cpf)) return 'Informe um CPF válido com 11 dígitos numéricos.';
        }
        if (step === 1) {
            if (!form.password || form.password.length < 6) return 'A senha deve ter no mínimo 6 caracteres.';
            if (form.password !== form.confirmPassword) return 'As senhas não coincidem.';
        }
        if (step === 2) {
            if (!form.registration_number) return 'Informe a matrícula.';
            if (!form.course_name) return 'Selecione o curso acadêmico.';
            if (!form.current_period) return 'Selecione o período atual.';
            if (!form.class_schedule) return 'Selecione o turno das aulas.';
        }
        return null;
    };

    const nextStep = () => {
        const validationError = validateStep();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setStep((previous) => Math.min(previous + 1, STEPS.length - 1));
    };

    const prevStep = () => {
        setError('');
        setStep((previous) => Math.max(previous - 1, 0));
    };

    const handleSubmit = async () => {
        const validationError = validateStep();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post('/auth/register/student', {
                password: form.password,
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone || null,
                age: form.age ? parseInt(form.age, 10) : null,
                gender: form.gender || null,
                cpf: form.cpf,
                registration_number: form.registration_number.trim(),
                course_name: form.course_name,
                current_period: form.current_period ? parseInt(form.current_period, 10) : null,
                class_schedule: form.class_schedule || null,
                is_working: form.is_working,
                work_schedule: form.work_schedule || null,
                lyceum_password: form.lyceum_password || null,
            });
            setSuccess(true);
        } catch (err) {
            const detail = err.response?.data?.detail;
            const message = Array.isArray(detail)
                ? detail.map((item) => item.msg).join(' | ')
                : detail;
            setError(
                message ||
                (err.request
                    ? 'Não foi possível conectar ao backend. Verifique se a API está rodando em http://127.0.0.1:8000.'
                    : 'Erro ao cadastrar. Tente novamente.')
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthSuccessState
                title="Cadastro de aluno concluído"
                description="Sua conta foi criada. Ao acessar o sistema, a NEXORA poderá sincronizar automaticamente os dados acadêmicos do portal do aluno."
                onAction={() => navigate('/login')}
            />
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Aluno"
                subtitle="Preencha seus dados para ativar o monitoramento acadêmico individual na NEXORA."
                icon={GraduationCap}
                tone="student"
            >
                <div className="mb-8 flex items-center justify-center gap-3">
                    {STEPS.map((item, index) => {
                        const active = index === step;
                        const done = index < step;
                        return (
                            <React.Fragment key={item.title}>
                                <div className="flex items-center gap-3">
                                    <div className={[
                                        'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all',
                                        done || active
                                            ? 'bg-brand-gradient text-white shadow-glow-sm'
                                            : 'bg-bg-secondary text-text-secondary',
                                    ].join(' ')}>
                                        {done ? <CheckCircle className="h-4 w-4" /> : index + 1}
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Etapa {index + 1}</p>
                                        <p className="text-sm text-text-secondary">{item.title}</p>
                                    </div>
                                </div>
                                {index < STEPS.length - 1 ? <div className="hidden h-px flex-1 bg-border-subtle sm:block" /> : null}
                            </React.Fragment>
                        );
                    })}
                </div>

                <p className="mb-5 text-center text-sm text-text-secondary">{STEPS[step].subtitle}</p>

                {error ? <AuthAlert>{error}</AuthAlert> : null}

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.25 }}
                        className="mt-5 space-y-4"
                    >
                        {step === 0 ? (
                            <>
                                <Input label="Nome completo" placeholder="Seu nome completo" icon={User} value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Input label="E-mail" type="email" placeholder="seu@email.com" icon={Mail} value={form.email} onChange={(event) => updateField('email', event.target.value)} required description="Obrigatório informar um e-mail válido com @." />
                                    <Input label="Celular" placeholder="Somente números" icon={Phone} value={form.phone} onChange={(event) => updateField('phone', digitsOnly(event.target.value, 11))} inputMode="numeric" maxLength={11} description="Digite apenas números, com 10 ou 11 dígitos." />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Input label="CPF" placeholder="Somente números" icon={Hash} value={form.cpf} onChange={(event) => updateField('cpf', digitsOnly(event.target.value, 11))} inputMode="numeric" maxLength={11} required description="Digite apenas números. O CPF precisa ter 11 dígitos válidos." />
                                    <Input label="Idade" type="number" placeholder="18" value={form.age} onChange={(event) => updateField('age', event.target.value)} />
                                </div>
                                <Select label="Gênero" value={form.gender} onChange={(event) => updateField('gender', event.target.value)}>
                                    <option value="">Selecione...</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="feminino">Feminino</option>
                                    <option value="outro">Outro</option>
                                </Select>
                            </>
                        ) : null}

                        {step === 1 ? (
                            <>
                                <Input label="Senha" type="password" placeholder="Mínimo de 6 caracteres" icon={Lock} value={form.password} onChange={(event) => updateField('password', event.target.value)} required />
                                <Input label="Confirmar senha" type="password" placeholder="Repita a senha" icon={Lock} value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} required />
                            </>
                        ) : null}

                        {step === 2 ? (
                            <>
                                <Input label="Matrícula" placeholder="Número da matrícula" icon={Hash} value={form.registration_number} onChange={(event) => updateField('registration_number', event.target.value)} required />
                                <Select label="Curso acadêmico" icon={GraduationCap} value={form.course_name} onChange={(event) => updateField('course_name', event.target.value)}>
                                    <option value="">Selecione o curso...</option>
                                    {availableCourses.map((course) => (
                                        <option key={course} value={course}>{course}</option>
                                    ))}
                                </Select>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-text-secondary">Período atual</label>
                                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-6">
                                        {Array.from({ length: 12 }, (_, index) => index + 1).map((period) => {
                                            const selected = form.current_period === String(period);
                                            return (
                                                <button
                                                    key={period}
                                                    type="button"
                                                    onClick={() => updateField('current_period', String(period))}
                                                    className={[
                                                        'h-10 rounded-xl border text-sm font-bold transition-all',
                                                        selected
                                                            ? 'border-accent-blue bg-accent-blue text-white shadow-glow-sm'
                                                            : 'border-border-subtle bg-white text-text-secondary hover:border-accent-blue/40 hover:text-text-primary',
                                                    ].join(' ')}
                                                >
                                                    {period}o
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <Select label="Turno das aulas" icon={Calendar} value={form.class_schedule} onChange={(event) => updateField('class_schedule', event.target.value)}>
                                    <option value="">Selecione o turno...</option>
                                    <option value="MORNING">Matutino</option>
                                    <option value="INTEGRAL">Integral</option>
                                    <option value="NIGHT">Noturno</option>
                                </Select>

                                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                                    <label className="flex cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={form.is_working}
                                            onChange={(event) => updateField('is_working', event.target.checked)}
                                            className="h-4 w-4 rounded border-border-subtle accent-accent-blue"
                                        />
                                        <span className="text-sm text-text-secondary">
                                            <Briefcase className="mr-1.5 inline h-4 w-4" />
                                            Trabalho atualmente
                                        </span>
                                    </label>

                                    {form.is_working ? (
                                        <div className="mt-4">
                                            <Input
                                                label="Horário de trabalho"
                                                placeholder="Ex: 08:00 às 17:00"
                                                icon={Calendar}
                                                value={form.work_schedule}
                                                onChange={(event) => updateField('work_schedule', event.target.value)}
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                <Input
                                    label="Senha do portal Lyceum"
                                    type="password"
                                    placeholder="Opcional: preencha apenas se alterou a senha padrão"
                                    icon={Lock}
                                    value={form.lyceum_password}
                                    onChange={(event) => updateField('lyceum_password', event.target.value)}
                                    description="Se você nunca alterou a senha do portal, a NEXORA usa o padrão institucional baseado no CPF."
                                />
                            </>
                        ) : null}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex items-center justify-between gap-3">
                    {step > 0 ? (
                        <Button variant="ghost" onClick={prevStep}>Voltar</Button>
                    ) : (
                        <AuthBackButton onClick={() => navigate('/register')} label="Voltar" />
                    )}

                    {step < STEPS.length - 1 ? (
                        <Button onClick={nextStep}>Próximo</Button>
                    ) : (
                        <Button onClick={handleSubmit} loading={loading}>Finalizar cadastro</Button>
                    )}
                </div>
            </AuthCard>
        </AuthLayout>
    );
}
