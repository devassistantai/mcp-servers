# GitHub Projects MCP Server

## Configuração com Smithery

Este diretório contém um arquivo `smithery.yaml` para configurar o servidor MCP para GitHub Projects, que permite interagir com os Projetos do GitHub através do protocolo MCP (Model Context Protocol).

## Pré-requisitos

- Um token de acesso pessoal (PAT) do GitHub com permissões para acessar projetos
- Node.js v20 ou superior
- npm v9 ou superior

## Instalação via Smithery

Para instalar este servidor MCP usando o Smithery CLI, execute:

```bash
npx -y @smithery/cli install github-projects --client claude
```

O Smithery solicitará o token do GitHub durante a instalação.

## Configuração Manual

Se preferir configurar manualmente o MCP, você pode usar o seguinte formato:

```json
{
  "description": "GitHub Projects API",
  "authentication": {
    "type": "bearer",
    "token": "seu-token-github"
  }
}
```

## Autenticação

Este servidor requer um token de acesso pessoal do GitHub com permissões para acessar projetos. O token pode ser criado em [https://github.com/settings/tokens](https://github.com/settings/tokens).

## Executando localmente

Se você deseja executar este servidor localmente:

1. Instale as dependências:
   ```bash
   cd src/github-projects
   npm install
   ```

2. Compile o TypeScript:
   ```bash
   npm run build
   ```

3. Execute o servidor:
   ```bash
   GITHUB_TOKEN=seu-token-github node dist/index.js
   ```

## Operações suportadas

### Projetos
- Listar projetos
- Obter detalhes de um projeto
- Criar um novo projeto
- Atualizar um projeto
- Excluir um projeto

### Itens
- Listar itens em um projeto
- Obter detalhes de um item
- Criar um novo item
- Atualizar um item
- Excluir um item

### Campos
- Listar campos em um projeto
- Obter detalhes de um campo
- Criar um novo campo
- Atualizar um campo
- Excluir um campo

### Visualizações
- Listar visualizações em um projeto
- Obter detalhes de uma visualização
- Criar uma nova visualização
- Atualizar uma visualização
- Excluir uma visualização

## Formato do smithery.yaml

O arquivo `smithery.yaml` está configurado com a seguinte estrutura:

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    required: ["githubToken"]
    properties:
      githubToken:
        type: string
        description: Token de acesso pessoal do GitHub com permissões para acessar projetos
  commandFunction: |
    ({ githubToken }) => {
      return {
        command: "node",
        args: ["./dist/index.js"],
        cwd: __dirname,
        env: {
          GITHUB_TOKEN: githubToken
        }
      }
    }
```

Este formato especifica:
- Um comando de início do tipo `stdio`
- Um schema de configuração que requer apenas o token do GitHub
- Uma função de comando que retorna a configuração para executar o servidor Node.js com as variáveis de ambiente necessárias