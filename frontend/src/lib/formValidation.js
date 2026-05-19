export function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function digitsOnly(value, maxLength = null) {
    const digits = String(value || '').replace(/\D/g, '');
    return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
}

export function isValidEmail(value) {
    const normalized = normalizeEmail(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidPhone(value) {
    const digits = digitsOnly(value, 11);
    return digits.length === 10 || digits.length === 11;
}

export function isValidCpf(value) {
    const cpf = digitsOnly(value, 11);

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    let sum = 0;
    for (let index = 0; index < 9; index += 1) {
        sum += Number(cpf[index]) * (10 - index);
    }
    let checkDigit = (sum * 10) % 11;
    if (checkDigit === 10) {
        checkDigit = 0;
    }
    if (checkDigit !== Number(cpf[9])) {
        return false;
    }

    sum = 0;
    for (let index = 0; index < 10; index += 1) {
        sum += Number(cpf[index]) * (11 - index);
    }
    checkDigit = (sum * 10) % 11;
    if (checkDigit === 10) {
        checkDigit = 0;
    }

    return checkDigit === Number(cpf[10]);
}

