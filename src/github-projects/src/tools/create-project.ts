import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Ferramenta MCP: create_project
 * 
 * Cria um novo projeto do GitHub Projects V2 para um usuário ou organização.
 * 
 * No formato MCP, esta ferramenta pode ser invocada assim:
 * 
 * ```json
 * {
 *   "name": "create_project",
 *   "arguments": {
 *     "owner": "lucianotonet",
 *     "type": "user",
 *     "title": "Meu Projeto",
 *     "description": "Descrição do projeto",
 *     "layout": "BOARD",
 *     "public": true
 *   }
 * }
 * ```
 * 
 * Resposta de sucesso:
 * ```json
 * {
 *   "content": [
 *     {
 *       "type": "text",
 *       "text": "{\"success\":true,\"message\":\"Projeto criado com sucesso\",\"project\":{...}}"
 *     }
 *   ]
 * }
 * ```
 * 
 * Resposta de erro:
 * ```json
 * {
 *   "isError": true,
 *   "content": [
 *     {
 *       "type": "text",
 *       "text": "{\"success\":false,\"message\":\"Erro ao criar projeto\",\"error\":\"...\"}"
 *     }
 *   ]
 * }
 * ```
 */

/**
 * Schema de validação para criar projetos
 * 
 * Parâmetros:
 * - owner (string): Nome do usuário ou organização (obrigatório)
 * - type ('user'|'organization'): Tipo de proprietário (obrigatório)
 * - title (string): Título do projeto (obrigatório)
 * - description (string): Descrição do projeto (opcional)
 * - layout ('BOARD'|'TABLE'): Tipo de layout do projeto (opcional, padrão: BOARD)
 * - public (boolean): Se o projeto deve ser público (opcional, padrão: false)
 */
export const CreateProjectSchema = z.object({
  owner: z.string().min(1).describe('Username or organization name'),
  type: z.enum(['user', 'organization']).describe('Type of owner (user or organization)'),
  title: z.string().min(1).describe('Project title'),
  description: z.string().optional().describe('Project description'),
  layout: z.enum(['BOARD', 'TABLE']).optional().describe('Project layout type (BOARD or TABLE)'),
  public: z.boolean().optional().describe('Whether the project is public'),
});

/**
 * Tipo dos parâmetros de entrada para criar projetos
 */
export type CreateProjectParams = z.infer<typeof CreateProjectSchema>;

/**
 * Query GraphQL para obter o ID global do usuário
 */
const GET_USER_ID_QUERY = `
  query getUserId($login: String!) {
    user(login: $login) {
      id
    }
  }
`;

/**
 * Query GraphQL para obter o ID global da organização
 */
const GET_ORG_ID_QUERY = `
  query getOrgId($login: String!) {
    organization(login: $login) {
      id
    }
  }
`;

/**
 * Mutation GraphQL para criar um projeto de usuário
 */
const CREATE_USER_PROJECT_MUTATION = `
  mutation createUserProject($input: CreateProjectV2Input!) {
    createProjectV2(
      input: $input
    ) {
      projectV2 {
        id
        number
        title
        shortDescription
        url
        closed
        createdAt
        updatedAt
        owner {
          ... on User {
            login
          }
        }
      }
    }
  }
`;

/**
 * Mutation GraphQL para criar um projeto de organização
 */
const CREATE_ORG_PROJECT_MUTATION = `
  mutation createOrgProject($input: CreateProjectV2Input!) {
    createProjectV2(
      input: $input
    ) {
      projectV2 {
        id
        number
        title
        shortDescription
        url
        closed
        createdAt
        updatedAt
        owner {
          ... on Organization {
            login
          }
        }
      }
    }
  }
`;

/**
 * Implementação da ferramenta MCP: create_project
 * 
 * Esta função segue o padrão MCP de resposta:
 * - Respostas bem-sucedidas retornam um objeto com a propriedade content
 * - Erros retornam um objeto com as propriedades isError e content
 * 
 * @param params Parâmetros para criação do projeto
 * @returns Resposta no formato MCP com os dados do projeto criado ou mensagem de erro
 * 
 * @example
 * // Criar um projeto para usuário
 * createProject({
 *   owner: "octocat",
 *   type: "user",
 *   title: "Meu Projeto",
 *   public: true
 * });
 * 
 * @example
 * // Criar um projeto para organização
 * createProject({
 *   owner: "github",
 *   type: "organization",
 *   title: "Projeto da Organização",
 *   description: "Descrição detalhada",
 *   layout: "BOARD"
 * });
 */
export async function createProject(params: CreateProjectParams) {
  try {
    // Extrai parâmetros
    const { 
      owner, 
      type, 
      title, 
      description = "", 
      layout = "BOARD",
      public: isPublic = false 
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
    
    // Primeiro, vamos obter o ID global do proprietário (usuário ou organização)
    let ownerId: string;
    
    try {
      // Seleciona a query com base no tipo
      const query = type === 'user' ? GET_USER_ID_QUERY : GET_ORG_ID_QUERY;
      
      // Executa a query para obter o ID
      const idResult = await executeGraphQL(query, { login: owner });
      
      // Extrai o ID do resultado
      if (type === 'user') {
        ownerId = idResult.user?.id;
        if (!ownerId) {
          throw new Error(`Usuário '${owner}' não encontrado`);
        }
      } else {
        ownerId = idResult.organization?.id;
        if (!ownerId) {
          throw new Error(`Organização '${owner}' não encontrada`);
        }
      }
    } catch (error) {
      throw new Error(`Falha ao obter ID do proprietário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    // Prepara os dados para criar o projeto
    // Na API do GitHub, apenas o ownerId e title são campos obrigatórios
    const input = {
      ownerId,
      title,
    };
    
    // Seleciona a mutation com base no tipo
    const mutation = type === 'user' ? 
      CREATE_USER_PROJECT_MUTATION : 
      CREATE_ORG_PROJECT_MUTATION;
    
    // Executa a mutation GraphQL com as variáveis
    const result = await executeGraphQL(mutation, { 
      input
    });
    
    // Extrai os dados do projeto criado
    const project = result.createProjectV2?.projectV2;
    
    if (!project) {
      throw new Error('Falha ao criar projeto. Resposta inválida da API.');
    }
    
    // Retornar o resultado
    return createMcpResponse({
      success: true,
      message: 'Projeto criado com sucesso.',
      project: {
        id: project.id,
        number: project.number,
        title: project.title,
        shortDescription: project.shortDescription,
        url: project.url,
        closed: project.closed,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        owner: project.owner.login
      }
    });
    
  } catch (error) {
    // Formatar e retornar erro
    return createMcpResponse({
      success: false,
      message: `Falha ao criar projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 