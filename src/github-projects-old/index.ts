#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as fs from 'fs';
import * as path from 'path';

// Carrega variáveis de ambiente do arquivo .env
import dotenv from 'dotenv';
dotenv.config();

import * as projects from './operations/projects.js';
import * as items from './operations/items.js';
import * as fields from './operations/fields.js';
import * as views from './operations/views.js';
import {
  GitHubError,
  isGitHubError,
  formatGitHubError,
} from './common/errors.js';
import { VERSION } from "./common/version.js";
import { checkTokenType } from "./common/utils.js";
import { IssueBasedProject } from './operations/projects-rest.js';

// Configuração de logging
const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'errors.log');
const DEBUG_LOG_FILE = path.join(LOG_DIR, 'debug.log');

// Criação do diretório de logs se não existir
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Função para salvar logs em arquivo
 * @param message Mensagem de log
 * @param level Nível do log (error, info, debug)
 * @param error Objeto de erro opcional
 */
function logToFile(message: string, level: 'error' | 'info' | 'debug' = 'info', error?: any) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Log no console (mantém o comportamento original)
  console.error(formattedMessage);
  
  // Conteúdo completo para gravação no arquivo
  let logContent = formattedMessage;
  
  // Adiciona detalhes do erro se fornecido
  if (error) {
    let errorDetails = '';
    if (typeof error === 'object') {
      try {
        if (error instanceof Error) {
          errorDetails = `\n    Mensagem: ${error.message}\n    Stack: ${error.stack}`;
        } else {
          errorDetails = `\n    ${JSON.stringify(error, null, 2)}`;
        }
      } catch (e) {
        errorDetails = `\n    [Erro não serializável]: ${String(error)}`;
      }
    } else {
      errorDetails = `\n    ${String(error)}`;
    }
    logContent += errorDetails;
  }
  
  logContent += '\n';
  
  // Grava no arquivo de acordo com o nível
  try {
    if (level === 'error') {
      fs.appendFileSync(ERROR_LOG_FILE, logContent);
    } else if (level === 'debug') {
      fs.appendFileSync(DEBUG_LOG_FILE, logContent);
    }
  } catch (err) {
    console.error(`Falha ao escrever no arquivo de log: ${err}`);
  }
}

// Configura captura global de exceções não tratadas
process.on('uncaughtException', (error: Error) => {
  logToFile(`Exceção não tratada capturada: ${error.message}`, 'error', error);
  // Não encerramos o processo, permitindo que continue
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logToFile(`Rejeição não tratada em Promise: ${reason}`, 'error', { reason, promise });
  // Não encerramos o processo, permitindo que continue
});

