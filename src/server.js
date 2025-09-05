require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const webhookRoutes = require('./routes/webhookRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { initializeFirebase } = require('./config/firebaseConfig');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Firebase
try {
  initializeFirebase();
  console.log('🔥 Firebase inicializado com sucesso');
} catch (error) {
  console.error('❌ Falha ao inicializar Firebase:', error);
  process.exit(1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requests por windowMs
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Rotas
app.use('/webhook', webhookRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'InfoPlus Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    message: 'InfoPlus Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook/paysuite',
      payments: '/api/payments'
    },
    documentation: 'Ver documentação para detalhes'
  });
});

// Middleware de erro
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/paysuite`);
  console.log(`💳 API Payments: http://localhost:${PORT}/api/payments`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT. Desligando graciosamente...');
  server.close(() => {
    console.log('✅ Servidor fechado');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM. Desligando graciosamente...');
  server.close(() => {
    console.log('✅ Servidor fechado');
    process.exit(0);
  });
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

module.exports = app;