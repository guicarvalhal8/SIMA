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

export async function fetchAcademicCourses(api) {
    try {
        const response = await api.get('/courses/academic-courses');
        const values = Array.isArray(response.data) ? response.data : [];
        const cleaned = values
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        if (cleaned.length > 0) {
            return [...new Set(cleaned)].sort((left, right) => left.localeCompare(right));
        }
    } catch (error) {
        console.error('Erro ao carregar cursos academicos', error);
    }

    return ACADEMIC_COURSE_FALLBACK;
}
