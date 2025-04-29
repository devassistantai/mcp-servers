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

/**
 * Sanitiza um objeto para garantir que ele possa ser serializado para JSON
 * sem problemas de formato ou caracteres inválidos
 * @param data Objeto a ser sanitizado
 * @returns Objeto sanitizado seguro para ser serializado para JSON
 */
export function sanitizeForJsonResponse(data: any): any {
  if (data === undefined || data === null) {
    return null;
  }
  
  try {
    // Verifica se o objeto pode ser serializado e deserializado sem problemas
    const jsonString = JSON.stringify(data);
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    // Se houver erro, loga e retorna um objeto simplificado
    logger.error(`Erro ao serializar objeto para JSON: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    logger.debug({ data }, 'Objeto que causou erro de serialização');
    
    return {
      error: "Erro ao processar resposta",
      message: "O objeto não pôde ser convertido para JSON válido"
    };
  }
}

/**
 * Formata uma resposta MCP com conteúdo sanitizado para garantir JSON válido
 * @param content Conteúdo a ser incluído na resposta
 * @param isError Se a resposta representa um erro
 * @returns Objeto de resposta MCP formatado corretamente
 */
export function createMcpResponse(content: any, isError: boolean = false): {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
} {
  // Sanitiza o conteúdo antes de serializar
  const sanitizedContent = sanitizeForJsonResponse(content);
  
  try {
    // Cria a resposta no formato MCP
    return {
      ...(isError ? { isError: true } : {}),
      content: [
        {
          type: "text",
          text: JSON.stringify(sanitizedContent)
        }
      ]
    };
  } catch (error) {
    // Manipula erros na criação da resposta
    logger.error(`Erro ao formatar resposta MCP: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    
    // Fallback para garantir uma resposta válida
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Erro interno",
            message: "Não foi possível gerar resposta válida"
          })
        }
      ]
    };
  }
} 