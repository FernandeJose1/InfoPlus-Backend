const admin = require('firebase-admin');
const { sendPushNotification } = require('../utils/notificationUtils');
const { validatePaymentData } = require('../utils/validationUtils');
const ParseService = require('../services/parseService');
const { 
  createPaymentRequest, 
  calculatePoints, 
  validateOperator, 
  validatePhoneNumber,
  formatPhoneNumber,
  detectOperator,
  generatePaymentReference,
  validateAmount
} = require('../utils/paymentUtils');

// Handler principal para webhooks de pagamento
async function handlePaymentWebhook(payload) {
  const { event, data } = payload;
  const reference = data?.reference;

  if (!reference) {
    throw new Error('Referência não encontrada no webhook');
  }

  console.log(`🔄 Processando evento: ${event} para referência: ${reference}`);

  try {
    // Validar payload do webhook
    if (!['payment.success', 'payment.failed', 'payment.cancelled', 'payment.expired'].includes(event)) {
      throw new Error(`Evento não suportado: ${event}`);
    }

    switch (event) {
      case 'payment.success':
        await handlePaymentSuccess(data, reference);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(data, reference);
        break;
      
      case 'payment.cancelled':
        await handlePaymentCancelled(data, reference);
        break;
      
      case 'payment.expired':
        await handlePaymentExpired(data, reference);
        break;
      
      default:
        console.log(`⚠️  Evento não tratado: ${event}`);
        await logUnhandledEvent(payload);
    }

    console.log(`✅ Evento ${event} processado com sucesso para ${reference}`);

  } catch (error) {
    console.error(`❌ Erro ao processar evento ${event}:`, error);
    throw error;
  }
}

// Criar novo pagamento
async function createPayment(userId, paymentData) {
  try {
    // Validar dados do pagamento usando a função atualizada
    validatePaymentData(paymentData);

    const db = admin.firestore();
    
    // Gerar referência única se não fornecida
    const reference = paymentData.reference || generatePaymentReference();
    
    const paymentRef = db.collection('payments').doc(reference);

    // Verificar se referência já existe
    const existingPayment = await paymentRef.get();
    if (existingPayment.exists) {
      throw new Error('Referência de pagamento já existe');
    }

    // Validar operadora
    if (!validateOperator(paymentData.operator)) {
      throw new Error('Operadora inválida');
    }

    // Validar número de telefone
    if (!validatePhoneNumber(paymentData.phoneNumber)) {
      throw new Error('Número de telefone inválido');
    }

    // Validar valor
    validateAmount(paymentData.amount);

    // Calcular pontos usando a nova função
    const pointsEarned = calculatePoints(paymentData.amount);

    // Formatar número de telefone
    const formattedPhone = formatPhoneNumber(paymentData.phoneNumber);

    const paymentRecord = {
      userId: userId,
      amount: paymentData.amount,
      currency: paymentData.currency || 'MZN',
      operator: paymentData.operator,
      phoneNumber: formattedPhone,
      transactionId: reference,
      status: 'pending',
      pointsEarned: pointsEarned,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      metadata: paymentData.metadata || {}
    };

    // ✅ SALVAR EM AMBOS: FIREBASE E BACK4APP
    await paymentRef.set(paymentRecord);
    
    try {
      await ParseService.savePayment(paymentRecord);
      console.log(`✅ Pagamento ${reference} salvo no Back4App`);
    } catch (error) {
      console.warn('⚠️  Aviso: Erro ao salvar no Back4App (não crítico):', error.message);
    }

    // Iniciar pagamento na PaySuite
    const paymentResult = await createPaymentRequest({
      amount: paymentData.amount,
      phone: formattedPhone,
      reference: reference,
      operator: paymentData.operator,
      userId: userId,
      pointsEarned: pointsEarned
    });

    console.log(`✅ Pagamento criado: ${reference}`);

    return {
      success: true,
      reference: reference,
      paymentUrl: paymentResult.payment_url,
      pointsEarned: pointsEarned
    };

  } catch (error) {
    console.error('❌ Erro ao criar pagamento:', error);
    throw error;
  }
}

// Detectar operadora automaticamente pelo número
async function createPaymentWithAutoDetect(userId, paymentData) {
  try {
    // Validar dados básicos
    if (!paymentData.amount || !paymentData.phoneNumber) {
      throw new Error('Valor e número de telefone são obrigatórios');
    }

    // Validar número de telefone
    if (!validatePhoneNumber(paymentData.phoneNumber)) {
      throw new Error('Número de telefone inválido');
    }

    // Detectar operadora automaticamente
    const operator = detectOperator(paymentData.phoneNumber);
    
    // Criar dados de pagamento com operadora detectada
    const enhancedPaymentData = {
      ...paymentData,
      operator: operator
    };

    return await createPayment(userId, enhancedPaymentData);

  } catch (error) {
    console.error('❌ Erro ao criar pagamento com detecção automática:', error);
    throw error;
  }
}

