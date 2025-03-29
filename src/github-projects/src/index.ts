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

// Importa utilitários
import logger from './utils/logger.js';
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
    console.error("GitHub Projects MCP Server running on stdio");
  } catch (error) {
    console.error("Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
}

// Configura captura global de exceções não tratadas
process.on('uncaughtException', (error: Error) => {
  console.error('Exceção não tratada:', error);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Rejeição de Promise não tratada:', reason);
});

// Executa o servidor
runServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 