// scripts/fix-env.js
const fs = require('fs');
const path = require('path');

function fixEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado');
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

  const backupPath = path.join(__dirname, '..', '.env.backup');
  const fixedPath = path.join(__dirname, '..', '.env');
  
  // Fazer backup do original
  fs.writeFileSync(backupPath, envContent);
  fs.writeFileSync(fixedPath, fixedContent);
  
  console.log('✅ Backup do .env original salvo como: .env.backup');
  console.log('✅ Arquivo .env corrigido com sucesso!');
  console.log('💡 Execute: npm start para iniciar o servidor');
  
  return true;
}

// Executar se chamado diretamente
if (require.main === module) {
  fixEnvFile();
}

module.exports = { fixEnvFile };