import re


def _parse_numeric(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    cleaned = re.sub(r'[^0-9,.-]', '', text)
    if cleaned.count(',') > 1 and '.' not in cleaned:
        cleaned = cleaned.replace(',', '')
    cleaned = cleaned.replace(',', '.')
    if cleaned in {'', '-', '.', '-.'}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def resolve_attendance_percentage(percentual_presenca, total_faltas=None, total_aulas=None):
    direct = _parse_numeric(percentual_presenca)
    absences = _parse_numeric(total_faltas)
    classes = _parse_numeric(total_aulas)

    derived = None
    if classes is not None and classes > 0 and absences is not None:
        derived = max(0.0, min(100.0, ((classes - absences) / classes) * 100.0))

    if direct is None:
        return round(derived, 2) if derived is not None else None

    direct = max(0.0, min(100.0, direct))
    if derived is not None and direct == 0.0 and absences < classes:
        return round(derived, 2)

    return round(direct, 2)
