const axios = require('axios');
const { generateRequestSignature } = require('./signatureUtils');

// Criar requisição de pagamento na PaySuite (formato compatível com Flutter)
async function createPaymentRequest(paymentData) {
  try {
    const apiKey = process.env.PAYSUITE_API_KEY;
    const baseUrl = process.env.PAYSUITE_BASE_URL || "https://paysuite.tech/api/v1";

    if (!apiKey) {
      throw new Error('Chave API da PaySuite não configurada');
    }

    // PAYLOAD COMPATÍVEL com Flutter
    const payload = {
      amount: paymentData.amount.toString(),
      reference: paymentData.reference,
      description: paymentData.description || 'Pagamento Infoplus',
      callback_url: process.env.PAYSUITE_CALLBACK_URL || `${process.env.APP_URL}/webhook/paysuite`,
      method: paymentData.operator, // Campo 'method' (compatível com Flutter)
      phone_number: paymentData.phone, // Campo 'phone_number' (compatível com Flutter)
      currency: paymentData.currency || 'MZN'
    };

    console.log('📤 PaySuite Request Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(`${baseUrl}/payments`, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': paymentData.reference,
        'User-Agent': 'InfoPlus-Backend/1.0.0'
      },
      timeout: parseInt(process.env.PAYSUITE_TIMEOUT) || 30000
    });

    console.log('📥 PaySuite Response:', {
      status: response.status,
      data: response.data
    });

    if (response.data.status !== 'success') {
      throw new Error(`PaySuite API error: ${response.data.message || 'Unknown error'}`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ Erro na requisição para PaySuite:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });
    
    if (error.response) {
      const errorMessage = error.response.data?.message || error.response.statusText;
      const errorCode = error.response.data?.code || 'PAYSUITE_API_ERROR';
      throw new Error(`PaySuite API: ${errorMessage} (${errorCode})`);
    } else if (error.request) {
      throw new Error('Falha na conexão com PaySuite - timeout ou rede indisponível');
    } else {
      throw new Error(`Erro na configuração: ${error.message}`);
    }
  }
}

// Verificar status de pagamento na PaySuite
async function checkPaymentStatus(paymentId) {
  try {
    const apiKey = process.env.PAYSUITE_API_KEY;
    const baseUrl = process.env.PAYSUITE_BASE_URL;

    if (!apiKey) {
      throw new Error('Chave API da PaySuite não configurada');
    }

    const response = await axios.get(`${baseUrl}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'InfoPlus-Backend/1.0.0'
      },
      timeout: 15000
    });

    if (response.data.status !== 'success') {
      throw new Error(`PaySuite status check failed: ${response.data.message}`);
    }

    return response.data.data;

  } catch (error) {
    console.error('❌ Erro ao verificar status na PaySuite:', {
      message: error.message,
      response: error.response?.data,
      paymentId: paymentId
    });
    
    throw new Error(`Falha ao verificar status: ${error.response?.data?.message || error.message}`);
  }
}

// Calcular pontos baseado no valor do pagamento (compatível com Flutter)
function calculatePoints(amount, currency = 'MZN') {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (amountNum >= 3.0) return 6;
  if (amountNum >= 2.0) return 4;
  if (amountNum >= 1.0) return 1;
  return 0;
}

// Validar operadora de telefone
function validateOperator(operator) {
  const validOperators = ['mcel', 'vodacom', 'movitel', 'tmcel', 'mpesa', 'emola'];
  return validOperators.includes(operator.toLowerCase());
}

// Validar número de telefone (formato moçambicano)
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  
  const phoneRegex = /^(\+258|258)?8[2-7][0-9]{7}$/;
  const cleanedPhone = phone.replace(/\s/g, '');
  return phoneRegex.test(cleanedPhone);
}

// Formatar número de telefone para formato internacional (compatível com Flutter)
function formatPhoneNumber(phone) {
  if (!phone) throw new Error('Número de telefone não fornecido');
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('258')) {
    return digits;
  }
  
  if (digits.length === 9) {
    return `258${digits}`;
  }
  
  if (digits.length > 9) {
    return `258${digits.substring(digits.length - 9)}`;
  }
  
  throw new Error('Número de telefone inválido');
}

// Detectar operadora pelo prefixo do número (compatível com Flutter)
function detectOperator(phoneNumber) {
  if (!phoneNumber) throw new Error('Número de telefone não fornecido');
  
  const digits = phoneNumber.replace(/\D/g, '');
  const local = digits.startsWith('258') ? digits.substring(3) : digits;
  
  if (local.length < 2) {
    throw new Error('Número de telefone muito curto');
  }
  
  const prefix = local.substring(0, 2);
  
  const operatorPrefixes = {
    '82': 'vodacom', // MCel
    '83': 'vodacom', // MCel
    '84': 'mpesa',   // Vodacom M-Pesa
    '85': 'mpesa',   // Vodacom M-Pesa
    '86': 'emola',   // Movitel E-Mola
    '87': 'emola',   // Movitel E-Mola
  };
  
  const operator = operatorPrefixes[prefix];
  if (!operator) {
    throw new Error(`Operadora não suportada para prefixo ${prefix}`);
  }
  
  return operator;
}

// Gerar referência única para pagamento
function generatePaymentReference(prefix = 'INF') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}${timestamp}${random}`.substring(0, 20);
}

// Formatar valor para exibição
function formatAmount(amount, currency = 'MZN') {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

// Validar se o valor do pagamento está dentro dos limites
function validateAmount(amount) {
  const minAmount = 1.0;
  const maxAmount = 10000.0;
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (amountNum < minAmount) {
    throw new Error(`Valor mínimo é ${formatAmount(minAmount)}`);
  }
  
  if (amountNum > maxAmount) {
    throw new Error(`Valor máximo é ${formatAmount(maxAmount)}`);
  }
  
  return true;
}

module.exports = {
  createPaymentRequest,
  checkPaymentStatus,
  calculatePoints,
  validateOperator,
  validatePhoneNumber,
  formatPhoneNumber,
  detectOperator,
  generatePaymentReference,
  formatAmount,
  validateAmount
};