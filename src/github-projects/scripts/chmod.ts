#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

// Função para garantir saída JSON válida
function safeLog(data: any): void {
  console.log(JSON.stringify(data));
}

function safeError(data: any): void {
  console.error(JSON.stringify(data));
}

// Para compatibilidade com sistemas Unix/Linux
// Este script irá atribuir permissão de execução ao arquivo index.js no diretório dist
try {
  const indexPath = path.resolve('./dist/index.js');
  
  if (process.platform !== 'win32') {
    // No Windows, as permissões funcionam diferentemente
    safeLog({ message: `Atribuindo permissão de execução a ${indexPath}` });
    fs.chmodSync(indexPath, 0o755); // rwxr-xr-x
    safeLog({ message: 'Permissão atribuída com sucesso' });
  } else {
    safeLog({ message: 'Ignorando permissões no Windows' });
  }
} catch (error) {
  safeError({ 
    message: 'Erro ao atribuir permissões', 
    error: error instanceof Error ? error.message : String(error) 
  });
  process.exit(1);
} 