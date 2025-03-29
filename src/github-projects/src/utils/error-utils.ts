import logger from './logger.js';

/**
 * Interface para erros retornados pela API do GitHub
 */
export interface GitHubError {
  name: string;
  status: number;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{
        message: string;
        type: string;
        path?: string[];
      }>;
      documentation_url?: string;
    };
  };
  message: string;
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
}

/**
 * Verifica se um erro é um erro da API do GitHub
 * @param error Objeto de erro a ser verificado
 * @returns true se for um erro da API do GitHub, false caso contrário
 */
export function isGitHubError(error: any): error is GitHubError {
  return (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    'status' in error &&
    'message' in error
  );
}

/**
 * Formata um erro do GitHub em uma mensagem amigável
 * @param error Erro do GitHub
 * @returns Mensagem de erro formatada
 */
export function formatGitHubError(error: any): string {
  if (!isGitHubError(error)) {
    return error?.message || 'Erro desconhecido';
  }
  
  // Log completo do erro para depuração
  logger.debug({ error }, 'Erro detalhado do GitHub');
  
  let message = `Erro ${error.status}: ${error.message}`;
  
  // Adiciona erros específicos se existirem
  if (error.response?.data?.errors && error.response.data.errors.length > 0) {
    message += '\n\nDetalhes:';
    error.response.data.errors.forEach((err) => {
      message += `\n- ${err.message}`;
      if (err.path) {
        message += ` (em: ${err.path.join('.')})`;
      }
    });
  }
  
  // Se for um erro de permissão, adiciona dica sobre tokens
  if (error.status === 401 || error.status === 403) {
    message += '\n\nDica: Verifique se seu token tem as permissões necessárias (repo, project, admin:org) ' +
      'e se é um token clássico (ghp_) para operações GraphQL.';
  }
  
  // Adiciona link para documentação se disponível
  if (error.response?.data?.documentation_url) {
    message += `\n\nDocumentação: ${error.response.data.documentation_url}`;
  }
  
  return message;
}

/**
 * Transforma um erro do GitHub em um objeto padronizado para resposta
 * @param error Erro do GitHub ou outro erro
 * @returns Objeto de erro formatado para resposta
 */
export function createErrorResponse(error: any): { error: string } {
  const errorMessage = isGitHubError(error)
    ? formatGitHubError(error)
    : error?.message || 'Erro desconhecido';
  
  return { error: errorMessage };
} 