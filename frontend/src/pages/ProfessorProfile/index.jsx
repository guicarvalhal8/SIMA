import React, { useEffect, useState } from 'react';
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

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/professors/me');
                const data = response.data;
                setForm({
                    name: data.user_name || '',
                    email: data.user_email || '',
                    phone: data.phone || '',
                });
                setAcademicCourses(data.academic_courses || []);
                setLinkedSubjects(data.courses || []);
            } catch (err) {
                console.error(err);
                setError('Erro ao carregar perfil.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

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
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await Promise.all([
                api.patch('/auth/me', {
                    full_name: form.name,
                    email: form.email,
                    phone: form.phone,
                }),
                api.put('/professors/me/academic-courses', {
                    course_names: academicCourses,
                }),
            ]);

            const refreshed = await api.get('/professors/me');
            setLinkedSubjects(refreshed.data.courses || []);
            setSuccess('Perfil atualizado com sucesso. As disciplinas foram recalculadas automaticamente.');
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
        .filter((course) => course.toLowerCase().includes(courseSearch.toLowerCase()))
        .filter((course) => !academicCourses.includes(course));

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto max-w-5xl space-y-6"
        >
            <PageHeader
                title="Meu perfil"
                subtitle="Atualize seus dados e os cursos academicos que alimentam a deteccao automatica de disciplinas."
                icon={UserCircle}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="p-6">
                        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-text-primary">
                            <User className="h-5 w-5 text-accent-purple-light" />
                            Informacoes basicas
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
                            Cursos em que voce leciona
                        </h3>
                        <p className="mb-4 text-sm text-text-secondary">
                            Os cursos abaixo definem quais alunos entram no seu radar. As disciplinas sao derivadas automaticamente do scraping desses alunos.
                        </p>

                        {academicCourses.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {academicCourses.map((name) => (
                                    <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/20 bg-accent-purple/12 px-3 py-1.5 text-xs font-medium text-accent-purple">
                                        {name}
                                        <button type="button" onClick={() => toggleAcademicCourse(name)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent-purple/18">
                                            ×
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
                            Salvar alteracoes
                        </Button>
                    </div>
                </form>

                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                                <BookOpen className="h-4 w-4 text-accent-blue-light" />
                                Disciplinas detectadas
                            </h3>
                            <span className="rounded-full bg-accent-purple/10 px-2 py-0.5 text-xs font-bold text-accent-purple">
                                {linkedSubjects.length}
                            </span>
                        </div>
                        <p className="mb-4 text-xs leading-6 text-text-secondary">
                            Esta lista e alimentada automaticamente pelos alunos sincronizados nos cursos selecionados acima.
                        </p>
                        <div className="space-y-2">
                            {linkedSubjects.length > 0 ? linkedSubjects.slice(0, 8).map((course) => (
                                <div key={course.name} className="flex items-center justify-between rounded-lg bg-bg-elevated/35 p-3 text-xs">
                                    <span className="truncate pr-3 text-text-secondary">{course.name}</span>
                                    <span className="font-mono text-text-tertiary">{course.code || 'AUTO'}</span>
                                </div>
                            )) : (
                                <p className="text-xs italic text-text-secondary">
                                    Ainda nao ha disciplinas detectadas. Isso acontece quando os alunos do curso ainda nao trouxeram dados do scraping.
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
                            1. O professor escolhe os cursos academicos. 2. Os alunos desses cursos sincronizam suas disciplinas na area do aluno. 3. A NEXORA libera automaticamente as disciplinas correspondentes no painel docente.
                        </p>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
}
