import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para atualizar campos de item
 */
export const UpdateProjectItemSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  itemId: z.string().min(1).describe('Item ID (GraphQL global ID)'),
  fieldId: z.string().min(1).describe('Field ID (GraphQL global ID)'),
  value: z.string().describe('Value to set for the field as a string. For complex values, use JSON format.'),
});

/**
 * Tipo dos parâmetros de entrada para atualizar campos de item
 */
export type UpdateProjectItemParams = z.infer<typeof UpdateProjectItemSchema>;

/**
 * Mutation GraphQL para atualizar um campo de item
 */
const UPDATE_PROJECT_ITEM_FIELD_MUTATION = `
  mutation UpdateProjectItemField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
        fieldValues(first: 20) {
          nodes {
            ... on ProjectV2ItemFieldTextValue {
              text
              field {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldDateValue {
              date
              field {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              field {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldNumberValue {
              number
              field {
                ... on ProjectV2FieldCommon {
                  id
                  name
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
 * Atualiza o valor de um campo específico de um item em um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param itemId ID do item a ser atualizado
 * @param fieldId ID do campo a ser atualizado
 * @param value Valor a ser definido para o campo (como string)
 */
export async function updateProjectItem(params: {
  projectId: string;
  itemId: string;
  fieldId: string;
  value: string;
}) {
  try {
    // Extrai parâmetros
    const { projectId, itemId, fieldId, value } = params;
    
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
    logMcpRequest('update_project_item', {
      projectId,
      itemId,
      fieldId,
      value
    });
    
    // Prepara o valor de entrada para a mutation baseado no tipo de valor
    const parsedValue = parseValueInput(value);
    
    // Executa a mutation GraphQL para atualizar o campo
    const result = await executeGraphQL(UPDATE_PROJECT_ITEM_FIELD_MUTATION, { 
      input: {
        projectId,
        itemId,
        fieldId,
        value: parsedValue
      }
    });
    
    // Verifica se houve erro ou se o item não foi atualizado
    if (!result.updateProjectV2ItemFieldValue?.projectV2Item?.id) {
      return createMcpResponse({
        success: false,
        message: 'Falha ao atualizar campo do item no projeto.',
      }, true);
    }
    
    const updatedItem = result.updateProjectV2ItemFieldValue.projectV2Item;
    
    // Extrai os valores dos campos atualizados
    const fieldsObj: Record<string, any> = {};
    
    // Processa os valores dos campos para melhor visualização
    if (updatedItem.fieldValues?.nodes) {
      updatedItem.fieldValues.nodes.forEach((fieldValue: any) => {
        if (fieldValue?.field?.name) {
          const fieldName = fieldValue.field.name;
          
          // Determina o valor com base no tipo de campo
          let fieldValueData = null;
          if ('text' in fieldValue) {
            fieldValueData = fieldValue.text;
          } else if ('date' in fieldValue) {
            fieldValueData = fieldValue.date;
          } else if ('name' in fieldValue) {
            fieldValueData = fieldValue.name;
          } else if ('number' in fieldValue) {
            fieldValueData = fieldValue.number;
          }
          
          // Adiciona ao objeto de campos
          fieldsObj[fieldName] = fieldValueData;
        }
      });
    }
    
    // Log da resposta MCP
    logMcpResponse('update_project_item', {
      success: true,
      itemId,
      updatedFields: fieldsObj
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Campo atualizado com sucesso no item.`,
      projectId: projectId,
      itemId: itemId,
      fieldId: fieldId,
      fields: fieldsObj
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('update_project_item', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao atualizar campo do item: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
}

/**
 * Processa e converte o valor de entrada para o formato esperado pela API
 * @param value Valor a ser processado (como string)
 * @returns Objeto formatado para a API do GitHub
 */
function parseValueInput(value: string): object {
  try {
    // Tenta interpretar como JSON
    if (value.trim().startsWith('{') && value.trim().endsWith('}')) {
      return JSON.parse(value);
    }
    
    // É uma string com formato de data ISO?
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value)) {
      return { date: value };
    }
    
    // É um número?
    const num = Number(value);
    if (!isNaN(num) && value.trim() === num.toString()) {
      return { number: num };
    }
    
    // Valor vazio?
    if (!value.trim()) {
      return { text: "" };
    }
    
    // Default: trata como texto
    return { text: value };
  } catch (e) {
    // Em caso de erro ao processar, usa como texto
    return { text: value };
  }
} 