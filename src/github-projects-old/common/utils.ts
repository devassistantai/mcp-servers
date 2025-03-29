/**
 * Utility functions for GitHub Projects API interactions
 */
import fetch from 'node-fetch';
import { getUserAgent } from 'universal-user-agent';
import { createGitHubError, isGitHubError, GitHubError } from './errors.js';

export const USER_AGENT = getUserAgent();

/**
 * Verifica o tipo de token GitHub (clássico ou fine-grained)
 * 
 * @param token Token GitHub a ser verificado
 * @returns Objeto com informações sobre o token
 */
export async function checkTokenType(token: string) {
    try {
        // Tenta acessar a informação do usuário atual (funciona com qualquer token)
        const response = await fetch('https://api.github.com/user', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Projects-MCP-Server',
            }
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return {
                valid: false,
                type: 'unknown',
                message: data.message || 'Token inválido',
            };
        }

        // Verifica se é fine-grained ou classic
        // Os tokens fine-grained começam com "github_pat_"
        // Os tokens clássicos geralmente começam com "ghp_"
        const isFineGrained = token.startsWith('github_pat_');
        const isClassic = token.startsWith('ghp_');

        return {
            valid: true,
            type: isFineGrained ? 'fine-grained' : (isClassic ? 'classic' : 'unknown'),
            username: data.login,
            message: isFineGrained
                ? 'Atenção: Tokens fine-grained têm limitações com a API GraphQL do GitHub'
                : 'Token válido',
        };
    } catch (error) {
        console.error("Erro ao verificar token:", error);
        return {
            valid: false,
            type: 'unknown',
            message: `Erro ao verificar token: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Make a GraphQL request to the GitHub API
 * 
 * @param query GraphQL query or mutation
 * @returns Response data
 * @throws {GitHubError} If the request fails
 */
export async function graphqlRequest(query: string) {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error("GitHub token not found. Please set the GITHUB_TOKEN environment variable.");
  }
  
  let tokenType = 'unknown';
  try {
    const tokenInfo = await checkTokenType(token);
    tokenType = tokenInfo.type;
    
    // Check if the query contains organization access and token is fine-grained
    if (tokenType === 'fine-grained' && query.includes('organization(')) {
      throw createGitHubError(403, {
        message: "GraphQL request failed: Fine-grained tokens cannot access organization resources via GraphQL API",
        errors: [{
          message: "Fine-grained tokens have limited access to GraphQL API, especially for organization resources"
        }],
        documentation_url: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token",
        tokenType
      });
    }
  } catch (error) {
    // Se falhar a verificação do token, continuamos mas registramos o erro
    console.error("Erro ao verificar token antes da requisição GraphQL:", error);
  }
  
  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Projects-MCP-Server'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      // Lidar com erros de HTTP
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: "Error parsing response" };
      }
      
      throw createGitHubError(response.status, {
        message: `HTTP error ${response.status}: ${errorData.message || response.statusText}`,
        errors: errorData.errors || [],
        documentation_url: errorData.documentation_url,
        tokenType
      });
    }
    
    const data = await response.json();
    
    // Validar que data é um objeto
    if (!data || typeof data !== 'object') {
      throw createGitHubError(500, {
        message: "Invalid response format from GitHub API",
        errors: [],
        tokenType
      });
    }
    
    // Check for GraphQL errors
    if (data.errors) {
      const errorMessage = Array.isArray(data.errors) 
        ? data.errors.map((e: any) => e.message || "Unknown error").join(', ')
        : "Unknown GraphQL error";
        
      throw createGitHubError(response.status, {
        message: `GraphQL request failed: ${errorMessage}`,
        errors: Array.isArray(data.errors) ? data.errors : [{ message: "Unknown error" }],
        documentation_url: data.documentation_url,
        tokenType
      });
    }
    
    // Check for missing data
    if (!data.data) {
      throw createGitHubError(response.status, {
        message: "GraphQL response missing data",
        errors: [],
        documentation_url: data.documentation_url,
        tokenType
      });
    }
    
    return data.data;
  } catch (error) {
    // If it's already a GitHubError, just rethrow it
    if (isGitHubError(error)) {
      throw error;
    }
    
    // Otherwise, create a new GitHubError
    throw createGitHubError(500, {
      message: `GraphQL request failed: ${error instanceof Error ? error.message : String(error)}`,
      errors: [],
      tokenType
    });
  }
}

/**
 * Escapa uma string para uso seguro em queries GraphQL
 * 
 * @param str String a ser escapada
 * @returns String escapada
 */
export function escapeGraphQLString(str: string): string {
    if (!str) return "";
    
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}