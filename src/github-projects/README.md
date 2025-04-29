# GitHub Projects V2 MCP Server (@devassistantai/github-projects)

A Model Context Protocol (MCP) server designed to interact with the GitHub Projects V2 API using GraphQL. This server provides a set of tools that allow language models or other clients to manage GitHub Projects, including tasks, items, fields, and views.

## Prerequisites

1.  **GitHub Classic Token:** You need a GitHub classic personal access token (PAT) starting with `ghp_`. Fine-grained tokens (`github_pat_`) are **not** compatible with the Projects V2 GraphQL API.
    *   The token requires the following scopes:
        *   `repo` (for accessing private repositories linked to projects)
        *   `project` (for accessing projects)
        *   `admin:org` or `read:org` (if working with organization projects)
2.  **Environment Variable:** Set the `GITHUB_TOKEN` environment variable with your classic token.
3.  **Node.js:** Version >= 20.0.0 (as specified in `package.json`).
4.  **npm:** For installing dependencies and running scripts.

## Installation

Clone the main repository (`mcp-servers`) if you haven't already. Then, navigate to the project directory and install dependencies:

```bash
cd src/github-projects
npm install
```

## Usage

You can run the server in development mode (with watching) or start the compiled version.

**Development:**

```bash
npm run dev
```

This command uses `tsx` to run the TypeScript source directly and watches for changes.

**Production/Compiled:**

First, build the TypeScript code:

```bash
npm run build
```

Then, start the server:

```bash
npm start
# or
node dist/index.js
```

The server will start and listen for requests via standard input/output (stdio), following the MCP specification.

## Cursor Integration

To use this server directly within the Cursor editor, you can configure it in your `.cursor/mcp.json` file. This method uses `npx` to run the package directly without needing a local clone (though you still need Node.js/npm installed).

Add the following entry to your `mcpServers` configuration:

```json
{
  "mcpServers": {
    "Github Projects": {
      "command": "cmd", // Use "bash" or your shell if not on Windows
      "args": [
        "/c", // Use "-c" if using bash/zsh
        "npx",
        "--yes", // Automatically confirm installation
        "@devassistantai/github-projects"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_YOUR_CLASSIC_TOKEN_HERE" // Replace with your actual token
      }
    }
    // ... other servers
  }
}
```

**Notes:**
*   Replace `"ghp_YOUR_CLASSIC_TOKEN_HERE"` with your actual GitHub classic token.
*   Adjust the `command` and the first argument (`/c` or `-c`) based on your operating system's shell (cmd for Windows, bash/zsh for Linux/macOS).
*   The `--yes` flag for `npx` skips the confirmation prompt when it needs to download the package.

After saving `mcp.json`, restart Cursor or reload the MCP server configuration for the changes to take effect.

## Available Tools

This server exposes several tools for interacting with GitHub Projects V2. All tools have been thoroughly tested and are production-ready.

### Core Project Management
*   `test_connection`: Test API connection and token validity ✅
*   `list_projects`: List projects for a user or organization ✅
*   `create_project`: Create a new project ✅
*   `update_project`: Update project details ✅
*   `toggle_project_archive`: Close or reopen a project ✅

### Item Management
*   `list_project_items`: List items (issues, PRs, drafts) in a project ✅
*   `add_project_item`: Add an existing issue or PR to a project ✅
*   `create_draft_item`: Create a new draft item ✅
*   `update_project_item`: Update fields of an existing item ✅
*   `remove_project_item`: Remove an item from a project ✅
*   `get_issue_id`: Get the GraphQL global ID for an issue or PR number ✅
*   `convert_draft_to_issue`: Convert a draft item into a real issue ✅
*   `bulk_add_issues`: Add multiple existing issues to a project at once ✅

### Task & Status Management
*   `create_task`: Create a new task (as draft or issue) with detailed fields ✅
*   `manage_task_status`: Update the status field of a task and optionally add a comment ✅
*   `group_tasks`: Set the same field value for multiple items simultaneously ✅

### Fields & Views
*   `list_project_fields`: List the fields defined in a project ✅
*   `create_project_field`: Create a new custom field in a project ✅
*   `list_project_views`: List the views configured for a project ✅

For detailed usage and parameters of each tool, refer to the [USAGE.md](USAGE.md) guide.

## Recent Improvements

*   Enhanced field type handling in `create_task`
*   Improved status management with proper option ID resolution
*   Configurable logging system
*   Better TypeScript type definitions
*   Removed code redundancies
*   Improved error handling and messages

## Planned Features

1. **Advanced Task Management**
   * Task dependency system
   * Task cloning functionality
   * Task template system
   * Bulk movement operations

2. **Performance & Security**
   * Query result caching
   * Enhanced input validation
   * Expanded automated testing
   * Improved error logging

3. **User Experience**
   * Simplified global ID handling
   * Better error messages for common issues
   * Streamlined workflows for frequent operations

Note: The creation of project views (`create_project_view`) was investigated but is not currently supported by the GitHub API.

## Configuration

The server can be configured using environment variables:

*   `GITHUB_TOKEN` (Required): Your GitHub classic PAT (`ghp_...`).
*   `LOG_LEVEL`: Set the logging level (`debug`, `info`, `warn`, `error`). Defaults to `info`.
*   `LOG_DIAGNOSTICS`: Set to `true` to enable detailed API request/response logging, even if `LOG_LEVEL` is not `debug`. Defaults to `false`.
*   `DISABLE_LOGS`: Set to `true` to completely disable all console output (useful for strict MCP environments). Defaults to `false`.

You can place these variables in a `.env` file in the `src/github-projects` directory.

## Development & Testing

*   **Linting:** `npm run lint`
*   **Cleaning:** `npm run clean` (removes the `dist` directory)
*   **Building:** `npm run build` (compiles TypeScript)
*   **Watching:** `npm run watch` (compiles TypeScript in watch mode)
*   **Testing:** `npm run test` (runs tests using Vitest)

## Contributing

Please refer to the main `CONTRIBUTING.md` file in the root of the `mcp-servers` repository.

## License

This project is licensed under the MIT License - see the `LICENSE` file in the root of the `mcp-servers` repository for details. 