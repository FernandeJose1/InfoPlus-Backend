const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Inicializar Firebase Admin
function initializeFirebase() {
  try {
    // Verificar se já está inicializado
    if (admin.apps.length > 0) {
      return admin.app();
    }

    console.log('🔍 Inicializando Firebase...');

    // Tentar carregar do arquivo service-account-key.json primeiro
    const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account-key.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('✅ Usando service account do arquivo JSON');
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
      });
    } else {
      console.log('⚠️  Arquivo service-account-key.json não encontrado, usando variáveis de ambiente');
      
      // Debug: Verificar se as variáveis de ambiente estão sendo carregadas
      console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Presente' : 'Ausente');
      console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'Presente' : 'Ausente');
      
      if (process.env.FIREBASE_PRIVATE_KEY) {
        console.log('FIREBASE_PRIVATE_KEY length:', process.env.FIREBASE_PRIVATE_KEY.length);
        console.log('FIREBASE_PRIVATE_KEY starts with:', process.env.FIREBASE_PRIVATE_KEY.substring(0, 20));
      } else {
        console.log('FIREBASE_PRIVATE_KEY: Ausente');
      }

      // Usar service account das variáveis de ambiente
      const serviceAccount = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };

      // Verificar se a chave privada está completa
      if (!serviceAccount.private_key || !serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Chave privada do Firebase está incompleta ou mal formatada. Verifique o arquivo .env');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
      });
    }

    console.log('✅ Firebase Admin inicializado com sucesso');
    return admin;

  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
    console.error('Stack:', error.stack);
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