import { z } from 'zod';
import { executeGraphQL, executeRest } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';
import { createDraftItem } from './create-draft-item.js';

/**
 * Schema de validação para criar tarefas
 */
export const CreateTaskSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  title: z.string().min(1).describe('Task title'),
  body: z.string().optional().describe('Task description/body'),
  repositoryId: z.string().optional().describe('Repository ID (optional, required to create a real issue)'),
  assignees: z.array(z.string()).optional().describe('GitHub usernames to assign to the task'),
  labels: z.array(z.string()).optional().describe('Labels to add to the task'),
  milestone: z.string().optional().describe('Milestone ID to associate with the task'),
  asDraftItem: z.boolean().optional().describe('Create as draft item instead of real issue (default: false)'),
  customFields: z.array(
    z.object({
      fieldId: z.string().describe('Field ID (GraphQL global ID)'),
      value: z.string().describe('Value to set (format depends on field type)'),
    })
  ).optional().describe('Custom fields to set on the task'),
});

/**
 * Tipo dos parâmetros de entrada para criar tarefas
 */
export type CreateTaskParams = z.infer<typeof CreateTaskSchema>;

/**
 * Query GraphQL para obter o nome do repositório a partir do ID
 */
const GET_REPOSITORY_INFO_QUERY = `
  query GetRepositoryInfo($id: ID!) {
    node(id: $id) {
      ... on Repository {
        id
        name
        owner {
          login
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para adicionar um item existente ao projeto
 */
const ADD_ITEM_TO_PROJECT_MUTATION = `
  mutation AddItemToProject($input: AddProjectV2ItemByIdInput!) {
    addProjectV2ItemById(input: $input) {
      item {
        id
        content {
          __typename
          ... on Issue {
            id
            title
            number
            url
          }
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para atualizar um campo de item
 */
const UPDATE_ITEM_FIELD_MUTATION = `
  mutation UpdateItemField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
      }
    }
  }
`;

/**
 * Query GraphQL para obter informações do campo
 */
const GET_FIELD_INFO_QUERY = `
  query GetFieldInfo($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2IterationField {
              id
              name
              dataType
              configuration {
                iterations {
                  id
                  title
                }
              }
            }
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
 * Cria uma nova tarefa em um projeto GitHub Projects V2
 * Pode criar como um rascunho ou como uma issue real
 */
export async function createTask(params: CreateTaskParams) {
  try {
    // Extrai parâmetros
    const { 
      projectId, 
      title, 
      body = '',
      repositoryId = null,
      assignees = [],
      labels = [],
      milestone = null,
      asDraftItem = false,
      customFields = []
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
    logMcpRequest('create_task', {
      projectId,
      title,
      bodyLength: body?.length || 0,
      repositoryId: repositoryId || '[não fornecido]',
      assignees,
      labels,
      milestone: milestone || '[não fornecido]',
      asDraftItem,
      customFieldsCount: customFields?.length || 0
    });
    
    let itemId, itemUrl, itemContent;
    
    // Determina se deve criar um rascunho ou uma issue real
    if (asDraftItem || !repositoryId) {
      // Usa a função createDraftItem existente que já está funcionando
      const draftItemResponse = await createDraftItem({
        projectId,
        title,
        body
      });
      
      // O resultado será um objeto MCP
      const responseContent = draftItemResponse.content?.[0]?.text;
      if (!responseContent) {
        return createMcpResponse({
          success: false,
          message: 'Falha ao criar item de rascunho no projeto: resposta inválida.',
        }, true);
      }
      
      // Converte a string JSON para objeto
      const draftItemData = JSON.parse(responseContent);
      
      if (!draftItemData.success || !draftItemData.item?.id) {
        return createMcpResponse({
          success: false,
          message: 'Falha ao criar item de rascunho no projeto.',
          details: draftItemData
        }, true);
      }
      
      itemId = draftItemData.item.id;
      itemContent = {
        type: 'DRAFT',
        id: draftItemData.item.contentId,
        title: draftItemData.item.title,
        body: draftItemData.item.body
      };
      
    } else {
      // Cria uma issue real se o repositório foi especificado
      
      // 1. Obtém informações do repositório para criar a issue
      const repoInfo = await executeGraphQL(GET_REPOSITORY_INFO_QUERY, { id: repositoryId });
      
      if (!repoInfo.node?.name || !repoInfo.node?.owner?.login) {
        return createMcpResponse({
          success: false,
          message: 'Falha ao obter informações do repositório.',
        }, true);
      }
      
      const owner = repoInfo.node.owner.login;
      const repo = repoInfo.node.name;
      
      // 2. Cria a issue usando a API REST
      const issueParams: Record<string, any> = {
        title,
        body,
      };
      
      // Adiciona assignees se fornecidos
      if (assignees.length > 0) {
        issueParams.assignees = assignees;
      }
      
      // Adiciona labels se fornecidas
      if (labels.length > 0) {
        issueParams.labels = labels;
      }
      
      // Adiciona milestone se fornecido
      if (milestone) {
        issueParams.milestone = milestone;
      }
      
      // Cria a issue
      const issueResult = await executeRest(
        `/repos/${owner}/${repo}/issues`,
        'POST',
        issueParams
      );
      
      if (!issueResult.node_id) {
        return createMcpResponse({
          success: false,
          message: 'Falha ao criar issue no repositório.',
        }, true);
      }
      
      // 3. Adiciona a issue ao projeto
      const addItemResult = await executeGraphQL(ADD_ITEM_TO_PROJECT_MUTATION, {
        input: {
          projectId,
          contentId: issueResult.node_id
        }
      });
      
      if (!addItemResult.addProjectV2ItemById?.item?.id) {
        return createMcpResponse({
          success: false,
          message: 'Issue criada, mas falha ao adicioná-la ao projeto.',
          issueUrl: issueResult.html_url
        }, true);
      }
      
      itemId = addItemResult.addProjectV2ItemById.item.id;
      itemUrl = issueResult.html_url;
      itemContent = {
        type: 'ISSUE',
        id: issueResult.node_id,
        number: issueResult.number,
        title: issueResult.title,
        url: issueResult.html_url,
        repository: {
          owner,
          name: repo
        }
      };
    }
    
    // Atualiza campos personalizados se houver
    const customFieldResults = [];
    if (customFields && customFields.length > 0) {
      for (const field of customFields) {
        try {
          // Primeiro, obtem informações sobre o campo para determinar seu tipo
          const fieldInfoResult = await executeGraphQL(GET_FIELD_INFO_QUERY, { projectId });
          
          // Encontrar o campo pelo ID
          const fields = fieldInfoResult.node?.fields?.nodes || [];
          const fieldInfo = fields.find((f: any) => f?.id === field.fieldId);
          
          if (!fieldInfo) {
            customFieldResults.push({
              fieldId: field.fieldId,
              success: false,
              error: `Campo com ID ${field.fieldId} não encontrado no projeto.`
            });
            continue;
          }
          
          // Determina o formato de valor correto com base no tipo de campo
          let formattedValue;
          
          switch (fieldInfo.dataType) {
            case 'TEXT':
              formattedValue = { text: field.value };
              break;
              
            case 'NUMBER':
              const num = Number(field.value);
              if (isNaN(num)) {
                customFieldResults.push({
                  fieldId: field.fieldId,
                  success: false,
                  error: `Valor "${field.value}" não é um número válido para o campo "${fieldInfo.name}".`
                });
                continue;
              }
              formattedValue = { number: num };
              break;
              
            case 'DATE':
              if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(field.value)) {
                customFieldResults.push({
                  fieldId: field.fieldId,
                  success: false,
                  error: `Valor "${field.value}" não é uma data válida. Use o formato ISO 8601 (YYYY-MM-DD).`
                });
                continue;
              }
              formattedValue = { date: field.value };
              break;
              
            case 'SINGLE_SELECT':
              // Para campos de seleção única, precisamos encontrar o ID da opção pelo nome
              const option = fieldInfo.options?.find((opt: any) => opt.name === field.value);
              
              if (!option) {
                customFieldResults.push({
                  fieldId: field.fieldId,
                  success: false,
                  error: `Opção "${field.value}" não encontrada para o campo de seleção "${fieldInfo.name}".`,
                  availableOptions: fieldInfo.options?.map((opt: any) => opt.name) || []
                });
                continue;
              }
              
              formattedValue = { singleSelectOptionId: option.id };
              break;
              
            case 'ITERATION':
              // Para campos de iteração, precisamos encontrar o ID da iteração pelo título
              const iteration = fieldInfo.configuration?.iterations?.find(
                (iter: any) => iter.title === field.value
              );
              
              if (!iteration) {
                customFieldResults.push({
                  fieldId: field.fieldId,
                  success: false,
                  error: `Iteração "${field.value}" não encontrada para o campo "${fieldInfo.name}".`,
                  availableIterations: fieldInfo.configuration?.iterations?.map((iter: any) => iter.title) || []
                });
                continue;
              }
              
              formattedValue = { iterationId: iteration.id };
              break;
              
            default:
              customFieldResults.push({
                fieldId: field.fieldId,
                success: false,
                error: `Tipo de campo "${fieldInfo.dataType}" não suportado.`
              });
              continue;
          }
          
          // Atualiza o campo
          const fieldUpdateResult = await executeGraphQL(UPDATE_ITEM_FIELD_MUTATION, {
            input: {
              projectId,
              itemId,
              fieldId: field.fieldId,
              value: formattedValue
            }
          });
          
          customFieldResults.push({
            fieldId: field.fieldId,
            fieldName: fieldInfo.name,
            fieldType: fieldInfo.dataType,
            value: field.value,
            success: !!fieldUpdateResult.updateProjectV2ItemFieldValue?.projectV2Item?.id
          });
        } catch (fieldError) {
          customFieldResults.push({
            fieldId: field.fieldId,
            success: false,
            error: fieldError instanceof Error ? fieldError.message : 'Erro desconhecido'
          });
        }
      }
    }
    
    // Log da resposta MCP
    logMcpResponse('create_task', {
      success: true,
      itemId,
      itemUrl: itemUrl || '[rascunho]',
      isDraft: asDraftItem || !repositoryId,
      customFieldsUpdated: customFieldResults.length
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: asDraftItem || !repositoryId
        ? 'Item de rascunho criado com sucesso no projeto.'
        : 'Issue criada e adicionada com sucesso ao projeto.',
      projectId,
      itemId,
      content: itemContent,
      url: itemUrl,
      customFields: customFieldResults
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('create_task', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao criar tarefa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 