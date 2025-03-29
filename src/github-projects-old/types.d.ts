declare module 'node-fetch' {
  export * from 'node-fetch';
  export default function fetch(
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response>;
}

declare module 'universal-user-agent' {
  export function getUserAgent(): string;
} 