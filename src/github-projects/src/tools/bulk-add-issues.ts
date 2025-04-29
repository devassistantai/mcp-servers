import { z } from 'zod';
import { executeGraphQL } from '../clients/github-client.js';
import { createErrorResponse, createMcpResponse } from '../utils/error-utils.js';
import { logMcpRequest, logMcpResponse, logMcpError } from '../utils/logger.js';
import { isTokenSuitableForGraphQL } from '../utils/token-utils.js';

/**
 * Schema de validação para adicionar múltiplas issues a um projeto
 */
export const BulkAddIssuesSchema = z.object({
  projectId: z.string().min(1).describe('Project ID (GraphQL global ID)'),
  owner: z.string().min(1).describe('Repository owner (username or organization name)'),
  repo: z.string().min(1).describe('Repository name'),
  issueNumbers: z.array(z.number().int().positive()).min(1).describe('List of issue numbers to add'),
  statusFieldId: z.string().optional().describe('Optional status field ID to set initial status'),
  statusValue: z.string().optional().describe('Optional status value to set (required if statusFieldId is provided)'),
});

/**
 * Tipo dos parâmetros de entrada para adicionar múltiplas issues
 */
export type BulkAddIssuesParams = z.infer<typeof BulkAddIssuesSchema>;

/**
 * Query GraphQL para obter o ID global de uma issue
 */
const GET_ISSUE_ID_QUERY = `
  query getIssueId($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        title
        url
      }
    }
  }
`;

/**
 * Mutation GraphQL para adicionar uma issue ao projeto
 */
const ADD_PROJECT_ITEM_MUTATION = `
  mutation addProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId,
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`;

/**
 * Mutation GraphQL para atualizar um campo de item
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
 * Query GraphQL para obter informações de um campo de status
 */
const GET_STATUS_FIELD_INFO_QUERY = `
  query GetStatusField($projectId: ID!, $fieldId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        field(id: $fieldId) {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Adiciona múltiplas issues de um repositório a um projeto GitHub Projects V2
 */
export async function bulkAddIssues(params: BulkAddIssuesParams) {
  try {
    // Extrai parâmetros
    const { 
      projectId, 
      owner, 
      repo, 
      issueNumbers,
      statusFieldId,
      statusValue
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
    
    // Valida parâmetros adicionais
    if (statusFieldId && !statusValue) {
      return createMcpResponse({
        success: false,
        message: 'É necessário fornecer um valor de status quando o ID do campo de status é fornecido.',
      }, true);
    }
    
    // Log da solicitação MCP
    logMcpRequest('bulk_add_issues', {
      projectId,
      owner,
      repo,
      issueCount: issueNumbers.length,
      hasStatusField: !!statusFieldId
    });
    
    // Obtém informações do campo de status se fornecido
    let statusOptionId: string | null = null;
    
    if (statusFieldId && statusValue) {
      const fieldInfoResult = await executeGraphQL(GET_STATUS_FIELD_INFO_QUERY, { 
        projectId,
        fieldId: statusFieldId
      });
      
      const statusField = fieldInfoResult.node?.field;
      
      if (!statusField) {
        return createMcpResponse({
          success: false,
          message: `Campo de status com ID ${statusFieldId} não encontrado no projeto.`,
        }, true);
      }
      
      // Verifica se o campo é realmente de seleção única
      if (!statusField.options) {
        return createMcpResponse({
          success: false,
          message: `O campo com ID ${statusFieldId} não é um campo de seleção única.`,
        }, true);
      }
      
      // Busca o ID da opção pelo nome
      const option = statusField.options.find((opt: any) => opt.name === statusValue);
      
      if (!option) {
        return createMcpResponse({
          success: false,
          message: `Opção "${statusValue}" não encontrada para o campo de status "${statusField.name}".`,
          availableOptions: statusField.options.map((opt: any) => opt.name)
        }, true);
      }
      
      statusOptionId = option.id;
    }
    
    // Resultado da operação
    const results: any[] = [];
    let successCount = 0;
    
    // Processa cada número de issue
    for (const issueNumber of issueNumbers) {
      try {
        // 1. Obter o ID global da issue
        const issueResult = await executeGraphQL(GET_ISSUE_ID_QUERY, {
          owner,
          repo,
          number: issueNumber
        });
        
        const issue = issueResult.repository?.issue;
        
        if (!issue) {
          results.push({
            issueNumber,
            success: false,
            error: `Issue #${issueNumber} não encontrada no repositório ${owner}/${repo}.`
          });
          continue;
        }
        
        // 2. Adicionar a issue ao projeto
        const addResult = await executeGraphQL(ADD_PROJECT_ITEM_MUTATION, {
          projectId,
          contentId: issue.id
        });
        
        if (!addResult.addProjectV2ItemById?.item?.id) {
          results.push({
            issueNumber,
            success: false,
            error: 'Falha ao adicionar issue ao projeto.'
          });
          continue;
        }
        
        const itemId = addResult.addProjectV2ItemById.item.id;
        
        // 3. Atualizar o status se necessário
        let statusUpdated = false;
        
        if (statusFieldId && statusOptionId) {
          try {
            const updateResult = await executeGraphQL(UPDATE_FIELD_VALUE_MUTATION, {
              input: {
                projectId,
                itemId,
                fieldId: statusFieldId,
                value: {
                  singleSelectOptionId: statusOptionId
                }
              }
            });
            
            statusUpdated = !!updateResult.updateProjectV2ItemFieldValue?.projectV2Item?.id;
          } catch (error) {
            // Continua mesmo com erro ao atualizar status
            console.error(`Erro ao atualizar status da issue #${issueNumber}:`, error);
          }
        }
        
        // Adiciona aos resultados
        results.push({
          issueNumber,
          success: true,
          itemId,
          issue: {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            url: issue.url
          },
          statusUpdated
        });
        
        successCount++;
      } catch (error) {
        results.push({
          issueNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
    
    // Log da resposta MCP
    logMcpResponse('bulk_add_issues', {
      success: successCount > 0,
      totalIssues: issueNumbers.length,
      successfulAdds: successCount
    });
    
    // Retorna resposta formatada
    return createMcpResponse({
      success: successCount > 0,
      message: `${successCount} de ${issueNumbers.length} issues adicionadas com sucesso ao projeto.`,
      projectId,
      repository: `${owner}/${repo}`,
      totalIssues: issueNumbers.length,
      successfulAdds: successCount,
      results
    });
    
  } catch (error) {
    // Log do erro
    logMcpError('bulk_add_issues', error);
    
    return createMcpResponse({
      success: false,
      message: `Falha ao adicionar issues em massa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, true);
  }
} 