const server = new Server(
  {
    name: "github-projects-mcp-server",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Crie uma instância do manipulador alternativo
const issueBasedProject = new IssueBasedProject();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    logToFile('Processando solicitação ListTools', 'debug');
    return {
      tools: [
        // Projects
        {
          name: "list_projects",
          description: "List GitHub Projects (V2) for a user or organization",
          inputSchema: zodToJsonSchema(projects.ListProjectsSchema),
        },
        {
          name: "get_project",
          description: "Get details of a specific GitHub Project (V2)",
          inputSchema: zodToJsonSchema(projects.GetProjectSchema),
        },
        {
          name: "create_project",
          description: "Create a new GitHub Project (V2)",
          inputSchema: zodToJsonSchema(projects.CreateProjectSchema),
        },
        {
          name: "update_project",
          description: "Update an existing GitHub Project (V2)",
          inputSchema: zodToJsonSchema(projects.UpdateProjectSchema),
        },
        {
          name: "delete_project",
          description: "Delete a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(projects.DeleteProjectSchema),
        },
        
        // Items
        {
          name: "list_project_items",
          description: "List items in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(items.ListItemsSchema),
        },
        {
          name: "add_project_item",
          description: "Add an issue or pull request to a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(items.AddItemSchema),
        },
        {
          name: "create_draft_item",
          description: "Create a draft item in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(items.CreateDraftItemSchema),
        },
        {
          name: "remove_project_item",
          description: "Remove an item from a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(items.RemoveItemSchema),
        },
        {
          name: "get_project_item",
          description: "Get details of a specific item in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(items.GetItemSchema),
        },
        
        // Fields
        {
          name: "list_project_fields",
          description: "List fields in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(fields.ListFieldsSchema),
        },
        {
          name: "create_project_field",
          description: "Create a new field in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(fields.CreateFieldSchema),
        },
        {
          name: "update_project_field_value",
          description: "Update field value for an item in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(fields.UpdateFieldValueSchema),
        },
        {
          name: "delete_project_field",
          description: "Delete a field from a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(fields.DeleteFieldSchema),
        },
        
        // Views
        {
          name: "list_project_views",
          description: "List views in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(views.ListViewsSchema),
        },
        {
          name: "create_project_view",
          description: "Create a new view in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(views.CreateViewSchema),
        },
        {
          name: "update_project_view",
          description: "Update an existing view in a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(views.UpdateViewSchema),
        },
        {
          name: "delete_project_view",
          description: "Delete a view from a GitHub Project (V2)",
          inputSchema: zodToJsonSchema(views.DeleteViewSchema),
        },
        // Projetos via REST API (compatível com tokens fine-grained)
        {
          name: "list_projects_rest",
          description: "Lista projetos (milestones) de um repositório usando API REST (compatível com tokens fine-grained)",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Proprietário do repositório (usuário ou organização)" },
              repo: { type: "string", description: "Nome do repositório" }
            },
            required: ["owner", "repo"]
          }
        },
        {
          name: "create_project_rest",
          description: "Cria um novo projeto (milestone) usando API REST (compatível com tokens fine-grained)",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Proprietário do repositório" },
              repo: { type: "string", description: "Nome do repositório" },
              title: { type: "string", description: "Título do projeto" },
              description: { type: "string", description: "Descrição do projeto" },
              due_date: { type: "string", description: "Data de vencimento (opcional)" }
            },
            required: ["owner", "repo", "title"]
          }
        },
        {
          name: "list_project_items_rest",
          description: "Lista itens (issues) de um projeto (milestone) usando API REST (compatível com tokens fine-grained)",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Proprietário do repositório" },
              repo: { type: "string", description: "Nome do repositório" },
              milestone_number: { type: "number", description: "Número do milestone" }
            },
            required: ["owner", "repo", "milestone_number"]
          }
        },
      ],
    };
  } catch (error) {
    logToFile('Erro ao processar ListTools', 'error', error);
    throw error; // Ainda lançamos o erro para o MCP lidar conforme necessário
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { params } = request;
    const name = params.name as string;
    const parameters = params.arguments as Record<string, any> || {};
    
    logToFile(`Executando ferramenta: ${name} com parâmetros: ${JSON.stringify(parameters)}`, 'debug');
    
    // Normalização de parâmetros para prevenir problemas
    const normalizedParams: Record<string, any> = {};
    
    // Copiar apenas parâmetros válidos e não-nulos/undefined
    if (parameters) {
      Object.keys(parameters).forEach(key => {
        if (parameters[key] !== null && parameters[key] !== undefined) {
          normalizedParams[key] = parameters[key];
        }
      });
    }

    // Adaptador de resposta que garante que qualquer resultado tenha formato consistente
    const adaptResponse = (result: any) => {
      // Para depuração - garantir que o JSON está devidamente formatado
      try {
        console.log(JSON.stringify({
          message: "Adaptando resposta",
          data: result
        }, null, 2));
      } catch (e) {
        console.log(JSON.stringify({
          message: "Erro ao serializar resposta",
          error: String(e)
        }));
      }
      
      // Se for um erro, devolver diretamente
      if (result && typeof result === 'object' && 'error' in result) {
        return { error: result.error, details: result.details || result };
      }
      
      // Para qualquer outro caso, garantir que retornamos um objeto com campo content
      // contendo um array de itens do tipo "text"
      let content = [];
      
      // Se já tiver um campo content que é um array, processar cada item
      if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
        content = result.content.map((item: any) => convertToTextItem(item));
      } 
      // Se for um array direto, converter cada item 
      else if (Array.isArray(result)) {
        content = result.map((item: any) => convertToTextItem(item));
      }
      // Se for outro tipo de objeto, converter em uma única entrada
      else if (result && typeof result === 'object') {
        const keys = Object.keys(result).filter(k => k !== 'error' && k !== 'details');
        if (keys.length > 0) {
          content = [convertToTextItem(result)];
        }
      }
      // Se for um valor simples
      else if (result !== null && result !== undefined) {
        content = [convertToTextItem(result)];
      }
      
      // Fornecer explicitamente um array vazio se não houver conteúdo
      return { content: content.length ? content : [{ type: 'text', text: 'Sem dados disponíveis' }] };
    };
    
    let result;
    
    try {
      switch (name) {
        // Projects REST API (mais confiável com tokens fine-grained)
        case "list_projects_rest":
          result = await issueBasedProject.listProjects(
            parameters.owner,
            parameters.repo
          );
          break;
          
        case "list_project_items_rest":
          console.log(JSON.stringify({ message: "Chamando listItems com parâmetros", owner: parameters.owner, repo: parameters.repo, milestone_number: parameters.milestone_number }));
          result = await issueBasedProject.listItems(
            parameters.owner,
            parameters.repo,
            parameters.milestone_number
          );
          console.log(JSON.stringify({ message: "Resultado de listItems", result }));
          
          // Força a estrutura correta para garantir que sempre retornamos um content válido
          // Mesmo que o resultado da função seja incorreto
          if (!result || typeof result !== 'object' || !('content' in result) || !Array.isArray(result.content)) {
            // Se não tiver a estrutura esperada, criar uma resposta padrão
            return {
              content: [
                {
                  type: "text",
                  text: "Nenhum item encontrado ou erro ao processar dados do milestone."
                }
              ]
            };
          }
          
          // Se já estiver no formato correto, apenas retornar
          return result;
          break;
          
        case "create_project_rest":
          result = await issueBasedProject.createProject(
            parameters.owner,
            parameters.repo,
            parameters.title,
            parameters.description,
            parameters.due_date
          );
          break;
          
        // Projects GraphQL API (para tokens clássicos)
        case "list_projects":
          result = await projects.listProjects(
            parameters.owner,
            parameters.type,
            parameters.first
          );
          break;
          
        case "get_project":
          result = await projects.getProject(parameters.project_id);
          break;
          
        // Outros casos...
        
        default:
          return { error: `Ferramenta desconhecida: ${name}` };
      }
      
      // Adaptar e normalizar a resposta
      return adaptResponse(result);
    } catch (funcError) {
      // Capturar erros específicos da função e adaptá-los
      const errorMessage = funcError instanceof Error ? funcError.message : String(funcError);
      logToFile(`Erro ao executar ${name}: ${errorMessage}`, 'error', funcError);
      
      return {
        error: `Erro ao executar ${name}: ${errorMessage}`,
        details: funcError
      };
    }
  } catch (globalError) {
    // Erro global no handler
    const errorMessage = globalError instanceof Error ? globalError.message : String(globalError);
    logToFile(`Erro global ao processar solicitação: ${errorMessage}`, 'error', globalError);
    
    return {
      error: `Erro ao processar solicitação: ${errorMessage}`,
      errorType: 'handler'
    };
  }
});

