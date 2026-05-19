import re
import unicodedata


def clean_subject_name(value: str | None) -> str:
    text = str(value or '').replace('\xa0', ' ')
    text = ' '.join(text.split())
    text = re.sub(r'\s+ver\s+detalhes\s*$', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*-+\s*$', '', text)
    return text.strip()


def normalize_subject_key(value: str | None) -> str:
    cleaned = clean_subject_name(value)
    normalized = unicodedata.normalize('NFKD', cleaned)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    return ' '.join(ascii_text.lower().strip().split())
