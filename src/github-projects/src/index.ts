#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import 'dotenv/config';

// Importa a versão das constantes
import { VERSION } from './utils/constants.js';

// Importa as ferramentas
import { listProjects, ListProjectsSchema } from './tools/list-projects.js';
import { testConnection, TestConnectionSchema } from './tools/test-connection.js';
import { createProject, CreateProjectSchema } from './tools/create-project.js';
import { updateProject, UpdateProjectSchema } from './tools/update-project.js';
import { toggleProjectArchive, ToggleProjectArchiveSchema } from './tools/toggle-project-archive.js';
import { updateProjectItem, UpdateProjectItemSchema } from './tools/update-project-item.js';
import { removeProjectItem, RemoveProjectItemSchema } from './tools/remove-project-item.js';
import { listProjectItems, ListProjectItemsSchema } from './tools/list-project-items.js';
import { listProjectFields, ListProjectFieldsSchema } from './tools/list-project-fields.js';
import { listProjectViews, ListProjectViewsSchema } from './tools/list-project-views.js';
import { addProjectItem, AddProjectItemSchema } from './tools/add-project-item.js';
import { createDraftItem, CreateDraftItemSchema } from './tools/create-draft-item.js';
import { createProjectField, CreateProjectFieldSchema } from './tools/create-project-field.js';

// Importa utilitários
import logger, { safeConsole } from './utils/logger.js';
import { getTokenWarning } from './utils/token-utils.js';

/**
 * Servidor MCP para GitHub Projects V2
 * 
 * Este servidor implementa ferramentas que permitem interagir com a API GraphQL do GitHub Projects V2.
 * Todas as ferramentas seguem o formato MCP e retornam respostas estruturadas conforme o padrão.
 * 
 * Formato MCP:
 * - Todas as ferramentas recebem parâmetros JSON nomeados
 * - Todas as respostas seguem a estrutura { content: [{ type: "text", text: "..." }] }
 * - Erros são indicados com a flag isError: true
 * 
 * Requer token clássico do GitHub (ghp_*) com escopos adequados para a API GraphQL.
 */
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

// Exibe mensagem de inicialização
logger.info(`Iniciando servidor MCP GitHub Projects V2 v${VERSION}`);

// Verifica o token do GitHub e exibe mensagem de aviso, se necessário
const tokenWarning = getTokenWarning(process.env.GITHUB_TOKEN);
if (tokenWarning) {
  logger.warn(tokenWarning);
}

// Configura o handler para listar as ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Processando solicitação ListTools');
  
  return {
    tools: [
      // Ferramentas de diagnóstico/teste
      {
        name: "test_connection",
        description: "Test GitHub API connection and token validity",
        inputSchema: zodToJsonSchema(TestConnectionSchema),
      },
      
      // Projects V2
      {
        name: "list_projects",
        description: "List GitHub Projects (V2) for a user or organization",
        inputSchema: zodToJsonSchema(ListProjectsSchema),
      },
      {
        name: "create_project",
        description: "Create a new GitHub Project (V2) for a user or organization",
        inputSchema: zodToJsonSchema(CreateProjectSchema),
      },
      {
        name: "update_project",
        description: "Update an existing GitHub Project (V2)",
        inputSchema: zodToJsonSchema(UpdateProjectSchema),
      },
      {
        name: "toggle_project_archive",
        description: "Archive or unarchive a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(ToggleProjectArchiveSchema),
      },
      {
        name: "update_project_item",
        description: "Update an existing project item in a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(UpdateProjectItemSchema),
      },
      {
        name: "remove_project_item",
        description: "Remove an item from a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(RemoveProjectItemSchema),
      },
      {
        name: "list_project_fields",
        description: "List fields from a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(ListProjectFieldsSchema),
      },
      {
        name: "list_project_views",
        description: "List views from a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(ListProjectViewsSchema),
      },
      {
        name: "list_project_items",
        description: "List items from a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(ListProjectItemsSchema),
      },
      {
        name: "add_project_item",
        description: "Add an existing Issue or Pull Request to a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(AddProjectItemSchema),
      },
      {
        name: "create_draft_item",
        description: "Create a draft item in a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(CreateDraftItemSchema),
      },
      {
        name: "create_project_field",
        description: "Create a new field in a GitHub Project (V2)",
        inputSchema: zodToJsonSchema(CreateProjectFieldSchema),
      },
      
      // Aqui serão adicionadas as outras ferramentas à medida que forem implementadas
    ],
  };
});

/**
 * Handler para processar chamadas de ferramentas MCP
 * 
 * O formato de chamada MCP segue o padrão:
 * 
 * Exemplo para test_connection:
 * ```
 * {
 *   "name": "test_connection",
 *   "arguments": {
 *     "random_string": "test"
 *   }
 * }
 * ```
 * 
 * Exemplo para list_projects:
 * ```
 * {
 *   "name": "list_projects",
 *   "arguments": {
 *     "owner": "octocat",
 *     "type": "user",
 *     "first": 10
 *   }
 * }
 * ```
 * 
 * Exemplo para create_project:
 * ```
 * {
 *   "name": "create_project",
 *   "arguments": {
 *     "owner": "octocat",
 *     "type": "user",
 *     "title": "My New Project",
 *     "description": "Project description",
 *     "layout": "BOARD",
 *     "public": true
 *   }
 * }
 * ```
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: parameters } = request.params;
  
  logger.debug(`Chamada da ferramenta: ${name}`);
  
  try {
    switch (name) {
      // Ferramentas de diagnóstico/teste
      case "test_connection":
        return await testConnection();
        
      // Projects V2
      case "list_projects":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await listProjects(parameters);
        
      case "create_project":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await createProject(parameters);
        
      case "update_project":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await updateProject(parameters);
        
      case "toggle_project_archive":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await toggleProjectArchive(parameters);
        
      case "update_project_item":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await updateProjectItem(parameters);
        
      case "remove_project_item":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await removeProjectItem(parameters);
        
      case "list_project_fields":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await listProjectFields(parameters);
        
      case "list_project_views":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await listProjectViews(parameters);
        
      case "create_project_field":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await createProjectField(parameters);
        
      case "list_project_items":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await listProjectItems(parameters);
        
      case "add_project_item":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await addProjectItem(parameters);
        
      case "create_draft_item":
        // @ts-ignore - O tipo de 'parameters' é diferente do esperado, mas os dados estão corretos
        return await createDraftItem(parameters);
        
      // Adicionar novos casos aqui à medida que implementamos mais ferramentas
        
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Ferramenta não implementada: ${name}`
            }
          ]
        };
    }
  } catch (error) {
    logger.error(`Erro ao processar ferramenta ${name}:`, error);
    
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
        }
      ]
    };
  }
});

// Inicia o servidor com StdioServerTransport (padrão MCP)
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    safeConsole.log({ message: "GitHub Projects MCP Server running on stdio" });
  } catch (error) {
    safeConsole.error({ message: "Erro ao iniciar o servidor", error });
    process.exit(1);
  }
}

// Configura captura global de exceções não tratadas
process.on('uncaughtException', (error: Error) => {
  safeConsole.error({ message: 'Exceção não tratada', error });
});

process.on('unhandledRejection', (reason: any) => {
  safeConsole.error({ message: 'Rejeição de Promise não tratada', reason });
});

// Executa o servidor
runServer().catch((error) => {
  safeConsole.error({ message: "Fatal error", error });
  process.exit(1);
}); 