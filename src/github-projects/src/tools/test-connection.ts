import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para teste de conexão
 */
export const TestConnectionSchema = z.object({}).strict();

/**
 * Query GraphQL para obter informações do usuário autenticado (viewer)
 */
const VIEWER_QUERY = `
  query GetViewer {
    viewer {
      login
      name
      url
    }
  }
`;

/**
 * Ferramenta para testar a conexão com o GitHub
 * @returns Informações do usuário autenticado ou erro
 */
export async function testConnection() {
  try {
    // Verifica se o token é adequado para GraphQL
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('Token do GitHub não configurado.');
    }
    
    if (!isTokenSuitableForGraphQL(token)) {
      return createMcpResponse({
        success: false,
        message: 'Token do GitHub não é adequado para API GraphQL. Utilize um token clássico (ghp_).',
        tokenType: 'fine-grained',
        isValid: false
      }, true);
    }
    
    // Executa a query GraphQL para obter informações do usuário
    const result = await executeGraphQL(VIEWER_QUERY);
    
    return createMcpResponse({
      success: true,
      message: 'Conexão com GitHub estabelecida com sucesso!',
      user: result.viewer,
      tokenType: 'classic',
      isValid: true
    });
  } catch (error) {
    return createMcpResponse({
      success: false,
      message: `Falha na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      isValid: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 