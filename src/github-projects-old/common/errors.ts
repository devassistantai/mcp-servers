/**
 * Types and utilities for handling GitHub API errors
 */

export interface GitHubError {
  message: string;
  documentation_url?: string;
  status?: number;
  errors?: any[];
  tokenType?: string;
}

export function isGitHubError(error: any): boolean {
  return (
    error &&
    typeof error === 'object' &&
    typeof error.message === 'string' &&
    (error.documentation_url !== undefined || error.status !== undefined || error.errors !== undefined)
  );
}

export function createGitHubError(
  status: number,
  response: { message: string; errors?: any[]; documentation_url?: string; tokenType?: string }
): GitHubError {
  return {
    status,
    message: response.message,
    errors: response.errors,
    documentation_url: response.documentation_url,
    tokenType: response.tokenType,
  };
}

export function formatGitHubError(error: GitHubError): string {
  let errorMessage = `GitHub API Error: ${error.message}`;
  
  // Adicionar informações sobre status code se disponível
  if (error.status) {
    errorMessage += ` (Status: ${error.status})`;
  }
  
  // Adicionar ajuda específica para erros de autorização
  if (error.status === 403 || error.message.includes("GraphQL request failed")) {
    errorMessage += "\n\nEste erro pode indicar um problema de permissão com seu token GitHub.";
    
    // Adicionar informação específica para token fine-grained
    if (error.tokenType === 'fine-grained') {
      errorMessage += "\n\n⚠️ IMPORTANTE: Você está usando um token fine-grained (github_pat_).";
      errorMessage += "\nTokens fine-grained têm limitações significativas com a API GraphQL do GitHub,";
      errorMessage += "\nespecialmente para recursos como GitHub Projects V2.";
      errorMessage += "\n\nSOLUÇÃO RECOMENDADA:";
      errorMessage += "\n1. Crie um token clássico (ghp_) em https://github.com/settings/tokens";
      errorMessage += "\n2. Selecione os seguintes escopos:";
      errorMessage += "\n   - repo (acesso completo aos repositórios)";
      errorMessage += "\n   - admin:org (acesso aos recursos da organização)";
      errorMessage += "\n   - project (acesso a projetos)";
      errorMessage += "\n3. Substitua o token atual no arquivo .env";
    } else {
      errorMessage += "\nPara operações com GitHub Projects V2, seu token precisa incluir os seguintes escopos:";
      errorMessage += "\n- repo (acesso completo aos repositórios)";
      errorMessage += "\n- admin:org (acesso aos recursos da organização)";
      errorMessage += "\n- project (acesso a projetos)";
      errorMessage += "\n\nVerifique seu token em: https://github.com/settings/tokens";
    }
  }
  
  // Adicionar link para documentação se disponível
  if (error.documentation_url) {
    errorMessage += `\nDocumentação: ${error.documentation_url}`;
  }
  
  // Adicionar detalhes de erros se disponíveis
  if (error.errors && error.errors.length > 0) {
    errorMessage += "\nDetalhes:";
    error.errors.forEach((err: any, index: number) => {
      errorMessage += `\n  ${index + 1}. ${JSON.stringify(err)}`;
    });
  }
  
  return errorMessage;
} 