const admin = require('firebase-admin');

// Inicializar Firebase Admin
function initializeFirebase() {
  try {
    // Verificar se já está inicializado
    if (admin.apps.length > 0) {
      return admin.app();
    }

    // Configuração para ambiente de produção
    if (process.env.NODE_ENV === 'production') {
      // Usar variáveis de ambiente em produção
      const serviceAccount = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });

    } else {
      // Desenvolvimento - usar service account do ambiente
      const serviceAccount = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    console.log('✅ Firebase Admin inicializado com sucesso');
    
    // Configurar logging do Firebase
    admin.firestore().settings({
      ignoreUndefinedProperties: true
    });

    return admin;

  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
    throw new Error('Falha na inicialização do Firebase: ' + error.message);
  }
}

// Obter instância do Firestore
function getFirestore() {
  return admin.firestore();
}

// Obter instância do Auth
function getAuth() {
  return admin.auth();
}

// Obter instância do Messaging
function getMessaging() {
  return admin.messaging();
}

// Obter instância do Storage
function getStorage() {
  return admin.storage();
}

// Verificar conexão com Firebase
async function checkFirebaseConnection() {
  try {
    const db = getFirestore();
    // Testar conexão com uma operação simples
    await db.collection('connection_test').doc('test').set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection('connection_test').doc('test').delete();
    return true;
  } catch (error) {
    console.error('❌ Falha na conexão com Firebase:', error);
    return false;
  }
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth,
  getMessaging,
  getStorage,
  checkFirebaseConnection,
  admin
};