export const ACADEMIC_COURSE_FALLBACK = [
    'Administracao',
    'Agronomia',
    'Analise e Desenvolvimento de Sistemas',
    'Arquitetura e Urbanismo',
    'Biomedicina',
    'Ciencias Contabeis',
    'Comunicacao Social: Publicidade e Propaganda',
    'Design Grafico',
    'Direito',
    'Educacao Fisica',
    'Enfermagem',
    'Engenharia Civil',
    'Engenharia de Software',
    'Engenharia Eletrica',
    'Engenharia Mecanica',
    'Estetica e Cosmetica',
    'Farmacia',
    'Fisioterapia',
    'Gastronomia',
    'Inteligencia Artificial',
    'Medicina',
    'Medicina Veterinaria',
    'Nutricao',
    'Odontologia',
    'Psicologia',
    'Relacoes Internacionais',
];

function normalizeCourseName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function dedupeAcademicCourses(values) {
    const uniqueValues = new Map();

    values.forEach((value) => {
        const cleaned = String(value || '').trim();
        const normalized = normalizeCourseName(cleaned);

        if (!cleaned || !normalized || uniqueValues.has(normalized)) {
            return;
        }

        uniqueValues.set(normalized, cleaned);
    });

    return Array.from(uniqueValues.values()).sort((left, right) => (
        left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
    ));
}

export async function fetchAcademicCourses(api) {
    try {
        const response = await api.get('/courses/academic-courses');
        const values = Array.isArray(response.data) ? response.data : [];
        const merged = dedupeAcademicCourses([...values, ...ACADEMIC_COURSE_FALLBACK]);

        if (merged.length > 0) {
            return merged;
        }
    } catch (error) {
        console.error('Erro ao carregar cursos academicos', error);
    }

    return dedupeAcademicCourses(ACADEMIC_COURSE_FALLBACK);
}
