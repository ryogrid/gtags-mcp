/**
 * MCP (Model-Code-Provider) TCP Server
 *
 * A service that uses GNU GLOBAL(gtags) as a backend and communicates
 * with an AI coding agent over a TCP socket using a
 * line-delimited JSON RPC protocol.
 *
 * It listens on a specified host and port for connections.
 */

const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const readline = require('readline');
const { env } = require('process');

const execPromise = promisify(exec);

/**
 * Parses command-line arguments.
 * @returns {{projectPath: string, host: string, port: number, updateIntervalSeconds: number}}
 */
function parseArguments() {
    const args = process.argv.slice(2);
    let projectPath = null;
    let host = '127.0.0.1'; // Default to localhost for security
    let port = env.PORT || 3000;       // Default port
    let updateIntervalSeconds = 15; // Default update interval

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dir' && i + 1 < args.length) {
            projectPath = path.resolve(args[i + 1]);
            i++;
        } else if (args[i] === '--port' && i + 1 < args.length) {
            const parsedPort = parseInt(args[i + 1], 10);
            if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
                port = parsedPort;
            }
            i++;
        } else if (args[i].startsWith('--interval=')) {
            const value = parseInt(args[i].split('=')[1], 10);
            if (!isNaN(value) && value > 0) {
                updateIntervalSeconds = value;
            }
        }
    }

    if (!projectPath) {
        console.error("Error: The '--dir' argument is required.");
        console.error("Usage: npx @ryogrid/gtags-mcp --dir /path/to/project [--port <num>]");
        process.exit(1);
    }

    return { projectPath, host, port, updateIntervalSeconds };
}

const { projectPath: PROJECT_PATH, host: HOST, port: PORT, updateIntervalSeconds } = parseArguments();

// --- Core GNU GLOBAL Functions (Unchanged) ---

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

// --- Request Processing Logic (Unchanged) ---

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

// --- TCP Server Logic ---

const server = net.createServer(clientSocket => {
    const clientAddress = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`;
    console.error(`[INFO] Client connected: ${clientAddress}`);
    
    const rl = readline.createInterface({
        input: clientSocket,
        crlfDelay: Infinity
    });

    rl.on('line', async (line) => {
        let request;
        try {
            request = JSON.parse(line);
            if (!request.id || !request.command) {
                throw new Error("Request must include 'id' and 'command' fields.");
            }
        } catch (error) {
            clientSocket.write(JSON.stringify({ id: null, status: 'error', error: { message: 'Invalid JSON request.', details: error.message } }) + '\n');
            return;
        }

        try {
            console.error(`[INFO] Received command from ${clientAddress}: ${request.command} (ID: ${request.id})`);
            const payload = await processRequest(request);
            clientSocket.write(JSON.stringify({ id: request.id, status: 'success', payload: payload }) + '\n');
        } catch (error) {
            clientSocket.write(JSON.stringify({ id: request.id, status: 'error', error: { message: error.message, details: error.stack } }) + '\n');
        }
    });

    clientSocket.on('end', () => {
        console.error(`[INFO] Client disconnected: ${clientAddress}`);
    });

    clientSocket.on('error', (err) => {
        console.error(`[ERROR] Client socket error from ${clientAddress}:`, err);
    });
});

async function main() {
    console.error("[INFO] Initializing MCP TCP server...");

    server.listen(PORT, HOST, async () => {
        console.error(`[INFO] MCP server is listening on TCP ${HOST}:${PORT}`);
        // Run initial index update after server starts listening
        await runGtagsUpdate();
        // Schedule periodic updates
        setInterval(runGtagsUpdate, updateIntervalSeconds * 1000);
    });

    server.on('error', (err) => {
        console.error('[FATAL] Server error:', err);
        process.exit(1);
    });

    const cleanup = () => {
        console.error('[INFO] Shutting down server...');
        server.close(() => {
            console.error('[INFO] Server closed.');
            process.exit(0);
        });
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(error => {
    console.error("[FATAL] An unhandled error occurred during initialization.", error);
    process.exit(1);
});