const Parse = require('parse/node');
const { initializeFirebase } = require('../src/config/firebaseConfig');
const paymentController = require('../src/controllers/paymentController');
const { verifyToken } = require('../src/middleware/authMiddleware');

// Inicializar Firebase
initializeFirebase();

// Health check da Cloud Function
Parse.Cloud.define("health", async () => {
  return { 
    status: "ok", 
    timestamp: new Date(),
    service: "InfoPlus Back4App Cloud",
    version: "1.0.0"
  };
});

// Criar pagamento via Cloud Function
Parse.Cloud.define("createPayment", async (request) => {
  try {
    const { amount, phoneNumber, operator, currency, token } = request.params;

    if (!token) {
      throw new Error("Token de autenticação é obrigatório");
    }

    // Simular request object para o middleware
    const mockRequest = {
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        amount,
        phoneNumber,
        operator,
        currency
      }
    };

    const mockResponse = {
      status: (code) => ({
        json: (data) => {
          if (code >= 400) {
            throw new Error(data.error || "Erro ao processar pagamento");
          }
          return data;
        }
      })
    };

    // Verificar token
    await new Promise((resolve, reject) => {
      verifyToken(mockRequest, mockResponse, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // Criar pagamento
    const result = await paymentController.createPayment(
      mockRequest.user.uid,
      mockRequest.body
    );

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error("❌ Erro em createPayment:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao criar pagamento"
    );
  }
});

// Obter status do pagamento
Parse.Cloud.define("getPaymentStatus", async (request) => {
  try {
    const { reference, token } = request.params;

    if (!token) {
      throw new Error("Token de autenticação é obrigatório");
    }

    const payment = await paymentController.getPaymentStatus(reference);
    
    return {
      success: true,
      data: payment
    };

  } catch (error) {
    console.error("❌ Erro em getPaymentStatus:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao buscar status do pagamento"
    );
  }
});

// Listar pagamentos do usuário
Parse.Cloud.define("getUserPayments", async (request) => {
  try {
    const { userId, limit = 20, page = 1, token } = request.params;

    if (!token) {
      throw new Error("Token de autenticação é obrigatório");
    }

    const payments = await paymentController.getUserPayments(
      userId,
      parseInt(limit),
      parseInt(page)
    );

    return {
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: payments.length,
        hasMore: payments.length === parseInt(limit)
      }
    };

  } catch (error) {
    console.error("❌ Erro em getUserPayments:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao buscar pagamentos"
    );
  }
});

// Webhook handler para Back4App
Parse.Cloud.define("processWebhook", async (request) => {
  try {
    const { payload, signature, timestamp } = request.params;

    // Simular request object
    const mockRequest = {
      headers: {
        'x-webhook-signature': signature,
        'x-webhook-timestamp': timestamp
      },
      body: payload
    };

    // Processar webhook
    await paymentController.handlePaymentWebhook(payload);

    return {
      success: true,
      message: "Webhook processado com sucesso"
    };

  } catch (error) {
    console.error("❌ Erro em processWebhook:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao processar webhook"
    );
  }
});

// Cancelar pagamento
Parse.Cloud.define("cancelPayment", async (request) => {
  try {
    const { reference, token } = request.params;

    if (!token) {
      throw new Error("Token de autenticação é obrigatório");
    }

    const result = await paymentController.cancelPayment(reference);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error("❌ Erro em cancelPayment:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao cancelar pagamento"
    );
  }
});

// Estatísticas do sistema
Parse.Cloud.define("getStats", async () => {
  try {
    const db = require('firebase-admin').firestore();
    
    const [
      totalPayments,
      completedPayments,
      totalUsers
    ] = await Promise.all([
      db.collection('payments').count().get(),
      db.collection('payments').where('status', '==', 'completed').count().get(),
      db.collection('users').count().get()
    ]);

    return {
      success: true,
      data: {
        totalPayments: totalPayments.data().count,
        completedPayments: completedPayments.data().count,
        totalUsers: totalUsers.data().count,
        successRate: totalPayments.data().count > 0 
          ? (completedPayments.data().count / totalPayments.data().count) * 100 
          : 0
      }
    };

  } catch (error) {
    console.error("❌ Erro em getStats:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao buscar estatísticas"
    );
  }
});

// Buscar usuário por ID
Parse.Cloud.define("getUser", async (request) => {
  try {
    const { userId, token } = request.params;

    if (!token) {
      throw new Error("Token de autenticação é obrigatório");
    }

    const db = require('firebase-admin').firestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new Error("Usuário não encontrado");
    }

    return {
      success: true,
      data: {
        id: userDoc.id,
        ...userDoc.data()
      }
    };

  } catch (error) {
    console.error("❌ Erro em getUser:", error);
    throw new Parse.Error(
      Parse.Error.SCRIPT_FAILED,
      error.message || "Erro ao buscar usuário"
    );
  }
});

console.log('✅ Cloud Functions do Back4App carregadas com sucesso');