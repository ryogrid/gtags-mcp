# MCP Stdio Service for AI Agents (@ryogrid/gtags-mcp)

## Overview

`@ryogrid/gtags-mcp` is a command-line service that provides a bridge between an AI coding agent and a local codebase. It uses GNU GLOBAL (gtags) for high-speed code analysis and communicates with a parent AI agent process via `stdio` (standard input/output) using a simple JSON-based protocol.

This design eliminates the need for network ports, simplifying integration and preventing conflicts. The AI agent spawns and manages this process directly.

## Core Problem and Solution

AI agents based on Large Language Models (LLMs) often lack direct access to a developer's file system. This limits their ability to understand the full context of a project, leading to "hallucinated" code and inconsistencies.

This service acts as the AI's "eyes" on the codebase. By spawning this process, the agent can send requests to its `stdin` to look up function definitions, find references, and explore the code, just as a developer uses an IDE.

## Features

- **Stdio Communication**: No network ports, no hassle. Communication is handled via `stdin` and `stdout`.
- **One-Command Execution**: Runs directly via `npx`, requiring no installation.
- **High-Speed Code Analysis**: Leverages `gtags` for instantaneous code navigation.
- **Automatic Index Updates**: Periodically runs an incremental `gtags` update in the background.

## Prerequisites

- **Node.js**: v18.0.0 or higher is recommended.
- **GNU GLOBAL**: The `gtags` command must be installed on the system and accessible in the `PATH`.

## How to Use

An AI agent orchestrator should spawn this process using `npx`.

```bash
npx @ryogrid/gtags-mcp --dir <path/to/project> [options]
```

**Arguments:**
- `--dir <path>` (Required): The path to the root directory of the codebase to analyze.
- `--interval <seconds>` (Optional): The interval in seconds for automatic index updates. Defaults to `3600` (1 hour).

**Example Spawn Command (from an agent):**
```bash
# The agent would spawn this command and hold onto its stdin/stdout streams.
npx @ryogrid/gtags-mcp --dir /home/user/projects/my-app
```

All status and log messages are written to `stderr`. The `stdout` stream is exclusively for JSON responses.

## Communication Protocol

The service uses a line-delimited JSON protocol. The agent writes a single-line JSON request to the process's `stdin`, and the service replies with a single-line JSON response on `stdout`.

### Request Format

A request is a JSON object with two required fields:

- `id` (string): A unique identifier for the request, which will be mirrored in the response.
- `command` (string): The name of the command to execute.
- `params` (object): A key-value object of parameters for the command.

**Example Request:**
```json
{"id":"req-001","command":"get_definition","params":{"symbol":"myFunction"}}
```

### Response Format

A response is a JSON object with three fields:

- `id` (string): The mirrored ID from the original request.
- `status` (string): Either `"success"` or `"error"`.
- `payload` (any): The result of the operation if `status` is `"success"`.
- `error` (object): An error object if `status` is `"error"`.

**Example Success Response:**
```json
{"id":"req-001","status":"success","payload":[{"symbol":"myFunction","line":42,"file":"src/utils.js","code":"function myFunction() {"}]}
```

**Example Error Response:**
```json
{"id":"req-002","status":"error","error":{"message":"Unknown command: get_foobar"}}
```

## Integrating with an AI Agent

To enable an agent to use this service, its system prompt should include a "tool definition" that describes the available commands. See `tool_definition.xml` for a template. The agent's orchestrator is responsible for spawning the process, formatting the JSON requests, sending them to `stdin`, reading `stdout` for responses, and parsing them.
