const admin = require('firebase-admin');

// Middleware para verificar token JWT
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Token de acesso necessário',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Token malformado',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Erro na verificação do token:', error.message);
    
    let statusCode = 401;
    let errorMessage = 'Token inválido';
    let errorCode = 'INVALID_TOKEN';

    switch (error.code) {
      case 'auth/id-token-expired':
        errorMessage = 'Token expirado';
        errorCode = 'TOKEN_EXPIRED';
        break;
      case 'auth/argument-error':
        errorMessage = 'Token malformado';
        errorCode = 'MALFORMED_TOKEN';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Usuário desativado';
        errorCode = 'USER_DISABLED';
        statusCode = 403;
        break;
      default:
        errorMessage = 'Falha na autenticação';
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
}

// Middleware para verificar se usuário é admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.admin) {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }
  next();
}

// Middleware para verificar se usuário tem acesso ao recurso
function requireUserAccess(paramName = 'userId') {
  return (req, res, next) => {
    const requestedUserId = req.params[paramName];
    
    if (req.user.uid !== requestedUserId && !req.user.admin) {
      return res.status(403).json({
        error: 'Acesso não autorizado a este recurso',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }
    next();
  };
}

// Middleware para logging de autenticação
function authLogger(req, res, next) {
  console.log('🔐 Tentativa de autenticação:', {
    path: req.path,
    method: req.method,
    hasToken: !!req.headers.authorization,
    userId: req.user?.uid,
    timestamp: new Date().toISOString()
  });
  next();
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireUserAccess,
  authLogger
};