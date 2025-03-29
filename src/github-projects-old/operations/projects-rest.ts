/**
 * Implementação alternativa para GitHub Projects usando a API REST de Issues
 * Compatível com tokens fine-grained
 */
import fetch from 'node-fetch';

// Token do GitHub configurado no ambiente
const token = process.env.GITHUB_TOKEN;

// URL base da API REST do GitHub
const API_BASE_URL = 'https://api.github.com';

/**
 * Classe que simula a funcionalidade de Projects V2 usando Issues
 */
export class IssueBasedProject {
  // Headers padrão para requisições REST
  private headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitHub-Projects-MCP-Server'
  };

  /**
   * Lista os "projetos" (milestones) de um repositório
   * 
   * @param owner Proprietário do repositório (usuário ou organização)
   * @param repo Nome do repositório
   * @returns Lista de milestones do repositório
   */
  async listProjects(owner: string, repo: string) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/milestones`;
    
    try {
      const response = await fetch(url, { headers: this.headers });
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // Ignora erro de parsing
        }
        
        return {
          error: `GitHub API Error: ${response.status} - ${response.statusText}`,
          details: errorData
        };
      }
      
      const data = await response.json();
      
      // Formatação específica para o MCP - cada item precisa ter um tipo específico
      const formatTextItem = (milestone: any) => {
        // Extrair informações relevantes
        const title = milestone.title || 'Untitled';
        const number = milestone.number || 0;
        const state = milestone.state || 'unknown';
        const description = milestone.description || '';
        
        // Formatação para exibição
        let text = `${title} (ID: milestone-${milestone.id || number}, Status: ${state})`;
        if (description) {
          text += `\n\n${description}`;
        }
        
        return {
          type: 'text',
          text
        };
      };
      
      // Se a resposta for um array de milestones
      if (Array.isArray(data) && data.length > 0) {
        return {
          content: data.map(milestone => formatTextItem(milestone))
        };
      } 
      // Se for um objeto único (improvável, mas possível)
      else if (data && typeof data === 'object' && !Array.isArray(data)) {
        return {
          content: [formatTextItem(data)]
        };
      } 
      // Se não houver dados ou for uma resposta vazia
      else {
        return {
          content: [{ type: 'text', text: 'Nenhum projeto encontrado para este repositório.' }]
        };
      }
    } catch (error) {
      console.error('Erro ao listar projetos:', error);
      return { 
        error: `Erro ao processar a requisição: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Cria um novo "projeto" (milestone) em um repositório
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param title Título do milestone
   * @param description Descrição do milestone
   * @param dueDate Data de vencimento (opcional)
   * @returns Milestone criado
   */
  async createProject(owner: string, repo: string, title: string, description?: string, dueDate?: string) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/milestones`;
    
    try {
      const body = {
        title,
        state: 'open',
        description: description || '',
        due_on: dueDate
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return {
        id: `milestone-${data.id}`,
        title: data.title,
        description: data.description,
        number: data.number,
        state: data.state,
        created_at: data.created_at,
        updated_at: data.updated_at,
        due_on: data.due_on,
        url: data.url
      };
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      throw error;
    }
  }

  /**
   * Lista os "itens" (issues) de um "projeto" (milestone)
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param milestoneNumber Número do milestone
   * @returns Lista de issues do milestone
   */
  async listItems(owner: string, repo: string, milestoneNumber: number) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/issues?milestone=${milestoneNumber}&state=all`;
    
    try {
      const response = await fetch(url, { headers: this.headers });
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // Ignora erro de parsing
        }
        
        return {
          error: `GitHub API Error: ${response.status} - ${response.statusText}`,
          details: errorData
        };
      }
      
      const data = await response.json();
      
      // Formatação específica para o MCP - cada item precisa ter um tipo específico
      const formatTextItem = (issue: any) => {
        // Extrair informações relevantes
        const title = issue.title || 'Untitled';
        const number = issue.number || 0;
        const state = issue.state || 'unknown';
        const body = issue.body || '';
        
        // Formatação para exibição
        let text = `${title} (#${number}, ${state})`;
        if (body) {
          text += `\n\n${body}`;
        }
        
        return {
          type: 'text',
          text
        };
      };
      
      // Se a resposta for um array de issues
      if (Array.isArray(data) && data.length > 0) {
        return {
          content: data.map(issue => formatTextItem(issue))
        };
      } 
      // Se for um objeto único (improvável, mas possível)
      else if (data && typeof data === 'object' && !Array.isArray(data)) {
        return {
          content: [formatTextItem(data)]
        };
      } 
      // Se não houver dados ou for uma resposta vazia
      else {
        return {
          content: [{ type: 'text', text: 'Nenhum item encontrado para este milestone.' }]
        };
      }
    } catch (error) {
      console.error('Erro ao listar itens:', error);
      return { 
        error: `Erro ao processar a requisição: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Adiciona um "item" (issue) a um "projeto" (milestone)
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param issueNumber Número da issue
   * @param milestoneNumber Número do milestone
   * @returns Issue atualizada
   */
  async addItem(owner: string, repo: string, issueNumber: number, milestoneNumber: number) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/issues/${issueNumber}`;
    
    try {
      const body = {
        milestone: milestoneNumber
      };
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return {
        id: `issue-${data.id}`,
        milestone: data.milestone,
        title: data.title,
        state: data.state,
        number: data.number
      };
    } catch (error) {
      console.error('Erro ao adicionar item ao projeto:', error);
      throw error;
    }
  }

  /**
   * Cria um novo "item de rascunho" (issue) em um "projeto" (milestone)
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param title Título da issue
   * @param body Corpo da issue
   * @param milestoneNumber Número do milestone
   * @returns Issue criada
   */
  async createDraftItem(owner: string, repo: string, title: string, body: string, milestoneNumber: number) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/issues`;
    
    try {
      const issueBody = {
        title,
        body,
        milestone: milestoneNumber
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(issueBody)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return {
        id: `issue-${data.id}`,
        title: data.title,
        body: data.body,
        number: data.number,
        state: data.state,
        milestone: data.milestone,
        url: data.url,
        html_url: data.html_url
      };
    } catch (error) {
      console.error('Erro ao criar item de rascunho:', error);
      throw error;
    }
  }

  /**
   * Atualiza um "projeto" (milestone) existente
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param milestoneNumber Número do milestone
   * @param title Novo título (opcional)
   * @param state Novo estado (opcional)
   * @param description Nova descrição (opcional)
   * @param dueDate Nova data de vencimento (opcional)
   * @returns Milestone atualizado
   */
  async updateProject(owner: string, repo: string, milestoneNumber: number, 
                       title?: string, state?: 'open' | 'closed', 
                       description?: string, dueDate?: string) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/milestones/${milestoneNumber}`;
    
    try {
      const body: any = {};
      if (title) body.title = title;
      if (state) body.state = state;
      if (description !== undefined) body.description = description;
      if (dueDate !== undefined) body.due_on = dueDate;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return {
        id: `milestone-${data.id}`,
        title: data.title,
        description: data.description,
        number: data.number,
        state: data.state,
        due_on: data.due_on,
        url: data.url
      };
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      throw error;
    }
  }

  /**
   * Remove um "item" (issue) de um "projeto" (milestone)
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param issueNumber Número da issue
   * @returns Status de sucesso
   */
  async removeItem(owner: string, repo: string, issueNumber: number) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/issues/${issueNumber}`;
    
    try {
      const body = {
        milestone: null
      };
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return { success: true, message: 'Item removido do projeto com sucesso' };
    } catch (error) {
      console.error('Erro ao remover item do projeto:', error);
      throw error;
    }
  }

  /**
   * Exclui um "projeto" (milestone)
   * 
   * @param owner Proprietário do repositório
   * @param repo Nome do repositório
   * @param milestoneNumber Número do milestone
   * @returns Status de sucesso
   */
  async deleteProject(owner: string, repo: string, milestoneNumber: number) {
    const url = `${API_BASE_URL}/repos/${owner}/${repo}/milestones/${milestoneNumber}`;
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw {
          status: response.status,
          message: data.message || 'GitHub API request failed',
          documentation_url: data.documentation_url
        };
      }
      
      return { success: true, message: 'Projeto excluído com sucesso' };
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      throw error;
    }
  }
}
