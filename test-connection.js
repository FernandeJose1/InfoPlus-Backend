// test-connection.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initializeFirebase, checkFirebaseConnection } = require('./src/config/firebaseConfig');
const { initializeParse, testConnection } = require('./src/config/parseConfig');
const ParseService = require('./src/services/parseService');

// Função para corrigir a chave privada (converter quebras de linha reais para \n)
function fixPrivateKeyFormat(privateKey) {
  if (!privateKey) return privateKey;
  
  // Se já tem \n, não precisa fazer nada
  if (privateKey.includes('\\n')) {
    return privateKey.replace(/\\n/g, '\n');
  }
  
  // Se tem quebras de linha reais, converter para \n
  if (privateKey.includes('\n')) {
    console.log('⚠️  Convertendo quebras de linha reais para \\n na chave privada...');
    return privateKey.replace(/\n/g, '\\n');
  }
  
  return privateKey;
}

// Função para verificar formato da chave privada
function validatePrivateKeyFormat(privateKey) {
  if (!privateKey) {
    return { valid: false, error: 'Chave privada não fornecida' };
  }

  // Verificar se a chave tem os marcadores PEM
  const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
  const hasBeginRSA = privateKey.includes('-----BEGIN RSA PRIVATE KEY-----');
  const hasEndRSA = privateKey.includes('-----END RSA PRIVATE KEY-----');

  const validMarkers = (hasBeginMarker && hasEndMarker) || (hasBeginRSA && hasEndRSA);
  
  if (validMarkers) {
    return { valid: true };
  } else {
    return { 
      valid: false, 
      error: 'Chave privada não está no formato PEM válido. Verifique se inclui os marcadores BEGIN/END.' 
    };
  }
}

// Função para verificar se o arquivo .env está correto
function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verificar se a chave privada tem quebras de linha reais
  const hasRealNewlines = envContent.includes('FIREBASE_PRIVATE_KEY=') && 
                         envContent.includes('\n') && 
                         !envContent.includes('\\n');

  if (hasRealNewlines) {
    console.log('⚠️  AVISO: O arquivo .env contém quebras de linha reais na chave privada.');
    console.log('💡 Isso causará problemas com o Firebase Admin SDK.');
    console.log('💡 Solução: Substitua as quebras de linha reais por \\n');
    
    // Mostrar exemplo de como deveria ser
    console.log('\n📝 Exemplo correto:');
    console.log('FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
    
    return false;
  }

  return true;
}

