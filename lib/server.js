/**
 * MCP (Model-Code-Provider) stdio Service
 *
 * A command-line application that uses GNU GLOBAL(gtags) as a backend
 * to provide codebase structural information to an AI coding agent.
 *
 * It communicates over stdio using a line-delimited JSON RPC protocol.
 *   - Reads requests from stdin.
 *   - Writes responses to stdout.
 *   - Writes logs and status messages to stderr.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const readline = require('readline');

const execPromise = promisify(exec);

/**
 * Parses command-line arguments.
 * @returns {{projectPath: string, updateIntervalSeconds: number}}
 */
function parseArguments() {
    const args = process.argv.slice(2);
    let projectPath = null;
    let updateIntervalSeconds = 15; // Default: 15 seconds

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dir' && i + 1 < args.length) {
            projectPath = path.resolve(args[i + 1]);
            i++;
        } else if (args[i].startsWith('--interval=')) {
            const value = parseInt(args[i].split('=')[1], 10);
            if (!isNaN(value) && value > 0) {
                updateIntervalSeconds = value;
            }
        }
    }

    if (!projectPath) {
        console.error("Error: The '--dir' argument specifying the target project path is required.");
        console.error("Usage: npx @ryogrid/gtags-mcp --dir /path/to/project [--interval=seconds]");
        process.exit(1);
    }

    return { projectPath, updateIntervalSeconds };
}

const { projectPath: PROJECT_PATH, updateIntervalSeconds } = parseArguments();

// --- Core GNU GLOBAL Functions ---

async function runGtagsUpdate() {
    console.error(`[INFO] [${new Date().toISOString()}] Starting incremental index update for: ${PROJECT_PATH}`);
    try {
        await execPromise('gtags -i', { cwd: PROJECT_PATH });
        console.error(`[INFO] [${new Date().toISOString()}] Index update completed successfully.`);
    } catch (error) {
        console.error(`[ERROR] [${new Date().toISOString()}] Index update failed.`, error.stderr);
    }
}

function executeGlobalCommand(args) {
    return new Promise((resolve, reject) => {
        const command = `global ${args.join(' ')}`;
        exec(command, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
            if (error && !stderr.includes('not found')) return reject({ error, stderr });
            resolve(stdout);
        });
    });
}

function parseLocationOutput(output) {
    if (!output) return [];
    return output.trim().split('\n').map(line => {
        const match = line.match(/^(\S+)\s+(\d+)\s+([^\s]+)\s+(.*)$/);
        if (!match) return null;
        return { symbol: match[1], line: parseInt(match[2], 10), file: match[3], code: match[4].trim() };
    }).filter(Boolean);
}

// --- Request Processing Logic ---

async function processRequest(request) {
    const { command, params } = request;

    switch (command) {
        case 'get_definition':
            return await executeGlobalCommand(['-x', params.symbol]).then(parseLocationOutput);
        
        case 'get_references':
            return await executeGlobalCommand(['-xr', params.symbol]).then(parseLocationOutput);

        case 'list_symbols_with_prefix':
            return await executeGlobalCommand(['-c', params.prefix]).then(out => out.trim().split('\n').filter(Boolean));

        default:
            throw new Error(`Unknown command: ${command}`);
    }
}

/**
 * Writes a JSON response to stdout.
 * @param {object} response - The response object to send.
 */
function sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}

// --- Main Application Logic ---

async function main() {
    console.error("[INFO] Initializing MCP stdio service...");
    await runGtagsUpdate();
    setInterval(runGtagsUpdate, updateIntervalSeconds * 1000);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    console.error("[INFO] MCP service is ready and listening for requests on stdin.");

    rl.on('line', async (line) => {
        let request;
        try {
            request = JSON.parse(line);
            if (!request.id || !request.command) {
                throw new Error("Request must include 'id' and 'command' fields.");
            }
        } catch (error) {
            sendResponse({ id: null, status: 'error', error: { message: 'Invalid JSON request.', details: error.message } });
            return;
        }

        try {
            console.error(`[INFO] Received command: ${request.command} (ID: ${request.id})`);
            const payload = await processRequest(request);
            sendResponse({ id: request.id, status: 'success', payload: payload });
        } catch (error) {
            sendResponse({ id: request.id, status: 'error', error: { message: error.message, details: error.stack } });
        }
    });

    rl.on('close', () => {
        console.error("[INFO] Stdin stream closed. Shutting down MCP service.");
        process.exit(0);
    });
}

main().catch(error => {
    console.error("[FATAL] A fatal error occurred during initialization.", error);
    process.exit(1);
});
