import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BookOpen,
    Briefcase,
    CheckCircle,
    GraduationCap,
    Hash,
    Lock,
    Mail,
    Phone,
    Search,
    User,
} from 'lucide-react';

import api from '@/services/api';
import { fetchAcademicCourses } from '@/constants/academicCourses';
import { AuthAlert, AuthBackButton, AuthCard, AuthLayout, AuthSuccessState } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { digitsOnly, isValidEmail, isValidPhone, normalizeText } from '@/lib/formValidation';

export function ProfessorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [courseSearch, setCourseSearch] = useState('');
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const [availableAcademicCourses, setAvailableAcademicCourses] = useState([]);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);

    const [form, setForm] = useState({
        registration_code: '',
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        phone: '',
        academic_courses: [],
    });

    useEffect(() => {
        fetchAcademicCourses(api).then(setAvailableAcademicCourses);
    }, []);

    useEffect(() => {
        if (form.academic_courses.length > 0) {
            const namesParam = form.academic_courses.map(name => encodeURIComponent(name)).join(',');
            api.get(`/courses/by-academic-courses?names=${namesParam}`)
                .then(res => {
                    setAvailableCourses(res.data || []);
                    const validIds = (res.data || []).map(c => c.id).filter(Boolean);
                    setSelectedCourseIds(prev => prev.filter(id => validIds.includes(id)));
                })
                .catch(err => {
                    console.error("Erro ao buscar disciplinas:", err);
                });
        } else {
            setAvailableCourses([]);
            setSelectedCourseIds([]);
        }
    }, [form.academic_courses]);

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
    };

    const toggleAcademicCourse = (name) => {
        setForm((previous) => {
            const exists = previous.academic_courses.some((course) => normalizeText(course) === normalizeText(name));
            return {
                ...previous,
                academic_courses: exists
                    ? previous.academic_courses.filter((course) => normalizeText(course) !== normalizeText(name))
                    : [...previous.academic_courses, name],
            };
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.registration_code || form.registration_code.length !== 5) {
            setError('O código de matrícula deve ter exatamente 5 dígitos.');
            return;
        }
        if (!form.password || form.password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (!form.name || form.name.trim().length < 2) {
            setError('Informe o nome completo.');
            return;
        }
        if (!isValidEmail(form.email)) {
            setError('Informe um e-mail válido com @.');
            return;
        }
        if (form.phone && !isValidPhone(form.phone)) {
            setError('Informe um celular apenas com números e 10 ou 11 dígitos.');
            return;
        }
        if (form.academic_courses.length === 0) {
            setError('Selecione ao menos um curso acadêmico.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register/professor', {
                registration_code: form.registration_code,
                password: form.password,
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone || null,
                academic_course_names: form.academic_courses,
                course_ids: selectedCourseIds,
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
                title="Cadastro de professor concluído"
                description="Sua conta foi criada. Suas disciplinas selecionadas já estão atreladas ao seu perfil para monitoramento e análises acadêmicas."
                onAction={() => navigate('/login')}
            />
        );
    }

    const filteredCourses = availableAcademicCourses
        .filter((course) => normalizeText(course).includes(normalizeText(courseSearch)))
        .filter((course) => !form.academic_courses.some((selected) => normalizeText(selected) === normalizeText(course)));

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Professor"
                subtitle="Informe seus dados institucionais e os cursos que você acompanha."
                icon={BookOpen}
                tone="professor"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Código de matrícula"
                            placeholder="Ex: 20001"
                            icon={Hash}
                            value={form.registration_code}
                            onChange={(event) => updateField('registration_code', digitsOnly(event.target.value, 5))}
                            required
                            maxLength={5}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ display: 'none' }}></div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Senha"
                            type="password"
                            placeholder="Mínimo de 6 caracteres"
                            icon={Lock}
                            value={form.password}
                            onChange={(event) => updateField('password', event.target.value)}
                            required
                        />
                        <Input
                            label="Confirmar senha"
                            type="password"
                            placeholder="Repita a senha"
                            icon={Lock}
                            value={form.confirmPassword}
                            onChange={(event) => updateField('confirmPassword', event.target.value)}
                            required
                        />
                    </div>

                    <Input
                        label="Nome completo"
                        placeholder="Seu nome completo"
                        icon={User}
                        value={form.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        required
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="E-mail"
                            type="email"
                            placeholder="professor@email.com"
                            icon={Mail}
                            value={form.email}
                            onChange={(event) => updateField('email', event.target.value)}
                            required
                            description="Obrigatório informar um e-mail válido com @."
                        />
                        <Input
                            label="Celular"
                            placeholder="Somente números"
                            icon={Phone}
                            value={form.phone}
                            onChange={(event) => updateField('phone', digitsOnly(event.target.value, 11))}
                            inputMode="numeric"
                            maxLength={11}
                            description="Digite apenas números, com 10 ou 11 dígitos."
                        />
                    </div>

                    <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-2xl bg-accent-purple/10 p-2 text-accent-purple">
                                <Briefcase className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-text-primary">Disciplinas lecionadas por você</p>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
                                    Você pode escolher as disciplinas específicas que você leciona no cadastro e também editá-las depois no seu painel de perfil.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="mb-2 block text-sm font-semibold text-text-secondary">
                            Cursos em que você leciona
                        </label>

                        {form.academic_courses.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {form.academic_courses.map((name) => (
                                    <span
                                        key={name}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/20 bg-accent-purple/12 px-3 py-1.5 text-xs font-medium text-accent-purple"
                                    >
                                        {name}
                                        <button
                                            type="button"
                                            onClick={() => toggleAcademicCourse(name)}
                                            className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-accent-purple/18"
                                        >
                                            x
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <Input
                            placeholder="Digite o nome do curso para buscar..."
                            icon={Search}
                            value={courseSearch}
                            onChange={(event) => setCourseSearch(event.target.value)}
                            onFocus={() => setShowCourseDropdown(true)}
                            description="Esses cursos definem o universo de alunos e disciplinas que a NEXORA vinculará ao seu perfil."
                        />

                        {showCourseDropdown ? (
                            <div className="fixed inset-0 z-40" onClick={() => setShowCourseDropdown(false)} />
                        ) : null}

                        {showCourseDropdown ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-border-subtle bg-white/95 shadow-card-hover backdrop-blur-xl"
                            >
                                {filteredCourses.length > 0 ? filteredCourses.map((course) => (
                                    <button
                                        key={course}
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            toggleAcademicCourse(course);
                                            setCourseSearch('');
                                            setShowCourseDropdown(false);
                                        }}
                                        className="flex w-full items-center justify-between border-b border-border-subtle/20 px-5 py-3.5 text-left text-sm text-text-primary transition-all last:border-0 hover:bg-accent-purple/12"
                                    >
                                        <span>{course}</span>
                                        <CheckCircle className="h-4 w-4 text-accent-purple" />
                                    </button>
                                )) : (
                                    <div className="px-6 py-6 text-center">
                                        <GraduationCap className="mx-auto mb-2 h-8 w-8 text-text-tertiary/30" />
                                        <p className="text-xs italic text-text-secondary">Nenhum curso encontrado.</p>
                                    </div>
                                )}
                            </motion.div>
                        ) : null}
                    </div>

                    {form.academic_courses.length > 0 && availableCourses.length > 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-border-subtle bg-slate-50/50 p-4 space-y-2.5"
                        >
                            <label className="block text-sm font-semibold text-text-secondary">
                                Selecione as disciplinas que você ministra (opcional)
                            </label>
                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto sm:grid-cols-2 pr-1">
                                {availableCourses.map((course) => {
                                    const isChecked = selectedCourseIds.includes(course.id);
                                    return (
                                        <label
                                            key={course.id || course.name}
                                            className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                                                isChecked
                                                    ? 'border-accent-purple/30 bg-accent-purple/5 text-accent-purple font-semibold animate-pulse-subtle'
                                                    : 'border-border-subtle bg-white/40 hover:bg-slate-100/50 text-text-secondary'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedCourseIds(prev => prev.filter(id => id !== course.id));
                                                    } else {
                                                        if (course.id) {
                                                            setSelectedCourseIds(prev => [...prev, course.id]);
                                                        }
                                                    }
                                                }}
                                                className="rounded border-border-subtle text-accent-purple focus:ring-accent-purple"
                                            />
                                            <span className="text-xs">{course.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <AuthBackButton onClick={() => navigate('/register')} label="Voltar" />
                        <Button type="submit" loading={loading}>
                            Cadastrar professor
                        </Button>
                    </div>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
