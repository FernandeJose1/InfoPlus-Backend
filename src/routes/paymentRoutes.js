const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { 
  getPaymentStatus, 
  getUserPayments, 
  cancelPayment, 
  createPayment 
} = require('../controllers/paymentController');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(verifyToken);

// Criar novo pagamento
router.post('/create', async (req, res) => {
  try {
    const userId = req.user.uid;
    const paymentData = req.body;

    const result = await createPayment(userId, paymentData);
    
    res.status(201).json({
      success: true,
      message: 'Pagamento criado com sucesso',
      data: result
    });

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Obter status de um pagamento específico
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await getPaymentStatus(reference);
    
    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Erro ao buscar status do pagamento:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Listar pagamentos de um usuário
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar se usuário tem permissão
    if (req.user.uid !== userId && !req.user.admin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso não autorizado'
      });
    }

    const { limit = 20, page = 1 } = req.query;
    
    const payments = await getUserPayments(userId, parseInt(limit), parseInt(page));
    
    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: payments.length,
        hasMore: payments.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar pagamentos do usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar meus pagamentos (current user)
router.get('/my-payments', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 20, page = 1 } = req.query;
    
    const payments = await getUserPayments(userId, parseInt(limit), parseInt(page));
    
    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: payments.length,
        hasMore: payments.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancelar um pagamento
router.post('/:reference/cancel', async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await cancelPayment(reference);
    
    res.status(200).json({
      success: true,
      message: 'Pagamento cancelado com sucesso',
      data: result
    });

  } catch (error) {
    console.error('Erro ao cancelar pagamento:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// criar pagamentos
router.post('/create', verifyToken, async (req, res) => {
  try {
    const result = await createPayment(req.user.uid, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Health check específico para pagamentos
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Serviço de pagamentos está funcionando',
    timestamp: new Date().toISOString(),
    userId: req.user?.uid
  });
});

// Rota para simular webhook (apenas desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  router.post('/simulate-webhook', async (req, res) => {
    try {
      const { event, data } = req.body;
      
      // Simular processamento de webhook
      console.log('🧪 Simulando webhook:', { event, reference: data?.reference });
      
      // Aqui você pode adicionar lógica de simulação
      res.status(200).json({
        success: true,
        message: 'Webhook simulado',
        event,
        data
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = router;