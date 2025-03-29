/**
 * Type definition for the token check result
 */
export interface TokenCheckResult {
  valid: boolean;
  type: 'fine-grained' | 'classic' | 'unknown';
  username?: string;
  message: string;
}

/**
 * Checks the type of GitHub token and validates it
 * @param token The GitHub token to check
 * @returns Information about the token including its type and validity
 */
export interface TokenCheckResult {
    valid: boolean;
    type: 'fine-grained' | 'classic' | 'unknown';
    username?: string;
    message: string;
}

export function checkTokenType(token: string): Promise<TokenCheckResult>;