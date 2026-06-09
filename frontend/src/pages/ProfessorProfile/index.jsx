import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    BookOpen,
    CheckCircle,
    GraduationCap,
    Mail,
    Phone,
    Save,
    Search,
    User,
    UserCircle,
} from 'lucide-react';

import api from '@/services/api';
import { fetchAcademicCourses } from '@/constants/academicCourses';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath } from '@/lib/app-shell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function dedupeSubjects(subjects) {
    const unique = new Map();
    for (const subject of subjects || []) {
        const key = normalizeText(subject?.name || subject?.code || '');
        if (!key || unique.has(key)) continue;
        unique.set(key, subject);
    }
    return Array.from(unique.values()).sort((left, right) => {
        const leftName = left?.name || '';
        const rightName = right?.name || '';
        return leftName.localeCompare(rightName);
    });
}

export function ProfessorProfile() {
    const { user } = useAuth();
    const coursesRoute = buildRolePath(user?.role, 'courses');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [availableCourses, setAvailableCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '' });
    const [academicCourses, setAcademicCourses] = useState([]);
    const [linkedSubjects, setLinkedSubjects] = useState([]);

    useEffect(() => {
        fetchAcademicCourses(api).then(setAvailableCourses);
    }, []);

    const loadLinkedSubjects = async (courseNames) => {
        const selectedNames = (courseNames || []).filter(Boolean);
        if (!selectedNames.length) {
            setLinkedSubjects([]);
            return [];
        }

        try {
            const response = await api.get('/courses/by-academic-courses', {
                params: { names: selectedNames.join(',') },
            });
            const subjects = Array.isArray(response.data) ? response.data : [];
            const uniqueSubjects = dedupeSubjects(subjects);
            setLinkedSubjects(uniqueSubjects);
            return uniqueSubjects;
        } catch (loadError) {
            console.error('Erro ao carregar disciplinas elegíveis do professor', loadError);
            setLinkedSubjects([]);
            return [];
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/professors/me');
                const data = response.data;
                const nextForm = {
                    name: data.user_name || user?.full_name || '',
                    email: data.user_email || user?.email || '',
                    phone: data.phone || '',
                };
                const nextAcademicCourses = data.academic_courses || [];
                setForm(nextForm);
                setAcademicCourses(nextAcademicCourses);
                await loadLinkedSubjects(nextAcademicCourses);
            } catch (err) {
                console.error(err);
                setError('Erro ao carregar perfil.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user?.email, user?.full_name]);

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
        setSuccess('');
    };

    const toggleAcademicCourse = (courseName) => {
        setAcademicCourses((previous) => (
            previous.includes(courseName)
                ? previous.filter((course) => course !== courseName)
                : [...previous, courseName]
        ));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        const trimmedName = form.name.trim();
        const trimmedEmail = form.email.trim().toLowerCase();
        const trimmedPhone = form.phone.trim();

        if (academicCourses.length === 0) {
            setError('Selecione ao menos um curso acadêmico.');
            setSaving(false);
            return;
        }

        if (trimmedEmail && !trimmedEmail.includes('@')) {
            setError('Informe um e-mail válido com @ ou deixe o campo em branco.');
            setSaving(false);
            return;
        }

        try {
            const requests = [
                api.put('/professors/me/academic-courses', {
                    course_names: academicCourses,
                }),
            ];

            if (trimmedName || trimmedEmail || trimmedPhone) {
                requests.unshift(
                    api.patch('/auth/me', {
                        ...(trimmedName ? { full_name: trimmedName } : {}),
                        ...(trimmedEmail ? { email: trimmedEmail } : {}),
                        phone: trimmedPhone || null,
                    })
                );
            }

            await Promise.all(requests);

            const refreshed = await api.get('/professors/me');
            const refreshedAcademicCourses = refreshed.data.academic_courses || [];
            setForm({
                name: refreshed.data.user_name || trimmedName || '',
                email: refreshed.data.user_email || trimmedEmail || '',
                phone: refreshed.data.phone || trimmedPhone || '',
            });
            setAcademicCourses(refreshedAcademicCourses);
            await loadLinkedSubjects(refreshedAcademicCourses);
            setSuccess('Cursos do professor salvos com sucesso. As disciplinas elegíveis do seu curso já foram atualizadas.');
        } catch (err) {
            setError(err.response?.data?.detail || 'Erro ao atualizar perfil.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            </div>
        );
    }
    const filteredCourses = availableCourses
        .filter((course) => normalizeText(course).includes(normalizeText(courseSearch)))
        .filter((course) => !academicCourses.some((selected) => normalizeText(selected) === normalizeText(course)));
    const linkedSubjectsPreview = linkedSubjects;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto max-w-5xl space-y-6"
        >
            <PageHeader
                title="Meu perfil"
                subtitle="Atualize seus dados e mantenha salvos os cursos acadêmicos que definem as disciplinas elegíveis do seu painel."
                icon={UserCircle}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="p-6">
                        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-text-primary">
                            <User className="h-5 w-5 text-accent-purple-light" />
                            Informações básicas
                        </h3>
                        <div className="space-y-4">
                            <Input label="Nome completo" value={form.name} onChange={(event) => updateField('name', event.target.value)} icon={User} placeholder="Seu nome" />
                            <Input label="E-mail" value={form.email} onChange={(event) => updateField('email', event.target.value)} icon={Mail} type="email" placeholder="seu@email.com" />
                            <Input label="Telefone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} icon={Phone} placeholder="(00) 00000-0000" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
                            <GraduationCap className="h-5 w-5 text-accent-blue-light" />
                            Cursos em que você leciona
                        </h3>
                        <p className="mb-4 text-sm text-text-secondary">
                            Os cursos abaixo ficam salvos no seu perfil desde o cadastro. A partir deles, a NEXORA libera apenas as disciplinas elegíveis daquele curso para você marcar no módulo de disciplinas.
                        </p>

                        {academicCourses.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {academicCourses.map((name) => (
                                    <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/20 bg-accent-purple/12 px-3 py-1.5 text-xs font-medium text-accent-purple">
                                        {name}
                                        <button type="button" onClick={() => toggleAcademicCourse(name)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent-purple/18">
                                            x
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <div className="relative">
                            <Input
                                placeholder="Digite o nome do curso para buscar..."
                                icon={Search}
                                value={courseSearch}
                                onChange={(event) => setCourseSearch(event.target.value)}
                                onFocus={() => setShowCourseDropdown(true)}
                            />

                            {showCourseDropdown ? <div className="fixed inset-0 z-40" onClick={() => setShowCourseDropdown(false)} /> : null}
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
                                        <div className="px-6 py-6 text-center text-xs italic text-text-secondary">Nenhum curso encontrado.</div>
                                    )}
                                </motion.div>
                            ) : null}
                        </div>
                    </Card>

                    {error ? (
                        <div className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/8 p-4 text-sm text-danger">
                            <AlertCircle className="h-5 w-5" />
                            {error}
                        </div>
                    ) : null}
                    {success ? (
                        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/8 p-4 text-sm text-success">
                            <CheckCircle className="h-5 w-5" />
                            {success}
                        </div>
                    ) : null}

                    <div className="flex justify-end">
                        <Button type="submit" loading={saving} icon={Save} className="px-8">
                            Salvar alterações
                        </Button>
                    </div>
                </form>

                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                                <BookOpen className="h-4 w-4 text-accent-blue-light" />
                                Disciplinas elegíveis do seu curso
                            </h3>
                            <span className="rounded-full bg-accent-purple/10 px-2 py-0.5 text-xs font-bold text-accent-purple">
                                {linkedSubjects.length}
                            </span>
                        </div>
                        <p className="mb-4 text-xs leading-6 text-text-secondary">
                            Esta lista já considera os cursos que você salvou no perfil. Na próxima etapa, em Disciplinas matriculadas, você escolhe quais dessas disciplinas realmente leciona.
                        </p>
                        <div className="space-y-2">
                            {linkedSubjectsPreview.length > 0 ? linkedSubjectsPreview.map((course) => (
                                <div key={course.id || course.name} className="flex items-center justify-between rounded-lg bg-bg-elevated/35 p-3 text-xs">
                                    <span className="truncate pr-3 text-text-secondary">{course.name}</span>
                                    <span className="font-mono text-text-tertiary">{course.code || 'CURSO'}</span>
                                </div>
                            )) : (
                                <p className="text-xs italic text-text-secondary">
                                    Ainda não há disciplinas elegíveis carregadas para os cursos salvos no seu perfil.
                                </p>
                            )}
                        </div>
                        <Link to={coursesRoute} className="mt-5 block">
                            <Button variant="secondary" className="w-full">
                                Ver disciplinas e turmas
                            </Button>
                        </Link>
                    </Card>

                    <Card className="border-accent-purple/20 bg-gradient-to-br from-accent-purple/10 to-accent-blue/10 p-6">
                        <h4 className="text-sm font-semibold text-text-primary">Como funciona agora</h4>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            1. O professor salva os cursos acadêmicos no próprio perfil. 2. A NEXORA monta as disciplinas elegíveis de cada curso. 3. Na tela de disciplinas, o professor seleciona apenas as disciplinas que realmente leciona.
                        </p>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
}
