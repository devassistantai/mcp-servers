import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { DEFAULT_PAGE_SIZE } from '../utils/constants.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para listar campos de um projeto
 */
export const ListProjectFieldsSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  first: z.number().optional().describe('Number of fields to return'),
});

/**
 * Tipo dos parâmetros de entrada para listar campos
 */
export type ListProjectFieldsParams = z.infer<typeof ListProjectFieldsSchema>;

/**
 * Query GraphQL para obter campos de um projeto (V2)
 */
const PROJECT_FIELDS_QUERY = `
  query getProjectFields($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        title
        number
        fields(first: $first) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2FieldCommon {
              id
              name
              dataType
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
            ... on ProjectV2IterationField {
              id
              name
              dataType
              configuration {
                duration
                startDay
                iterations {
                  id
                  title
                  startDate
                  duration
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
 * Processa dados de diferentes tipos de campos
 * @param field Objeto de campo retornado pela API
 * @returns Objeto de campo processado com informações formatadas
 */
function processField(field: any): any {
  // Extrair propriedades básicas presentes em todos os tipos de campos
  const baseField = {
    id: field.id,
    name: field.name,
    dataType: field.dataType,
  };

  // Adicionar propriedades específicas de cada tipo de campo
  if (field.dataType === 'SINGLE_SELECT' && field.options) {
    // Campo de seleção única
    return {
      ...baseField,
      options: field.options.map((option: any) => ({
        id: option.id,
        name: option.name,
        color: option.color
      }))
    };
  } else if (field.dataType === 'ITERATION' && field.configuration) {
    // Campo de iteração
    return {
      ...baseField,
      configuration: {
        duration: field.configuration.duration,
        startDay: field.configuration.startDay,
        iterations: field.configuration.iterations?.map((iteration: any) => ({
          id: iteration.id,
          title: iteration.title,
          startDate: iteration.startDate,
          duration: iteration.duration
        }))
      }
    };
  }

  // Campo padrão para outros tipos (TEXT, NUMBER, DATE, etc.)
  return baseField;
}

/**
 * Lista os campos de um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param first Número de campos a retornar (opcional, padrão 20)
 */
export async function listProjectFields(params: {
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
    logMcpRequest('list_project_fields', {
      projectId,
      first
    });
    
    // Executa a query GraphQL para buscar os campos do projeto
    const result = await executeGraphQL(PROJECT_FIELDS_QUERY, { 
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
    const fields = project.fields?.nodes || [];
    const pageInfo = project.fields?.pageInfo || { hasNextPage: false, endCursor: null };
    
    // Processa os campos para formato adequado
    const processedFields = fields.map(processField);
    
    // Log da resposta MCP
    logMcpResponse('list_project_fields', {
      success: true,
      projectId,
      fieldsCount: processedFields.length
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: true,
      message: `Campos do projeto "${project.title}" (#${project.number}) recuperados com sucesso.`,
      projectId: projectId,
      projectTitle: project.title,
      projectNumber: project.number,
      fields: processedFields,
      pagination: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor
      }
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('list_project_fields', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao listar campos do projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 