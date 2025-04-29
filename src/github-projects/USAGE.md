# Guia de Uso das Ferramentas de GitHub Projects V2

Este documento descreve como utilizar as ferramentas disponíveis no servidor MCP para GitHub Projects V2, incluindo as novas ferramentas de gerenciamento de tarefas.

## Pré-requisitos

1. Token clássico do GitHub (formato `ghp_`) com as permissões:
   - `repo` (para acesso a repositórios privados)
   - `project` (para acesso a projetos)
   - `admin:org` (opcional, para projetos em organizações)

2. Servidor MCP configurado e rodando

## Ferramentas de Gerenciamento de Tarefas

### 1. Criar Tarefa (`create_task`)

Esta ferramenta permite criar uma nova tarefa em um projeto, seja como um rascunho ou como uma issue real.

#### Parâmetros

- `projectId` (obrigatório): ID do projeto (GraphQL global ID)
- `title` (obrigatório): Título da tarefa
- `body` (opcional): Descrição/corpo da tarefa
- `repositoryId` (opcional): ID do repositório onde criar a issue (obrigatório para criar uma issue real)
- `assignees` (opcional): Lista de usernames para atribuir à tarefa
- `labels` (opcional): Lista de etiquetas para adicionar à tarefa
- `milestone` (opcional): ID do milestone para associar à tarefa
- `asDraftItem` (opcional): Criar como item de rascunho em vez de issue real (padrão: false)
- `customFields` (opcional): Campos personalizados para definir na tarefa
  - `fieldId`: ID do campo (GraphQL global ID)
  - `value`: Valor a ser definido

#### Exemplos de Uso

**Criar um rascunho:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "title": "Implementar nova funcionalidade",
  "body": "Esta tarefa envolve implementar...",
  "asDraftItem": true,
  "customFields": [
    {
      "fieldId": "PVTF_lADOABC123",
      "value": "Alta"
    }
  ]
}
```

**Criar uma issue real:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "title": "Corrigir bug na interface",
  "body": "Quando o usuário clica em...",
  "repositoryId": "R_kgDOABC123",
  "assignees": ["octocat"],
  "labels": ["bug", "prioridade-alta"],
  "customFields": [
    {
      "fieldId": "PVTF_lADOABC123",
      "value": "Alta"
    },
    {
      "fieldId": "PVTF_lADOABC456",
      "value": "2023-10-15"
    }
  ]
}
```

### 2. Gerenciar Status de Tarefa (`manage_task_status`)

Esta ferramenta permite atualizar o status de uma tarefa e opcionalmente adicionar um comentário.

#### Parâmetros

- `projectId` (obrigatório): ID do projeto (GraphQL global ID)
- `itemId` (obrigatório): ID do item (GraphQL global ID)
- `statusFieldId` (obrigatório): ID do campo de status (GraphQL global ID)
- `newStatus` (obrigatório): Novo valor de status a ser definido (nome da opção)
- `addComment` (opcional): Se deve adicionar um comentário sobre a mudança de status
- `commentBody` (opcional): Texto do comentário (obrigatório se addComment for true)

#### Exemplos de Uso

**Atualizar status sem comentário:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "itemId": "PVTI_lADOABC123",
  "statusFieldId": "PVTF_lADOABC789",
  "newStatus": "Em Progresso"
}
```

**Atualizar status com comentário:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "itemId": "PVTI_lADOABC123",
  "statusFieldId": "PVTF_lADOABC789",
  "newStatus": "Concluído",
  "addComment": true,
  "commentBody": "Concluí esta tarefa após resolver o problema com a conexão ao banco de dados."
}
```

### 3. Agrupar Tarefas (`group_tasks`)

Esta ferramenta permite definir o mesmo valor para um campo específico em várias tarefas de uma só vez.

#### Parâmetros

- `projectId` (obrigatório): ID do projeto (GraphQL global ID)
- `groupById` (obrigatório): ID do campo para agrupar (GraphQL global ID)
- `items` (obrigatório): Lista de IDs dos itens a serem agrupados
- `groupValue` (obrigatório): Valor a ser definido para o campo

#### Exemplos de Uso

**Agrupar tarefas por status:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "groupById": "PVTF_lADOABC789",
  "items": [
    "PVTI_lADOABC123",
    "PVTI_lADOABC456",
    "PVTI_lADOABC789"
  ],
  "groupValue": "Em Progresso"
}
```

**Agrupar tarefas por iteração:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "groupById": "PVTF_lADOXYZ789",
  "items": [
    "PVTI_lADOABC123",
    "PVTI_lADOABC456"
  ],
  "groupValue": "Sprint 15"
}
```

**Agrupar tarefas por prioridade:**

```json
{
  "projectId": "PVT_kwDOABC123",
  "groupById": "PVTF_lADODEF123",
  "items": [
    "PVTI_lADOABC123",
    "PVTI_lADOABC456",
    "PVTI_lADOABC789"
  ],
  "groupValue": "Alta"
}
```

## Dicas e Boas Práticas

1. **Obtendo IDs Necessários:**
   - Use `list_projects` para obter o `projectId`
   - Use `list_project_fields` para obter o `fieldId` e `statusFieldId`
   - Use `list_project_items` para obter o `itemId`

2. **Valores para Campos Especiais:**
   - Para campos de seleção única (como Status), use o nome da opção, não o ID
   - Para campos de data, use o formato ISO 8601 (YYYY-MM-DD)
   - Para campos de iteração, use o título da iteração

3. **Criação de Tarefas:**
   - Crie como rascunho para notas ou ideias iniciais
   - Crie como issue real para tarefas que precisam de rastreamento, pull requests e colaboração

4. **Comentários:**
   - Adicione comentários ao gerenciar status para documentar decisões ou progresso
   - Comentários só funcionam em issues reais, não em rascunhos

5. **Agrupamento de Tarefas:**
   - Utilize para definir rapidamente uma mesma prioridade, status ou iteração
   - Especialmente útil para planejamento de sprints ou reorganização de tarefas

## Resolução de Problemas

Se encontrar problemas ao usar as ferramentas, verifique:

1. Se o token tem as permissões necessárias
2. Se está usando IDs corretos e válidos
3. Se o formato dos valores corresponde ao tipo de campo (texto, número, data, etc.)
4. Se o token é um token clássico (começa com `ghp_`)

Para obter mais informações de erro detalhadas, verifique os logs do servidor MCP. 