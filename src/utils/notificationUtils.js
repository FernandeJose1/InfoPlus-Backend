const admin = require('firebase-admin');

// Enviar notificação push
async function sendPushNotification(userId, notification) {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log(`Usuário ${userId} não encontrado`);
      return false;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`Usuário ${userId} não tem token FCM`);
      return false;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        type: notification.type || 'payment_notification',
        reference: notification.reference || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'payment_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notificação enviada para ${userId}: ${response}`);

    // Registrar notificação no banco de dados
    await db.collection('notifications').doc().set({
      userId: userId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      reference: notification.reference,
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'delivered',
      fcm_response: response
    });

    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    
    // Registrar falha
    const db = admin.firestore();
    await db.collection('notifications').doc().set({
      userId: userId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      reference: notification.reference,
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'failed',
      error: error.message
    });

    return false;
  }
}

// Enviar notificação para múltiplos usuários
async function sendBulkNotification(userIds, notification) {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, notification))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { successful, failed, total: userIds.length };
}

// Obter histórico de notificações
async function getNotificationHistory(userId, limit = 20) {
  const db = admin.firestore();
  const notificationsRef = db.collection('notifications')
    .where('userId', '==', userId)
    .orderBy('sent_at', 'desc')
    .limit(limit);

  const snapshot = await notificationsRef.get();
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    sent_at: doc.data().sent_at?.toDate()
  }));
}

// Enviar notificação transacional
async function sendTransactionalNotification(userId, type, data) {
  const notificationTemplates = {
    payment_success: {
      title: 'Pagamento Confirmado! 🎉',
      body: `Seu pagamento de ${data.amount} MT foi confirmado. Você ganhou ${data.points} pontos!`
    },
    payment_failed: {
      title: 'Pagamento Falhou ❌',
      body: 'Seu pagamento não foi processado. Por favor, tente novamente.'
    },
    points_earned: {
      title: 'Pontos Ganhos! ⭐',
      body: `Você ganhou ${data.points} pontos! Continue assim!`
    },
    welcome: {
      title: 'Bem-vindo ao InfoPlus! 👋',
      body: 'Sua conta foi criada com sucesso. Comece a ganhar pontos agora!'
    }
  };

  const template = notificationTemplates[type] || {
    title: 'InfoPlus 📱',
    body: 'Você tem uma nova notificação'
  };

  return await sendPushNotification(userId, {
    ...template,
    type: type,
    reference: data.reference || ''
  });
}

module.exports = {
  sendPushNotification,
  sendBulkNotification,
  getNotificationHistory,
  sendTransactionalNotification
};