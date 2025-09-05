const { validateOperator, validatePhoneNumber, validateAmount } = require('./paymentUtils');

// Validar dados de pagamento (ATUALIZADO para usar funções do paymentUtils)
function validatePaymentData(paymentData) {
  const errors = [];

  if (!paymentData.amount || typeof paymentData.amount !== 'number' || paymentData.amount <= 0) {
    errors.push('Valor do pagamento inválido');
  } else {
    try {
      validateAmount(paymentData.amount);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (!paymentData.phoneNumber || typeof paymentData.phoneNumber !== 'string') {
    errors.push('Número de telefone é obrigatório');
  } else if (!validatePhoneNumber(paymentData.phoneNumber)) {
    errors.push('Número de telefone inválido');
  }

  if (!paymentData.operator || typeof paymentData.operator !== 'string') {
    errors.push('Operadora é obrigatória');
  } else if (!validateOperator(paymentData.operator)) {
    errors.push('Operadora inválida');
  }

  if (errors.length > 0) {
    throw new Error(`Dados de pagamento inválidos: ${errors.join(', ')}`);
  }

  return true;
}

// Validar dados do usuário
function validateUserData(userData) {
  const errors = [];

  if (!userData.email || !isValidEmail(userData.email)) {
    errors.push('Email inválido');
  }

  if (!userData.phoneNumber || typeof userData.phoneNumber !== 'string') {
    errors.push('Número de telefone é obrigatório');
  } else if (!validatePhoneNumber(userData.phoneNumber)) {
    errors.push('Número de telefone inválido');
  }

  if (errors.length > 0) {
    throw new Error(`Dados de usuário inválidos: ${errors.join(', ')}`);
  }

  return true;
}

// Validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validar URL
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validar timestamp
function isValidTimestamp(timestamp) {
  return !isNaN(new Date(timestamp).getTime());
}

// Sanitizar dados de entrada
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
}

// Validar limites numéricos
function validateNumberLimits(value, min, max, fieldName) {
  if (value < min || value > max) {
    throw new Error(`${fieldName} deve estar entre ${min} e ${max}`);
  }
  return true;
}

// Validar array não vazio
function validateNonEmptyArray(array, fieldName) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error(`${fieldName} deve ser um array não vazio`);
  }
  return true;
}

// Validar dados de pagamento simplificados (para criação automática)
function validateBasicPaymentData(paymentData) {
  const errors = [];

  if (!paymentData.amount || typeof paymentData.amount !== 'number' || paymentData.amount <= 0) {
    errors.push('Valor do pagamento inválido');
  } else {
    try {
      validateAmount(paymentData.amount);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (!paymentData.phoneNumber || typeof paymentData.phoneNumber !== 'string') {
    errors.push('Número de telefone é obrigatório');
  } else if (!validatePhoneNumber(paymentData.phoneNumber)) {
    errors.push('Número de telefone inválido');
  }

  if (errors.length > 0) {
    throw new Error(`Dados de pagamento inválidos: ${errors.join(', ')}`);
  }

  return true;
}

module.exports = {
  validatePaymentData,
  validateUserData,
  validateBasicPaymentData,
  isValidEmail,
  isValidUrl,
  isValidTimestamp,
  sanitizeInput,
  validateNumberLimits,
  validateNonEmptyArray
};