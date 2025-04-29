import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para agrupar tarefas
 */
export const GroupTasksSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  groupById: z.string().min(1).describe('Field ID to group by (GraphQL global ID)'),
  items: z.array(
    z.string().min(1).describe('Item ID (GraphQL global ID)')
  ).min(1).describe('List of item IDs to group'),
  groupValue: z.string().min(1).describe('Value to set for the group field'),
});

/**
 * Tipo dos parâmetros de entrada para agrupar tarefas
 */
export type GroupTasksParams = z.infer<typeof GroupTasksSchema>;

/**
 * Mutation GraphQL para atualizar campos de itens
 */
const UPDATE_FIELD_VALUE_MUTATION = `
  mutation UpdateFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
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
 * Agrupa várias tarefas definindo o mesmo valor para um campo específico
 * em todos os itens fornecidos em um projeto
 */
export async function groupTasks(params: GroupTasksParams) {
  try {
    // Extrai parâmetros
    const { 
      projectId, 
      groupById, 
      items, 
      groupValue 
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
    logMcpRequest('group_tasks', {
      projectId,
      groupById,
      itemsCount: items.length,
      groupValue
    });
    
    // Obter informações do campo para determinar o tipo de valor a ser usado
    const fieldInfoResult = await executeGraphQL(GET_FIELD_INFO_QUERY, { 
      projectId 
    });
    
    // Encontrar o campo pelo ID
    const fields = fieldInfoResult.node?.fields?.nodes || [];
    const field = fields.find((f: any) => f?.id === groupById);
    
    if (!field) {
      return createMcpResponse({
        success: false,
        message: `Campo com ID ${groupById} não encontrado no projeto.`,
      }, true);
    }
    
    // Determina o formato de valor correto com base no tipo de campo
    let formattedValue;
    
    switch (field.dataType) {
      case 'TEXT':
        formattedValue = { text: groupValue };
        break;
        
      case 'NUMBER':
        const num = Number(groupValue);
        if (isNaN(num)) {
          return createMcpResponse({
            success: false,
            message: `Valor "${groupValue}" não é um número válido para o campo "${field.name}".`,
          }, true);
        }
        formattedValue = { number: num };
        break;
        
      case 'DATE':
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(groupValue)) {
          return createMcpResponse({
            success: false,
            message: `Valor "${groupValue}" não é uma data válida. Use o formato ISO 8601 (YYYY-MM-DD).`,
          }, true);
        }
        formattedValue = { date: groupValue };
        break;
        
      case 'SINGLE_SELECT':
        // Para campos de seleção única, precisamos encontrar o ID da opção pelo nome
        const option = field.options?.find((opt: any) => opt.name === groupValue);
        
        if (!option) {
          return createMcpResponse({
            success: false,
            message: `Opção "${groupValue}" não encontrada para o campo de seleção "${field.name}".`,
            availableOptions: field.options?.map((opt: any) => opt.name) || []
          }, true);
        }
        
        formattedValue = { singleSelectOptionId: option.id };
        break;
        
      case 'ITERATION':
        // Para campos de iteração, precisamos encontrar o ID da iteração pelo título
        const iteration = field.configuration?.iterations?.find(
          (iter: any) => iter.title === groupValue
        );
        
        if (!iteration) {
          return createMcpResponse({
            success: false,
            message: `Iteração "${groupValue}" não encontrada para o campo "${field.name}".`,
            availableIterations: field.configuration?.iterations?.map((iter: any) => iter.title) || []
          }, true);
        }
        
        formattedValue = { iterationId: iteration.id };
        break;
        
      default:
        return createMcpResponse({
          success: false,
          message: `Tipo de campo "${field.dataType}" não suportado para agrupamento.`,
        }, true);
    }
    
    // Atualiza o campo para cada item
    const results = [];
    let successCount = 0;
    
    for (const itemId of items) {
      try {
        const result = await executeGraphQL(UPDATE_FIELD_VALUE_MUTATION, {
          input: {
            projectId,
            itemId,
            fieldId: groupById,
            value: formattedValue
          }
        });
        
        const success = !!result.updateProjectV2ItemFieldValue?.projectV2Item?.id;
        
        results.push({
          itemId,
          success
        });
        
        if (success) {
          successCount++;
        }
      } catch (itemError) {
        results.push({
          itemId,
          success: false,
          error: itemError instanceof Error ? itemError.message : 'Erro desconhecido'
        });
      }
    }
    
    // Log da resposta MCP
    logMcpResponse('group_tasks', {
      success: successCount > 0,
      totalItems: items.length,
      successfulUpdates: successCount,
      fieldName: field.name,
      fieldType: field.dataType,
      groupValue
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: successCount > 0,
      message: `${successCount} de ${items.length} itens agrupados com sucesso pelo campo "${field.name}" com valor "${groupValue}".`,
      projectId,
      fieldId: groupById,
      fieldName: field.name,
      fieldType: field.dataType,
      groupValue,
      totalItems: items.length,
      successfulUpdates: successCount,
      results
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('group_tasks', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao agrupar tarefas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 