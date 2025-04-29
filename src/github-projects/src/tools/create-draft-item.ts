import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para criar item de rascunho
 */
export const CreateDraftItemSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  title: z.string().min(1).describe('Title for the draft item'),
  body: z.string().optional().describe('Body content for the draft item'),
});

/**
 * Tipo dos parâmetros de entrada para criar item de rascunho
 */
export type CreateDraftItemParams = z.infer<typeof CreateDraftItemSchema>;

/**
 * Mutation GraphQL para adicionar item de rascunho a um projeto (V2)
 */
const ADD_DRAFT_ITEM_MUTATION = `
  mutation addDraftItem($projectId: ID!, $title: String!, $body: String) {
    addProjectV2DraftIssue(input: {
      projectId: $projectId,
      title: $title,
      body: $body
    }) {
      projectItem {
        id
        type
        content {
          ... on DraftIssue {
            id
            title
            body
          }
        }
      }
    }
  }
`;

/**
 * Cria um item de rascunho em um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param title Título do item de rascunho
 * @param body Corpo/conteúdo do item de rascunho (opcional)
 */
export async function createDraftItem(params: {
  projectId: string;
  title: string;
  body?: string;
}) {
  try {
    // Extrai parâmetros
    const { projectId, title, body = '' } = params;
    
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
    
    // Executa a mutation GraphQL para criar o item de rascunho
    const result = await executeGraphQL(ADD_DRAFT_ITEM_MUTATION, { 
      projectId,
      title,
      body
    });
    
    // Verifica se houve erro ou se o item não foi criado
    if (!result.addProjectV2DraftIssue?.projectItem?.id) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao criar item de rascunho no projeto.',
      }, true);
    }
    
    // Extrai os dados do item criado
    const item = result.addProjectV2DraftIssue.projectItem;
    const draftContent = item.content;
    
    // Formata os dados do item de rascunho
    const itemData = {
      id: item.id,
      type: item.type,
      contentType: 'DRAFT',
      contentId: draftContent.id,
      title: draftContent.title,
      body: draftContent.body
    };
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Item de rascunho "${title}" criado com sucesso no projeto.`,
      projectId: projectId,
      item: itemData
    });
    
  } catch (error) {
    return createMcpResponse({
      success: false,
      message: `Falha ao criar item de rascunho: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 