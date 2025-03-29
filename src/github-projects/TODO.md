# Próximos Passos para GitHub Projects V2 MCP

## Implementações Realizadas
- ✅ Servidor MCP básico funcionando via Cursor
- ✅ Ferramenta `test_connection` para verificar autenticação
- ✅ Ferramenta `list_projects` para listar projetos de usuários/organizações
- ✅ Ferramenta `create_project` para criar novos projetos (testada e funcionando)

## Próximas Funcionalidades a Implementar

1. **Gerenciamento de Projetos**
   - ✅ Criar novos projetos (`create_project`)
   - ✅ Atualizar projetos existentes (`update_project`)
   - ✅ Fechar/Abrir projetos (`toggle_project_archive`) - *Nota: API do GitHub não suporta arquivar projetos, apenas fechá-los*

2. **Gerenciamento de Itens**
   - Listar itens de um projeto (`list_project_items`)
   - Adicionar itens a um projeto (`add_project_item`)
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
- **Saída do console**: Todo texto impresso no console deve ser JSON válido para evitar erros no Cursor. Sempre use safeConsole ou funções similares

### Implementações de Segurança
- **Logs em JSON válido**: Implementadas funções de log que garantem que toda saída seja JSON válido
- **Sanitização de respostas**: Função `createMcpResponse` garante que as respostas MCP sejam sempre JSON válido
- **Tratamento de erros**: Erros e exceções são capturados e formatados como JSON válido

### Links Úteis
- [Documentação GraphQL GitHub](https://docs.github.com/en/graphql)
- [API de Projetos V2](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [MCP Specification](https://modelcontextprotocol.io/docs/concepts/tools)

Ao continuar o desenvolvimento, será essencial manter esse formato de resposta consistente e seguir os padrões estabelecidos para garantir compatibilidade com o protocolo MCP.
