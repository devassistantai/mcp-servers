#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

// Para compatibilidade com sistemas Unix/Linux
// Este script irá atribuir permissão de execução ao arquivo index.js no diretório dist
try {
  const indexPath = path.resolve('./dist/index.js');
  
  if (process.platform !== 'win32') {
    // No Windows, as permissões funcionam diferentemente
    console.log(`Atribuindo permissão de execução a ${indexPath}`);
    fs.chmodSync(indexPath, 0o755); // rwxr-xr-x
    console.log('Permissão atribuída com sucesso');
  } else {
    console.log('Ignorando permissões no Windows');
  }
} catch (error) {
  console.error('Erro ao atribuir permissões:', error);
  process.exit(1);
} 