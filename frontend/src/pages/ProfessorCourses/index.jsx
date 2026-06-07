import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, BookOpen, GraduationCap, Search, Users, CheckCircle, Save } from 'lucide-react';

import api from '@/services/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath } from '@/lib/app-shell';

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
        const key = subject?.id ? `id:${subject.id}` : `name:${normalizeText(subject?.name || subject?.code)}`;
        if (!key || unique.has(key)) continue;
        unique.set(key, subject);
    }
    return Array.from(unique.values()).sort((left, right) => {
        const leftName = String(left?.name || left?.code || '');
        const rightName = String(right?.name || right?.code || '');
        return leftName.localeCompare(rightName);
    });
}

export function ProfessorCourses() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedAcademicCourse, setSelectedAcademicCourse] = useState('');
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const profileRoute = buildRolePath(user?.role, 'profile');

    const loadProfile = async () => {
        const response = await api.get('/professors/me');
        setProfile(response.data);
        const selectedIds = response.data.selected_course_ids || [];
        setSelectedCourseIds(selectedIds);
        return response.data;
    };

    const loadAvailableSubjects = async (academicCourseName) => {
        if (!academicCourseName) {
            setAvailableSubjects([]);
            return [];
        }

        setSubjectsLoading(true);
        try {
            const response = await api.get('/courses/by-academic-courses', {
                params: { names: academicCourseName },
            });
            const subjects = Array.isArray(response.data) ? response.data : [];
            const uniqueSubjects = dedupeSubjects(subjects);
            setAvailableSubjects(uniqueSubjects);
            return uniqueSubjects;
        } catch (loadError) {
            console.error('Erro ao carregar disciplinas disponiveis do curso', loadError);
            setAvailableSubjects([]);
            throw loadError;
        } finally {
            setSubjectsLoading(false);
        }
    };

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError('');
            try {
                const data = await loadProfile();
                const academicCourses = data.academic_courses || [];
                if (academicCourses.length > 0) {
                    const initialAcademicCourse = academicCourses[0];
                    setSelectedAcademicCourse(initialAcademicCourse);
                    await loadAvailableSubjects(initialAcademicCourse);
                } else {
                    setAvailableSubjects([]);
                }
            } catch (loadError) {
                console.error('Erro ao carregar disciplinas do professor', loadError);
                setError('Nao foi possivel carregar o escopo docente agora.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const academicCourseOptions = useMemo(() => {
        return (profile?.academic_courses || [])
            .map((name) => {
                const subjectsForCourse = (profile?.courses || []).filter((course) => course.academic_course_name === name);
                const selectedForCourse = subjectsForCourse.filter((course) => selectedCourseIds.includes(course.id));
                const studentsForCourse = selectedForCourse.reduce((sum, course) => sum + (course.student_count || 0), 0);
                return {
                    name,
                    selectedSubjects: selectedForCourse.length,
                    students: studentsForCourse,
                    totalSubjects: subjectsForCourse.length,
                };
            })
            .filter((course) => course.totalSubjects > 0);
    }, [profile, selectedCourseIds]);

    useEffect(() => {
        if (!academicCourseOptions.length) {
            setSelectedAcademicCourse('');
            setAvailableSubjects([]);
            return;
        }

        const exists = academicCourseOptions.some((course) => course.name === selectedAcademicCourse);
        if (!selectedAcademicCourse || !exists) {
            const nextAcademicCourse = academicCourseOptions[0].name;
            setSelectedAcademicCourse(nextAcademicCourse);
            loadAvailableSubjects(nextAcademicCourse).catch(() => {
                setError('Nao foi possivel carregar as disciplinas do curso selecionado.');
            });
        }
    }, [academicCourseOptions, selectedAcademicCourse]);

    const statsByCourseKey = useMemo(() => {
        const map = new Map();
        for (const subject of profile?.courses || []) {
            const key = subject?.id ? `id:${subject.id}` : `name:${normalizeText(subject?.name)}`;
            map.set(key, subject);
        }
        return map;
    }, [profile]);

    const selectedCourseDetailsById = useMemo(() => {
        const map = new Map();
        for (const subject of profile?.selected_courses || []) {
            if (subject?.id) {
                map.set(subject.id, subject);
            }
        }
        return map;
    }, [profile]);

    const visibleSubjects = useMemo(() => {
        const searchKey = normalizeText(search);
        return availableSubjects
            .map((course) => {
                const key = course?.id ? `id:${course.id}` : `name:${normalizeText(course?.name)}`;
                const stats = statsByCourseKey.get(key);
                return {
                    ...course,
                    student_count: stats?.student_count || 0,
                    periods: stats?.periods || [],
                };
            })
            .filter((course) => !searchKey || [course.name, course.code].filter(Boolean).join(' ').toLowerCase().includes(searchKey))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [availableSubjects, search, statsByCourseKey]);

    const selectedSubjects = useMemo(() => {
        const merged = [];
        const availableById = new Map(availableSubjects.filter((subject) => subject?.id).map((subject) => [subject.id, subject]));

        for (const courseId of selectedCourseIds) {
            const live = availableById.get(courseId);
            if (!live) continue;
            const stats = statsByCourseKey.get(`id:${courseId}`);
            merged.push({
                ...live,
                academic_course_name: stats?.academic_course_name || selectedAcademicCourse,
                student_count: stats?.student_count || 0,
                periods: stats?.periods || [],
            });
        }

        return merged.sort((left, right) => left.name.localeCompare(right.name));
    }, [availableSubjects, selectedAcademicCourse, selectedCourseIds, statsByCourseKey]);

    const totalSelectedStudents = selectedSubjects.reduce((sum, subject) => sum + (subject.student_count || 0), 0);
    const totalAvailableSubjects = visibleSubjects.length;

    const toggleCourse = (courseId) => {
        setSelectedCourseIds((previous) => (
            previous.includes(courseId)
                ? previous.filter((id) => id !== courseId)
                : [...previous, courseId]
        ));
        setSuccess('');
        setError('');
    };

    const handleAcademicCourseSelect = async (courseName) => {
        setSelectedAcademicCourse(courseName);
        setSearch('');
        setError('');
        try {
            await loadAvailableSubjects(courseName);
        } catch {
            setError('Nao foi possivel carregar as disciplinas do curso selecionado.');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.put('/professors/me/courses', { course_ids: selectedCourseIds });
            const refreshed = await loadProfile();
            if (selectedAcademicCourse) {
                await loadAvailableSubjects(selectedAcademicCourse);
            }
            setSuccess(
                refreshed.selected_course_ids?.length
                    ? 'Disciplinas do seu curso salvas com sucesso. As proximas leituras do professor usarao apenas esse escopo.'
                    : 'Nenhuma disciplina ficou selecionada. Voce pode marcar novamente as disciplinas do seu curso.'
            );
        } catch (saveError) {
            console.error('Erro ao salvar disciplinas do professor', saveError);
            setError(saveError.response?.data?.detail || 'Nao foi possivel salvar as disciplinas selecionadas.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent-blue" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Cursos salvos" value={academicCourseOptions.length} helper="Cursos academicos persistidos no seu perfil" icon={GraduationCap} tone="indigo" />
                <MetricCard title="Disciplinas do curso" value={totalAvailableSubjects} helper="Elegiveis no curso selecionado" icon={BookOpen} tone="purple" />
                <MetricCard title="Disciplinas selecionadas" value={selectedSubjects.length} helper="Escopo docente salvo no seu perfil" icon={CheckCircle} tone="emerald" />
                <MetricCard title="Alunos cobertos" value={totalSelectedStudents} helper="Contagem atual nas disciplinas escolhidas" icon={Users} tone="blue" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card>
                    <CardHeader
                        title="1. Escolha um curso do seu perfil"
                        subtitle="Os cursos salvos no seu perfil aparecem aqui. Selecione um curso abaixo para marcar e salvar apenas as disciplinas que você realmente leciona."
                        icon={GraduationCap}
                    />

                    {academicCourseOptions.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                {academicCourseOptions.map((course) => {
                                    const isActive = course.name === selectedAcademicCourse;
                                    return (
                                        <button
                                            key={course.name}
                                            type="button"
                                            onClick={() => handleAcademicCourseSelect(course.name)}
                                            className={`rounded-[22px] border px-4 py-3 text-left transition ${isActive
                                                ? 'border-accent-blue/35 bg-accent-blue/10 dark:bg-accent-blue/20 shadow-sm'
                                                : 'border-border-subtle dark:border-slate-800 bg-bg-card hover:border-border-hover hover:bg-bg-secondary/50'}`}
                                        >
                                            <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{course.selectedSubjects} disciplinas ja selecionadas • {course.students} alunos cobertos</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">2. Selecione apenas as disciplinas do curso {selectedAcademicCourse || 'escolhido'}</p>
                                        <p className="mt-1 text-sm text-text-secondary">As opcoes abaixo pertencem ao curso salvo no seu perfil. Assim o professor nao ve disciplinas fora da sua area.</p>
                                    </div>
                                    <div className="relative w-full md:max-w-xs">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                        <input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Buscar disciplina..."
                                            className="h-11 w-full rounded-2xl border border-border-subtle dark:border-slate-800 bg-bg-card pl-10 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {subjectsLoading ? (
                                        <div className="flex min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-border-subtle dark:border-slate-800 bg-bg-card/70">
                                            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                                        </div>
                                    ) : visibleSubjects.length > 0 ? visibleSubjects.map((course) => {
                                        const isChecked = selectedCourseIds.includes(course.id);
                                        return (
                                            <button
                                                key={`${selectedAcademicCourse}-${course.id || course.name}`}
                                                type="button"
                                                onClick={() => course.id && toggleCourse(course.id)}
                                                disabled={!course.id}
                                                className={`flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition ${isChecked
                                                    ? 'border-accent-purple/35 bg-accent-purple/10 dark:bg-accent-purple/20'
                                                    : 'border-border-subtle dark:border-slate-800 bg-bg-card hover:border-border-hover hover:bg-bg-secondary/40'} ${!course.id ? 'cursor-not-allowed opacity-60' : ''}`}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">{course.code || 'Sem codigo institucional'} • {course.student_count || 0} alunos vinculados no momento</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {course.periods?.length ? course.periods.map((period) => (
                                                            <Badge key={`${course.name}-${period}`} variant="neutral">{period}o periodo</Badge>
                                                        )) : (
                                                            <Badge variant="neutral">Sem alunos sincronizados ainda</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge variant={isChecked ? 'success' : 'info'}>{isChecked ? 'Selecionada' : 'Disponivel'}</Badge>
                                            </button>
                                        );
                                    }) : (
                                        <EmptyState
                                            icon={BookOpen}
                                            title="Nenhuma disciplina encontrada para este curso"
                                            description="Ajuste a busca ou revise o curso salvo no perfil do professor."
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={BookOpen}
                            title="Nenhum curso salvo no perfil"
                            description="Primeiro salve os cursos em que voce leciona no perfil do professor. Depois, as disciplinas do curso aparecerao aqui para selecao."
                            action={(
                                <Link to={profileRoute}>
                                    <Button>Ir para meu perfil</Button>
                                </Link>
                            )}
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Resumo do escopo docente"
                        subtitle="O curso continua salvo no perfil e aqui voce controla apenas as disciplinas que realmente leciona."
                        icon={Users}
                        action={<Button icon={Save} loading={saving} onClick={handleSave}>Salvar escopo</Button>}
                    />

                    {error ? (
                        <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                            {error}
                        </div>
                    ) : null}
                    {success ? (
                        <div className="mb-4 rounded-2xl border border-success/20 bg-success/8 px-4 py-3 text-sm text-success">
                            {success}
                        </div>
                    ) : null}

                    <div className="space-y-4">
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4 text-sm text-text-secondary">
                            <p className="font-semibold text-text-primary">Como a tela funciona agora</p>
                            <p className="mt-2 leading-6">1. O curso do professor ja vem salvo desde o cadastro. 2. A NEXORA mostra somente as disciplinas elegiveis daquele curso. 3. O professor marca quais dessas disciplinas realmente leciona e salva o escopo.</p>
                        </div>

                        {selectedSubjects.length > 0 ? (
                            <div className="space-y-3">
                                {selectedSubjects.map((course) => (
                                    <div key={`selected-${course.id}`} className="rounded-[22px] border border-border-subtle dark:border-slate-800 bg-bg-card px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                                <p className="mt-1 text-sm text-text-secondary">{course.code || 'Sem codigo institucional'} • {course.academic_course_name || selectedAcademicCourse || 'Curso salvo no perfil'}</p>
                                            </div>
                                            <Badge variant="info">{course.student_count || 0} alunos</Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {course.periods?.length ? course.periods.map((period) => (
                                                <Badge key={`selected-${course.id}-${period}`} variant="neutral">{period}o periodo</Badge>
                                            )) : (
                                                <Badge variant="neutral">Sem alunos sincronizados ainda</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={CheckCircle}
                                title="Nenhuma disciplina selecionada"
                                description="Escolha um curso salvo no seu perfil, marque as disciplinas que voce leciona e salve o escopo para o restante da plataforma usar apenas esse recorte."
                            />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
