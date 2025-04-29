import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para converter um rascunho em issue
 */
export const ConvertDraftToIssueSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  draftId: z.string().min(1).describe('Draft item ID (GraphQL global ID)'),
  repositoryId: z.string().min(1).describe('Repository ID (GraphQL global ID)'),
  assignees: z.array(z.string()).optional().describe('GitHub usernames to assign to the task'),
  labels: z.array(z.string()).optional().describe('Labels to add to the task'),
  milestone: z.string().optional().describe('Milestone ID to associate with the task'),
});

/**
 * Tipo dos parâmetros de entrada para converter rascunho em issue
 */
export type ConvertDraftToIssueParams = z.infer<typeof ConvertDraftToIssueSchema>;

/**
 * Query GraphQL para obter detalhes de um item de rascunho
 */
const GET_DRAFT_ITEM_QUERY = `
  query getDraftItem($projectId: ID!, $itemId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        item(id: $itemId) {
          id
          type
          content {
            ... on DraftIssue {
              id
              title
              body
            }
          }
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
            }
          }
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para criar uma issue em um repositório
 */
const CREATE_ISSUE_MUTATION = `
  mutation createIssue($repositoryId: ID!, $title: String!, $body: String, $assigneeIds: [ID!], $labelIds: [ID!], $milestoneId: ID) {
    createIssue(input: {
      repositoryId: $repositoryId,
      title: $title,
      body: $body,
      assigneeIds: $assigneeIds,
      labelIds: $labelIds,
      milestoneId: $milestoneId
    }) {
      issue {
        id
        number
        title
        url
        repository {
          name
          owner {
            login
          }
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para remover um item de rascunho
 */
const DELETE_DRAFT_ITEM_MUTATION = `
  mutation DeleteProjectItem($input: DeleteProjectV2ItemInput!) {
    deleteProjectV2Item(input: $input) {
      deletedItemId
    }
  }
`;

/**
 * Mutation GraphQL para adicionar uma issue ao projeto
 */
const ADD_ISSUE_TO_PROJECT_MUTATION = `
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
 * Converte um item de rascunho em uma issue real em um repositório 
 * e a adiciona novamente ao projeto
 */
export async function convertDraftToIssue(params: ConvertDraftToIssueParams) {
  try {
    // Extrai parâmetros
    const { 
      projectId, 
      draftId, 
      repositoryId, 
      assignees = [], 
      labels = [], 
      milestone = null 
    } = params;
    
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
    logMcpRequest('convert_draft_to_issue', {
      projectId,
      draftId,
      repositoryId,
      assignees,
      hasLabels: labels.length > 0,
      hasMilestone: !!milestone
    });
    
    // 1. Primeiro, obter detalhes do rascunho
    const draftResult = await executeGraphQL(GET_DRAFT_ITEM_QUERY, { 
      projectId,
      itemId: draftId 
    });
    
    // Verificar se o item existe e é um rascunho
    const draftItem = draftResult.node?.item;
    if (!draftItem) {
      return createMcpResponse({
        success: false,
        message: 'Item de rascunho não encontrado no projeto.',
      }, true);
    }
    
    // Verificar se o item é realmente um rascunho
    if (draftItem.type !== 'DRAFT_ISSUE' || !draftItem.content) {
      return createMcpResponse({
        success: false,
        message: `O item não é um rascunho, é um item do tipo: ${draftItem.type}`,
      }, true);
    }
    
    const draftContent = draftItem.content;
    const draftTitle = draftContent.title;
    const draftBody = draftContent.body || '';
    
    // Extrai valores dos campos para preservar (ex: status, etc.)
    const fieldValues: Record<string, any> = {};
    if (draftItem.fieldValues?.nodes) {
      draftItem.fieldValues.nodes.forEach((fieldValue: any) => {
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
          }
          
          // Adiciona o valor ao objeto de campos se não for nulo
          if (value !== null) {
            fieldValues[fieldName] = value;
          }
        }
      });
    }
    
    // 2. Converter IDs de assignees de username para node IDs globais
    // No futuro, implementar uma função para obter IDs globais de usuários
    // Por enquanto, vamos aceitar que os assignees já são node IDs globais
    const assigneeIds = assignees.length > 0 ? assignees : [];
    
    // 3. Criar uma nova issue no repositório
    const issueResult = await executeGraphQL(CREATE_ISSUE_MUTATION, {
      repositoryId,
      title: draftTitle,
      body: draftBody,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : null,
      labelIds: labels.length > 0 ? labels : null,
      milestoneId: milestone || null
    });
    
    if (!issueResult.createIssue?.issue) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao criar issue a partir do rascunho.',
      }, true);
    }
    
    const newIssue = issueResult.createIssue.issue;
    
    // 4. Remover o item de rascunho do projeto
    const deleteResult = await executeGraphQL(DELETE_DRAFT_ITEM_MUTATION, {
      input: {
        projectId,
        itemId: draftId
      }
    });
    
    if (!deleteResult.deleteProjectV2Item?.deletedItemId) {
      // Não falhar completamente se a remoção falhar, apenas registrar aviso
      logMcpError('convert_draft_to_issue', new Error('Falha ao remover item de rascunho após conversão.'));
    }
    
    // 5. Adicionar a nova issue ao projeto
    const addResult = await executeGraphQL(ADD_ISSUE_TO_PROJECT_MUTATION, {
      projectId,
      contentId: newIssue.id
    });
    
    if (!addResult.addProjectV2ItemById?.item?.id) {
      return createMcpResponse({
        success: false,
        message: 'Issue criada com sucesso, mas falha ao adicioná-la de volta ao projeto.',
        issue: {
          id: newIssue.id,
          number: newIssue.number,
          title: newIssue.title,
          url: newIssue.url,
          repository: {
            name: newIssue.repository.name,
            owner: newIssue.repository.owner.login
          }
        }
      }, true);
    }
    
    // ID do novo item no projeto
    const newItemId = addResult.addProjectV2ItemById.item.id;
    
    // 6. Atualizar os campos do novo item para preservar valores (ex: status)
    // Esta parte será implementada no futuro, após a conversão básica funcionar
    // Exigirá conhecer os IDs dos campos e como formatá-los corretamente
    
    // Log da resposta MCP
    logMcpResponse('convert_draft_to_issue', {
      success: true,
      draftId,
      newIssueId: newIssue.id,
      newIssueNumber: newIssue.number,
      newItemId
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Rascunho convertido com sucesso para issue #${newIssue.number}.`,
      projectId,
      originalDraftId: draftId,
      newItemId,
      issue: {
        id: newIssue.id,
        number: newIssue.number,
        title: newIssue.title,
        url: newIssue.url,
        repository: {
          name: newIssue.repository.name,
          owner: newIssue.repository.owner.login
        }
      },
      fieldValues
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('convert_draft_to_issue', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao converter rascunho para issue: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 