// Handler para pagamento bem-sucedido
async function handlePaymentSuccess(data, reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);

  const paymentDoc = await paymentRef.get();
  if (!paymentDoc.exists) {
    throw new Error(`Pagamento não encontrado: ${reference}`);
  }

  const paymentData = paymentDoc.data();
  if (paymentData.status === 'completed') {
    console.log(`ℹ️  Pagamento já estava completo: ${reference}`);
    return;
  }

  const updateData = {
    status: 'completed',
    confirmed_at: admin.firestore.FieldValue.serverTimestamp(),
    paysuite_id: data.id,
    transaction_id: data.transaction_id,
    raw_message: JSON.stringify(data),
    error_message: null,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };

  await paymentRef.update(updateData);

  // ✅ ATUALIZAR NO BACK4APP TAMBÉM
  try {
    await ParseService.updatePaymentStatus(reference, 'completed', {
      paysuiteId: data.id,
      transactionId: data.transaction_id,
      confirmedAt: new Date()
    });
    console.log(`✅ Pagamento ${reference} atualizado no Back4App`);
  } catch (error) {
    console.warn('⚠️  Aviso: Erro ao atualizar Back4App (não crítico):', error.message);
  }

  // Adicionar pontos ao usuário se aplicável
  const pointsEarned = paymentData.pointsEarned || 0;
  const userId = paymentData.userId;

  if (userId && pointsEarned > 0) {
    await addUserPoints(userId, pointsEarned, reference);
    await createPointsRecord(userId, pointsEarned, reference);
    
    // ✅ ATUALIZAR PONTOS NO BACK4APP
    try {
      await ParseService.updateUserPoints(userId, pointsEarned);
      await ParseService.savePointsRecord({
        userId: userId,
        points: pointsEarned,
        origin: 'payment',
        paymentReference: reference,
        description: `Pontos ganhos por pagamento ${reference}`
      });
      console.log(`✅ Pontos do usuário ${userId} atualizados no Back4App`);
    } catch (error) {
      console.warn('⚠️  Aviso: Erro ao atualizar pontos no Back4App:', error.message);
    }
  }

  // Enviar notificação push
  await sendPushNotification(userId, {
    title: 'Pagamento Confirmado! 🎉',
    body: `Seu pagamento de ${data.amount} MT foi confirmado. Você ganhou ${pointsEarned} pontos!`,
    type: 'payment_success',
    reference: reference
  });

  console.log(`✅ Pagamento confirmado: ${reference}, Pontos: ${pointsEarned}`);
}

