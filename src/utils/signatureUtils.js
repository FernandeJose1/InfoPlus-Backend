const crypto = require('crypto');

// Gerar assinatura HMAC-SHA256 em HEX (COMPATÍVEL com Flutter)
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  return hmac.update(payload).digest('hex'); // Sempre retorna HEX
}

// Verificar assinatura do webhook com suporte a HEX e base64
function verifyWebhookSignature(req) {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;

  if (!signature) {
    throw new Error('Assinatura não encontrada nos headers');
  }

  if (!secret) {
    throw new Error('Segredo do webhook não configurado');
  }

  // Verificar timestamp para prevenir replay attacks
  if (timestamp) {
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    const timeDifference = Math.abs(currentTime - requestTime);
    
    if (timeDifference > 5 * 60 * 1000) { // 5 minutos
      throw new Error('Timestamp inválido - possível replay attack');
    }
  }

  const payload = JSON.stringify(req.body);
  const calculatedSignature = generateSignature(payload, secret);

  console.log('🔍 Webhook Signature Debug:', {
    received: signature,
    calculated: calculatedSignature,
    length: {
      received: signature.length,
      calculated: calculatedSignature.length
    },
    timestamp: timestamp || 'none'
  });

  // Verificar se a assinatura recebida é HEX (64 caracteres) ou base64
  const isHexSignature = signature.length === 64 && /^[0-9a-fA-F]+$/.test(signature);
  
  if (isHexSignature) {
    // Comparação segura para HEX
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(calculatedSignature, 'utf8')
    )) {
      throw new Error('Assinatura HEX inválida');
    }
  } else {
    // Tentar comparar como base64 (para backward compatibility)
    try {
      const calculatedBase64 = Buffer.from(calculatedSignature, 'hex').toString('base64');
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedBase64)
      )) {
        throw new Error('Assinatura base64 inválida');
      }
    } catch (error) {
      throw new Error('Formato de assinatura não reconhecido');
    }
  }

  return true;
}

// Validar payload do webhook
function validateWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload inválido ou vazio');
  }

  if (!payload.event) {
    throw new Error('Evento não especificado no payload');
  }

  if (!payload.data) {
    throw new Error('Dados não especificados no payload');
  }

  const validEvents = [
    'payment.success',
    'payment.failed',
    'payment.cancelled',
    'payment.expired',
    'payment.pending'
  ];

  if (!validEvents.includes(payload.event)) {
    throw new Error(`Evento inválido: ${payload.event}`);
  }

  const { data } = payload;
  
  if (!data.reference) {
    throw new Error('Referência não encontrada nos dados');
  }

  if (payload.event === 'payment.success') {
    if (!data.amount || !data.transaction_id) {
      throw new Error('Dados incompletos para pagamento bem-sucedido');
    }
  }

  return true;
}

// Gerar assinatura para request de saída (compatível com Flutter)
function generateRequestSignature(payload, secret) {
  const timestamp = Date.now().toString();
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = generateSignature(payloadString + timestamp, secret);
  
  return {
    signature,
    timestamp
  };
}

module.exports = {
  generateSignature,
  verifyWebhookSignature,
  validateWebhookPayload,
  generateRequestSignature
};