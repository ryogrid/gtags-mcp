# MCP TCP Server for AI Agents (@ryogrid/gtags-mcp)

## Overview

`@ryogrid/gtags-mcp` is a backend service for AI coding agents that communicates via **TCP**. It uses GNU GLOBAL (gtags) for high-speed code analysis and provides a network-accessible endpoint for an AI agent to query a local or remote codebase.

This TCP-based architecture allows for flexible deployment, enabling the agent and the code analysis server to run on different machines.

## Core Problem and Solution

AI agents based on Large Language Models (LLMs) often lack direct access to a developer's file system. This service acts as the AI's "eyes" on the codebase. By launching this server, the agent can connect to its TCP port and send requests to look up function definitions, find references, and explore the code, just as a developer uses an IDE.

## Features

- **TCP Communication**: Listens on a configurable host and port, accessible over the network.
- **One-Command Execution**: Runs directly via `npx`, requiring no installation.
- **High-Speed Code Analysis**: Leverages `gtags` for instantaneous code navigation.
- **Automatic Index Updates**: Periodically runs an incremental `gtags` update in the background.

## Prerequisites

- **Node.js**: v18.0.0 or higher is recommended.
- **GNU GLOBAL**: The `gtags` command must be installed on the system and accessible in the `PATH`.

## How to Use

An AI agent orchestrator should spawn this process using `npx`, providing the path to the project directory.

```bash
npx @ryogrid/gtags-mcp --dir <path/to/project> [--port <num>] [options]
```

**Arguments:**
- `--dir <path>` (Required): The path to the root directory of the codebase to analyze.
- `--port <num>` (Optional): The port to listen on. **Defaults to `3000`**.
- `--interval <seconds>` (Optional): The interval in seconds for automatic index updates. Defaults to `3600` (1 hour).

**Example:**```bash
# Start the server for 'my-app' on the default host and port
npx @ryogrid/gtags-mcp --dir /home/user/projects/my-app

# Start the server on a custom port
npx @ryogrid/gtags-mcp --dir /home/user/projects/my-app --port 5000
```

## Integrating with an AI Agent

An agent orchestrator would be responsible for:
1.  Spawning the `gtags-mcp` server process with the correct `--dir`and `--port` arguments.
2.  Connecting a TCP client to the server's host and port.
3.  Sending and receiving JSON messages over the TCP connection.

### Example Registration Command

Assuming the agent's CLI is `claude` and it supports TCP endpoint registration:

```bash
# Register an MCP server named 'gtags-mcp' with the agent
claude mcp add gtags-mcp \
  -- npx @ryogrid/gtags-mcp --dir "/path/to/my-project"
```

## Communication Protocol

The service uses a line-delimited JSON protocol over the TCP connection. The client writes a single-line JSON request, and the server replies with a single-line JSON response.

### Request Format
A request is a JSON object with `id`, `command`, and `params` fields.

**Example Request sent over the TCP socket:**
```json
{"id":"req-001","command":"get_definition","params":{"symbol":"myFunction"}}
```

### Response Format
A response is a JSON object with `id`, `status`, and `payload`/`error` fields.

**Example Success Response received from the TCP socket:**
```json
{"id":"req-01","status":"success","payload":[{"symbol":"myFunction","line":42,"file":"src/utils.js","code":"function myFunction() {"}]}
```