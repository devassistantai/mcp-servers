import 'dotenv/config';

// Configuração do logger
const logLevel = process.env.LOG_LEVEL || 'info';
const enableDiagnostics = process.env.LOG_DIAGNOSTICS === 'true';

// Níveis de log e seus valores numéricos
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Verifica se o nível de log atual permite o log do nível especificado
function shouldLog(level: LogLevel): boolean {
  const currentLevelValue = LOG_LEVELS[logLevel as LogLevel] ?? LOG_LEVELS.info;
  const targetLevelValue = LOG_LEVELS[level];
  return targetLevelValue >= currentLevelValue;
}

// Formata um objeto para logging
function formatObject(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return String(obj);
  }
}

// Logger simples para não depender de bibliotecas externas
const logger = {
  debug(message: string | object, ...args: any[]): void {
    if (!shouldLog('debug')) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' 
      ? message 
      : formatObject(message);
    console.debug(`[${timestamp}] [DEBUG] ${formattedMessage}`, ...args);
  },
  
  info(message: string | object, ...args: any[]): void {
    if (!shouldLog('info')) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' 
      ? message 
      : formatObject(message);
    console.info(`[${timestamp}] [INFO] ${formattedMessage}`, ...args);
  },
  
  warn(message: string | object, ...args: any[]): void {
    if (!shouldLog('warn')) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' 
      ? message 
      : formatObject(message);
    console.warn(`[${timestamp}] [WARN] ${formattedMessage}`, ...args);
  },
  
  error(message: string | object, ...args: any[]): void {
    if (!shouldLog('error')) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' 
      ? message 
      : formatObject(message);
    console.error(`[${timestamp}] [ERROR] ${formattedMessage}`, ...args);
  }
};

// Adiciona métodos para logging de requisições/respostas da API
export interface ApiLogDetails {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  status?: number;
  responseBody?: any;
  error?: any;
}

function sanitizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const result = { ...headers };
  
  // Remove informações sensíveis dos headers
  if (result.authorization) {
    result.authorization = '[REDACTED]';
  }
  
  return result;
}

function sanitizeBody(body: any): any {
  if (!body) return body;
  
  try {
    // Se for uma string, tenta fazer parse para JSON
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Se não for JSON válido, retorna a string
        return body;
      }
    }
    
    // Clona o objeto para não modificar o original
    const result = { ...body };
    
    // Remove campos sensíveis de objetos
    if (result.token) result.token = '[REDACTED]';
    if (result.password) result.password = '[REDACTED]';
    if (result.secret) result.secret = '[REDACTED]';
    
    return result;
  } catch (err) {
    return body;
  }
}

// Log de requisição para API externa
export function logApiRequest(details: ApiLogDetails): void {
  if (!enableDiagnostics && !shouldLog('debug')) return;
  
  logger.debug({
    msg: 'API Request',
    url: details.url,
    method: details.method,
    headers: sanitizeHeaders(details.headers),
    body: sanitizeBody(details.body)
  });
}

// Log de resposta de API externa
export function logApiResponse(details: ApiLogDetails): void {
  if (!enableDiagnostics && !shouldLog('debug')) return;
  
  logger.debug({
    msg: 'API Response',
    url: details.url,
    status: details.status,
    responseBody: sanitizeBody(details.responseBody)
  });
}

// Log de erro de API externa
export function logApiError(details: ApiLogDetails): void {
  logger.error({
    msg: 'API Error',
    url: details.url,
    method: details.method,
    status: details.status,
    error: details.error
  });
}

// Log de requisição MCP recebida
export function logMcpRequest(toolName: string, params: any): void {
  logger.info({
    msg: 'MCP Request',
    tool: toolName,
    params
  });
}

// Log de resposta MCP enviada
export function logMcpResponse(toolName: string, response: any): void {
  logger.info({
    msg: 'MCP Response',
    tool: toolName,
    response
  });
}

// Log de erro MCP
export function logMcpError(toolName: string, error: any): void {
  logger.error({
    msg: 'MCP Error',
    tool: toolName,
    error
  });
}

export default logger; 