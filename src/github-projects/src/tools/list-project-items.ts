import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { DEFAULT_PAGE_SIZE } from '../utils/constants.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para listar itens de um projeto
 */
export const ListProjectItemsSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  first: z.number().optional().describe('Number of items to return'),
  after: z.string().optional().describe('Cursor for pagination'),
});

/**
 * Tipo dos parâmetros de entrada para listar itens
 */
export type ListProjectItemsParams = z.infer<typeof ListProjectItemsSchema>;

/**
 * Query GraphQL para obter itens de um projeto (V2)
 */
const PROJECT_ITEMS_QUERY = `
  query getProjectItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        title
        number
        items(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            type
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  title
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
            content {
              __typename
              ... on Issue {
                id
                title
                number
                url
                state
                repository {
                  name
                  owner {
                    login
                  }
                }
              }
              ... on PullRequest {
                id
                title
                number
                url
                state
                repository {
                  name
                  owner {
                    login
                  }
                }
              }
              ... on DraftIssue {
                id
                title
                body
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Tipo para representar o conteúdo do item do projeto
 */
interface ProjectItemContent {
  type: string;
  id: string;
  title: string;
  number?: number;
  url?: string;
  state?: string;
  body?: string;
  repository?: {
    name: string;
    owner: string;
  };
}

/**
 * Tipo para representar um item do projeto processado
 */
interface ProcessedProjectItem {
  id: string;
  type: string;
  content: ProjectItemContent | null;
  fields: Record<string, any>;
}

/**
 * Lista os itens de um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param first Número de itens a retornar (opcional, padrão 20)
 * @param after Cursor para paginação (opcional)
 */
export async function listProjectItems(params: {
  projectId: string;
  first?: number;
  after?: string;
}) {
  try {
    // Extrai parâmetros
    const { projectId, first = DEFAULT_PAGE_SIZE, after = null } = params;
    
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
    
    // Executa a query GraphQL para buscar os itens do projeto
    const result = await executeGraphQL(PROJECT_ITEMS_QUERY, { 
      projectId,
      first,
      after
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
    const items = project.items?.nodes || [];
    const pageInfo = project.items?.pageInfo || { hasNextPage: false, endCursor: null };
    
    // Processa os itens para um formato mais adequado para o cliente
    const processedItems = items.map((item: any): ProcessedProjectItem => {
      // Objeto base do item
      const processedItem: ProcessedProjectItem = {
        id: item.id,
        type: item.type,
        content: null,
        fields: {}
      };
      
      // Processa o conteúdo (Issue, PR ou Draft)
      if (item.content) {
        if (item.content.__typename === 'DraftIssue') {
          processedItem.content = {
            type: 'DRAFT',
            id: item.content.id,
            title: item.content.title,
            body: item.content.body
          };
        } else {
          // Issue ou PR
          processedItem.content = {
            type: item.content.__typename === 'Issue' ? 'ISSUE' : 'PULL_REQUEST',
            id: item.content.id,
            title: item.content.title,
            number: item.content.number,
            url: item.content.url,
            state: item.content.state,
            repository: {
              name: item.content.repository?.name,
              owner: item.content.repository?.owner?.login
            }
          };
        }
      }
      
      // Processa os valores dos campos
      if (item.fieldValues?.nodes) {
        item.fieldValues.nodes.forEach((fieldValue: any) => {
          if (fieldValue && fieldValue.field?.name) {
            const fieldName = fieldValue.field.name;
            
            // Determina o valor com base no tipo de campo
            let value = null;
            if ('text' in fieldValue) {
              value = fieldValue.text;
            } else if ('date' in fieldValue) {
              value = fieldValue.date;
            } else if ('name' in fieldValue) {
              value = fieldValue.name;
            } else if ('number' in fieldValue) {
              value = fieldValue.number;
            } else if ('title' in fieldValue) {
              value = fieldValue.title;
            }
            
            // Adiciona o valor ao objeto de campos
            processedItem.fields[fieldName] = value;
          }
        });
      }
      
      return processedItem;
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Itens do projeto "${project.title}" (#${project.number}) recuperados com sucesso.`,
      projectId: projectId,
      projectTitle: project.title,
      projectNumber: project.number,
      items: processedItems,
      pagination: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor
      }
    });
    
  } catch (error) {
    return createMcpResponse({
      success: false,
      message: `Falha ao listar itens do projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 