require('dotenv').config();
const { initializeFirebase, checkFirebaseConnection } = require('./config/firebaseConfig');
const { initializeParse, testConnection } = require('./config/parseConfig');
const ParseService = require('./services/parseService');
// Verificar modo de operação
if (process.env.SERVER_MODE === 'cloud') {
  console.log('☁️  Modo Cloud Function - Iniciando Back4App');
  require('../cloud/main.js');
} else {
  console.log('🚀 Modo Express - Iniciando servidor tradicional');
  require('./server');
}

// Verificar variáveis de ambiente críticas
const requiredEnvVars = [
  'PAYSUITE_API_KEY',
  'PAYSUITE_WEBHOOK_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'PARSE_APP_ID',
  'PARSE_JS_KEY',
  'PARSE_SERVER_URL'
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

// Inicializar Parse/Back4App
try {
  initializeParse();
  console.log('📡 Parse/Back4App inicializado');
} catch (error) {
  console.error('❌ Falha ao inicializar Parse:', error);
  process.exit(1);
}

// Verificar conexões
async function startupChecks() {
  try {
    console.log('🔍 Verificando conexões...');
    
    const [firebaseConnected, parseConnected] = await Promise.all([
      checkFirebaseConnection(),
      testConnection()
    ]);
    
    if (!firebaseConnected) {
      throw new Error('Falha na conexão com Firebase');
    }
    
    if (!parseConnected) {
      console.warn('⚠️  Conexão com Back4App falhou, mas o sistema continuará em modo fallback');
    } else {
      // Inicializar classes do Back4App
      await ParseService.initializeClasses();
    }
    
    console.log('✅ Verificações de startup concluídas');
    
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