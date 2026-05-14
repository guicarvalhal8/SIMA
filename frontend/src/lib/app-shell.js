import {
    Activity,
    BookOpen,
    BrainCircuit,
    GraduationCap,
    LayoutDashboard,
    Lightbulb,
    ScrollText,
    Shield,
    Sparkles,
    TrendingUp,
    UserCircle2,
    Users,
} from 'lucide-react';

const ROLE_META = {
    admin: {
        label: 'Pro-Reitor',
        area: 'Supervisao academica ampliada',
        shortLabel: 'Pro-Reitoria',
        accent: 'from-accent-blue-dark via-accent-blue to-accent-purple',
        softAccent: 'from-accent-blue-dark/8 via-accent-blue/10 to-accent-purple/14',
        badge: 'bg-accent-blue-dark/10 text-accent-blue-dark border-accent-blue/15',
        dot: 'bg-accent-blue-dark',
        home: '/proreitor/dashboard',
    },
    viewer: {
        label: 'Institucional',
        area: 'Consulta executiva',
        shortLabel: 'Consulta',
        accent: 'from-accent-blue-dark via-accent-blue to-accent-purple',
        softAccent: 'from-accent-blue-dark/8 via-accent-blue/10 to-accent-purple/14',
        badge: 'bg-accent-blue-dark/10 text-accent-blue-dark border-accent-blue/15',
        dot: 'bg-accent-blue-dark',
        home: '/',
    },
    coordinator: {
        label: 'Coordenador',
        area: 'Gestao de curso',
        shortLabel: 'Coordenacao',
        accent: 'from-accent-purple via-accent-purple-light to-accent-blue',
        softAccent: 'from-accent-purple/10 via-accent-purple-light/10 to-accent-blue/12',
        badge: 'bg-accent-purple/10 text-accent-purple border-accent-purple/15',
        dot: 'bg-accent-purple',
        home: '/coordinator/dashboard',
    },
    professor: {
        label: 'Professor',
        area: 'Acompanhamento de turmas',
        shortLabel: 'Docencia',
        accent: 'from-accent-indigo via-accent-purple to-accent-blue',
        softAccent: 'from-accent-indigo/10 via-accent-purple/10 to-accent-blue/12',
        badge: 'bg-accent-indigo/10 text-accent-indigo border-accent-indigo/15',
        dot: 'bg-accent-indigo',
        home: '/professor/dashboard',
    },
    student: {
        label: 'Aluno',
        area: 'Jornada academica',
        shortLabel: 'Aluno',
        accent: 'from-accent-blue via-accent-blue-light to-accent-cyan',
        softAccent: 'from-accent-blue/10 via-accent-blue-light/10 to-accent-cyan/12',
        badge: 'bg-accent-blue/10 text-accent-blue border-accent-blue/15',
        dot: 'bg-accent-blue',
        home: '/student/dashboard',
    },
};

