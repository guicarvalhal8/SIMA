import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
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

export function ProfessorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [courseSearch, setCourseSearch] = useState('');
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const [availableAcademicCourses, setAvailableAcademicCourses] = useState([]);

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

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
    };

    const toggleAcademicCourse = (name) => {
        setForm((previous) => {
            const exists = previous.academic_courses.includes(name);
            return {
                ...previous,
                academic_courses: exists
                    ? previous.academic_courses.filter((course) => course !== name)
                    : [...previous.academic_courses, name],
            };
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.registration_code || form.registration_code.length !== 5) {
            setError('O codigo de matricula deve ter exatamente 5 digitos.');
            return;
        }
        if (!form.password || form.password.length < 6) {
            setError('A senha deve ter no minimo 6 caracteres.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('As senhas nao coincidem.');
            return;
        }
        if (!form.name || form.name.length < 2) {
            setError('Informe o nome completo.');
            return;
        }
        if (!form.email) {
            setError('Informe um e-mail valido.');
            return;
        }
        if (form.academic_courses.length === 0) {
            setError('Selecione ao menos um curso academico.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register/professor', {
                registration_code: form.registration_code,
                password: form.password,
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                academic_course_names: form.academic_courses,
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
                    ? 'Nao foi possivel conectar ao backend. Verifique se a API esta rodando em http://127.0.0.1:8000.'
                    : 'Erro ao cadastrar. Tente novamente.')
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthSuccessState
                title="Cadastro de professor concluido"
                description="Sua conta foi criada. As disciplinas passarao a aparecer automaticamente quando houver alunos do mesmo curso com dados sincronizados via scraping."
                onAction={() => navigate('/login')}
            />
        );
    }

    const filteredCourses = availableAcademicCourses
        .filter((course) => course.toLowerCase().includes(courseSearch.toLowerCase()))
        .filter((course) => !form.academic_courses.includes(course));

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Professor"
                subtitle="Informe seus dados institucionais e os cursos que voce acompanha."
                icon={BookOpen}
                tone="professor"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <Input
                        label="Codigo de matricula"
                        placeholder="Ex: 20001"
                        icon={Hash}
                        value={form.registration_code}
                        onChange={(event) => updateField('registration_code', event.target.value.replace(/\D/g, '').slice(0, 5))}
                        required
                        maxLength={5}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Senha"
                            type="password"
                            placeholder="Minimo de 6 caracteres"
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
                        />
                        <Input
                            label="Telefone"
                            placeholder="(00) 00000-0000"
                            icon={Phone}
                            value={form.phone}
                            onChange={(event) => updateField('phone', event.target.value)}
                        />
                    </div>

                    <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-2xl bg-accent-purple/10 p-2 text-accent-purple">
                                <Briefcase className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-text-primary">Disciplinas sincronizadas automaticamente</p>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
                                    Voce escolhe apenas os cursos academicos. As disciplinas aparecem depois de forma automatica quando houver alunos desses cursos com scraping atualizado na area do aluno.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="mb-2 block text-sm font-semibold text-text-secondary">
                            Cursos em que voce leciona
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
                                            ×
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
                            description="Esses cursos definem o universo de alunos e disciplinas que a NEXORA vinculara ao seu perfil."
                        />

                        {showCourseDropdown ? (
                            <div className="fixed inset-0 z-40" onClick={() => setShowCourseDropdown(false)} />
                        ) : null}

                        {showCourseDropdown && courseSearch ? (
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
