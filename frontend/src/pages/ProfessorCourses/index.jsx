import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, BookOpen, GraduationCap, Search, Users, CheckCircle } from 'lucide-react';

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
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const profileRoute = buildRolePath(user?.role, 'profile');

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [profileRes, studentsRes] = await Promise.all([
                    api.get('/professors/me'),
                    api.get('/professors/me/students'),
                ]);
                setProfile(profileRes.data);
                setSubjectStudents(studentsRes.data || []);
            } catch (error) {
                console.error('Erro ao carregar disciplinas do professor', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const filteredSubjects = useMemo(() => {
        const searchKey = search.trim().toLowerCase();
        if (!searchKey) return subjectStudents;
        return subjectStudents.filter((subject) => {
            const haystack = [subject.course_name, subject.course_code]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(searchKey);
        });
    }, [search, subjectStudents]);

    const totalStudents = filteredSubjects.reduce((sum, item) => sum + (item.students?.length || 0), 0);

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
                title="Disciplinas vinculadas automaticamente"
                subtitle="As turmas abaixo sao abertas a partir dos alunos do mesmo curso com dados sincronizados no ambiente do aluno."
                icon={BookOpen}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Cursos vinculados" value={profile?.academic_courses?.length || 0} helper="Base academica configurada no perfil" icon={GraduationCap} tone="indigo" />
                <MetricCard title="Disciplinas ativas" value={filteredSubjects.length} helper="Detectadas automaticamente via scraping" icon={BookOpen} tone="purple" />
                <MetricCard title="Alunos monitorados" value={totalStudents} helper="Alunos listados nas turmas ativas" icon={Users} tone="blue" />
                <MetricCard title="Sincronizacao" value={filteredSubjects.length > 0 ? 'OK' : 'Pendente'} helper="Depende de dados academicos do aluno" icon={CheckCircle} tone="emerald" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                    <CardHeader
                        title="Turmas e alunos liberados"
                        subtitle="Cada disciplina abaixo aparece quando existe pelo menos um aluno do mesmo curso com dados sincronizados."
                        icon={GraduationCap}
                    />

                    {filteredSubjects.length > 0 ? (
                        <div className="space-y-4">
                            {filteredSubjects.map((subject) => (
                                <div key={subject.course_name} className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{subject.course_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{subject.course_code || 'Disciplina vinculada por base academica'}</p>
                                        </div>
                                        <Badge variant="info">{subject.students.length} alunos</Badge>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {[...new Set(subject.students.map((student) => student.current_period).filter(Boolean))].map((period) => (
                                            <Badge key={period} variant="neutral">{period}o periodo</Badge>
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
                            title="Nenhuma disciplina liberada ainda"
                            description="Quando os alunos dos cursos vinculados sincronizarem seus dados academicos, as disciplinas aparecerao aqui automaticamente."
                        />
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title="Como destravar mais disciplinas"
                        subtitle="A configuracao agora depende do curso e do scraping do aluno, nao de marcacao manual."
                        icon={Search}
                        action={(
                            <div className="relative w-full max-w-xs">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar disciplina..."
                                    className="h-11 w-full rounded-2xl border border-border-subtle bg-white pl-10 pr-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                                />
                            </div>
                        )}
                    />

                    <div className="space-y-4 text-sm text-text-secondary">
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
                            <p className="font-semibold text-text-primary">1. Defina os cursos no perfil</p>
                            <p className="mt-1 leading-6">O professor informa apenas os cursos academicos em que atua.</p>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
                            <p className="font-semibold text-text-primary">2. O aluno sincroniza o portal</p>
                            <p className="mt-1 leading-6">As disciplinas entram na NEXORA pela area do aluno via scraping do Lyceum.</p>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
                            <p className="font-semibold text-text-primary">3. A vinculação acontece sozinha</p>
                            <p className="mt-1 leading-6">Assim que houver aluno do mesmo curso com disciplina sincronizada, ela aparece aqui para o professor.</p>
                        </div>
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

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
