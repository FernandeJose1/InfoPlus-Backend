require('dotenv').config();
const { initializeFirebase, checkFirebaseConnection } = require('./config/firebaseConfig');

// Verificar variáveis de ambiente críticas
const requiredEnvVars = [
  'PAYSUITE_API_KEY',
  'PAYSUITE_WEBHOOK_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Variáveis de ambiente ausentes:', missingEnvVars.join(', '));
  process.exit(1);
}

// Inicializar Firebase
try {
  initializeFirebase();
  console.log('🔥 Firebase inicializado');
} catch (error) {
  console.error('❌ Falha ao inicializar Firebase:', error);
  process.exit(1);
}

// Verificar conexão com Firebase
async function startupChecks() {
  try {
    const isConnected = await checkFirebaseConnection();
    if (!isConnected) {
      throw new Error('Falha na conexão com Firebase');
    }
    
    console.log('✅ Conexão com Firebase verificada');
    
    // Iniciar servidor após verificações
    const server = require('./server');
    
  } catch (error) {
    console.error('❌ Falha nas verificações de startup:', error);
    process.exit(1);
  }
}

// Executar verificações de startup
startupChecks();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT. Desligando graciosamente...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM. Desligando graciosamente...');
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promise rejeitada não tratada:', reason);
  process.exit(1);
});