// Função auxiliar para converter qualquer objeto em um item de texto formatado
function convertToTextItem(item: any): { type: string; text: string } {
  if (item === null || item === undefined) {
    return { type: 'text', text: 'No data' };
  }
  
  // Se já for um item formatado corretamente, retornar como está
  if (typeof item === 'object' && 'type' in item && item.type === 'text' && 'text' in item) {
    return item;
  }
  
  if (typeof item === 'string') {
    return { type: 'text', text: item };
  }
  
  if (typeof item === 'object') {
    // Extrair informações comuns de projetos/milestones
    if ('title' in item) {
      const title = item.title || 'Untitled';
      const description = item.description || item.body || '';
      const id = item.id || item.number || '';
      const status = item.state || (item.closed ? 'closed' : 'open');
      
      let formatted = `${title} (ID: ${id}, Status: ${status})`;
      if (description) {
        formatted += `\n\n${description}`;
      }
      
      return { type: 'text', text: formatted };
    }
    
    // Para outros objetos, simplesmente converter para JSON
    return { 
      type: 'text', 
      text: JSON.stringify(item, null, 2) 
    };
  }
  
  // Para outros tipos primitivos
  return { type: 'text', text: String(item) };
}

async function runServer() {
  logToFile(`Iniciando GitHub Projects MCP Server v${VERSION}...`, 'info');

  if (!process.env.GITHUB_TOKEN) {
    logToFile("GITHUB_TOKEN environment variable is required", 'error');
    process.exit(1);
  }

  // Verificar o token (completo)
  const token = process.env.GITHUB_TOKEN;
  if (token.length < 30) {
    logToFile("AVISO: O token GitHub fornecido parece muito curto. Verifique se é um token válido.", 'error');
  }

  try {
    const tokenInfo = await checkTokenType(token);
    
    if (!tokenInfo.valid) {
      logToFile(`ERRO: Token GitHub inválido - ${tokenInfo.message}`, 'error');
      process.exit(1);
    }
    
    logToFile(`Token GitHub válido. Tipo de token: ${tokenInfo.type.toUpperCase()}`, 'info');
    logToFile(`Usuário/organização: ${tokenInfo.username}`, 'info');
    
    if (tokenInfo.type === 'fine-grained') {
      logToFile('\n⚠️ AVISO IMPORTANTE:', 'error');
      logToFile('Você está usando um token fine-grained (github_pat_).', 'error');
      logToFile('Este tipo de token tem limitações significativas com a API GraphQL do GitHub,', 'error');
      logToFile('especialmente para recursos como GitHub Projects V2.', 'error');
      logToFile('\nESPERE ERROS 403 AO TENTAR ACESSAR RECURSOS DO GITHUB PROJECTS V2.', 'error');
      logToFile('\nPara resolver este problema:', 'error');
      logToFile('1. Crie um token clássico (ghp_) em https://github.com/settings/tokens', 'error');
      logToFile('2. Selecione os seguintes escopos:', 'error');
      logToFile('   - repo (acesso completo aos repositórios)', 'error');
      logToFile('   - admin:org (acesso aos recursos da organização)', 'error');
      logToFile('   - project (acesso a projetos)', 'error');
      logToFile('3. Substitua o token atual no arquivo .env\n', 'error');
    } else {
      logToFile("Note que para operações com GitHub Projects V2, seu token precisa incluir os seguintes escopos:", 'info');
      logToFile("- repo (acesso completo aos repositórios)", 'info');
      logToFile("- admin:org (acesso aos recursos da organização)", 'info');
      logToFile("- project (acesso a projetos)", 'info');
    }
  } catch (error) {
    logToFile(`Erro ao verificar token: ${error}`, 'error', error);
    logToFile("Continuando mesmo com erro de verificação de token...", 'error');
  }

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logToFile("GitHub Projects MCP Server running on stdio", 'info');
  } catch (error) {
    logToFile(`Erro ao conectar servidor: ${error}`, 'error', error);
    // Não encerramos o processo para permitir retry
  }
}

// Inicia o servidor e captura erros
runServer().catch((err) => {
  logToFile("Erro fatal:", 'error', err);
  // Não encerramos o processo, permitindo retry
});