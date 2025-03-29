/**
 * Operations for managing GitHub Projects (V2)
 */
import { z } from "zod";
import { graphqlRequest, escapeGraphQLString, checkTokenType } from "../common/utils.js";
import { createGitHubError, isGitHubError, formatGitHubError, GitHubError } from "../common/errors.js";

// Schemas
export const ListProjectsSchema = z.object({
  owner: z.string().describe("Username or organization name"),
  type: z.enum(["user", "organization"]).describe("Type of owner (user or organization)"),
  first: z.number().optional().describe("Number of projects to return"),
});

export const GetProjectSchema = z.object({
  project_id: z.string().describe("ID of the project"),
});

export const CreateProjectSchema = z.object({
  owner: z.string().describe("Username or organization name"),
  title: z.string().describe("Title of the project"),
  description: z.string().optional().describe("Description of the project"),
  type: z.enum(["user", "organization"]).describe("Type of owner (user or organization)"),
});

export const UpdateProjectSchema = z.object({
  project_id: z.string().describe("ID of the project"),
  title: z.string().optional().describe("New title for the project"),
  closed: z.boolean().optional().describe("Whether the project is closed"),
  description: z.string().optional().describe("New description for the project"),
});

export const DeleteProjectSchema = z.object({
  project_id: z.string().describe("ID of the project"),
});

/**
 * List GitHub Projects (V2) for a user or organization
 * 
 * @param owner Username or organization name
 * @param type Type of owner (user or organization)
 * @param first Number of projects to return (default: 20)
 * @returns List of projects
 */
