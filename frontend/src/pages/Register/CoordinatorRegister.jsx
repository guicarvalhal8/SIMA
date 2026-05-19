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

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
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
        if (!form.name || form.name.trim().length < 2) {
            setError('Informe o nome completo.');
            return;
        }
        if (!isValidEmail(form.email)) {
            setError('Informe um e-mail valido com @.');
            return;
        }
        if (form.phone && !isValidPhone(form.phone)) {
            setError('Informe um celular apenas com numeros e 10 ou 11 digitos.');
            return;
        }
        if (!form.academic_course_name) {
            setError('Selecione o curso que voce coordena.');
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
                title="Cadastro de coordenador concluido"
                description="Sua conta foi criada com o curso institucional vinculado para analises e gestao academica."
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
                subtitle="Vincule sua conta ao curso institucional que voce coordena."
                icon={Shield}
                tone="coordinator"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <Input
                        label="Codigo de matricula"
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
                            placeholder="coordenador@email.com"
                            icon={Mail}
                            value={form.email}
                            onChange={(event) => updateField('email', event.target.value)}
                            required
                            description="Obrigatorio informar um e-mail valido com @."
                        />
                        <Input
                            label="Celular"
                            placeholder="Somente numeros"
                            icon={Phone}
                            value={form.phone}
                            onChange={(event) => updateField('phone', digitsOnly(event.target.value, 11))}
                            inputMode="numeric"
                            maxLength={11}
                            description="Digite apenas numeros, com 10 ou 11 digitos."
                        />
                    </div>

                    <div className="relative">
                        <label className="mb-2 block text-sm font-semibold text-text-secondary">
                            Curso que voce coordena
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
                            description="O curso escolhido define o escopo dos alunos, relatorios e indicadores da coordenacao."
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
