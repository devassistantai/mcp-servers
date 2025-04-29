import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para criar campos em um projeto
 */
export const CreateProjectFieldSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  name: z.string().min(1).describe('Field name'),
  dataType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT']).describe('Field data type'),
  options: z.array(z.object({
    name: z.string().min(1),
    color: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED', 'PURPLE', 'BLUE', 'PINK', 'GRAY']).optional()
  })).optional().describe('Options for single select fields')
});

/**
 * Tipo dos parâmetros de entrada para criar campos
 */
export type CreateProjectFieldParams = z.infer<typeof CreateProjectFieldSchema>;

/**
 * Mutation GraphQL para criar um campo de texto em um projeto
 */
const CREATE_TEXT_FIELD_MUTATION = `
  mutation CreateTextField($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      name: $name,
      dataType: $dataType
    }) {
      clientMutationId
    }
  }
`;

/**
 * Mutation GraphQL para criar um campo de seleção única em um projeto
 */
const CREATE_SINGLE_SELECT_FIELD_MUTATION = `
  mutation CreateSingleSelectField($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      name: $name,
      dataType: SINGLE_SELECT,
      singleSelectOptions: $options
    }) {
      clientMutationId
    }
  }
`;

/**
 * Cria um novo campo em um projeto GitHub Projects V2
 * @param projectId ID do projeto (ID global do GraphQL)
 * @param name Nome do campo a ser criado
 * @param dataType Tipo de dados do campo (TEXT, NUMBER, DATE, SINGLE_SELECT)
 * @param options Opções para campos de seleção única (opcional)
 */
export async function createProjectField(params: {
  projectId: string;
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT';
  options?: Array<{
    name: string;
    color?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE' | 'BLUE' | 'PINK' | 'GRAY';
  }>;
}) {
  try {
    // Extrai parâmetros
    const { projectId, name, dataType, options = [] } = params;
    
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
    
    // Valida parâmetros específicos para cada tipo de campo
    if (dataType === 'SINGLE_SELECT' && (!options || options.length === 0)) {
      return createMcpResponse({
        success: false,
        message: 'É necessário fornecer pelo menos uma opção para campos do tipo SINGLE_SELECT.',
      }, true);
    }
    
    // Log da solicitação MCP
    logMcpRequest('create_project_field', {
      projectId,
      name,
      dataType,
      options
    });
    
    let result;
    
    // Executa a mutation apropriada baseada no tipo de campo
    switch (dataType) {
      case 'TEXT':
      case 'NUMBER':
      case 'DATE':
        result = await executeGraphQL(CREATE_TEXT_FIELD_MUTATION, {
          projectId,
          name,
          dataType
        });
        
        if (!result.createProjectV2Field) {
          throw new Error(`Falha ao criar campo de ${dataType.toLowerCase()}.`);
        }
        
        return createMcpResponse({
          success: true,
          message: `Campo de ${dataType.toLowerCase()} "${name}" criado com sucesso.`,
          projectId,
          field: {
            name,
            dataType
          }
        });
        
      case 'SINGLE_SELECT':
        result = await executeGraphQL(CREATE_SINGLE_SELECT_FIELD_MUTATION, {
          projectId,
          name,
          options: options.map(option => ({
            name: option.name,
            color: option.color || 'GRAY',
            description: ''
          }))
        });
        
        if (!result.createProjectV2Field) {
          throw new Error('Falha ao criar campo de seleção única.');
        }
        
        return createMcpResponse({
          success: true,
          message: `Campo de seleção única "${name}" criado com sucesso.`,
          projectId,
          field: {
            name,
            dataType,
            options: options
          }
        });
        
      default:
        return createMcpResponse({
          success: false,
          message: `Tipo de campo não suportado: ${dataType}`
        }, true);
    }
    
  } catch (error) {
    // Log do erro
    logMcpError('create_project_field', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao criar campo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 