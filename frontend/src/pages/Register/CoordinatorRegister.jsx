import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CheckCircle,
    GraduationCap,
    Hash,
    Lock,
    Mail,
    Phone,
    Search,
    Shield,
    User,
} from 'lucide-react';

import api from '@/services/api';
import { fetchAcademicCourses } from '@/constants/academicCourses';
import { AuthAlert, AuthBackButton, AuthCard, AuthLayout, AuthSuccessState } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { digitsOnly, isValidEmail, isValidPhone, normalizeText } from '@/lib/formValidation';

export function CoordinatorRegister() {
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
        academic_course_name: '',
    });

    useEffect(() => {
        fetchAcademicCourses(api).then(setAvailableAcademicCourses);
    }, []);

    useEffect(() => {
        if (form.academic_course_name) {
            api.get(`/courses/by-academic-courses?names=${encodeURIComponent(form.academic_course_name)}`)
                .then(res => {
                    setAvailableCourses(res.data || []);
                    setSelectedCourseIds([]);
                })
                .catch(err => {
                    console.error("Erro ao buscar disciplinas:", err);
                });
        } else {
            setAvailableCourses([]);
            setSelectedCourseIds([]);
        }
    }, [form.academic_course_name]);

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
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
        if (!form.academic_course_name) {
            setError('Selecione o curso que você coordena.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register/coordinator', {
                registration_code: form.registration_code,
                password: form.password,
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone || null,
                academic_course_name: form.academic_course_name,
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
                title="Cadastro de coordenador concluído"
                description="Sua conta foi criada com o curso institucional vinculado para análises e gestão acadêmica."
                onAction={() => navigate('/login')}
            />
        );
    }

    const filteredCourses = availableAcademicCourses.filter((course) => (
        normalizeText(course).includes(normalizeText(courseSearch))
    ));

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Coordenador"
                subtitle="Vincule sua conta ao curso institucional que você coordena."
                icon={Shield}
                tone="coordinator"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <Input
                        label="Código de matrícula"
                        placeholder="Ex: 10001"
                        icon={Hash}
                        value={form.registration_code}
                        onChange={(event) => updateField('registration_code', digitsOnly(event.target.value, 5))}
                        required
                        maxLength={5}
                    />

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
                            placeholder="coordenador@email.com"
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

                    <div className="relative">
                        <label className="mb-2 block text-sm font-semibold text-text-secondary">
                            Curso que você coordena
                        </label>

                        {form.academic_course_name ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
                                    {form.academic_course_name}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateField('academic_course_name', '');
                                            setCourseSearch('');
                                        }}
                                        className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-warning/12"
                                    >
                                        x
                                    </button>
                                </span>
                            </div>
                        ) : null}

                        <Input
                            placeholder="Digite o nome do curso para buscar..."
                            icon={Search}
                            value={courseSearch}
                            onChange={(event) => setCourseSearch(event.target.value)}
                            onFocus={() => setShowCourseDropdown(true)}
                            description="O curso escolhido define o escopo dos alunos, relatórios e indicadores da coordenação."
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
                                            updateField('academic_course_name', course);
                                            setCourseSearch(course);
                                            setShowCourseDropdown(false);
                                        }}
                                        className="flex w-full items-center justify-between border-b border-border-subtle/20 px-5 py-3.5 text-left text-sm text-text-primary transition-all last:border-0 hover:bg-warning/10"
                                    >
                                        <span>{course}</span>
                                        <CheckCircle className="h-4 w-4 text-warning" />
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

                    {form.academic_course_name && availableCourses.length > 0 ? (
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
                                                    ? 'border-warning/30 bg-warning/5 text-warning font-semibold animate-pulse-subtle'
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
                                                className="rounded border-border-subtle text-warning focus:ring-warning"
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
                            Cadastrar coordenador
                        </Button>
                    </div>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
