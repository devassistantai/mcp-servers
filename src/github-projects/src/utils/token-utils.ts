import logger from './logger.js';

/**
 * Enum para os tipos de token do GitHub
 */
export enum GitHubTokenType {
  CLASSIC = 'classic',
  FINE_GRAINED = 'fine-grained',
  UNKNOWN = 'unknown'
}

/**
 * Verifica o tipo de token do GitHub com base no prefixo
 * @param token Token do GitHub a ser verificado
 * @returns Tipo do token (classic, fine-grained ou unknown)
 */
export function detectTokenType(token?: string): GitHubTokenType {
  if (!token) {
    logger.error('Token não fornecido');
    return GitHubTokenType.UNKNOWN;
  }
  
  // Tokens clássicos começam com "ghp_"
  if (token.startsWith('ghp_')) {
    return GitHubTokenType.CLASSIC;
  }
  
  // Tokens fine-grained começam com "github_pat_"
  if (token.startsWith('github_pat_')) {
    return GitHubTokenType.FINE_GRAINED;
  }
  
  // Não foi possível determinar o tipo
  logger.warn('Tipo de token desconhecido. Prefixo não reconhecido.');
  return GitHubTokenType.UNKNOWN;
}

/**
 * Verifica se o token do GitHub é adequado para operações GraphQL
 * @param token Token do GitHub a ser verificado
 * @returns true se o token for adequado para GraphQL, false caso contrário
 */
export function isTokenSuitableForGraphQL(token?: string): boolean {
  if (!token) {
    return false;
  }
  
  const tokenType = detectTokenType(token);
  return tokenType === GitHubTokenType.CLASSIC;
}

/**
 * Obter mensagem de advertência para tokens inadequados
 * @param token Token do GitHub
 * @returns Mensagem de advertência ou null se o token for adequado
 */
export function getTokenWarning(token?: string): string | null {
  if (!token) {
    return 'Nenhum token do GitHub fornecido. Defina a variável de ambiente GITHUB_TOKEN.';
  }
  
  const tokenType = detectTokenType(token);
  
  if (tokenType === GitHubTokenType.FINE_GRAINED) {
    return 'AVISO: Você está usando um token fine-grained (github_pat_), que NÃO é compatível com a API GraphQL do Projects V2. ' +
      'Por favor, gere um token clássico (ghp_) com os escopos: repo, admin:org (ou read:org) e project.';
  }
  
  if (tokenType === GitHubTokenType.UNKNOWN) {
    return 'AVISO: Tipo de token desconhecido. Recomenda-se usar um token clássico (ghp_) para acesso à API GraphQL.';
  }
  
  return null;
} 