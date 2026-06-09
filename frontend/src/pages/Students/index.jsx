import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import clsx from 'clsx';
import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { StudentDetailModal } from '@/components/StudentDetailModal';

const statusMap = {
    ACTIVE: { label: 'Ativo', variant: 'success', dot: true },
    INACTIVE: { label: 'Inativo', variant: 'neutral', dot: false },
    GRADUATED: { label: 'Graduado', variant: 'info', dot: false },
    active: { label: 'Ativo', variant: 'success', dot: true },
};

export function StudentsList() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, [search]);

    async function fetchStudents() {
        try {
            setLoading(true);
            const query = search ? `?search=${search}` : '';
            const response = await api.get(`/students/${query}`);
            setStudents(response.data.students || []);
        } catch (error) {
            console.error('Erro ao buscar alunos', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Base acadêmica de alunos"
                subtitle="Busca, consulta e acompanhamento da base discente para leitura operacional e tomada de decisão."
                icon={Users}
                actions={<Button icon={UserPlus} variant="secondary">Novo cadastro</Button>}
            />

            <Card>
                <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-text-primary">Filtro de busca</p>
                        <p className="mt-1 text-sm text-text-secondary">Pesquise por nome, e-mail ou número de matrícula.</p>
                    </div>
                    <Input
                        placeholder="Buscar por nome ou matrícula"
                        icon={Search}
                        className="w-full max-w-xl"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="table-shell mt-6 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-subtle bg-bg-secondary/55 text-left text-text-tertiary">
                                <th className="px-6 py-4 font-semibold">Nome</th>
                                <th className="px-6 py-4 font-semibold">Matrícula</th>
                                <th className="px-6 py-4 font-semibold">E-mail</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Data de ingresso</th>
                                <th className="px-6 py-4 font-semibold" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, index) => (
                                    <tr key={index} className="border-b border-border-subtle/60 last:border-none">
                                        {Array.from({ length: 6 }).map((__, cellIndex) => (
                                            <td key={cellIndex} className="px-6 py-4">
                                                <div className={clsx('h-4 animate-pulse rounded-full bg-bg-secondary', cellIndex === 0 ? 'w-48' : 'w-28')} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : students.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="mx-auto max-w-md">
                                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue">
                                                <Users className="h-6 w-6" />
                                            </div>
                                            <p className="mt-5 text-lg font-semibold text-text-primary">Nenhum aluno encontrado</p>
                                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                                                Ajuste os filtros ou realize novos cadastros para ampliar a base consultada.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                students.map((student, index) => {
                                    const status = statusMap[student.status] || statusMap.INACTIVE;
                                    return (
                                        <motion.tr
                                            key={student.id}
                                            className="table-row-hover cursor-pointer border-b border-border-subtle/60 last:border-none"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.02 }}
                                            onClick={() => setSelectedStudentId(student.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient-soft text-sm font-bold text-accent-blue">
                                                        {student.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-text-primary">{student.name}</p>
                                                        <p className="text-sm text-text-secondary">{student.registration_number}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">{student.registration_number}</td>
                                            <td className="px-6 py-4 text-text-secondary">{student.email}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={status.variant} dot={status.dot}>{status.label}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">
                                                {new Date(student.enrollment_date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ChevronRight className="ml-auto h-4 w-4 text-text-tertiary" />
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
