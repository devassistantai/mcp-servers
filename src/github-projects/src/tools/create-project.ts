import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse } from '../utils/error-utils.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para criar projetos
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
 * Cria um novo projeto do GitHub (V2) para um usuário ou organização
 * @param owner Nome do usuário ou organização
 * @param type Tipo de proprietário (usuário ou organização)
 * @param title Título do projeto
 * @param description Descrição do projeto (opcional)
 * @param layout Tipo de layout do projeto (opcional, padrão BOARD)
 * @param public Se o projeto deve ser público (opcional, padrão false)
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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: 'Token do GitHub não é adequado para API GraphQL. Utilize um token clássico (ghp_).',
              tokenType: 'fine-grained',
              isValid: false
            })
          }
        ]
      };
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
    // Baseado na documentação atual do GitHub Projects v2 GraphQL API
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
    
    // Retorna os dados do projeto criado
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Projeto "${title}" criado com sucesso.`,
            project: {
              id: project.id,
              number: project.number,
              title: project.title,
              shortDescription: project.shortDescription,
              url: project.url,
              closed: project.closed,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt
            }
          })
        }
      ]
    };
    
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            message: `Falha ao criar projeto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          })
        }
      ]
    };
  }
} 