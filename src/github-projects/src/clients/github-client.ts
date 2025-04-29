import { GITHUB_GRAPHQL_ENDPOINT } from '../utils/constants.js';
import { isTokenSuitableForGraphQL, getTokenWarning } from '../utils/token-utils.js';
import { logApiRequest, logApiResponse, logApiError } from '../utils/logger.js';
import logger from '../utils/logger.js';

/**
 * Token para autenticação na API do GitHub
 */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Verifica o token do GitHub no início
 */
function checkGitHubToken(): void {
  const warning = getTokenWarning(GITHUB_TOKEN);
  
  if (!GITHUB_TOKEN) {
    logger.error('Token do GitHub não configurado na variável de ambiente GITHUB_TOKEN');
    return;
  }
  
  if (warning) {
    logger.warn(warning);
  } else {
    logger.info('Token do GitHub configurado corretamente para operações GraphQL');
  }
}

// Verifica o token ao carregar o módulo
checkGitHubToken();

/**
 * Cliente GraphQL para interagir com a API do GitHub
 * Implementação simples usando fetch que não depende de @octokit/graphql
 */
export async function executeGraphQL<T = any>(query: string, variables: any = {}): Promise<T> {
  // Verifica se o token é adequado para GraphQL antes de fazer a requisição
  if (!isTokenSuitableForGraphQL(GITHUB_TOKEN)) {
    throw new Error(
      'O token do GitHub não é adequado para operações GraphQL. ' +
      'Você deve usar um token clássico (ghp_) para acessar a API Projects V2.'
    );
  }
  
  // Objeto para enviar na requisição
  const requestBody = {
    query,
    variables
  };
  
  // Headers da requisição
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v4+json'
  };
  
  // Log da requisição (omitindo informações sensíveis)
  logApiRequest({
    url: GITHUB_GRAPHQL_ENDPOINT,
    method: 'POST',
    headers: { ...headers, authorization: '[REDACTED]' },
    body: requestBody
  });
  
  try {
    // Faz a requisição GraphQL usando fetch
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    // Processa a resposta
    const result = await response.json();
    
    // Verifica se houve erro no resultado
    if (!response.ok || result.errors) {
      const error = new Error(
        result.errors?.[0]?.message || 
        `Erro na requisição GraphQL: ${response.status} ${response.statusText}`
      );
      
      // Adiciona informações extras ao erro
      Object.assign(error, {
        name: 'GitHubGraphQLError',
        status: response.status,
        response: {
          data: result
        }
      });
      
      throw error;
    }
    
    // Log da resposta bem-sucedida
    logApiResponse({
      url: GITHUB_GRAPHQL_ENDPOINT,
      status: response.status,
      responseBody: result
    });
    
    return result.data as T;
  } catch (error) {
    // Log do erro
    logApiError({
      url: GITHUB_GRAPHQL_ENDPOINT,
      method: 'POST',
      error: error
    });
    
    // Rethrow para ser tratado pelo código chamador
    throw error;
  }
}

/**
 * Cliente REST para interagir com a API REST do GitHub
 * Implementação simples usando fetch que não depende de @octokit/rest
 */
export async function executeRest<T = any>(
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: any
): Promise<T> {
  // URL completa da API
  const url = `https://api.github.com${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  // Headers padrão
  const headers: Record<string, string> = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  
  // Configuração da requisição
  const requestOptions: RequestInit = {
    method,
    headers,
  };
  
  // Adiciona o corpo da requisição para métodos não-GET
  if (method !== 'GET' && data !== undefined) {
    requestOptions.body = JSON.stringify(data);
    headers['Content-Type'] = 'application/json';
  }
  
  // Log da requisição
  logApiRequest({
    url,
    method,
    headers: { ...headers, authorization: '[REDACTED]' },
    body: data
  });
  
  try {
    // Faz a requisição
    const response = await fetch(url, requestOptions);
    
    // Lê o corpo da resposta
    let responseBody = null;
    
    // Tenta fazer parse do corpo como JSON apenas se houver conteúdo
    if (response.status !== 204) { // 204 = No Content
      const responseText = await response.text();
      try {
        responseBody = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
        responseBody = responseText;
      }
    }
    
    // Verifica se a resposta foi bem sucedida
    if (!response.ok) {
      const error = new Error(
        responseBody?.message || `Erro na requisição REST: ${response.status} ${response.statusText}`
      );
      
      // Adiciona informações extras ao erro
      Object.assign(error, {
        name: 'GitHubRestError',
        status: response.status,
        response: {
          data: responseBody
        }
      });
      
      throw error;
    }
    
    // Log da resposta bem-sucedida
    logApiResponse({
      url,
      status: response.status,
      responseBody
    });
    
    return responseBody as T;
  } catch (error) {
    // Log do erro
    logApiError({
      url,
      method,
      error
    });
    
    // Rethrow para ser tratado pelo código chamador
    throw error;
  }
} 