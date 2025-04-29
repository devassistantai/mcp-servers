/**
 * Versão do servidor MCP
 */
export const VERSION = '0.1.0';

/**
 * Configurações padrão
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Endpoints da API do GitHub
 */
export const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
export const GITHUB_REST_ENDPOINT = 'https://api.github.com';

/**
 * Mensagens de sistema
 */
export const ERROR_MESSAGES = {
  MISSING_TOKEN: 'Token do GitHub não fornecido. Configure a variável de ambiente GITHUB_TOKEN.',
  INVALID_TOKEN_TYPE: 'Token do GitHub não é adequado para API GraphQL. Use um token clássico (ghp_).',
  GENERIC_ERROR: 'Ocorreu um erro ao processar a requisição.'
};

/**
 * Tipos de campo do Projects V2
 */
export enum ProjectFieldType {
  TEXT = 'TEXT',
  DATE = 'DATE',
  SINGLE_SELECT = 'SINGLE_SELECT',
  NUMBER = 'NUMBER'
};

/**
 * Tipos de layout do Projects V2
 */
export enum ProjectLayoutType {
  BOARD = 'BOARD',
  TABLE = 'TABLE'
}; 