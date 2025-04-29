import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para atualizar projetos
 */
export const UpdateProjectSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  title: z.string().optional().describe('New project title'),
  description: z.string().optional().describe('New project description'),
  public: z.boolean().optional().describe('Whether the project should be public'),
  closed: z.boolean().optional().describe('Whether the project should be closed')
});

/**
 * Tipo dos parâmetros de entrada para atualizar projetos
 */
export type UpdateProjectParams = z.infer<typeof UpdateProjectSchema>;

/**
 * Mutation GraphQL para atualizar um projeto
 */
const UPDATE_PROJECT_MUTATION = `
  mutation updateProject(
    $projectId: ID!,
    $title: String,
    $shortDescription: String,
    $public: Boolean,
    $closed: Boolean
  ) {
    updateProjectV2(
      input: {
        projectId: $projectId,
        title: $title,
        shortDescription: $shortDescription,
        public: $public,
        closed: $closed
      }
    ) {
      projectV2 {
        id
        number
        title
        shortDescription
        url
        closed
        public
        createdAt
        updatedAt
      }
    }
  }
`;

/**
 * Atualiza um projeto existente no GitHub Projects V2
 * @param projectId ID global do projeto no GraphQL
 * @param title Novo título do projeto (opcional)
 * @param description Nova descrição do projeto (opcional)
 * @param public Se o projeto deve ser público (opcional)
 * @param closed Se o projeto deve ser fechado (opcional)
 */
export async function updateProject(params: {
  projectId: string;
  title?: string;
  description?: string;
  public?: boolean;
  closed?: boolean;
}) {
  try {
    // Extrai parâmetros
    const { projectId, title, description, public: isPublic, closed } = params;
    
    // Verifica se ao menos um campo para atualização foi fornecido
    if (!title && description === undefined && isPublic === undefined && closed === undefined) {
      return createMcpResponse({
        success: false,
        message: 'Pelo menos um campo para atualização deve ser fornecido.',
        error: 'Nenhum campo para atualização fornecido'
      }, true);
    }
    
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
    logMcpRequest('update_project', {
      projectId,
      title: title || '[não alterado]',
      description: description || '[não alterado]',
      public: isPublic === undefined ? '[não alterado]' : isPublic,
      closed: closed === undefined ? '[não alterado]' : closed
    });
    
    // Executa a mutation GraphQL com as variáveis
    const result = await executeGraphQL(UPDATE_PROJECT_MUTATION, { 
      projectId,
      title,
      shortDescription: description,
      public: isPublic,
      closed
    });
    
    // Extrai o projeto atualizado do resultado
    const updatedProject = result.updateProjectV2?.projectV2;
    
    if (!updatedProject) {
      throw new Error('Falha ao atualizar o projeto. Resposta da API inválida.');
    }
    
    // Log da resposta MCP
    logMcpResponse('update_project', {
      success: true,
      projectId,
      updatedProject
    });
    
    // Monta a resposta no formato MCP usando a função auxiliar
    return createMcpResponse({
      success: true,
      message: 'Projeto atualizado com sucesso.',
      project: {
        id: updatedProject.id,
        number: updatedProject.number,
        title: updatedProject.title,
        shortDescription: updatedProject.shortDescription,
        url: updatedProject.url,
        closed: updatedProject.closed,
        public: updatedProject.public,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt
      }
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('update_project', error);
    
    // Retorna resposta de erro no formato MCP
    return createMcpResponse({
      success: false,
      message: `Falha ao atualizar projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 