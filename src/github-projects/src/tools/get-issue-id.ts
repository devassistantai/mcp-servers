import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para obter ID global de uma issue
 */
export const GetIssueIdSchema = z.object({
  owner: z.string().min(1).describe('Repository owner (username or organization name)'),
  repo: z.string().min(1).describe('Repository name'),
  issueNumber: z.number().int().positive().describe('Issue number'),
});

/**
 * Tipo dos parâmetros de entrada para obter ID de issue
 */
export type GetIssueIdParams = z.infer<typeof GetIssueIdSchema>;

/**
 * Query GraphQL para obter o ID global de uma issue
 */
const GET_ISSUE_ID_QUERY = `
  query getIssueId($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        title
        url
        state
      }
    }
  }
`;

/**
 * Query GraphQL para obter o ID global de um pull request
 */
const GET_PR_ID_QUERY = `
  query getPrId($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        number
        title
        url
        state
      }
    }
  }
`;

/**
 * Obtém o ID global de uma issue ou PR no GitHub
 * @param owner Proprietário do repositório (usuário ou organização)
 * @param repo Nome do repositório
 * @param issueNumber Número da issue
 * @returns ID global da issue/PR e informações adicionais
 */
export async function getIssueId(params: GetIssueIdParams) {
  try {
    // Extrai parâmetros
    const { owner, repo, issueNumber } = params;
    
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
    
    // Log da solicitação MCP
    logMcpRequest('get_issue_id', {
      owner,
      repo,
      issueNumber
    });
    
    // Primeiro, tenta obter como issue
    let result = await executeGraphQL(GET_ISSUE_ID_QUERY, { 
      owner,
      repo,
      number: issueNumber
    });
    
    let item = result.repository?.issue;
    let type = 'issue';
    
    // Se não encontrou como issue, tenta como pull request
    if (!item) {
      result = await executeGraphQL(GET_PR_ID_QUERY, { 
        owner,
        repo,
        number: issueNumber
      });
      
      item = result.repository?.pullRequest;
      type = 'pullRequest';
    }
    
    // Verifica se o item foi encontrado
    if (!item) {
      return createMcpResponse({
        success: false,
        message: `Issue ou PR #${issueNumber} não encontrada no repositório ${owner}/${repo}.`,
      }, true);
    }
    
    // Log da resposta MCP
    logMcpResponse('get_issue_id', {
      success: true,
      type,
      id: item.id,
      number: item.number
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `ID global obtido com sucesso para ${type === 'issue' ? 'issue' : 'pull request'} #${issueNumber}.`,
      globalId: item.id,
      type,
      number: item.number,
      title: item.title,
      url: item.url,
      state: item.state,
      repository: {
        owner,
        name: repo
      },
      reference: `${owner}/${repo}#${issueNumber}`
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('get_issue_id', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao obter ID global da issue: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 