const { Parse } = require('../config/parseConfig');

class ParseService {
  // Garantir que as classes existam
  static async initializeClasses() {
    try {
      const classesToCreate = ['Payment', 'User', 'PointsRecord', 'Notification'];
      
      for (const className of classesToCreate) {
        await require('../config/parseConfig').ensureClassExists(className);
      }
      
      console.log('✅ Classes do Back4App verificadas/criadas');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar classes:', error);
      return false;
    }
  }

  // Salvar pagamento no Back4App
  static async savePayment(paymentData) {
    try {
      const Payment = Parse.Object.extend('Payment');
      const payment = new Payment();
      
      // Mapear dados do pagamento
      payment.set('reference', paymentData.reference);
      payment.set('amount', paymentData.amount);
      payment.set('currency', paymentData.currency || 'MZN');
      payment.set('operator', paymentData.operator);
      payment.set('phoneNumber', paymentData.phoneNumber);
      payment.set('status', paymentData.status || 'pending');
      payment.set('pointsEarned', paymentData.pointsEarned || 0);
      payment.set('userId', paymentData.userId);
      payment.set('metadata', paymentData.metadata || {});
      
      if (paymentData.timestamp) {
        payment.set('createdAt', new Date(paymentData.timestamp.toDate()));
      } else {
        payment.set('createdAt', new Date());
      }
      
      await payment.save();
      console.log(`✅ Pagamento ${paymentData.reference} salvo no Back4App`);
      return payment;
    } catch (error) {
      console.error('❌ Erro ao salvar pagamento no Back4App:', error);
      throw error;
    }
  }

  // Atualizar status do pagamento
  static async updatePaymentStatus(reference, status, additionalData = {}) {
    try {
      const Payment = Parse.Object.extend('Payment');
      const query = new Parse.Query(Payment);
      query.equalTo('reference', reference);
      
      const payment = await query.first();
      if (payment) {
        payment.set('status', status);
        payment.set('updatedAt', new Date());
        
        // Adicionar dados adicionais
        Object.keys(additionalData).forEach(key => {
          if (additionalData[key] !== undefined) {
            payment.set(key, additionalData[key]);
          }
        });
        
        await payment.save();
        console.log(`✅ Status do pagamento ${reference} atualizado para: ${status}`);
        return payment;
      }
      
      console.warn(`⚠️  Pagamento ${reference} não encontrado no Back4App`);
      return null;
    } catch (error) {
      console.error('❌ Erro ao atualizar pagamento:', error);
      throw error;
    }
  }

  // Buscar pagamentos do usuário
  static async getUserPayments(userId, limit = 20, page = 0) {
    try {
      const Payment = Parse.Object.extend('Payment');
      const query = new Parse.Query(Payment);
      
      query.equalTo('userId', userId);
      query.descending('createdAt');
      query.limit(limit);
      query.skip(page * limit);
      
      const payments = await query.find();
      return payments.map(payment => ({
        id: payment.id,
        ...payment.toJSON(),
        createdAt: payment.get('createdAt'),
        updatedAt: payment.get('updatedAt')
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar pagamentos:', error);
      throw error;
    }
  }

  // Salvar usuário
  static async saveUser(userData) {
    try {
      const User = Parse.Object.extend('User');
      const user = new User();
      
      user.set('uid', userData.uid);
      user.set('email', userData.email || '');
      user.set('phoneNumber', userData.phoneNumber || '');
      user.set('points', userData.points || 0);
      user.set('totalPointsEarned', userData.totalPointsEarned || 0);
      user.set('fcmToken', userData.fcmToken || '');
      user.set('createdAt', new Date());
      
      await user.save();
      console.log(`✅ Usuário ${userData.uid} salvo no Back4App`);
      return user;
    } catch (error) {
      console.error('❌ Erro ao salvar usuário:', error);
      throw error;
    }
  }

  // Atualizar pontos do usuário
  static async updateUserPoints(userId, points) {
    try {
      const User = Parse.Object.extend('User');
      const query = new Parse.Query(User);
      query.equalTo('uid', userId);
      
      const user = await query.first();
      if (user) {
        user.increment('points', points);
        user.increment('totalPointsEarned', points);
        user.set('updatedAt', new Date());
        
        await user.save();
        console.log(`✅ Pontos do usuário ${userId} atualizados: +${points}`);
        return user;
      }
      
      console.warn(`⚠️  Usuário ${userId} não encontrado no Back4App`);
      return null;
    } catch (error) {
      console.error('❌ Erro ao atualizar pontos:', error);
      throw error;
    }
  }

  // Buscar usuário por ID
  static async getUser(userId) {
    try {
      const User = Parse.Object.extend('User');
      const query = new Parse.Query(User);
      query.equalTo('uid', userId);
      
      const user = await query.first();
      return user ? user.toJSON() : null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      throw error;
    }
  }

  // Salvar registro de pontos
  static async savePointsRecord(recordData) {
    try {
      const PointsRecord = Parse.Object.extend('PointsRecord');
      const record = new PointsRecord();
      
      record.set('userId', recordData.userId);
      record.set('points', recordData.points);
      record.set('origin', recordData.origin || 'payment');
      record.set('paymentReference', recordData.paymentReference || '');
      record.set('description', recordData.description || '');
      record.set('createdAt', new Date());
      
      await record.save();
      console.log(`✅ Registro de pontos salvo para usuário ${recordData.userId}`);
      return record;
    } catch (error) {
      console.error('❌ Erro ao salvar registro de pontos:', error);
      throw error;
    }
  }

  // Salvar notificação
  static async saveNotification(notificationData) {
    try {
      const Notification = Parse.Object.extend('Notification');
      const notification = new Notification();
      
      notification.set('userId', notificationData.userId);
      notification.set('title', notificationData.title);
      notification.set('body', notificationData.body);
      notification.set('type', notificationData.type);
      notification.set('reference', notificationData.reference || '');
      notification.set('status', notificationData.status || 'delivered');
      notification.set('sentAt', new Date());
      
      await notification.save();
      return notification;
    } catch (error) {
      console.error('❌ Erro ao salvar notificação:', error);
      throw error;
    }
  }

  // Obter estatísticas
  static async getStats() {
    try {
      const Payment = Parse.Object.extend('Payment');
      const query = new Parse.Query(Payment);
      
      const totalPayments = await query.count();
      const completedPayments = await query.equalTo('status', 'completed').count();
      
      return {
        totalPayments,
        completedPayments,
        successRate: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return { totalPayments: 0, completedPayments: 0, successRate: 0 };
    }
  }
}

module.exports = ParseService;