// Handler para pagamento falho
async function handlePaymentFailed(data, reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);

  await paymentRef.update({
    status: 'failed',
    error_message: data.error_message || 'Pagamento falhou',
    raw_message: JSON.stringify(data),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // ✅ ATUALIZAR NO BACK4APP
  try {
    await ParseService.updatePaymentStatus(reference, 'failed', {
      errorMessage: data.error_message || 'Pagamento falhou',
      failedAt: new Date()
    });
  } catch (error) {
    console.warn('⚠️  Aviso: Erro ao atualizar Back4App:', error.message);
  }

  const paymentDoc = await paymentRef.get();
  const paymentData = paymentDoc.data();
  const userId = paymentData.userId;

  await sendPushNotification(userId, {
    title: 'Pagamento Falhou ❌',
    body: 'Seu pagamento não foi processado. Por favor, tente novamente.',
    type: 'payment_failed',
    reference: reference
  });

  console.log(`❌ Pagamento falhou: ${reference}`);
}

// Handler para pagamento cancelado
async function handlePaymentCancelled(data, reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);

  await paymentRef.update({
    status: 'cancelled',
    cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
    raw_message: JSON.stringify(data),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // ✅ ATUALIZAR NO BACK4APP
  try {
    await ParseService.updatePaymentStatus(reference, 'cancelled', {
      cancelledAt: new Date()
    });
  } catch (error) {
    console.warn('⚠️  Aviso: Erro ao atualizar Back4App:', error.message);
  }

  const paymentDoc = await paymentRef.get();
  const paymentData = paymentDoc.data();
  const userId = paymentData.userId;

  await sendPushNotification(userId, {
    title: 'Pagamento Cancelado ⏹️',
    body: 'Seu pagamento foi cancelado.',
    type: 'payment_cancelled',
    reference: reference
  });

  console.log(`⏹️  Pagamento cancelado: ${reference}`);
}

// Handler para pagamento expirado
async function handlePaymentExpired(data, reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);

  await paymentRef.update({
    status: 'expired',
    error_message: 'Pagamento expirado',
    raw_message: JSON.stringify(data),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // ✅ ATUALIZAR NO BACK4APP
  try {
    await ParseService.updatePaymentStatus(reference, 'expired', {
      errorMessage: 'Pagamento expirado',
      expiredAt: new Date()
    });
  } catch (error) {
    console.warn('⚠️  Aviso: Erro ao atualizar Back4App:', error.message);
  }

  const paymentDoc = await paymentRef.get();
  const paymentData = paymentDoc.data();
  const userId = paymentData.userId;

  await sendPushNotification(userId, {
    title: 'Pagamento Expirado ⌛',
    body: 'Seu pagamento expirou. Por favor, inicie um novo pagamento.',
    type: 'payment_expired',
    reference: reference
  });

  console.log(`⌛ Pagamento expirado: ${reference}`);
}

// Adicionar pontos ao usuário
async function addUserPoints(userId, points, reference) {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);

  try {
    await userRef.update({
      points: admin.firestore.FieldValue.increment(points),
      total_points_earned: admin.firestore.FieldValue.increment(points),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`⭐ ${points} pontos adicionados para usuário ${userId}`);

  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    throw new Error(`Falha ao adicionar pontos: ${error.message}`);
  }
}

// Criar registro de pontos
async function createPointsRecord(userId, points, reference) {
  const db = admin.firestore();
  const pointsRef = db.collection('points_records').doc(reference);

  try {
    await pointsRef.set({
      userId: userId,
      points: points,
      origin: 'payment',
      paymentReference: reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      description: `Pontos ganhos por pagamento ${reference}`
    });

  } catch (error) {
    console.error('Erro ao criar registro de pontos:', error);
  }
}

// Log de evento não tratado
async function logUnhandledEvent(payload) {
  const db = admin.firestore();
  const logRef = db.collection('webhook_logs').doc();

  await logRef.set({
    event: payload.event,
    data: payload.data,
    received_at: admin.firestore.FieldValue.serverTimestamp(),
    processed: false,
    notes: 'Evento não tratado'
  });
}

// Obter status de pagamento
async function getPaymentStatus(reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);
  const paymentDoc = await paymentRef.get();

  if (!paymentDoc.exists) {
    throw new Error('Pagamento não encontrado');
  }

  const paymentData = paymentDoc.data();
  
  return {
    status: paymentData.status,
    amount: paymentData.amount,
    reference: paymentData.transactionId,
    created_at: paymentData.timestamp,
    confirmed_at: paymentData.confirmed_at,
    cancelled_at: paymentData.cancelled_at,
    error_message: paymentData.error_message,
    operator: paymentData.operator,
    points_earned: paymentData.pointsEarned || 0
  };
}

// Obter pagamentos do usuário
async function getUserPayments(userId, limit = 20, page = 1) {
  try {
    // ✅ TENTAR PRIMEIRO NO BACK4APP
    try {
      const parsePayments = await ParseService.getUserPayments(userId, limit, page - 1);
      if (parsePayments && parsePayments.length > 0) {
        console.log(`✅ Pagamentos recuperados do Back4App para usuário ${userId}`);
        return parsePayments;
      }
    } catch (error) {
      console.warn('⚠️  Fallback para Firebase - Erro no Back4App:', error.message);
    }
    
    // Fallback para Firebase
    const db = admin.firestore();
    const offset = (page - 1) * limit;

    const paymentsRef = db.collection('payments')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset);

    const snapshot = await paymentsRef.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
        confirmed_at: data.confirmed_at?.toDate(),
        cancelled_at: data.cancelled_at?.toDate()
      };
    });

  } catch (error) {
    console.error('❌ Erro ao buscar pagamentos:', error);
    throw error;
  }
}

// Cancelar pagamento
async function cancelPayment(reference) {
  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(reference);
  const paymentDoc = await paymentRef.get();

  if (!paymentDoc.exists) {
    throw new Error('Pagamento não encontrado');
  }

  const paymentData = paymentDoc.data();
  
  if (['completed', 'cancelled', 'failed'].includes(paymentData.status)) {
    throw new Error(`Pagamento já está ${paymentData.status}`);
  }

  await paymentRef.update({
    status: 'cancelled',
    cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // ✅ ATUALIZAR NO BACK4APP
  try {
    await ParseService.updatePaymentStatus(reference, 'cancelled', {
      cancelledAt: new Date()
    });
  } catch (error) {
    console.warn('⚠️  Aviso: Erro ao atualizar Back4App:', error.message);
  }

  return { success: true, reference };
}

module.exports = {
  handlePaymentWebhook,
  createPayment,
  createPaymentWithAutoDetect,
  handlePaymentSuccess,
  handlePaymentFailed,
  handlePaymentCancelled,
  handlePaymentExpired,
  getPaymentStatus,
  getUserPayments,
  cancelPayment
};