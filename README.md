# MCP Stdio Service for AI Agents (@ryogrid/gtags-mcp)

## Overview

`@ryogrid/gtags-mcp` is a command-line service that provides a bridge between an AI coding agent and a local codebase. It uses GNU GLOBAL (gtags) for high-speed code analysis and communicates with a parent AI agent process via `stdio` (standard input/output) using a simple JSON-based protocol.

This design eliminates the need for network ports, simplifying integration and preventing conflicts. The AI agent spawns and manages this process directly.

## Core Problem and Solution

AI agents based on Large Language Models (LLMs) often face challenges when generating code:
- **Lack of Context**: They can only see the snippets of code provided in their prompt.
- **Hallucination**: They may "guess" and generate code that calls non-existent functions or uses incorrect variable names.
- **Inconsistency**: They might produce code that doesn't align with the project's existing coding conventions and style.

This service acts as the AI's "eyes" on the codebase. By spawning this process, the agent can send requests to its `stdin` to look up function definitions, find references, and explore the code, just as a human developer uses an IDE.

## Features

- **Stdio Communication**: No network ports, no hassle. Communication is handled via `stdin` and `stdout`.
- **One-Command Execution**: Runs directly via `npx`, requiring no installation.
- **High-Speed Code Analysis**: Leverages `gtags` for instantaneous code navigation.
- **Automatic Index Updates**: Periodically runs an incremental `gtags` update in the background.

## Prerequisites

- **Node.js**: v18.0.0 or higher is recommended.
- **GNU GLOBAL**: The `gtags` command must be installed on the system and accessible in the `PATH`.

## How to Use

An AI agent orchestrator should spawn this process using `npx`. You can also run it directly in your terminal for testing purposes.

```bash
npx @ryogrid/gtags-mcp --dir <path/to/project> [options]
```

**Arguments:**
- `--dir <path>` (Required): The path to the root directory of the codebase you want to analyze.
- `--interval <seconds>` (Optional): The interval in seconds for automatic index updates. Defaults to `15` (15 seconds).

**Example:**
```bash
# Start the service for 'my-app' with a 30-second update interval
npx @ryogrid/gtags-mcp --dir /home/user/projects/my-app --interval=30
```
When run, the service will log status messages to `stderr` and wait for JSON requests on `stdin`.

## Integrating with an AI Agent

For an AI agent to use this service, its orchestrator (e.g., a CLI like `claude code`) must be configured to spawn the `gtags-mcp` process when needed. This is typically done via a "registration" command.

### Example One-Liner Registration

Let's assume the agent's CLI is `claude` and it has a command `mcp add` to register a new code provider. The command would look like this:

```bash
claude mcp add gtags-mcp -- npx @ryogrid/gtags-mcp --dir "/path/to/my-project"
```

Let's break down this command:

- `claude mcp add`: The main command to register a new provider.
- `gtags-mcp`: A unique name you give to this specific configuration. The agent will use this name to refer to the project.
- `--`: A standard separator indicating that all following arguments form the command to be executed.
- `npx @ryogrid/gtags-mcp --dir "/path/to/my-project"`: The full, exact command that the `claude` agent will execute to start the `stdio` service for your project.

After running this registration command, when you ask the agent a question about `gtags-mcp`, it knows to spawn the specified command and communicate with it over `stdio`.

## Communication Protocol

The service uses a line-delimited JSON protocol. The agent writes a single-line JSON request to the process's `stdin`, and the service replies with a single-line JSON response on `stdout`.

### Request Format

A request is a JSON object with three required fields:

- `id` (string): A unique identifier for the request, which will be mirrored in the response.
- `command` (string): The name of the command to execute (e.g., `get_definition`).
- `params` (object): A key-value object of parameters for the command.

**Example Request sent to `stdin`:**
```json
{"id":"req-001","command":"get_definition","params":{"symbol":"myFunction"}}
```

### Response Format

A response is a JSON object with the following fields:

- `id` (string): The mirrored ID from the original request.
- `status` (string): Either `"success"` or `"error"`.
- `payload` (any): The result of the operation if `status` is `"success"`.
- `error` (object): An error object if `status` is `"error"`.

**Example Success Response written to `stdout`:**
```json
{"id":"req-001","status":"success","payload":[{"symbol":"myFunction","line":42,"file":"src/utils.js","code":"function myFunction() {"}]}
```

**Example Error Response written to `stdout`:**
```json
{"id":"req-002","status":"error","error":{"message":"Unknown command: get_foobar"}}
```

The agent's system prompt should be configured with knowledge of the available commands. See `tool_definition.xml` for a template.