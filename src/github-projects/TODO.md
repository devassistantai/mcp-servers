# Próximos Passos para GitHub Projects V2 MCP

## Implementações Realizadas
- ✅ Servidor MCP básico funcionando via Cursor
- ✅ Ferramenta `test_connection` para verificar autenticação
- ✅ Ferramenta `list_projects` para listar projetos de usuários/organizações
- ✅ Ferramenta `create_project` para criar novos projetos (testada e funcionando)
- ✅ Ferramenta `update_project` para atualizar projetos existentes
- ✅ Ferramenta `toggle_project_archive` para abrir/fechar projetos
- ✅ Ferramenta `list_project_items` para listar itens de um projeto
- ✅ Ferramenta `add_project_item` para adicionar issues/PRs a um projeto
- ✅ Ferramenta `create_draft_item` para criar itens de rascunho

## Próximas Funcionalidades a Implementar

1. **Gerenciamento de Projetos**
   - ✅ Criar novos projetos (`create_project`)
   - ✅ Atualizar projetos existentes (`update_project`)
   - ✅ Fechar/Abrir projetos (`toggle_project_archive`) - *Nota: API do GitHub não suporta arquivar projetos, apenas fechá-los*

2. **Gerenciamento de Itens**
   - ✅ Listar itens de um projeto (`list_project_items`)
   - ✅ Adicionar itens a um projeto (`add_project_item`)
   - ✅ Criar itens de rascunho (`create_draft_item`)
   - Atualizar status/campos de itens (`update_project_item`)
   - Remover itens de um projeto (`remove_project_item`)

3. **Campos e Visualizações**
   - Listar campos de um projeto (`list_project_fields`)
   - Criar novos campos (`add_project_field`)
   - Listar visualizações de um projeto (`list_project_views`)
   - Criar novas visualizações (`create_project_view`)

## Resultados dos Testes

| Ferramenta              | Status   | Observações                                            |
|-------------------------|----------|--------------------------------------------------------|
| `test_connection`       | ✅ Sucesso | Verifica token clássico e confirma conectividade       |
| `list_projects`         | ✅ Sucesso | Lista projetos de usuários e organizações              |
| `create_project`        | ✅ Sucesso | Cria projetos após obter ID global do proprietário     |
| `update_project`        | ✅ Sucesso | Atualiza informações básicas de projetos               |
| `toggle_project_archive`| ✅ Sucesso | Fecha/abre projetos usando o campo `closed`            |
| `list_project_items`    | ✅ Sucesso | Lista todos os itens de um projeto com seus campos     |
| `add_project_item`      | ⚠️ Parcial | Adição de issues requer permissões e IDs válidos       |
| `create_draft_item`     | ✅ Sucesso | Cria itens de rascunho em um projeto                   |

## Informações Importantes

### Estrutura do Projeto
- Servidor MCP em `src/github-projects/`
- Ferramentas em `src/github-projects/src/tools/`
- Cliente GraphQL em `src/github-projects/src/clients/github-client.js`
- Utilitários em `src/github-projects/src/utils/`

### Configuração
- Arquivo mcp.json em `.cursor/mcp.json` com configuração para execução via npm run dev
- Token GitHub em variável de ambiente `GITHUB_TOKEN`
- Utilizar token clássico (ghp_) para compatibilidade com API GraphQL

