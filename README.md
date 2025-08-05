# MCP Server for GNU GLOBAL (@ryogrid/gtags-mcp)

## Overview

`@ryogrid/gtags-mcp` is an MCP (Model Context Protocol) server that provides AI coding agents like Claude Code with powerful codebase analysis capabilities using GNU GLOBAL (gtags). It allows AI agents to search for symbol definitions, references, and perform pattern matching across large codebases with high performance.

## Features

- **MCP Protocol Compliance**: Fully compatible with Model Context Protocol for seamless integration with AI coding agents
- **Symbol Definition Lookup**: Find exact definitions of functions, variables, classes, and other symbols
- **Reference Finding**: Locate all usages of a symbol across the entire codebase  
- **Symbol Completion**: List all symbols that start with a given prefix
- **Pattern Search**: Search for patterns in source code using grep-like functionality
- **Automatic Index Updates**: Periodically updates the gtags database to keep results current
- **High Performance**: Leverages GNU GLOBAL's optimized indexing for fast searches even in large codebases

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **GNU GLOBAL**: Must be installed and accessible in PATH
  - On Ubuntu/Debian: `sudo apt install global`
  - On macOS: `brew install global`
  - On other systems: See [GNU GLOBAL installation guide](https://www.gnu.org/software/global/)

## Installation

### Global Installation
```bash
npm install -g @ryogrid/gtags-mcp
```

### Using npx (Recommended)
```bash
npx @ryogrid/gtags-mcp --dir /path/to/your/project
```

## Usage

### Command Line Options
```bash
gtags-mcp --dir <project-directory> [--interval <seconds>]

Options:
  --dir <path>        Path to the project directory (required)
  --interval <seconds> Update interval for gtags database in seconds (default: 15)
```

### Basic Usage
```bash
# Start MCP server for a specific project
npx @ryogrid/gtags-mcp --dir /home/user/my-project

# With custom update interval
npx @ryogrid/gtags-mcp --dir /home/user/my-project --interval 30
```

## Integration with AI Coding Agents

### Claude Code Integration

1. **Option 1: Direct Configuration**
   
   Add to your Claude Code MCP configuration file (usually located at `~/.config/claude/mcp.json`):

   ```json
   {
     "servers": {
       "gtags-mcp": {
         "type": "stdio",
         "command": "npx",
         "args": [
           "@ryogrid/gtags-mcp",
           "--dir",
           "/path/to/your/project"
         ],
         "env": {}
       }
     }
   }
   ```

2. **Option 2: Using Configuration Template**
   
   Copy the provided `claude-config.json` file and modify the `--dir` path:
   
   ```bash
   cp node_modules/@ryogrid/gtags-mcp/claude-config.json ~/.config/claude/mcp.json
   # Edit the file to set your project path
   ```

### Other MCP-Compatible Agents

Use the provided `mcp.config.json` as a template for other MCP-compatible AI agents.

## Available Tools

The MCP server provides the following tools to AI agents:

### 1. get_definition
Retrieves the exact definition of a symbol (function, variable, class, etc.)

**Input**: `{ "symbol": "function_name" }`
**Output**: File location, line number, and source code of the definition

### 2. get_references  
Finds all locations where a symbol is used/referenced

**Input**: `{ "symbol": "function_name" }`  
**Output**: List of all files and line numbers where the symbol is referenced

### 3. list_symbols_with_prefix
Lists all symbols that start with a given prefix (useful for auto-completion)

**Input**: `{ "prefix": "get_" }`
**Output**: List of all symbols starting with the prefix

### 4. search_pattern
Searches for a pattern in the source code using grep-like functionality

**Input**: `{ "pattern": "TODO|FIXME" }`
**Output**: All matches with file locations and context

## How It Works

1. **Initialization**: When started, the server checks for an existing GTAGS database in the project directory. If none exists, it creates one using `gtags`.

2. **Query Processing**: The server receives MCP-formatted requests from AI agents and translates them into appropriate `global` commands.

3. **Automatic Updates**: The server periodically runs `global -u` to update the symbol database as code changes.

4. **Response Formatting**: Results are formatted according to MCP specifications and returned to the requesting AI agent.

## Built-in Analysis Prompts

The MCP server includes intelligent prompts that guide AI agents on how to effectively use the codebase analysis tools:

### Available Prompts

1. **analyze-codebase**: General codebase analysis workflow and best practices
2. **find-function**: Systematic approach to understanding a specific function
3. **code-navigation**: Strategies for navigating and exploring codebases
4. **refactoring-analysis**: Pre-refactoring impact analysis checklist

### How Prompts Work

When an AI agent (like Claude Code) connects to this MCP server, it automatically receives guidance on:
- When to use each tool
- How to analyze code systematically  
- Best practices for codebase exploration
- Step-by-step workflows for common tasks

The prompts ensure that AI agents use the tools effectively and follow software engineering best practices.


## Supported Languages

GNU GLOBAL supports many programming languages including:
- C/C++
- Java
- PHP
- Python
- JavaScript
- Go
- Rust
- And many more

The exact language support depends on your GNU GLOBAL installation and configuration.

## Troubleshooting

### Common Issues

1. **"gtags command not found"**
   - Ensure GNU GLOBAL is installed and in your PATH
   - Verify installation: `which gtags`

2. **"No symbols found"**
   - Make sure you're in a directory with source code
   - Check that GTAGS database was created successfully
   - Some file types might not be indexed by default

3. **Permission errors**
   - Ensure the server has read/write access to the project directory
   - GTAGS database files need to be writable for updates

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=1 npx @ryogrid/gtags-mcp --dir /path/to/project
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Links

- [GitHub Repository](https://github.com/ryogrid/gtags-mcp)
- [NPM Package](https://www.npmjs.com/package/@ryogrid/gtags-mcp)
- [GNU GLOBAL Documentation](https://www.gnu.org/software/global/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)