const NAV_BY_ROLE = {
    admin: [
        { icon: Activity, label: 'Dashboard pro-reitoria', description: 'Alertas criticos, turmas e alunos em risco', to: '/proreitor/dashboard' },
        { icon: BookOpen, label: 'Disciplinas acompanhadas', description: 'Componentes, turmas e alunos vinculados', to: '/proreitor/courses' },
        { icon: ScrollText, label: 'Subir planilhas', description: 'Upload, normalizacao e leitura historica', to: '/proreitor/historical-data' },
        { icon: BrainCircuit, label: 'Analises academicas', description: 'Cinco recortes para leitura profunda', to: '/proreitor/analysis-center' },
        { icon: UserCircle2, label: 'Meu perfil', description: 'Dados, cursos e configuracoes da pro-reitoria', to: '/proreitor/profile' },
    ],
    viewer: [
        { icon: LayoutDashboard, label: 'Visao institucional', description: 'KPIs globais e mapa de risco', to: '/' },
        { icon: Users, label: 'Base academica', description: 'Corpo discente monitorado', to: '/students' },
        { icon: TrendingUp, label: 'Indicadores globais', description: 'Analises e desempenho agregado', to: '/analytics' },
    ],
    coordinator: [
        { icon: Shield, label: 'Painel do curso', description: 'Predicoes, tendencias e alertas', to: '/coordinator/dashboard' },
        { icon: BrainCircuit, label: 'Central analitica', description: 'Leitura ampliada do curso e intervencoes', to: '/coordinator/analysis-center' },
        { icon: Users, label: 'Alunos do curso', description: 'Busca e acompanhamento da base', to: '/students' },
        { icon: TrendingUp, label: 'Relatorios analiticos', description: 'Estatisticas e comparativos', to: '/analytics' },
        { icon: BrainCircuit, label: 'Predicoes por turma', description: 'Risco academico por segmento', to: '/predictions' },
        { icon: Lightbulb, label: 'Plano de acao', description: 'Recomendacoes operacionais', to: '/recommendations' },
        { icon: Sparkles, label: 'Insights de IA', description: 'Leituras sinteticas para decisao', to: '/ai-insights' },
    ],
    professor: [
        { icon: Activity, label: 'Dashboard docente', description: 'Alertas criticos, turmas e alunos em risco', to: '/professor/dashboard' },
        { icon: BookOpen, label: 'Disciplinas matriculadas', description: 'Componentes, turmas e alunos vinculados', to: '/professor/courses' },
        { icon: ScrollText, label: 'Subir planilhas', description: 'Upload, normalizacao e leitura historica', to: '/professor/historical-data' },
        { icon: BrainCircuit, label: 'Analises academicas', description: 'Cinco recortes para leitura profunda', to: '/professor/analysis-center' },
        { icon: UserCircle2, label: 'Meu perfil', description: 'Dados docentes e cursos vinculados', to: '/professor/profile' },
    ],
    student: [
        { icon: GraduationCap, label: 'Meu painel', description: 'Desempenho, risco e proximos passos', to: '/student/dashboard' },
        { icon: UserCircle2, label: 'Meu perfil', description: 'Dados pessoais, academicos e Lyceum', to: '/student/profile' },
    ],
};

function normalizeRole(role) {
    return String(role || 'viewer').toLowerCase();
}

export function getRoleMeta(role) {
    const normalizedRole = normalizeRole(role);
    return ROLE_META[normalizedRole] || ROLE_META.viewer;
}

export function getDefaultRoute(role) {
    return getRoleMeta(role).home;
}

export function getNavItems(role) {
    const normalizedRole = normalizeRole(role);
    return NAV_BY_ROLE[normalizedRole] || NAV_BY_ROLE.viewer;
}

export function getRoleRoutePrefix(role) {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === 'admin') return '/proreitor';
    if (normalizedRole === 'professor') return '/professor';
    if (normalizedRole === 'coordinator') return '/coordinator';
    if (normalizedRole === 'student') return '/student';
    return '';
}

export function buildRolePath(role, subpath = '') {
    const prefix = getRoleRoutePrefix(role);
    if (!prefix) return subpath || '/';
    const cleanSubpath = String(subpath || '').replace(/^\/+/, '');
    return cleanSubpath ? `${prefix}/${cleanSubpath}` : prefix;
}

export function isProfessorLikeRole(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'professor' || normalizedRole === 'admin';
}

export function getInitials(name) {
    if (!name) {
        return 'NX';
    }

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'NX';
}

export function getPageMeta(pathname, role) {
    const items = getNavItems(role);
    const sortedItems = [...items].sort((left, right) => right.to.length - left.to.length);
    const match = sortedItems.find((item) => (
        item.to === '/'
            ? pathname === '/'
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
    ));

    if (match) {
        return match;
    }

    return {
        label: 'Painel',
        description: getRoleMeta(role).area,
        icon: LayoutDashboard,
        to: getDefaultRoute(role),
    };
}
