import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BookOpen,
    Check,
    CheckCircle,
    GraduationCap,
    Loader2,
    Plus,
    Save,
    Search,
    Users,
} from 'lucide-react';

import api from '@/services/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath } from '@/lib/app-shell';

export function ProfessorCourses() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const profileRes = await api.get('/professors/me');
                const nextProfile = profileRes.data;
                setProfile(nextProfile);
                setSelectedIds(new Set(nextProfile.courses?.map((course) => course.id).filter(Boolean) || []));

                const requests = [
                    api.get('/professors/me/students'),
                ];
                if (Array.isArray(nextProfile.academic_courses) && nextProfile.academic_courses.length > 0) {
                    requests.push(api.get('/courses/by-academic-courses', {
                        params: {
                            names: nextProfile.academic_courses.join(','),
                        },
                    }));
                }

                const [studentsRes, coursesRes] = await Promise.allSettled(requests);
                if (studentsRes.status === 'fulfilled') setSubjectStudents(studentsRes.value.data || []);
                if (coursesRes?.status === 'fulfilled') setAvailableCourses(coursesRes.value.data || []);
                else if (!nextProfile.academic_courses?.length) setAvailableCourses([]);
            } catch (error) {
                console.error('Erro ao carregar disciplinas do professor', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const filteredCourses = useMemo(() => {
        const searchKey = search.trim().toLowerCase();
        return availableCourses
            .filter((course) => {
                if (!searchKey) return true;
                return [
                    course.name,
                    course.code,
                    course.department,
                ].filter(Boolean).some((value) => String(value).toLowerCase().includes(searchKey));
            })
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [availableCourses, search]);

    const selectedSubjects = useMemo(() => (
        subjectStudents.filter((subject) => {
            if (selectedIds.size === 0) return true;
            if (subject.course_id == null) return false;
            return selectedIds.has(subject.course_id);
        })
    ), [selectedIds, subjectStudents]);

    const totalStudents = selectedSubjects.reduce((sum, item) => sum + (item.students?.length || 0), 0);
    const profileRoute = buildRolePath(user?.role, 'profile');

    function toggleCourse(courseId) {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(courseId)) next.delete(courseId);
            else next.add(courseId);
            return next;
        });
        setSaved(false);
    }

    async function handleSave() {
        setSaving(true);
        try {
            const response = await api.put('/professors/me/courses', {
                course_ids: Array.from(selectedIds),
            });
            setProfile((previous) => ({ ...previous, courses: response.data.courses }));
            const studentsRes = await api.get('/professors/me/students');
            setSubjectStudents(studentsRes.data || []);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Erro ao salvar disciplinas do professor', error);
        } finally {
            setSaving(false);
        }
    }

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
                subtitle="Veja os componentes sob sua responsabilidade, relacione alunos e ajuste suas disciplinas vinculadas."
                icon={BookOpen}
                actions={(
                    <Button onClick={handleSave} loading={saving} icon={saved ? CheckCircle : Save}>
                        {saved ? 'Salvo' : 'Salvar disciplinas'}
                    </Button>
                )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="Disciplinas vinculadas"
                    value={selectedIds.size}
                    helper="Componentes atualmente salvos no seu perfil"
                    icon={BookOpen}
                    tone="indigo"
                />
                <MetricCard
                    title="Turmas listadas"
                    value={selectedSubjects.length}
                    helper="Disciplinas com alunos e base ativa"
                    icon={GraduationCap}
                    tone="purple"
                />
                <MetricCard
                    title="Alunos vinculados"
                    value={totalStudents}
                    helper="Somatorio das turmas sob sua responsabilidade"
                    icon={Users}
                    tone="blue"
                />
                <MetricCard
                    title="Disponiveis"
                    value={availableCourses.length}
                    helper="Disciplinas elegiveis dentro dos seus cursos academicos"
                    icon={CheckCircle}
                    tone="emerald"
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Card>
                    <CardHeader
                        title="Disciplinas sob sua responsabilidade"
                        subtitle="Estas sao as turmas e materias em que voce ja aparece como responsavel."
                        icon={GraduationCap}
                    />

                    {selectedSubjects.length > 0 ? (
                        <div className="space-y-4">
                            {selectedSubjects.map((subject) => (
                                <div key={subject.course_name} className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{subject.course_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                {subject.course_code || 'Disciplina vinculada por base academica'}
                                            </p>
                                        </div>
                                        <Badge variant="info">{subject.students.length} alunos</Badge>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {[...new Set(subject.students.map((student) => student.current_period).filter(Boolean))].map((period) => (
                                            <Badge key={period} variant="neutral">
                                                {period}o periodo
                                            </Badge>
                                        ))}
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        {subject.students.slice(0, 6).map((student) => (
                                            <div key={`${subject.course_name}-${student.registration_number}`} className="rounded-2xl bg-white px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStudentId(student.student_id)}
                                                    className="text-left text-sm font-semibold text-text-primary transition-colors hover:text-accent-blue"
                                                >
                                                    {student.student_name}
                                                </button>
                                                <p className="mt-1 text-sm text-text-secondary">
                                                    {student.registration_number} • {student.class_schedule || 'Turno nao informado'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={BookOpen}
                            title="Nenhuma disciplina vinculada ainda"
                            description="Selecione disciplinas na coluna ao lado para que o professor passe a enxergar turmas, alunos e analises relacionadas."
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Ajustar disciplinas"
                        subtitle="Use a busca para escolher quais componentes devem aparecer nas suas analises."
                        icon={Search}
                        action={(
                            <div className="relative w-full max-w-xs">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar por nome, codigo..."
                                    className="h-11 w-full rounded-2xl border border-border-subtle bg-white pl-10 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                                />
                            </div>
                        )}
                    />

                    {filteredCourses.length > 0 ? (
                        <div className="space-y-3">
                            {filteredCourses.map((course) => {
                                const isSelected = selectedIds.has(course.id);
                                return (
                                    <motion.button
                                        key={`${course.id}-${course.name}`}
                                        type="button"
                                        onClick={() => toggleCourse(course.id)}
                                        className={[
                                            'w-full rounded-[22px] border px-4 py-4 text-left transition',
                                            isSelected
                                                ? 'border-accent-blue/25 bg-brand-gradient-soft shadow-glow-sm'
                                                : 'border-border-subtle bg-bg-secondary/40 hover:border-border-hover hover:bg-white',
                                        ].join(' ')}
                                        whileHover={{ y: -1 }}
                                        whileTap={{ scale: 0.995 }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {course.code && <Badge variant="neutral">{course.code}</Badge>}
                                                    {course.department && <Badge variant="info">{course.department}</Badge>}
                                                </div>
                                                <p className="mt-3 text-sm font-semibold text-text-primary">{course.name}</p>
                                            </div>
                                            <span className={[
                                                'flex h-8 w-8 items-center justify-center rounded-2xl',
                                                isSelected ? 'bg-accent-blue text-white' : 'bg-white text-text-secondary',
                                            ].join(' ')}>
                                                {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            </span>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            icon={Search}
                            title="Nenhuma disciplina encontrada"
                            description="Revise sua busca ou confira se seus cursos academicos foram selecionados no perfil."
                            action={(
                                <Link to={profileRoute}>
                                    <Button variant="secondary">Abrir meu perfil</Button>
                                </Link>
                            )}
                        />
                    )}
                </Card>
            </div>

            {profile?.academic_courses?.length === 0 && (
                <EmptyState
                    icon={GraduationCap}
                    title="Primeiro selecione os cursos academicos"
                    description="Sem essa definicao no perfil, o sistema nao consegue listar corretamente as disciplinas disponiveis para docencia."
                    action={(
                        <Link to={profileRoute}>
                            <Button>Ir para meu perfil</Button>
                        </Link>
                    )}
                />
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
