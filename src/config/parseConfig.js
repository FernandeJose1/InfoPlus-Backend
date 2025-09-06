const Parse = require('parse/node');

// Inicializar Parse com Back4App
function initializeParse() {
  try {
    Parse.initialize(
      process.env.PARSE_APP_ID,
      process.env.PARSE_JS_KEY,
      process.env.PARSE_MASTER_KEY
    );
    Parse.serverURL = process.env.PARSE_SERVER_URL;
    
    // Configurações adicionais
    Parse.enableLocalDatastore();
    Parse.enableEncryptedUser();
    
    console.log('✅ Parse/Back4App inicializado com sucesso');
    return Parse;
  } catch (error) {
    console.error('❌ Erro ao inicializar Parse:', error);
    throw error;
  }
}

// Testar conexão
async function testConnection() {
  try {
    const Test = Parse.Object.extend('ConnectionTest');
    const test = new Test();
    test.set('testField', 'Connection successful');
    test.set('timestamp', new Date());
    await test.save();
    
    // Limpar teste
    await test.destroy();
    
    console.log('✅ Conexão com Back4App testada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha na conexão com Back4App:', error);
    return false;
  }
}

// Verificar se classe existe
async function checkClassExists(className) {
  try {
    const schema = await Parse.Schema.all();
    return schema.some(s => s.className === className);
  } catch (error) {
    console.warn(`⚠️  Não foi possível verificar classe ${className}:`, error.message);
    return false;
  }
}

// Criar classe se não existir
async function ensureClassExists(className, fields = {}) {
  try {
    const exists = await checkClassExists(className);
    if (!exists) {
      console.log(`📋 Criando classe ${className} no Back4App...`);
      // A classe será criada automaticamente no primeiro uso
    }
    return true;
  } catch (error) {
    console.warn(`⚠️  Erro ao verificar/criar classe ${className}:`, error.message);
    return false;
  }
}

module.exports = {
  initializeParse,
  testConnection,
  checkClassExists,
  ensureClassExists,
  Parse
};