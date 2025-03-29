import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para adicionar item a um projeto
 */
export const AddProjectItemSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  contentId: z.string().min(1).describe('Content ID (GraphQL global ID of an Issue or Pull Request)'),
});

/**
 * Tipo dos parâmetros de entrada para adicionar item
 */
export type AddProjectItemParams = z.infer<typeof AddProjectItemSchema>;

/**
 * Mutation GraphQL para adicionar item a um projeto (V2)
 */
const ADD_PROJECT_ITEM_MUTATION = `
  mutation addProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId,
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`;

/**
 * Query GraphQL para obter detalhes de um item recém-adicionado
 */
const GET_PROJECT_ITEM_QUERY = `
  query getProjectItem($id: ID!) {
    node(id: $id) {
      ... on ProjectV2Item {
        id
        type
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
        }
      }
    }
  }
`;

/**
 * Adiciona um item (issue ou PR) a um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param contentId ID do conteúdo (ID global do issue ou PR)
 */
export async function addProjectItem(params: {
  projectId: string;
  contentId: string;
}) {
  try {
    // Extrai parâmetros
    const { projectId, contentId } = params;
    
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
    
    // Executa a mutation GraphQL para adicionar o item ao projeto
    const result = await executeGraphQL(ADD_PROJECT_ITEM_MUTATION, { 
      projectId,
      contentId
    });
    
    // Verifica se houve erro ou se o item não foi adicionado
    if (!result.addProjectV2ItemById?.item?.id) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao adicionar item ao projeto.',
      }, true);
    }
    
    // ID do item adicionado
    const itemId = result.addProjectV2ItemById.item.id;
    
    // Busca detalhes completos do item adicionado
    const itemDetails = await executeGraphQL(GET_PROJECT_ITEM_QUERY, { 
      id: itemId
    });
    
    // Processa os dados do item
    const item = itemDetails.node;
    
    // Processa o conteúdo (Issue ou PR)
    let itemData = null;
    if (item?.content) {
      const isIssue = item.content.__typename === 'Issue';
      
      itemData = {
        id: itemId,
        type: item.type,
        contentType: isIssue ? 'ISSUE' : 'PULL_REQUEST',
        contentId: item.content.id,
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
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Item adicionado com sucesso ao projeto.`,
      projectId: projectId,
      item: itemData
    });
    
  } catch (error) {
    return createMcpResponse({
      success: false,
      message: `Falha ao adicionar item ao projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 