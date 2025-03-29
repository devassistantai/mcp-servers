import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { DEFAULT_PAGE_SIZE } from '../utils/constants.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para listar visualizações de um projeto
 */
export const ListProjectViewsSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  first: z.number().optional().describe('Number of views to return'),
});

/**
 * Tipo dos parâmetros de entrada para listar visualizações
 */
export type ListProjectViewsParams = z.infer<typeof ListProjectViewsSchema>;

/**
 * Query GraphQL para obter visualizações de um projeto (V2)
 */
const PROJECT_VIEWS_QUERY = `
  query getProjectViews($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        title
        number
        views(first: $first) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            name
            layout
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`;

/**
 * Processa dados de uma visualização de projeto
 * @param view Objeto de visualização retornado pela API
 * @returns Objeto de visualização processado com informações formatadas
 */
function processView(view: any): any {
  return {
    id: view.id,
    name: view.name,
    layout: view.layout,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt
  };
}

/**
 * Lista as visualizações de um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param first Número de visualizações a retornar (opcional, padrão 20)
 */
export async function listProjectViews(params: {
  projectId: string;
  first?: number;
}) {
  try {
    // Extrai parâmetros
    const { projectId, first = DEFAULT_PAGE_SIZE } = params;
    
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
    logMcpRequest('list_project_views', {
      projectId,
      first
    });
    
    // Executa a query GraphQL para buscar as visualizações do projeto
    const result = await executeGraphQL(PROJECT_VIEWS_QUERY, { 
      projectId,
      first
    });
    
    // Verifica se o projeto foi encontrado
    if (!result.node) {
      return createMcpResponse({
        success: false,
        message: `Projeto com ID ${projectId} não encontrado.`,
      }, true);
    }
    
    // Extrai dados do projeto
    const project = result.node;
    const views = project.views?.nodes || [];
    const pageInfo = project.views?.pageInfo || { hasNextPage: false, endCursor: null };
    
    // Processa as visualizações para formato adequado
    const processedViews = views.map(processView);
    
    // Log da resposta MCP
    logMcpResponse('list_project_views', {
      success: true,
      projectId,
      viewsCount: processedViews.length
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Visualizações do projeto "${project.title}" (#${project.number}) recuperadas com sucesso.`,
      projectId: projectId,
      projectTitle: project.title,
      projectNumber: project.number,
      views: processedViews,
      pagination: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor
      }
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('list_project_views', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao listar visualizações do projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 