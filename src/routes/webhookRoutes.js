const express = require('express');
const { verifyWebhookSignature, validateWebhookPayload } = require('../utils/signatureUtils');
const { handlePaymentWebhook } = require('../controllers/paymentController');

const router = express.Router();

// Middleware para log de webhooks
router.use('/paysuite', (req, res, next) => {
  console.log('📩 Webhook recebido:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    headers: {
      signature: req.headers['x-webhook-signature'],
      timestamp: req.headers['x-webhook-timestamp']
    }
  });
  next();
});

// Middleware para verificar assinatura do webhook
router.use('/paysuite', (req, res, next) => {
  try {
    verifyWebhookSignature(req);
    validateWebhookPayload(req.body);
    next();
  } catch (error) {
    console.error('❌ Erro na verificação de webhook:', error.message);
    
    // Log do webhook inválido
    const db = require('firebase-admin').firestore();
    db.collection('webhook_logs').doc().set({
      type: 'invalid_signature',
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      timestamp: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      error: error.message
    });

    return res.status(401).json({ 
      error: 'Webhook inválido',
      message: error.message
    });
  }
});

// Webhook principal da PaySuite
router.post('/paysuite', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('✅ Webhook válido recebido:', {
      event,
      reference: data?.reference,
      timestamp: new Date().toISOString()
    });

    // Log do webhook recebido
    const db = require('firebase-admin').firestore();
    await db.collection('webhook_logs').doc().set({
      type: 'received',
      event,
      reference: data?.reference,
      headers: req.headers,
      body: req.body,
      received_at: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      status: 'processing'
    });

    await handlePaymentWebhook(req.body);

    // Atualizar log como processado
    await db.collection('webhook_logs').doc().set({
      type: 'processed',
      event,
      reference: data?.reference,
      processed_at: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      status: 'success'
    }, { merge: true });

    res.status(200).json({ 
      status: 'success', 
      message: 'Webhook processado com sucesso',
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    
    // Log do erro
    const db = require('firebase-admin').firestore();
    await db.collection('webhook_logs').doc().set({
      type: 'error',
      event: req.body.event,
      reference: req.body.data?.reference,
      error: error.message,
      stack: error.stack,
      processed_at: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      status: 'failed'
    }, { merge: true });

    res.status(500).json({ 
      error: 'Erro ao processar webhook',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para testar webhook (apenas desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  router.post('/test', (req, res) => {
    console.log('🧪 Webhook de teste recebido:', {
      body: req.body,
      headers: req.headers,
      ip: req.ip
    });
    
    res.json({ 
      message: 'Webhook de teste recebido',
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  });

  // Rota para testar assinatura
  router.post('/test-signature', (req, res) => {
    try {
      const { generateSignature } = require('../utils/signatureUtils');
      const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
      const payload = req.body;
      
      const signature = generateSignature(JSON.stringify(payload), secret);
      
      res.json({
        signature,
        secret: secret ? '***' + secret.slice(-4) : 'not set',
        payload
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
}

// Health check para webhooks
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Webhook Processor',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

module.exports = router;