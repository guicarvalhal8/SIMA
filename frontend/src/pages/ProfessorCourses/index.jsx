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
    return String(value || '').trim().toLowerCase();
}

export function ProfessorCourses() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedAcademicCourse, setSelectedAcademicCourse] = useState('');
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);
    const profileRoute = buildRolePath(user?.role, 'profile');

    const loadProfile = async () => {
        const response = await api.get('/professors/me');
        setProfile(response.data);
        const selectedIds = response.data.selected_course_ids || [];
        setSelectedCourseIds(selectedIds);
        return response.data;
    };

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError('');
            try {
                await loadProfile();
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
        const groups = new Map();
        for (const item of profile?.courses || []) {
            if (!item?.academic_course_name || !item?.student_count) continue;
            const group = groups.get(item.academic_course_name) || {
                name: item.academic_course_name,
                subjects: 0,
                students: 0,
            };
            group.subjects += 1;
            group.students += item.student_count;
            groups.set(item.academic_course_name, group);
        }
        return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
    }, [profile]);

    useEffect(() => {
        if (!academicCourseOptions.length) {
            setSelectedAcademicCourse('');
            return;
        }

        const exists = academicCourseOptions.some((course) => course.name === selectedAcademicCourse);
        if (!selectedAcademicCourse || !exists) {
            setSelectedAcademicCourse(academicCourseOptions[0].name);
        }
    }, [academicCourseOptions, selectedAcademicCourse]);

    const visibleSubjects = useMemo(() => {
        const searchKey = normalizeText(search);
        return (profile?.courses || [])
            .filter((course) => course.academic_course_name === selectedAcademicCourse)
            .filter((course) => !searchKey || [course.name, course.code].filter(Boolean).join(' ').toLowerCase().includes(searchKey))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [profile, search, selectedAcademicCourse]);

    const selectedSubjects = useMemo(() => {
        const selectedSet = new Set(selectedCourseIds);
        return (profile?.courses || [])
            .filter((course) => course.id && selectedSet.has(course.id))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [profile, selectedCourseIds]);

    const totalSelectedStudents = selectedSubjects.reduce((sum, subject) => sum + (subject.student_count || 0), 0);
    const totalAvailableSubjects = academicCourseOptions.reduce((sum, course) => sum + course.subjects, 0);

    const toggleCourse = (courseId) => {
        setSelectedCourseIds((previous) => (
            previous.includes(courseId)
                ? previous.filter((id) => id !== courseId)
                : [...previous, courseId]
        ));
        setSuccess('');
        setError('');
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.put('/professors/me/courses', { course_ids: selectedCourseIds });
            const refreshed = await loadProfile();
            setSuccess(
                refreshed.selected_course_ids?.length
                    ? 'Escopo docente salvo. Agora a NEXORA considera apenas as disciplinas selecionadas por voce.'
                    : 'Nenhuma disciplina ficou selecionada. Voce pode voltar e marcar as disciplinas que leciona.'
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
            <PageHeader
                title="Disciplinas matriculadas"
                subtitle="Escolha primeiro um curso com alunos ativos, depois marque apenas as disciplinas que voce realmente leciona."
                icon={BookOpen}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Cursos com alunos" value={academicCourseOptions.length} helper="Cursos academicos com base ativa" icon={GraduationCap} tone="indigo" />
                <MetricCard title="Disciplinas disponiveis" value={totalAvailableSubjects} helper="Detectadas a partir dos alunos sincronizados" icon={BookOpen} tone="purple" />
                <MetricCard title="Disciplinas selecionadas" value={selectedSubjects.length} helper="Escopo docente salvo no seu perfil" icon={CheckCircle} tone="emerald" />
                <MetricCard title="Alunos cobertos" value={totalSelectedStudents} helper="Somatorio das disciplinas que voce marcou" icon={Users} tone="blue" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card>
                    <CardHeader
                        title="1. Escolha um curso com alunos matriculados"
                        subtitle="A lista abaixo mostra apenas cursos que ja possuem alunos ativos e disciplinas detectadas via sincronizacao."
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
                                            onClick={() => setSelectedAcademicCourse(course.name)}
                                            className={`rounded-[22px] border px-4 py-3 text-left transition ${isActive
                                                ? 'border-accent-blue/35 bg-accent-blue/10 shadow-sm'
                                                : 'border-border-subtle bg-white hover:border-border-hover hover:bg-bg-secondary/50'}`}
                                        >
                                            <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{course.subjects} disciplinas detectadas • {course.students} alunos no curso</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">2. Marque as disciplinas que voce leciona em {selectedAcademicCourse || 'um curso'}</p>
                                        <p className="mt-1 text-sm text-text-secondary">Depois de salvar, o dashboard e as analises do professor passam a usar esse escopo.</p>
                                    </div>
                                    <div className="relative w-full md:max-w-xs">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                        <input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Buscar disciplina..."
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white pl-10 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {visibleSubjects.length > 0 ? visibleSubjects.map((course) => {
                                        const isChecked = selectedCourseIds.includes(course.id);
                                        return (
                                            <button
                                                key={`${course.academic_course_name}-${course.id || course.name}`}
                                                type="button"
                                                onClick={() => course.id && toggleCourse(course.id)}
                                                disabled={!course.id}
                                                className={`flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition ${isChecked
                                                    ? 'border-accent-purple/35 bg-accent-purple/10'
                                                    : 'border-border-subtle bg-white hover:border-border-hover hover:bg-bg-secondary/40'} ${!course.id ? 'cursor-not-allowed opacity-60' : ''}`}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">{course.code || 'Sem codigo institucional'} • {course.student_count} alunos no curso</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {course.periods?.map((period) => (
                                                            <Badge key={`${course.name}-${period}`} variant="neutral">{period}o periodo</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={isChecked ? 'success' : 'info'}>{isChecked ? 'Selecionada' : 'Disponivel'}</Badge>
                                                </div>
                                            </button>
                                        );
                                    }) : (
                                        <EmptyState
                                            icon={BookOpen}
                                            title="Nenhuma disciplina encontrada"
                                            description="Ajuste a busca ou escolha outro curso academico com alunos ativos."
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={BookOpen}
                            title="Nenhum curso com alunos sincronizados ainda"
                            description="Assim que houver alunos ativos sincronizados nos seus cursos academicos, as disciplinas aparecerao aqui para selecao."
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Resumo do escopo docente"
                        subtitle="Depois de selecionar as disciplinas, a tela mostra apenas os quantitativos para reduzir poluicao visual."
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
                            <p className="mt-2 leading-6">1. O professor escolhe um curso que ja tem alunos ativos. 2. Marca apenas as disciplinas que realmente leciona. 3. A NEXORA passa a contar alunos por disciplina sem listar nome por nome nesta tela.</p>
                        </div>

                        {selectedSubjects.length > 0 ? (
                            <div className="space-y-3">
                                {selectedSubjects.map((course) => (
                                    <div key={`selected-${course.id}`} className="rounded-[22px] border border-border-subtle bg-white px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-text-primary">{course.name}</p>
                                                <p className="mt-1 text-sm text-text-secondary">{course.code || 'Sem codigo institucional'} • {course.academic_course_name}</p>
                                            </div>
                                            <Badge variant="info">{course.student_count} alunos</Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {course.periods?.map((period) => (
                                                <Badge key={`selected-${course.id}-${period}`} variant="neutral">{period}o periodo</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={CheckCircle}
                                title="Nenhuma disciplina selecionada"
                                description="Escolha um curso, marque as disciplinas que voce leciona e salve o escopo para a plataforma reduzir o ruido visual nas proximas telas."
                            />
                        )}
                    </div>

                    {!profile?.academic_courses?.length ? (
                        <div className="mt-5">
                            <EmptyState
                                icon={GraduationCap}
                                title="Primeiro selecione os cursos academicos"
                                description="Sem os cursos no perfil, o sistema nao consegue identificar quais alunos e disciplinas pertencem ao seu escopo."
                                action={(
                                    <Link to={profileRoute}>
                                        <Button>Ir para meu perfil</Button>
                                    </Link>
                                )}
                            />
                        </div>
                    ) : null}
                </Card>
            </div>
        </div>
    );
}
