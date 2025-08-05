const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const MCP_VERSION = "2024-11-05";

class GtagsMCPServer {
    constructor(projectDir, updateInterval = 15) {
        this.projectDir = projectDir;
        this.updateInterval = updateInterval;
        this.isUpdating = false;
        this.setupStdioHandlers();
        this.startPeriodicUpdate();
    }

    setupStdioHandlers() {
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data) => {
            const lines = data.trim().split('\n');
            lines.forEach((line) => {
                if (line.trim()) {
                    try {
                        this.handleMessage(JSON.parse(line));
                    } catch (error) {
                        this.sendError({
                            jsonrpc: "2.0",
                            id: null,
                            error: {
                                code: -32700,
                                message: "Parse error"
                            }
                        });
                    }
                }
            });
        });
    }

    async handleMessage(message) {
        const { jsonrpc, id, method, params } = message;
        
        try {
            let result;
            
            switch (method) {
                case 'initialize':
                    result = await this.initialize();
                    break;
                case 'tools/list':
                    result = this.listTools();
                    break;
                case 'tools/call':
                    result = await this.callTool(params);
                    break;
                case 'prompts/list':
                    result = this.listPrompts();
                    break;
                case 'prompts/get':
                    result = await this.getPrompt(params);
                    break;
                default:
                    throw new Error(`Unknown method: ${method}`);
            }
            
            this.sendResponse({ jsonrpc, id, result });
        } catch (error) {
            this.sendError({ 
                jsonrpc, 
                id, 
                error: {
                    code: -32603,
                    message: error.message
                }
            });
        }
    }

    async initialize() {
        // Initialize gtags if needed
        await this.ensureGtagsDatabase();
        
        return {
            protocolVersion: MCP_VERSION,
            capabilities: {
                tools: {
                    listChanged: false
                },
                prompts: {
                    listChanged: false
                }
            },
            serverInfo: {
                name: "gtags-mcp",
                version: "0.0.4"
            }
        };
    }

    listPrompts() {
        return {
            prompts: [
                {
                    name: "analyze-codebase",
                    description: "Get guidance on how to effectively analyze a codebase using gtags-mcp tools",
                    arguments: []
                },
                {
                    name: "find-function",
                    description: "Get instructions for finding and analyzing a specific function in the codebase",
                    arguments: [
                        {
                            name: "function_name",
                            description: "The name of the function to analyze",
                            required: false
                        }
                    ]
                },
                {
                    name: "code-navigation",
                    description: "Learn how to navigate and understand code relationships using available tools",
                    arguments: []
                },
                {
                    name: "refactoring-analysis",
                    description: "Get guidance on analyzing code before refactoring using gtags tools",
                    arguments: [
                        {
                            name: "target_symbol",
                            description: "The symbol/function to be refactored",
                            required: false
                        }
                    ]
                }
            ]
        };
    }

    async getPrompt(params) {
        const { name, arguments: args = {} } = params;
        
        switch (name) {
            case 'analyze-codebase':
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `You are a code analysis expert. I have access to a powerful codebase analysis tool called gtags-mcp that wraps GNU GLOBAL. Here's how to use it effectively:

## Available Tools:

1. **get_definition**: Find where symbols (functions, variables, classes) are defined
   - Use when: You need to understand what a function/variable does
   - Example: get_definition with symbol "ReadPage"

2. **get_references**: Find all places where a symbol is used
   - Use when: You need to understand the impact of changing a function
   - Example: get_references with symbol "ReadPage" to see all call sites

3. **list_symbols_with_prefix**: Get all symbols starting with a prefix
   - Use when: You want to discover related functions or do code completion
   - Example: list_symbols_with_prefix with prefix "Read" to find all Read* functions

4. **search_pattern**: Search for patterns in source code
   - Use when: You need to find specific code patterns, TODOs, error handling, etc.
   - Example: search_pattern with pattern "TODO|FIXME" to find pending work

## Best Practices:

- Start with get_definition to understand a symbol's implementation
- Use get_references to analyze impact before making changes
- Use list_symbols_with_prefix for code discovery and understanding naming patterns
- Use search_pattern for finding specific code constructs or debugging

Always analyze the codebase systematically: definition → references → related symbols → patterns.`
                            }
                        }
                    ]
                };

            case 'find-function':
                const functionName = args.function_name || 'TARGET_FUNCTION';
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `I need to analyze the function "${functionName}" in this codebase. Please help me understand it thoroughly by following this systematic approach:

## Step-by-Step Analysis:

1. **Find the Definition**
   - Use get_definition with symbol "${functionName}"
   - Understand the function's signature, parameters, and implementation

2. **Analyze Usage**
   - Use get_references with symbol "${functionName}"
   - Identify all places where this function is called
   - Understand the calling contexts and patterns

3. **Discover Related Functions**
   - Use list_symbols_with_prefix to find related functions
   - Look for functions with similar prefixes or naming patterns

4. **Find Implementation Patterns**
   - Use search_pattern to find similar implementations
   - Look for error handling, logging, or specific patterns used by this function

## Questions to Answer:
- What does this function do?
- Where is it called from?
- What are its dependencies?
- Are there similar functions?
- What would be the impact of modifying it?

Please execute these tools systematically and provide a comprehensive analysis.`
                            }
                        }
                    ]
                };

            case 'code-navigation':
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `You are helping me navigate and understand this codebase. Here's how to use the available gtags-mcp tools for effective code navigation:

## Navigation Strategy:

### 1. Top-Down Exploration
- Start with list_symbols_with_prefix using common prefixes like "main", "init", "create", etc.
- Use get_definition on key functions to understand the architecture
- Follow the call graph using get_references

### 2. Bottom-Up Investigation  
- When you encounter an unknown function/variable, use get_definition immediately
- Use get_references to understand how it fits into the larger system
- Use search_pattern to find similar usage patterns

### 3. Cross-Reference Analysis
- For any function modification, always use get_references first
- Use list_symbols_with_prefix to find related functions that might need similar changes
- Use search_pattern to find coding conventions and patterns

### 4. Debugging and Investigation
- Use search_pattern with error messages, function names, or specific keywords
- Use get_references to trace data flow and execution paths
- Use list_symbols_with_prefix to find utility functions and helpers

## Navigation Tips:
- Always understand a function's definition before analyzing its usage
- Use references to understand the impact scope of changes
- Use prefix matching to discover the codebase's organization and naming conventions
- Use pattern search for finding examples and understanding conventions

Start by exploring the main entry points and work your way through the codebase systematically.`
                            }
                        }
                    ]
                };

            case 'refactoring-analysis':
                const targetSymbol = args.target_symbol || 'TARGET_SYMBOL';
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `I'm planning to refactor the symbol "${targetSymbol}". Please help me perform a thorough impact analysis using the gtags-mcp tools:

## Pre-Refactoring Analysis Checklist:

### 1. Understand Current Implementation
- Use get_definition with symbol "${targetSymbol}"
- Analyze the current implementation, parameters, return values, and logic
- Document what the function/variable currently does

### 2. Impact Assessment
- Use get_references with symbol "${targetSymbol}"
- Identify ALL places where this symbol is used
- Categorize usage patterns (direct calls, parameter passing, assignments, etc.)

### 3. Find Related Code
- Use list_symbols_with_prefix to find related functions/variables
- Look for functions that might need similar refactoring
- Identify naming patterns and conventions

### 4. Pattern Analysis
- Use search_pattern to find similar implementations in the codebase
- Look for established patterns that the refactoring should follow
- Find examples of how similar refactoring was done before

### 5. Dependency Analysis
- For each reference found, use get_definition on the calling functions
- Understand the context and requirements of each caller
- Identify any special handling or edge cases

## Refactoring Safety Questions:
- How many places will be affected?
- Are there any critical/sensitive call sites?
- What are the interface requirements from callers?
- Are there existing patterns to follow?
- What tests might need to be updated?

Please execute this analysis systematically and provide a comprehensive refactoring plan with risk assessment.`
                            }
                        }
                    ]
                };

            default:
                throw new Error(`Unknown prompt: ${name}`);
        }
    }

    listTools() {
        return {
            tools: [
                {
                    name: "get_definition",
                    description: "Retrieves the exact definition (file, line number, and source code) of a symbol using GNU GLOBAL",
                    inputSchema: {
                        type: "object",
                        properties: {
                            symbol: {
                                type: "string",
                                description: "The exact name of the symbol (function, variable, class, etc.) to find the definition of"
                            }
                        },
                        required: ["symbol"]
                    }
                },
                {
                    name: "get_references",
                    description: "Finds all locations where a symbol is used/referenced in the codebase",
                    inputSchema: {
                        type: "object",
                        properties: {
                            symbol: {
                                type: "string", 
                                description: "The name of the symbol whose references/usages to find"
                            }
                        },
                        required: ["symbol"]
                    }
                },
                {
                    name: "list_symbols_with_prefix",
                    description: "Lists all symbols (functions, variables, classes, etc.) that start with a given prefix",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prefix: {
                                type: "string",
                                description: "The prefix string to search for. Returns all symbols starting with this prefix"
                            }
                        },
                        required: ["prefix"]
                    }
                },
                {
                    name: "search_pattern",
                    description: "Searches for a pattern in the source code using grep-like functionality",
                    inputSchema: {
                        type: "object",
                        properties: {
                            pattern: {
                                type: "string",
                                description: "The pattern/regex to search for in the source code"
                            }
                        },
                        required: ["pattern"]
                    }
                }
            ]
        };
    }

    async callTool(params) {
        const { name, arguments: args } = params;
        
        switch (name) {
            case 'get_definition':
                return await this.getDefinition(args.symbol);
            case 'get_references':
                return await this.getReferences(args.symbol);
            case 'list_symbols_with_prefix':
                return await this.listSymbolsWithPrefix(args.prefix);
            case 'search_pattern':
                return await this.searchPattern(args.pattern);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    async ensureGtagsDatabase() {
        const gtagsPath = path.join(this.projectDir, 'GTAGS');
        try {
            await fs.access(gtagsPath);
        } catch (error) {
            // GTAGS database doesn't exist, create it
            await this.runCommand('gtags', [], { cwd: this.projectDir });
        }
    }

    async getDefinition(symbol) {
        try {
            const output = await this.runCommand('global', ['-d', symbol], { cwd: this.projectDir });
            const lines = output.trim().split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No definition found for symbol: ${symbol}`
                        }
                    ]
                };
            }

            const results = [];
            for (const line of lines) {
                const [file, lineNum, code] = line.split(/\s+/, 3);
                const filePath = path.resolve(this.projectDir, file);
                
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const fileLines = fileContent.split('\n');
                    const targetLine = fileLines[parseInt(lineNum) - 1] || '';
                    
                    results.push({
                        file: file,
                        line: parseInt(lineNum),
                        code: targetLine.trim(),
                        fullPath: filePath
                    });
                } catch (readError) {
                    results.push({
                        file: file,
                        line: parseInt(lineNum),
                        code: code || 'Unable to read file content',
                        fullPath: filePath
                    });
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Definition(s) of '${symbol}':\n\n` +
                              results.map(r => 
                                `File: ${r.file}:${r.line}\n` +
                                `Code: ${r.code}\n` +
                                `Path: ${r.fullPath}`
                              ).join('\n\n')
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting definition for '${symbol}': ${error.message}`
                    }
                ]
            };
        }
    }

    async getReferences(symbol) {
        try {
            const output = await this.runCommand('global', ['-r', symbol], { cwd: this.projectDir });
            const lines = output.trim().split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No references found for symbol: ${symbol}`
                        }
                    ]
                };
            }

            const results = [];
            for (const line of lines) {
                const [file, lineNum, code] = line.split(/\s+/, 3);
                results.push({
                    file: file,
                    line: parseInt(lineNum),
                    code: code || 'N/A'
                });
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `References to '${symbol}' (${results.length} found):\n\n` +
                              results.map(r => 
                                `${r.file}:${r.line} - ${r.code}`
                              ).join('\n')
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting references for '${symbol}': ${error.message}`
                    }
                ]
            };
        }
    }

    async listSymbolsWithPrefix(prefix) {
        try {
            const output = await this.runCommand('global', ['-c', prefix], { cwd: this.projectDir });
            const symbols = output.trim().split('\n').filter(line => line.trim());
            
            if (symbols.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No symbols found with prefix: ${prefix}`
                        }
                    ]
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Symbols with prefix '${prefix}' (${symbols.length} found):\n\n` +
                              symbols.join('\n')
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error listing symbols with prefix '${prefix}': ${error.message}`
                    }
                ]
            };
        }
    }

    async searchPattern(pattern) {
        try {
            const output = await this.runCommand('global', ['-g', pattern], { cwd: this.projectDir });
            const lines = output.trim().split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No matches found for pattern: ${pattern}`
                        }
                    ]
                };
            }

            const results = [];
            for (const line of lines) {
                const [file, lineNum, code] = line.split(/\s+/, 3);
                results.push({
                    file: file,
                    line: parseInt(lineNum),
                    code: code || 'N/A'
                });
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Pattern matches for '${pattern}' (${results.length} found):\n\n` +
                              results.map(r => 
                                `${r.file}:${r.line} - ${r.code}`
                              ).join('\n')
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error searching pattern '${pattern}': ${error.message}`
                    }
                ]
            };
        }
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    startPeriodicUpdate() {
        setInterval(async () => {
            if (!this.isUpdating) {
                this.isUpdating = true;
                try {
                    await this.runCommand('global', ['-u'], { cwd: this.projectDir });
                } catch (error) {
                    // Silently handle update errors
                } finally {
                    this.isUpdating = false;
                }
            }
        }, this.updateInterval * 1000);
    }

    sendResponse(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }

    sendError(error) {
        process.stdout.write(JSON.stringify(error) + '\n');
    }

    start() {
        // Server is ready to receive messages
        process.stderr.write('GtagsMCPServer started\n');
    }
}

module.exports = GtagsMCPServer;