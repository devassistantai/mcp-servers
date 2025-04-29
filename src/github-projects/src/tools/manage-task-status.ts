import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para gerenciar status de tarefas
 */
export const ManageTaskStatusSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  itemId: z.string().min(1).describe('Item ID (GraphQL global ID)'),
  statusFieldId: z.string().min(1).describe('Status field ID (GraphQL global ID)'),
  newStatus: z.string().min(1).describe('New status value to set (option name from single select field)'),
  addComment: z.boolean().optional().describe('Whether to add a comment about the status change'),
  commentBody: z.string().optional().describe('Comment body text (required if addComment is true)'),
});

/**
 * Tipo dos parâmetros de entrada para gerenciar status de tarefas
 */
export type ManageTaskStatusParams = z.infer<typeof ManageTaskStatusSchema>;

/**
 * Mutation GraphQL para atualizar o status de uma tarefa
 */
const UPDATE_TASK_STATUS_MUTATION = `
  mutation UpdateTaskStatus($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
        fieldValues(first: 20) {
          nodes {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              field {
                ... on ProjectV2FieldCommon {
                  id
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
          }
          ... on PullRequest {
            id
            title
            number
            url
          }
          ... on DraftIssue {
            id
            title
          }
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para adicionar um comentário a uma issue
 */
const ADD_COMMENT_MUTATION = `
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      commentEdge {
        node {
          id
          url
        }
      }
    }
  }
`;

/**
 * Query GraphQL para obter os detalhes do item do projeto
 */
const GET_ITEM_DETAILS_QUERY = `
  query GetItemDetails($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        id
        content {
          __typename
          ... on Issue {
            id
            title
            number
            url
          }
          ... on PullRequest {
            id
            title
            number
            url
          }
          ... on DraftIssue {
            id
            title
          }
        }
      }
    }
  }
`;

/**
 * Query GraphQL para obter informações do campo de status
 */
const GET_STATUS_FIELD_INFO_QUERY = `
  query GetStatusFieldInfo($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options {
                id
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Gerencia o status de uma tarefa em um projeto do GitHub Projects V2,
 * atualizando o status e opcionalmente adicionando um comentário sobre a mudança
 */
export async function manageTaskStatus(params: ManageTaskStatusParams) {
  try {
    // Extrai parâmetros
    const { 
      projectId, 
      itemId, 
      statusFieldId, 
      newStatus, 
      addComment = false, 
      commentBody = '' 
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
    logMcpRequest('manage_task_status', {
      projectId,
      itemId,
      statusFieldId,
      newStatus,
      addComment,
      commentBody: addComment ? commentBody : '[não requisitado]'
    });
    
    // 1. Obtém informações sobre o campo de status para encontrar o ID da opção pelo nome
    const statusFieldResult = await executeGraphQL(GET_STATUS_FIELD_INFO_QUERY, {
      projectId,
    });
    
    // Encontrar o campo de status pelo ID
    const statusFields = statusFieldResult.node?.fields?.nodes || [];
    const statusField = statusFields.find((field: any) => field?.id === statusFieldId);
    
    if (!statusField) {
      return createMcpResponse({
        success: false,
        message: `Campo de status com ID ${statusFieldId} não encontrado no projeto.`,
      }, true);
    }
    
    // Verifica se é um campo de seleção única
    if (statusField.dataType !== 'SINGLE_SELECT' || !statusField.options) {
      return createMcpResponse({
        success: false,
        message: `O campo ${statusField.name} não é um campo de seleção única válido para status.`,
      }, true);
    }
    
    // Procura a opção pelo nome
    const statusOption = statusField.options.find((opt: any) => opt.name === newStatus);
    if (!statusOption) {
      return createMcpResponse({
        success: false,
        message: `Opção de status "${newStatus}" não encontrada no campo "${statusField.name}".`,
        availableOptions: statusField.options.map((opt: any) => opt.name)
      }, true);
    }
    
    // 2. Atualiza o status da tarefa com o ID correto da opção
    const statusUpdateResult = await executeGraphQL(UPDATE_TASK_STATUS_MUTATION, { 
      input: {
        projectId,
        itemId,
        fieldId: statusFieldId,
        value: { 
          singleSelectOptionId: statusOption.id 
        }
      }
    });
    
    // Verifica se houve erro ou se o item não foi atualizado
    if (!statusUpdateResult.updateProjectV2ItemFieldValue?.projectV2Item?.id) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao atualizar status da tarefa no projeto.',
      }, true);
    }
    
    const updatedItem = statusUpdateResult.updateProjectV2ItemFieldValue.projectV2Item;
    
    // 3. Adiciona comentário se solicitado
    let commentResult = null;
    if (addComment && commentBody) {
      // Primeiro precisamos obter o conteúdo real (Issue ou PR) para adicionar o comentário
      const itemDetails = await executeGraphQL(GET_ITEM_DETAILS_QUERY, { itemId });
      
      if (itemDetails.node?.content) {
        const content = itemDetails.node.content;
        
        // Só podemos adicionar comentários em Issues ou PRs, não em DraftIssues
        if (content.__typename === 'Issue' || content.__typename === 'PullRequest') {
          try {
            commentResult = await executeGraphQL(ADD_COMMENT_MUTATION, {
              input: {
                subjectId: content.id,
                body: commentBody
              }
            });
          } catch (commentError) {
            // Registra o erro do comentário, mas não falha a operação toda se o status já foi atualizado
            logMcpError('manage_task_status', commentError);
            commentResult = { error: 'Falha ao adicionar comentário, mas o status foi atualizado com sucesso.' };
          }
        } else {
          commentResult = { 
            warning: 'Comentários só podem ser adicionados a Issues ou Pull Requests, não a rascunhos.' 
          };
        }
      } else {
        commentResult = { 
          warning: 'Não foi possível obter detalhes do item para adicionar comentário.' 
        };
      }
    }
    
    // Extrai os valores dos campos atualizados (em particular o status)
    const fieldsObj: Record<string, any> = {};
    
    // Processa os valores dos campos para melhor visualização
    if (updatedItem.fieldValues?.nodes) {
      updatedItem.fieldValues.nodes.forEach((fieldValue: any) => {
        if (fieldValue?.field?.name) {
          const fieldName = fieldValue.field.name;
          
          // Para valores de seleção única (como status)
          if ('name' in fieldValue) {
            fieldsObj[fieldName] = fieldValue.name;
          }
        }
      });
    }
    
    // Determina o tipo e detalhes do conteúdo
    let contentInfo = null;
    if (updatedItem.content) {
      if (updatedItem.content.__typename === 'DraftIssue') {
        contentInfo = {
          type: 'DRAFT',
          title: updatedItem.content.title,
        };
      } else {
        // Issue ou PR
        contentInfo = {
          type: updatedItem.content.__typename,
          title: updatedItem.content.title,
          number: updatedItem.content.number,
          url: updatedItem.content.url
        };
      }
    }
    
    // Log da resposta MCP
    logMcpResponse('manage_task_status', {
      success: true,
      itemId,
      newStatus,
      statusOptionId: statusOption.id,
      fields: fieldsObj,
      contentInfo,
      commentAdded: commentResult ? true : false
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Status da tarefa atualizado com sucesso para "${newStatus}".`,
      projectId: projectId,
      itemId: itemId,
      statusFieldId: statusFieldId,
      statusFieldName: statusField.name,
      newStatus: newStatus,
      content: contentInfo,
      fields: fieldsObj,
      comment: commentResult || undefined
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('manage_task_status', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao gerenciar status da tarefa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 