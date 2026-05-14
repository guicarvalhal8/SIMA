import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    User, Mail, Phone, BookOpen, Save, CheckCircle, Search,
    AlertCircle, UserCircle, GraduationCap, ChevronRight, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildRolePath } from '@/lib/app-shell';

const AVAILABLE_COURSES = [
    "Administração", "Agronomia", "Análise e Desenvolvimento de Sistemas",
    "Arquitetura e Urbanismo", "Biomedicina", "Ciências Contábeis",
    "Comunicação Social: Publicidade e Propaganda", "Design Gráfico",
    "Direito", "Educação Física", "Enfermagem", "Engenharia Civil",
    "Engenharia de Software", "Engenharia Elétrica", "Engenharia Mecânica",
    "Estética e Cosmética", "Farmácia", "Fisioterapia", "Gastronomia",
    "Inteligência Artificial", "Medicina", "Medicina Veterinária",
    "Nutrição", "Odontologia", "Psicologia", "Relações Internacionais",
];

export function ProfessorProfile() {
    const { user } = useAuth();
    const coursesRoute = buildRolePath(user?.role, 'courses');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [form, setForm] = useState({ name: '', email: '', phone: '' });

    const [courses, setCourses] = useState([]);
    const [academicCourses, setAcademicCourses] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());

    // Search states
    const [courseSearch, setCourseSearch] = useState('');
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profileRes = await api.get('/professors/me');
                const data = profileRes.data;
                setForm({
                    name: data.user_name || '',
                    email: data.user_email || '',
                    phone: data.phone || '',
                });
                setCourses(data.courses || []);
                setAcademicCourses(data.academic_courses || []);
                if (data.courses) {
                    // Usar nomes para rastrear seleção (IDs podem variar entre scraping e DB)
                    setSelectedSubjectIds(new Set(data.courses.map(c => c.name)));
                }
            } catch (err) {
                console.error(err);
                setError('Erro ao carregar perfil');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    // Quando mudar os cursos acadêmicos, buscar matérias específicas
    useEffect(() => {
        const fetchSubjects = async () => {
            if (academicCourses.length > 0) {
                try {
                    const names = academicCourses.join(',');
                    const res = await api.get(`/courses/by-academic-courses?names=${names}`);
                    setAvailableSubjects(res.data);
                } catch (err) {
                    console.error('Error fetching subjects:', err);
                }
            } else {
                setAvailableSubjects([]);
            }
        };
        fetchSubjects();
    }, [academicCourses]);

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    const toggleAcademicCourse = (courseName) => {
        setAcademicCourses(prev =>
            prev.includes(courseName)
                ? prev.filter(c => c !== courseName)
                : [...prev, courseName]
        );
    };

    const toggleSubject = (subjectKey) => {
        setSelectedSubjectIds(prev => {
            const next = new Set(prev);
            if (next.has(subjectKey)) {
                next.delete(subjectKey);
            } else {
                next.add(subjectKey);
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Salvar informações pessoais + cursos acadêmicos + disciplinas
            await Promise.all([
                api.patch('/auth/me', {
                    full_name: form.name,
                    email: form.email,
                    phone: form.phone,
                }),
                api.put('/professors/me/academic-courses', {
                    course_names: academicCourses
                }),
                api.put('/professors/me/courses', {
                    course_ids: [...selectedSubjectIds]
                }),
            ]);

            // Re-fetch para atualizar o resumo lateral
            const profileRes = await api.get('/professors/me');
            if (profileRes.data.courses) {
                setCourses(profileRes.data.courses);
            }

            setSuccess('Perfil atualizado com sucesso!');
        } catch (err) {
            setError(err.response?.data?.detail || 'Erro ao atualizar perfil');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto space-y-6"
        >
            <PageHeader
                title="Meu Perfil"
                subtitle="Gerencie suas informações e disciplinas"
                icon={UserCircle}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lado Esquerdo: Formulário */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                                <User className="w-5 h-5 text-accent-purple-light" />
                                Informações Básicas
                            </h3>
                            <div className="space-y-4">
                                <Input label="Nome Completo" value={form.name} onChange={e => updateField('name', e.target.value)} icon={User} placeholder="Seu nome" />
                                <Input label="E-mail" value={form.email} onChange={e => updateField('email', e.target.value)} icon={Mail} type="email" placeholder="seu@email.com" />
                                <Input label="Telefone" value={form.phone} onChange={e => updateField('phone', e.target.value)} icon={Phone} placeholder="(00) 00000-0000" />
                            </div>
                        </Card>

                        {/* Seleção de Cursos Acadêmicos */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-accent-blue-light" />
                                Cursos em que você leciona
                            </h3>
                            <p className="text-xs text-text-secondary mb-4">
                                Busque e selecione os cursos. Isso habilitará a seleção de matérias.
                            </p>

                            {/* Tags dos cursos selecionados */}
                            {academicCourses.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {academicCourses.map(name => (
                                        <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
                                            {name}
                                            <button type="button" onClick={() => toggleAcademicCourse(name)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-purple/20 transition-colors cursor-pointer">
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <Input
                                    placeholder="Digite o nome do curso para buscar..."
                                    icon={Search}
                                    value={courseSearch}
                                    onChange={e => setCourseSearch(e.target.value)}
                                    onFocus={() => setShowCourseDropdown(true)}
                                />

                                {showCourseDropdown && (
                                    <div className="fixed inset-0 z-40" onClick={() => setShowCourseDropdown(false)} />
                                )}

                                {showCourseDropdown && courseSearch && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-border-subtle bg-white/95 shadow-card-hover backdrop-blur-xl custom-scrollbar"
                                    >
                                        {AVAILABLE_COURSES
                                            .filter(c => c.toLowerCase().includes(courseSearch.toLowerCase()))
                                            .filter(c => !academicCourses.includes(c))
                                            .map((course, i) => (
                                                <button
                                                    key={i} type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleAcademicCourse(course); setCourseSearch(''); setShowCourseDropdown(false); }}
                                                    className="w-full text-left px-5 py-3.5 text-sm text-text-primary hover:bg-accent-purple/20 hover:text-white transition-all border-b border-border-subtle/20 last:border-0 flex items-center justify-between group"
                                                >
                                                    <span>{course}</span>
                                                    <div className="w-5 h-5 rounded-lg bg-accent-purple/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <CheckCircle className="w-3 h-3 text-accent-purple" />
                                                    </div>
                                                </button>
                                            ))}
                                        {AVAILABLE_COURSES.filter(c => c.toLowerCase().includes(courseSearch.toLowerCase())).filter(c => !academicCourses.includes(c)).length === 0 && (
                                            <div className="px-6 py-6 text-center">
                                                <BookOpen className="w-8 h-8 mx-auto mb-2 text-text-secondary/20" />
                                                <p className="text-xs text-text-secondary italic">Nenhum curso encontrado</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </Card>

                        {/* Seleção de Disciplinas */}
                        {academicCourses.length > 0 && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-accent-blue-light" />
                                    Disciplinas específicas
                                </h3>
                                <p className="text-xs text-text-secondary mb-4">
                                    Matérias disponíveis nos cursos selecionados acima.
                                </p>

                                <div className="mb-3">
                                    <Input
                                        placeholder="Buscar disciplina..."
                                        icon={Search}
                                        value={subjectSearch}
                                        onChange={e => setSubjectSearch(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {availableSubjects
                                        .filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                                        .sort((a, b) => {
                                            const aSelected = selectedSubjectIds.has(a.name) ? -1 : 0;
                                            const bSelected = selectedSubjectIds.has(b.name) ? -1 : 0;
                                            if (aSelected !== bSelected) return aSelected - bSelected;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(subject => (
                                            <label
                                                key={subject.name}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-200 ${selectedSubjectIds.has(subject.name)
                                                    ? 'border-accent-blue/40 bg-accent-blue/8'
                                                    : 'border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated/60'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSubjectIds.has(subject.name)}
                                                    onChange={() => toggleSubject(subject.name)}
                                                    className="w-4 h-4 rounded accent-accent-blue"
                                                />
                                                <div>
                                                    <span className="text-sm text-text-primary">{subject.name}</span>
                                                    {subject.code && <span className="text-xs text-text-secondary ml-2">({subject.code})</span>}
                                                </div>
                                            </label>
                                        ))}
                                    {availableSubjects.filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())).length === 0 && (
                                        <p className="text-xs text-text-secondary italic p-4 text-center glass-card">
                                            {subjectSearch ? 'Nenhuma disciplina encontrada.' : 'Nenhuma disciplina disponível.'}
                                        </p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/* Alerts */}
                        {error && (
                            <motion.div className="bg-accent-rose/10 border border-accent-rose/20 text-accent-rose p-4 rounded-xl flex items-center gap-3 text-sm" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </motion.div>
                        )}
                        {success && (
                            <motion.div className="bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald p-4 rounded-xl flex items-center gap-3 text-sm" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                <CheckCircle className="w-5 h-5" />
                                {success}
                            </motion.div>
                        )}

                        <div className="flex justify-end">
                            <Button type="submit" loading={saving} icon={Save} className="px-8 py-3 bg-accent-purple hover:bg-accent-purple-light">
                                Salvar Alterações
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Lado Direito: Resumo */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-accent-blue-light" />
                                Minhas Disciplinas
                            </h3>
                            <span className="text-xs font-bold text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full">
                                {courses.length}
                            </span>
                        </div>
                        <div className="space-y-2 mb-6">
                            {courses.length > 0 ? (
                                courses.slice(0, 5).map((course, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-bg-elevated/30 text-xs">
                                        <span className="text-text-secondary truncate pr-2">{course.name}</span>
                                        <span className="text-gray-500 font-mono flex-shrink-0">{course.code}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-text-secondary italic">Nenhuma disciplina selecionada</p>
                            )}
                            {courses.length > 5 && (
                                <p className="text-[10px] text-center text-gray-500">e mais {courses.length - 5} outras...</p>
                            )}
                        </div>
                        <Link to={coursesRoute}>
                            <Button variant="outline" className="w-full text-xs py-2 flex items-center justify-center gap-2 group">
                                Gerenciar Disciplinas
                                <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-accent-purple/10 to-accent-blue/10 border-accent-purple/20">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-white/5">
                                <GraduationCap className="w-5 h-5 text-accent-purple-light" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Status da Conta</h4>
                                <p className="text-xs text-text-secondary mt-1">Sua conta de professor está ativa e aprovada.</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                                    <span className="text-[10px] font-bold text-accent-emerald uppercase">Ativo</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
}
