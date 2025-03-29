import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { DEFAULT_PAGE_SIZE } from '../utils/constants.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para listar projetos
 */
export const ListProjectsSchema = z.object({
  owner: z.string().min(1).describe('Username or organization name'),
  type: z.enum(['user', 'organization']).describe('Type of owner (user or organization)'),
  first: z.number().optional().describe('Number of projects to return'),
});

/**
 * Tipo dos parâmetros de entrada para listar projetos
 */
export type ListProjectsParams = z.infer<typeof ListProjectsSchema>;

/**
 * Query GraphQL para obter projetos de um usuário
 */
const USER_PROJECTS_QUERY = `
  query getUserProjects($login: String!, $first: Int!) {
    user(login: $login) {
      projectsV2(first: $first) {
        nodes {
          id
          number
          title
          shortDescription
          url
          closed
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

/**
 * Query GraphQL para obter projetos de uma organização
 */
const ORG_PROJECTS_QUERY = `
  query getOrgProjects($login: String!, $first: Int!) {
    organization(login: $login) {
      projectsV2(first: $first) {
        nodes {
          id
          number
          title
          shortDescription
          url
          closed
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

/**
 * Lista os projetos do GitHub (V2) de um usuário ou organização
 * @param owner Nome do usuário ou organização
 * @param type Tipo de proprietário (usuário ou organização)
 * @param first Número de projetos a retornar (opcional, padrão 10)
 */
export async function listProjects(params: {
  owner: string;
  type: 'user' | 'organization';
  first?: number;
}) {
  try {
    // Extrai parâmetros
    const { owner, type, first = 10 } = params;
    
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
    
    // Seleciona a query com base no tipo
    const query = type === 'user' ? USER_PROJECTS_QUERY : ORG_PROJECTS_QUERY;
    
    // Executa a query GraphQL com as variáveis
    const result = await executeGraphQL(query, { 
      login: owner,
      first: first
    });
    
    // Processa o resultado de acordo com o tipo
    const ownerKey = type === 'user' ? 'user' : 'organization';
    const projects = result[ownerKey]?.projectsV2?.nodes || [];
    
    return createMcpResponse({
      success: true,
      message: `Projetos de ${owner} recuperados com sucesso.`,
      projects: projects.map((project: any) => ({
        id: project.id,
        number: project.number,
        title: project.title,
        shortDescription: project.shortDescription,
        url: project.url,
        closed: project.closed,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    });
    
  } catch (error) {
    return createMcpResponse({
      success: false,
      message: `Falha ao listar projetos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 