### Queries GraphQL
- Para projetos de usuário: `getUserProjects`
- Para projetos de organização: `getOrgProjects`
- Para próximas implementações, consultar [documentação GraphQL do GitHub](https://docs.github.com/en/graphql)

### Formato de Resposta MCP
- Todas as respostas devem incluir array `content` com objetos contendo `type` e `text`
- Para erros, usar `isError: true` junto com o array `content`
- Exemplo:
```javascript
{
  content: [
    {
      type: "text",
      text: JSON.stringify({ /* dados */ })
    }
  ]
}
```

### Lições Aprendidas
- **IDs globais do GitHub**: Para criar projetos, é necessário obter o ID global real do usuário/organização, não basta concatenar "user/nome"
- **Campos GraphQL**: Apenas o título e ownerId são obrigatórios para criar projetos
- **Formato MCP**: As ferramentas MCP esperam parâmetros nomeados e retornam respostas estruturadas consistentes
- **Saída do console**: Todo texto impresso no console deve ser JSON válido para evitar erros no Cursor. A melhor solução foi desativar completamente os logs.
- **Adição de issues/PRs**: Para adicionar issues ou PRs ao projeto, o token deve ter acesso de leitura ao repositório correspondente e o ID do conteúdo deve ser válido.
- **Rascunhos**: A criação de itens de rascunho é mais simples e não requer permissões adicionais além da gestão do projeto.

### Implementações de Segurança
- **Logs desativados**: Implementada flag `disableAllLogs` para evitar completamente erros de formatação no Cursor
- **Funções silenciosas**: Console e outros métodos de log substituídos por funções vazias
- **Sanitização de respostas**: Função `createMcpResponse` garante que as respostas MCP sejam sempre JSON válido
- **Tratamento de erros**: Erros e exceções são capturados e formatados como JSON válido, mas não são exibidos no console

### Links Úteis
- [Documentação GraphQL GitHub](https://docs.github.com/en/graphql)
- [API de Projetos V2](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [MCP Specification](https://modelcontextprotocol.io/docs/concepts/tools)

===


# Análise das Próximas Implementações para GitHub Projects V2 MCP

## Status Atual
Conforme o arquivo TODO.md, já foram implementadas com sucesso as funcionalidades de gerenciamento básico de projetos:
- ✅ Servidor MCP básico
- ✅ Verificação de conexão e autenticação
- ✅ Listagem de projetos
- ✅ Criação de projetos
- ✅ Atualização de projetos
- ✅ Arquivamento/desarquivamento de projetos

## Próximas Implementações Sugeridas (em ordem de prioridade)

### 1. Gerenciamento de Itens
Esta é a próxima etapa lógica, pois os projetos já podem ser criados e gerenciados. Agora precisamos manipular os itens dentro deles:

1. **`list_project_items`** - Implementação prioritária para listar os itens existentes em um projeto
   - Necessário implementar a query GraphQL para buscar itens de um projeto
   - Parâmetros necessários: `projectId` e opcionalmente filtros/paginação

2. **`add_project_item`** - Para vincular issues ou PRs existentes ao projeto
   - Requer mutation GraphQL `addProjectV2ItemById`
   - Parâmetros: `projectId` e `contentId` (ID do issue/PR)

3. **`create_draft_item`** - Para adicionar itens de rascunho ao projeto
   - Utilizar mutation `addProjectV2DraftItem`
   - Parâmetros: `projectId`, `title` e opcionalmente `body`

4. **`update_project_item`** - Para atualizar valores de campos de um item
   - Requer obtenção do ID do item e do campo a ser atualizado
   - Utilizar mutation `updateProjectV2ItemFieldValue`

5. **`remove_project_item`** - Para remover itens do projeto
   - Utilizar mutation `deleteProjectV2Item`
   - Parâmetro principal: `itemId`

### 2. Campos de Projetos
Essencial para personalização dos projetos:

1. **`list_project_fields`** - Para listar campos existentes
   - Query GraphQL para buscar campos de um projeto
   - Parâmetro: `projectId`

2. **`add_project_field`** - Para criar novos campos personalizados
   - Utilizar mutations apropriadas dependendo do tipo de campo:
     - `addProjectV2SingleSelectField`
     - `addProjectV2IterationField`
     - `addProjectV2DateField`
     - etc.

### 3. Visualizações de Projetos
Importante para apresentação e organização dos dados:

1. **`list_project_views`** - Para listar as visualizações existentes
   - Query para buscar visualizações de um projeto
   - Parâmetro: `projectId`

2. **`create_project_view`** - Para criar novas visualizações
   - Utilizar mutation `createProjectV2View`
   - Parâmetros: `projectId`, `name`, `layout`

## Recomendações de Implementação

1. **Abordagem por etapas**:
   - Comece com `list_project_items` para entender a estrutura dos itens
   - Em seguida, implemente `add_project_item` e `create_draft_item`
   - Por último, implemente as funções de atualização e remoção

2. **Estrutura das ferramentas**:
   - Siga o padrão já estabelecido no projeto para novas ferramentas
   - Cada ferramenta deve estar em um arquivo separado em `src/tools/`
   - Mantenha o formato de resposta MCP consistente

3. **Queries GraphQL**:
   - Defina as queries e mutations necessárias em arquivos separados
   - Reutilize a infraestrutura de cliente GraphQL já implementada

4. **Testes**:
   - Teste cada nova ferramenta e documente os resultados na tabela existente
   - Verifique casos de borda e tratamento de erros

## Próximos Passos Imediatos

1. Implementar `list_project_items` como primeira prioridade
2. Seguir com `add_project_item` e `create_draft_item`
3. Implementar os campos de projetos antes das visualizações, já que as visualizações geralmente dependem dos campos configurados