export async function listProjects(
  owner: string,
  type: "user" | "organization",
  first: number = 20
) {
  // Check token type first to provide better error messages
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub token not found. Please set the GITHUB_TOKEN environment variable.");
  }
  
  try {
    const tokenInfo = await checkTokenType(token);
    
    // If using fine-grained token with organization projects, provide a helpful error
    if (tokenInfo.type === 'fine-grained' && type === 'organization') {
      throw createGitHubError(403, {
        message: "GraphQL request failed: Fine-grained tokens cannot access organization projects via GraphQL API",
        tokenType: 'fine-grained',
        errors: [{
          message: "Fine-grained tokens have limited access to GraphQL API, especially for organization resources"
        }]
      });
    }
    
    const safeOwner = escapeGraphQLString(owner);
    const query = type === "user" 
      ? `
        query {
          user(login: "${safeOwner}") {
            projectsV2(first: ${first}) {
              nodes {
                id
                title
                number
                closed
                url
                createdAt
                updatedAt
              }
            }
          }
        }
      `
      : `
        query {
          organization(login: "${safeOwner}") {
            projectsV2(first: ${first}) {
              nodes {
                id
                title
                number
                closed
                url
                createdAt
                updatedAt
              }
            }
          }
        }
      `;

    const response = await graphqlRequest(query);
    
    // Extrair dados de maneira segura
    let projects = [];
    
    if (type === "user") {
      // Tentar extrair projetos de um usuário
      projects = response?.user?.projectsV2?.nodes || [];
    } else {
      // Tentar extrair projetos de uma organização
      projects = response?.organization?.projectsV2?.nodes || [];
    }
    
    // Se projects não for um array, convertê-lo para array
    if (!Array.isArray(projects)) {
      if (projects && typeof projects === 'object') {
        // Se for um objeto, transformar em um array com este objeto
        projects = [projects];
      } else {
        // Se não for nem array nem objeto, retornar array vazio
        projects = [];
      }
    }
    
    // Garantir que cada projeto tenha os campos necessários
    return projects.map(project => ({
      id: project.id || `project-${Date.now()}`,
      title: project.title || 'Untitled Project',
      number: project.number || 0,
      closed: project.closed || false,
      url: project.url || '',
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: project.updatedAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error(`Error listing projects for ${type} ${owner}:`, error);
    // Reempacotar o erro para não quebrar o fluxo
    if (isGitHubError(error)) {
      return { 
        error: formatGitHubError(error as GitHubError),
        errorType: 'GitHub',
        owner,
        type
      };
    } else {
      return {
        error: `Error: ${error instanceof Error ? error.message : String(error)}`,
        errorType: 'General',
        owner,
        type
      };
    }
  }
}

/**
 * Get details of a GitHub Project (V2)
 * 
 * @param projectId ID of the project
 * @returns Project details
 */
export async function getProject(projectId: string) {
  const safeProjectId = escapeGraphQLString(projectId);
  const query = `
    query {
      node(id: "${safeProjectId}") {
        ... on ProjectV2 {
          id
          title
          number
          url
          closed
          createdAt
          updatedAt
          readme
          shortDescription
          public
          items(first: 20) {
            totalCount
          }
          fields(first: 20) {
            nodes {
              ... on ProjectV2FieldCommon {
                id
                name
              }
            }
          }
          views(first: 20) {
            nodes {
              id
              name
              layout
            }
          }
        }
      }
    }
  `;

  try {
    const response = await graphqlRequest(query);
    
    if (!response?.node) {
      throw createGitHubError(404, {
        message: `Project not found with ID: ${projectId}`,
        errors: []
      });
    }
    
    return response.node;
  } catch (error) {
    console.error(`Error getting project details for ID ${projectId}:`, error);
    throw error;
  }
}

/**
 * Create a new GitHub Project (V2)
 * 
 * @param owner Username or organization name
 * @param title Title of the project
 * @param type Type of owner (user or organization)
 * @param description Optional description of the project (ignored)
 * @returns Created project
 */
export async function createProject(
  owner: string,
  title: string,
  type: "user" | "organization",
  description?: string
) {
  const safeOwner = escapeGraphQLString(owner);
  const safeTitle = escapeGraphQLString(title);
  
  // First, we need to get the owner ID
  const ownerQuery = type === "user" 
    ? `query { user(login: "${safeOwner}") { id } }`
    : `query { organization(login: "${safeOwner}") { id } }`;

  const ownerResponse = await graphqlRequest(ownerQuery);
  const ownerId = type === "user" 
    ? (ownerResponse as any).user.id 
    : (ownerResponse as any).organization.id;

  // Now create the project - note: description parameters are not supported in current API
  const mutation = `
    mutation {
      createProjectV2(input: {
        ownerId: "${ownerId}"
        title: "${safeTitle}"
      }) {
        projectV2 {
          id
          title
          number
          url
        }
      }
    }
  `;

  const response = await graphqlRequest(mutation);
  return (response as any).createProjectV2.projectV2;
}

/**
 * Update an existing GitHub Project (V2)
 * 
 * @param projectId ID of the project
 * @param title Optional new title for the project
 * @param closed Optional flag to close or open the project
 * @param description Optional new description for the project (ignored)
 * @returns Updated project
 */
export async function updateProject(
  projectId: string,
  title?: string,
  closed?: boolean,
  description?: string
) {
  const safeProjectId = escapeGraphQLString(projectId);
  
  let updateFields = "";
  if (title) updateFields += `title: "${escapeGraphQLString(title)}" `;
  if (closed !== undefined) updateFields += `closed: ${closed} `;
  // description is ignored as it's not supported by the API

  const mutation = `
    mutation {
      updateProjectV2(input: {
        projectId: "${safeProjectId}"
        ${updateFields}
      }) {
        projectV2 {
          id
          title
          number
          closed
        }
      }
    }
  `;

  const response = await graphqlRequest(mutation);
  return (response as any).updateProjectV2.projectV2;
}

/**
 * Delete a GitHub Project (V2)
 * 
 * @param projectId ID of the project
 * @returns Success status
 */
export async function deleteProject(projectId: string) {
  const safeProjectId = escapeGraphQLString(projectId);
  
  const mutation = `
    mutation {
      deleteProjectV2(input: {
        projectId: "${safeProjectId}"
      }) {
        clientMutationId
      }
    }
  `;

  await graphqlRequest(mutation);
  return { success: true };
}