// Função para verificar variáveis de ambiente
function checkEnvironmentVariables() {
  console.log('\n4. 🔧 Verificando variáveis de ambiente...');
  
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
  const results = {};

  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    results[varName] = {
      present: !!value,
      length: value ? value.length : 0,
      preview: value ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}` : 'N/A'
    };
  });

  // Verificação especial para a chave privada
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const fixedKey = fixPrivateKeyFormat(process.env.FIREBASE_PRIVATE_KEY);
    const keyValidation = validatePrivateKeyFormat(fixedKey);
    results.FIREBASE_PRIVATE_KEY.validFormat = keyValidation.valid;
    results.FIREBASE_PRIVATE_KEY.formatError = keyValidation.error;
    results.FIREBASE_PRIVATE_KEY.hasRealNewlines = process.env.FIREBASE_PRIVATE_KEY.includes('\n');
  }

  console.log('📋 Resultados das variáveis de ambiente:');
  Object.keys(results).forEach(key => {
    const result = results[key];
    const status = result.present ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${result.present ? `Presente (${result.length} chars)` : 'AUSENTE'}`);
    
    if (result.present && key === 'FIREBASE_PRIVATE_KEY') {
      console.log(`      Preview: ${result.preview}`);
      console.log(`      Formato PEM: ${result.validFormat ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
      console.log(`      Quebras de linha reais: ${result.hasRealNewlines ? '❌ SIM (PROBLEMA!)' : '✅ NÃO'}`);
      if (!result.validFormat) {
        console.log(`      Erro: ${result.formatError}`);
      }
      if (result.hasRealNewlines) {
        console.log(`      🔥 CRÍTICO: Chave contém quebras de linha reais!`);
        console.log(`      💡 Solução: Substitua \\n por \\\\n no arquivo .env`);
      }
    } else if (result.present && (key.includes('KEY') || key.includes('SECRET'))) {
      console.log(`      Preview: ${result.preview}`);
    }
  });

  if (missingEnvVars.length > 0) {
    console.log('❌ Variáveis de ambiente ausentes:', missingEnvVars.join(', '));
    return false;
  }

  if (results.FIREBASE_PRIVATE_KEY && results.FIREBASE_PRIVATE_KEY.hasRealNewlines) {
    console.log('❌ PROBLEMA CRÍTICO: Chave privada contém quebras de linha reais');
    console.log('💡 Corrija o arquivo .env substituindo quebras de linha por \\n');
    return false;
  }

  if (results.FIREBASE_PRIVATE_KEY && !results.FIREBASE_PRIVATE_KEY.validFormat) {
    console.log('❌ Formato inválido da chave privada do Firebase');
    return false;
  }

  console.log('✅ Todas as variáveis de ambiente estão presentes e válidas');
  return true;
}

// Função para criar um arquivo .env corrigido
function createFixedEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado para correção');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Corrigir quebras de linha na chave privada
  const fixedContent = envContent.replace(
    /(FIREBASE_PRIVATE_KEY=)([^\n]*)(\n( {4}[^\n]*)*)/g,
    (match, prefix, keyContent, newlines) => {
      // Substituir quebras de linha reais por \n
      const fixedKey = keyContent.replace(/\n/g, '\\n');
      return prefix + fixedKey;
    }
  );

  const backupPath = path.join(__dirname, '.env.backup');
  const fixedPath = path.join(__dirname, '.env.fixed');
  
  // Fazer backup do original
  fs.writeFileSync(backupPath, envContent);
  fs.writeFileSync(fixedPath, fixedContent);
  
  console.log('✅ Backup do .env original salvo como: .env.backup');
  console.log('✅ Arquivo .env corrigido salvo como: .env.fixed');
  console.log('💡 Instruções:');
  console.log('   1. Verifique o arquivo .env.fixed');
  console.log('   2. Se estiver correto, substitua o .env original:');
  console.log('      cp .env.fixed .env');
  console.log('   3. Execute novamente: npm run test:parse');
  
  return true;
}

async function testAllConnections() {
  console.log('🔍 Iniciando teste de conexões...\n');

  try {
    // Primeiro verificar o arquivo .env
    const envFileValid = checkEnvFile();
    if (!envFileValid) {
      console.log('\n🛠️  Deseja criar um arquivo .env corrigido automaticamente?');
      console.log('💡 Isso criará um backup e um arquivo corrigido.');
      // Para automação, vamos sempre tentar corrigir
      createFixedEnvFile();
      return false;
    }

    // Verificar variáveis de ambiente
    const envValid = checkEnvironmentVariables();
    if (!envValid) {
      // Se há quebras de linha reais, oferecer correção
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.includes('\n')) {
        console.log('\n🛠️  Corrigindo automaticamente o arquivo .env...');
        createFixedEnvFile();
      }
      return false;
    }

    // Inicializar Firebase
    console.log('\n1. 🔥 Testando conexão com Firebase...');
    try {
      // Corrigir a chave privada se necessário
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.includes('\n')) {
        process.env.FIREBASE_PRIVATE_KEY = fixPrivateKeyFormat(process.env.FIREBASE_PRIVATE_KEY);
      }
      
      initializeFirebase();
      const firebaseConnected = await checkFirebaseConnection();
      
      if (firebaseConnected) {
        console.log('✅ Firebase: CONECTADO com sucesso');
      } else {
        console.log('❌ Firebase: FALHA na conexão');
        return false;
      }
    } catch (firebaseError) {
      console.log('❌ Firebase: ERRO -', firebaseError.message);
      
      // Se o erro for relacionado à chave privada, sugerir correção
      if (firebaseError.message.includes('private key') || firebaseError.message.includes('PEM')) {
        console.log('💡 Provavelmente devido ao formato da chave privada.');
        console.log('💡 Execute: npm run fix:env para corrigir automaticamente');
      }
      return false;
    }

    // Inicializar Parse/Back4App
    console.log('\n2. 📡 Testando conexão com Back4App...');
    try {
      initializeParse();
      const parseConnected = await testConnection();
      
      if (parseConnected) {
        console.log('✅ Back4App: CONECTADO com sucesso');
        
        // Testar classes do Back4App
        console.log('\n3. 🗄️  Verificando classes no Back4App...');
        try {
          await ParseService.initializeClasses();
          console.log('✅ Classes do Back4App: VERIFICADAS com sucesso');
        } catch (classesError) {
          console.log('⚠️  Classes do Back4App: AVISO -', classesError.message);
        }
      } else {
        console.log('❌ Back4App: FALHA na conexão');
        return false;
      }
    } catch (parseError) {
      console.log('❌ Back4App: ERRO -', parseError.message);
      return false;
    }

    // Testar conexão com PaySuite (opcional)
    console.log('\n5. 💳 Testando configuração da PaySuite...');
    try {
      const paysuiteApiKey = process.env.PAYSUITE_API_KEY;
      const paysuiteSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
      
      if (paysuiteApiKey && paysuiteSecret) {
        console.log('✅ PaySuite: API Key e Secret configurados');
        console.log('   API Key:', paysuiteApiKey.substring(0, 10) + '...' + paysuiteApiKey.substring(paysuiteApiKey.length - 4));
        console.log('   Webhook Secret:', paysuiteSecret.substring(0, 10) + '...' + paysuiteSecret.substring(paysuiteSecret.length - 4));
      } else {
        console.log('❌ PaySuite: Configuração incompleta');
        return false;
      }
    } catch (paysuiteError) {
      console.log('❌ PaySuite: ERRO -', paysuiteError.message);
      return false;
    }

    console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('\n📊 RESUMO:');
    console.log('   ✅ Firebase: Conectado');
    console.log('   ✅ Back4App: Conectado');
    console.log('   ✅ Variáveis de ambiente: Configuradas');
    console.log('   ✅ PaySuite: Configurado');
    
    return true;

  } catch (error) {
    console.log('💥 ERRO GERAL no teste de conexões:', error.message);
    return false;
  }
}

// Adicionar script para corrigir o .env
if (process.argv.includes('--fix') || process.argv.includes('fix:env')) {
  console.log('🛠️  Corrigindo arquivo .env...');
  createFixedEnvFile();
  process.exit(0);
}

// Executar teste se chamado diretamente
if (require.main === module) {
  console.log('🛠️  Teste de Conexão - InfoPlus Backend');
  console.log('=======================================\n');
  
  // Verificar se é para corrigir
  if (process.argv.includes('--fix')) {
    createFixedEnvFile();
    process.exit(0);
  }
  
  testAllConnections()
    .then(success => {
      if (success) {
        console.log('\n🚀 Sistema pronto para uso!');
        process.exit(0);
      } else {
        console.log('\n❌ Sistema não está pronto. Verifique as configurações.');
        console.log('\n💡 Solução de problemas:');
        console.log('   1. Execute: npm run fix:env para corrigir automaticamente');
        console.log('   2. Ou edite manualmente o .env substituindo quebras de linha por \\n');
        console.log('   3. Exemplo: FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
        process.exit(1);
      }
    })
    .catch(error => {
      console.log('💥 Erro inesperado:', error);
      process.exit(1);
    });
}

module.exports = {
  testAllConnections,
  validatePrivateKeyFormat,
  checkEnvironmentVariables,
  createFixedEnvFile
};