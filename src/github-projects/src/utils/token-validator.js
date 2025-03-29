/**
 * Utilitários para validação e verificação de tokens GitHub
 */

/**
 * Verifica se o token GitHub é adequado para operações GraphQL
 * Tokens fine-grained (github_pat_) têm limitações com GraphQL
 * Tokens clássicos (ghp_) são recomendados para operações GraphQL
 * 
 * @param {string|undefined} token - O token GitHub a ser verificado
 * @returns {boolean} - Verdadeiro se o token é adequado para GraphQL
 */
export function isTokenSuitableForGraphQL(token) {
  // Se não existe token, não é adequado
  if (!token) {
    return false;
  }

  // Tokens fine-grained começam com github_pat_
  // Eles não são ideais para operações GraphQL completas
  if (token.startsWith('github_pat_')) {
    return false;
  }
  
  // Tokens clássicos geralmente começam com ghp_
  // Eles funcionam bem com todas as operações GraphQL
  if (token.startsWith('ghp_')) {
    return true;
  }
  
  // Para outros formatos de token, assumimos que podem funcionar
  // mas deve-se verificar a configuração de escopos
  return true;
} 