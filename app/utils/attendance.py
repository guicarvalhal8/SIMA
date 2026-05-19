import math
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


def resolve_total_classes(total_aulas=None, total_faltas=None, percentual_presenca=None):
    classes = _parse_numeric(total_aulas)
    absences = _parse_numeric(total_faltas)
    attendance = _parse_numeric(percentual_presenca)

    if classes is not None and classes > 0:
        return int(round(classes))

    if absences is None or attendance is None:
        return None

    attendance = max(0.0, min(100.0, attendance))
    if attendance >= 100.0:
        return 0 if absences and absences > 0 else None

    absence_ratio = 1 - (attendance / 100.0)
    if absence_ratio <= 0:
        return None

    inferred = absences / absence_ratio
    if not math.isfinite(inferred) or inferred <= 0:
        return None

    return max(int(round(inferred)), int(absences))


def resolve_attendance_percentage(percentual_presenca, total_faltas=None, total_aulas=None):
    direct = _parse_numeric(percentual_presenca)
    absences = _parse_numeric(total_faltas)
    classes = resolve_total_classes(total_aulas, total_faltas, percentual_presenca)

    derived = None
    if classes is not None and classes > 0 and absences is not None:
        derived = max(0.0, min(100.0, ((classes - absences) / classes) * 100.0))

    if direct is None:
        return round(derived, 2) if derived is not None else None

    direct = max(0.0, min(100.0, direct))
    if derived is not None and (direct == 0.0 or abs(direct - derived) > 25):
        return round(derived, 2)

    return round(direct, 2)
