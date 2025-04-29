import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para remover item de um projeto
 */
export const RemoveProjectItemSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  itemId: z.string().min(1).describe('Item ID (GraphQL global ID)'),
});

/**
 * Tipo dos parâmetros de entrada para remover item de projeto
 */
export type RemoveProjectItemParams = z.infer<typeof RemoveProjectItemSchema>;

/**
 * Mutation GraphQL para remover um item de um projeto
 */
const DELETE_PROJECT_ITEM_MUTATION = `
  mutation DeleteProjectItem($input: DeleteProjectV2ItemInput!) {
    deleteProjectV2Item(input: $input) {
      deletedItemId
    }
  }
`;

/**
 * Remove um item de um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param itemId ID do item a ser removido
 */
export async function removeProjectItem(params: {
  projectId: string;
  itemId: string;
}) {
  try {
    // Extrai parâmetros
    const { projectId, itemId } = params;
    
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
    logMcpRequest('remove_project_item', {
      projectId,
      itemId
    });
    
    // Executa a mutation GraphQL para remover o item
    const result = await executeGraphQL(DELETE_PROJECT_ITEM_MUTATION, { 
      input: {
        projectId,
        itemId
      }
    });
    
    // Verifica se a operação foi bem-sucedida
    if (!result.deleteProjectV2Item?.deletedItemId) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao remover item do projeto.',
      }, true);
    }
    
    // ID do item removido
    const deletedItemId = result.deleteProjectV2Item.deletedItemId;
    
    // Log da resposta MCP
    logMcpResponse('remove_project_item', {
      success: true,
      deletedItemId
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Item removido com sucesso do projeto.`,
      projectId: projectId,
      deletedItemId: deletedItemId
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('remove_project_item', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao remover item do projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 