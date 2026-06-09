import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Search, Users } from 'lucide-react';

import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StudentDetailModal } from '@/components/StudentDetailModal';

function buildProfessorStudents(entries) {
    const studentMap = new Map();

    for (const entry of entries || []) {
        for (const student of entry.students || []) {
            const existing = studentMap.get(student.student_id) || {
                id: student.student_id,
                name: student.student_name,
                registrationNumber: student.registration_number,
                courseName: student.course_name,
                currentPeriod: student.current_period,
                subjectCount: 0,
            };

            studentMap.set(student.student_id, {
                ...existing,
                subjectCount: existing.subjectCount + 1,
            });
        }
    }

    return Array.from(studentMap.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function ProfessorStudents() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [students, setStudents] = useState([]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                const response = await api.get('/professors/me/students');
                setStudents(buildProfessorStudents(response.data || []));
            } catch (requestError) {
                console.error('Erro ao carregar alunos do professor', requestError);
                setStudents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    const filteredStudents = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) return students;

        return students.filter((student) => (
            [
                student.name,
                student.registrationNumber,
                student.courseName,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch)
        ));
    }, [search, students]);

    return (
        <div className="space-y-4">
            <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                        Aqui aparecem apenas os alunos vinculados às disciplinas selecionadas por você. Clique em um aluno para abrir notas, frequência e os detalhes completos.
                    </p>

                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <Badge variant="info">{filteredStudents.length} aluno{filteredStudents.length === 1 ? '' : 's'}</Badge>
                        <Input
                            placeholder="Buscar aluno"
                            icon={Search}
                            className="w-full min-w-[260px]"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-24 animate-pulse rounded-[24px] border border-border-subtle bg-white/70" />
                    ))
                ) : filteredStudents.length === 0 ? (
                    <Card className="p-10 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue">
                            <Users className="h-6 w-6" />
                        </div>
                        <p className="mt-5 text-lg font-semibold text-text-primary">Nenhum aluno encontrado</p>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Ajuste a busca ou revise as disciplinas salvas no seu perfil para atualizar a base ativa do professor.
                        </p>
                    </Card>
                ) : (
                    filteredStudents.map((student, index) => (
                        <motion.button
                            key={student.id}
                            type="button"
                            onClick={() => setSelectedStudentId(student.id)}
                            className="w-full rounded-[24px] border border-border-subtle bg-white/92 px-5 py-4 text-left shadow-sm transition hover:border-accent-blue/20 hover:shadow-[0_20px_46px_-34px_rgba(11,87,208,0.35)]"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-brand-gradient-soft text-sm font-bold text-accent-blue">
                                        {student.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="truncate text-base font-semibold text-text-primary">{student.name}</p>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                                            <span>Matrícula: {student.registrationNumber}</span>
                                            {student.courseName ? <span>{student.courseName}</span> : null}
                                            {student.currentPeriod ? <span>{student.currentPeriod}º período</span> : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-shrink-0 items-center gap-3">
                                    <span className="hidden text-xs font-medium text-text-tertiary sm:inline">
                                        {student.subjectCount} disciplina{student.subjectCount === 1 ? '' : 's'}
                                    </span>
                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-accent-blue">
                                        Abrir
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                    ))
                )}
            </div>

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
