import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    User, Mail, Phone, Hash, BookOpen, Calendar,
    Briefcase, Save, CheckCircle, AlertCircle,
    UserCircle, Lock
} from 'lucide-react';

export function StudentProfile() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        age: '',
        gender: '',
        cpf: '',
        registration_number: '',
        course_name: '',
        current_period: '',
        class_schedule: '',
        is_working: false,
        work_schedule: '',
        lyceum_password: '',
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/students/me');
                const data = res.data;
                setForm({
                    name: data.name || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    age: data.age || '',
                    gender: data.gender || '',
                    cpf: data.cpf || '',
                    registration_number: data.registration_number || '',
                    course_name: data.course_name || '',
                    current_period: data.current_period || '',
                    class_schedule: data.class_schedule || '',
                    is_working: data.is_working || false,
                    work_schedule: data.work_schedule || '',
                    lyceum_password: '', // Não mostramos a senha por segurança
                });
            } catch (err) {
                setError('Erro ao carregar perfil');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = { ...form };
            // Remover campos vazios ou não alteráveis se necessário
            if (!payload.lyceum_password) delete payload.lyceum_password;

            await api.patch('/students/me', payload);
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
                <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
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
                subtitle="Gerencie suas informações pessoais e acadêmicas"
                icon={UserCircle}
            />

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Pessoais */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                        <User className="w-5 h-5 text-accent-blue" />
                        Informações Pessoais
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Input
                            label="Nome Completo"
                            value={form.name}
                            onChange={e => updateField('name', e.target.value)}
                            icon={User}
                            placeholder="Seu nome completo"
                        />
                        <Input
                            label="E-mail"
                            value={form.email}
                            onChange={e => updateField('email', e.target.value)}
                            icon={Mail}
                            type="email"
                            placeholder="seu@email.com"
                        />
                        <Input
                            label="CPF (Somente leitura)"
                            value={form.cpf}
                            icon={Hash}
                            disabled
                            className="opacity-60"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Telefone"
                                value={form.phone}
                                onChange={e => updateField('phone', e.target.value)}
                                icon={Phone}
                                placeholder="(00) 00000-0000"
                            />
                            <Input
                                label="Idade"
                                type="number"
                                value={form.age}
                                onChange={e => updateField('age', e.target.value)}
                                placeholder="18"
                            />
                        </div>
                    </div>
                </Card>

                {/* Dados Acadêmicos */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-accent-emerald" />
                        Informações Acadêmicas
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Input
                            label="Matrícula (Somente leitura)"
                            value={form.registration_number}
                            icon={Hash}
                            disabled
                            className="opacity-60"
                        />
                        <Input
                            label="Curso (Somente leitura)"
                            value={form.course_name}
                            icon={BookOpen}
                            disabled
                            className="opacity-60"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Período (Somente leitura)"
                                value={form.current_period}
                                icon={Hash}
                                disabled
                                className="opacity-60"
                            />
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Turno</label>
                                <select
                                    value={form.class_schedule}
                                    onChange={e => updateField('class_schedule', e.target.value)}
                                    className="w-full rounded-2xl border border-border-subtle bg-white px-4 py-3 text-sm text-text-primary shadow-sm shadow-slate-900/[0.02] transition-colors focus:border-accent-blue/35 focus:outline-none focus:ring-4 focus:ring-accent-blue/10 [&>option]:bg-white [&>option]:text-text-primary"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="MORNING">Matutino</option>
                                    <option value="INTEGRAL">Integral</option>
                                    <option value="NIGHT">Noturno</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Trabalho */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-accent-amber" />
                        Situação Profissional
                    </h3>

                    <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={form.is_working}
                                onChange={e => updateField('is_working', e.target.checked)}
                                className="w-5 h-5 rounded border-border-subtle bg-bg-elevated accent-accent-blue"
                            />
                            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                                Trabalho atualmente
                            </span>
                        </label>

                        {form.is_working && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                            >
                                <Input
                                    label="Horário de Trabalho"
                                    value={form.work_schedule}
                                    onChange={e => updateField('work_schedule', e.target.value)}
                                    icon={Calendar}
                                    placeholder="Ex: 08:00 às 17:00"
                                />
                            </motion.div>
                        )}
                    </div>
                </Card>

                {/* Lyceum */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-accent-rose" />
                        Sincronização Lyceum
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">
                        Altere sua senha do portal acadêmico se você a modificou. Se não alterou, deixe em branco para usar a senha padrão (CPF).
                    </p>
                    <Input
                        label="Nova Senha do Portal"
                        type="password"
                        value={form.lyceum_password}
                        onChange={e => updateField('lyceum_password', e.target.value)}
                        icon={Lock}
                        placeholder="••••••••"
                    />
                </Card>

                {/* Alerts */}
                {error && (
                    <motion.div
                        className="bg-accent-rose/10 border border-accent-rose/20 text-accent-rose p-4 rounded-xl flex items-center gap-3 text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        className="bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald p-4 rounded-xl flex items-center gap-3 text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <CheckCircle className="w-5 h-5" />
                        {success}
                    </motion.div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <Button
                        type="submit"
                        loading={saving}
                        icon={Save}
                        className="px-8 py-3"
                    >
                        Salvar Alterações
                    </Button>
                </div>
            </form>
        </motion.div>
    );
}
