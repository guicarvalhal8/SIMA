import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    User, Lock, Mail, Phone, BookOpen, Hash,
    ArrowLeft, ArrowRight, CheckCircle, AlertCircle
} from 'lucide-react';

export function ProfessorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [courseSearch, setCourseSearch] = useState('');
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState('');
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [subjectsError, setSubjectsError] = useState('');

    // Mesma lista de cursos acadêmicos usada no cadastro de aluno
    const availableAcademicCourses = [
        "Administração",
        "Agronomia",
        "Análise e Desenvolvimento de Sistemas",
        "Arquitetura e Urbanismo",
        "Biomedicina",
        "Ciências Contábeis",
        "Comunicação Social: Publicidade e Propaganda",
        "Design Gráfico",
        "Direito",
        "Educação Física",
        "Enfermagem",
        "Engenharia Civil",
        "Engenharia de Software",
        "Engenharia Elétrica",
        "Engenharia Mecânica",
        "Estética e Cosmética",
        "Farmácia",
        "Fisioterapia",
        "Gastronomia",
        "Inteligência Artificial",
        "Medicina",
        "Medicina Veterinária",
        "Nutrição",
        "Odontologia",
        "Psicologia",
        "Relações Internacionais",
    ];

    const [form, setForm] = useState({
        registration_code: '',
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        phone: '',
        academic_courses: [],
        course_ids: [],
    });

    // Quando mudar os academic_courses, buscar as matérias específicas
    useEffect(() => {
        if (form.academic_courses.length > 0) {
            const names = form.academic_courses.join(',');
            setSubjectsLoading(true);
            setSubjectsError('');
            api.get(`/courses/by-academic-courses?names=${names}`)
                .then((res) => setAvailableSubjects(res.data))
                .catch((err) => {
                    setAvailableSubjects([]);
                    setSubjectsError(
                        err.response?.data?.detail ||
                        'Nao foi possivel carregar as disciplinas agora. Verifique se o backend esta em execucao.'
                    );
                })
                .finally(() => setSubjectsLoading(false));
        } else {
            setAvailableSubjects([]);
            setSubjectsLoading(false);
            setSubjectsError('');
            setForm(prev => ({ ...prev, course_ids: [] }));
        }
    }, [form.academic_courses]);

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const toggleAcademicCourse = (name) => {
        setForm(prev => {
            const current = prev.academic_courses;
            const next = current.includes(name)
                ? current.filter(c => c !== name)
                : [...current, name];
            return { ...prev, academic_courses: next };
        });
    };

    const toggleSubject = (subjectKey) => {
        setForm(prev => ({
            ...prev,
            course_ids: prev.course_ids.includes(subjectKey)
                ? prev.course_ids.filter(k => k !== subjectKey)
                : [...prev.course_ids, subjectKey],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.registration_code || form.registration_code.length !== 5) { setError('O código de matrícula deve ter exatamente 5 dígitos'); return; }
        if (!form.password || form.password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return; }
        if (form.password !== form.confirmPassword) { setError('As senhas não coincidem'); return; }
        if (!form.name || form.name.length < 2) { setError('Nome é obrigatório'); return; }
        if (!form.email) { setError('E-mail é obrigatório'); return; }

        setLoading(true);

        try {
            await api.post('/auth/register/professor', {
                registration_code: form.registration_code,
                password: form.password,
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                course_ids: form.course_ids,
                academic_course_names: form.academic_courses,
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
            <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
                <AnimatedBackground variant="login" />
                <motion.div
                    className="w-full max-w-md relative z-10 px-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="glass-card p-10 border-border-subtle text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        >
                            <CheckCircle className="w-20 h-20 text-accent-emerald mx-auto" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mt-6 text-text-primary">Cadastro Realizado!</h2>
                        <p className="text-text-secondary mt-3">
                            Seu cadastro de professor foi concluído com sucesso.
                            Faça login para acessar o sistema.
                        </p>
                        <div className="mt-4 p-3 rounded-xl bg-accent-emerald/8 border border-accent-emerald/20">
                            <p className="text-sm text-accent-emerald font-medium">
                                ✓ Conta ativada automaticamente
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="mt-8 w-full py-3"
                            icon={ArrowRight}
                        >
                            Ir para o Login
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
            <AnimatedBackground variant="login" />

            <motion.div
                className="w-full max-w-lg relative z-10 px-4"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="glass-card p-8 border-border-subtle">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple to-accent-rose flex items-center justify-center mx-auto">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold mt-4 gradient-text">Cadastro de Professor</h1>
                        <p className="text-sm text-text-secondary mt-1">
                            Informe seu código de matrícula institucional
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            className="bg-accent-rose/8 border border-accent-rose/20 text-accent-rose text-sm p-3 rounded-xl flex items-center gap-2 mb-5"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            label="Código de Matrícula"
                            placeholder="Ex: 20001 (5 dígitos)"
                            icon={Hash}
                            value={form.registration_code}
                            onChange={e => updateField('registration_code', e.target.value.replace(/\D/g, '').slice(0, 5))}
                            required
                            maxLength={5}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Senha"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                icon={Lock}
                                value={form.password}
                                onChange={e => updateField('password', e.target.value)}
                                required
                            />
                            <Input
                                label="Confirmar Senha"
                                type="password"
                                placeholder="Repita a senha"
                                icon={Lock}
                                value={form.confirmPassword}
                                onChange={e => updateField('confirmPassword', e.target.value)}
                                required
                            />
                        </div>
                        <Input
                            label="Nome Completo"
                            placeholder="Seu nome completo"
                            icon={User}
                            value={form.name}
                            onChange={e => updateField('name', e.target.value)}
                            required
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            placeholder="professor@email.com"
                            icon={Mail}
                            value={form.email}
                            onChange={e => updateField('email', e.target.value)}
                            required
                        />
                        <Input
                            label="Telefone"
                            placeholder="(00) 00000-0000"
                            icon={Phone}
                            value={form.phone}
                            onChange={e => updateField('phone', e.target.value)}
                        />

                        {/* 1. Seleção de Cursos Acadêmicos (busca por digitação) */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Cursos em que você leciona
                            </label>

                            {/* Tags dos cursos selecionados */}
                            {form.academic_courses.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {form.academic_courses.map(name => (
                                        <span
                                            key={name}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-purple/15 text-accent-purple border border-accent-purple/20"
                                        >
                                            {name}
                                            <button
                                                type="button"
                                                onClick={() => toggleAcademicCourse(name)}
                                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-purple/20 transition-colors cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <Input
                                placeholder="Digite o nome do curso para buscar..."
                                icon={BookOpen}
                                value={courseSearch}
                                onChange={e => setCourseSearch(e.target.value)}
                                onFocus={() => setShowCourseDropdown(true)}
                            />

                            {/* Overlay para fechar */}
                            {showCourseDropdown && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowCourseDropdown(false)}
                                />
                            )}

                            {/* Dropdown de resultados */}
                            {showCourseDropdown && courseSearch && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-border-subtle bg-white/95 shadow-card-hover backdrop-blur-xl custom-scrollbar"
                                >
                                    {availableAcademicCourses
                                        .filter(c => c.toLowerCase().includes(courseSearch.toLowerCase()))
                                        .filter(c => !form.academic_courses.includes(c))
                                        .map((course, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleAcademicCourse(course);
                                                    setCourseSearch('');
                                                    setShowCourseDropdown(false);
                                                }}
                                                className="w-full text-left px-5 py-3.5 text-sm text-text-primary hover:bg-accent-purple/20 hover:text-white transition-all border-b border-border-subtle/20 last:border-0 flex items-center justify-between group"
                                            >
                                                <span>{course}</span>
                                                <div className="w-5 h-5 rounded-lg bg-accent-purple/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CheckCircle className="w-3 h-3 text-accent-purple" />
                                                </div>
                                            </button>
                                        ))}
                                    {availableAcademicCourses
                                        .filter(c => c.toLowerCase().includes(courseSearch.toLowerCase()))
                                        .filter(c => !form.academic_courses.includes(c))
                                        .length === 0 && (
                                            <div className="px-6 py-6 text-center">
                                                <BookOpen className="w-8 h-8 mx-auto mb-2 text-text-secondary/20" />
                                                <p className="text-xs text-text-secondary italic">
                                                    Nenhum curso encontrado
                                                </p>
                                            </div>
                                        )}
                                </motion.div>
                            )}
                        </div>

                        {/* 2. Seleção de Disciplinas Específicas */}
                        {form.academic_courses.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3"
                            >
                                <label className="block text-sm font-medium text-text-secondary">
                                    Disciplinas específicas
                                </label>
                                <p className="text-[10px] text-text-tertiary">
                                    Mostrando disciplinas relacionadas aos cursos selecionados. Se a base ainda estiver incompleta, o sistema usa o catálogo institucional como apoio.
                                </p>

                                {/* Campo de busca de disciplinas */}
                                <Input
                                    placeholder="Buscar disciplina..."
                                    icon={BookOpen}
                                    value={subjectSearch}
                                    onChange={e => setSubjectSearch(e.target.value)}
                                />

                                {subjectsError && (
                                    <p className="rounded-xl border border-warning/20 bg-warning/8 px-4 py-3 text-xs text-warning">
                                        {subjectsError}
                                    </p>
                                )}

                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {subjectsLoading && (
                                        <p className="text-xs text-text-secondary italic p-4 text-center glass-card">
                                            Carregando disciplinas...
                                        </p>
                                    )}
                                    {availableSubjects
                                        .filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                                        .sort((a, b) => {
                                            // Selecionados primeiro, depois correspondentes à busca
                                            const aKey = a.id ?? a.name;
                                            const bKey = b.id ?? b.name;
                                            const aSelected = form.course_ids.includes(aKey) ? -1 : 0;
                                            const bSelected = form.course_ids.includes(bKey) ? -1 : 0;
                                            if (aSelected !== bSelected) return aSelected - bSelected;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(subject => (
                                            <label
                                                key={subject.id ?? subject.name}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-200 ${form.course_ids.includes(subject.id ?? subject.name)
                                                    ? 'border-accent-blue/40 bg-accent-blue/8'
                                                    : 'border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated/60'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.course_ids.includes(subject.id ?? subject.name)}
                                                    onChange={() => toggleSubject(subject.id ?? subject.name)}
                                                    className="w-4 h-4 rounded accent-accent-blue"
                                                />
                                                <div>
                                                    <span className="text-sm text-text-primary">{subject.name}</span>
                                                    {subject.code && <span className="text-xs text-text-secondary ml-2">({subject.code})</span>}
                                                </div>
                                            </label>
                                        ))}
                                    {!subjectsLoading && availableSubjects.filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())).length === 0 && (
                                        <p className="text-xs text-text-secondary italic p-4 text-center glass-card">
                                            {subjectSearch ? 'Nenhuma disciplina encontrada para a busca.' : 'Nenhuma disciplina relacionada foi encontrada para estes cursos.'}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        <div className="flex items-center justify-between mt-4 gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/register')}
                                className="text-sm text-gray-500 hover:text-accent-blue transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Voltar
                            </button>
                            <Button type="submit" loading={loading} icon={CheckCircle} className="px-6">
                                Cadastrar
                            </Button>
                        </div>
                    </form>
                </div>
            </motion.div >
        </div >
    );
}
