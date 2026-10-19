#!/usr/bin/env node
/**
 * Teamleader MCP CLI
 * 
 * Commands:
 *   auth          Start OAuth authentication flow
 *   auth status   Check authentication status
 *   auth logout   Clear stored tokens
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { getAuthorizationUrl, type OAuthConfig } from './auth/oauth.js';
import { startAuthServer } from './auth/auth-server.js';
import { VERSION } from './version.js';

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.teamleader-mcp');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_PORT = 9876;
const DEFAULT_REDIRECT_URI = `http://localhost:${DEFAULT_PORT}/callback`;

interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  createdAt: number;
}

interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function success(msg: string) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg: string) {
  console.error(`${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg: string) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
}

function warn(msg: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Save OAuth config to file
 */
async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  await fs.chmod(CONFIG_FILE, 0o600);
}

/**
 * Get OAuth config from environment variables, config file, or interactive prompt
 */
async function getOAuthConfig(): Promise<OAuthConfig | null> {
  // First try environment variables
  const envClientId = process.env.TEAMLEADER_CLIENT_ID;
  const envClientSecret = process.env.TEAMLEADER_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      redirectUri: process.env.TEAMLEADER_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    };
  }

  // Try config file
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config: Config = JSON.parse(data);

    if (config.clientId && config.clientSecret) {
      return {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri || DEFAULT_REDIRECT_URI,
      };
    }
  } catch {
    // Config file doesn't exist
  }

  // Interactive prompt
  info('No OAuth configuration found. Let\'s set it up!\n');
  console.log(`${colors.dim}You can get these from: https://marketplace.focus.teamleader.eu/build${colors.reset}\n`);

  const clientId = await prompt(`${colors.cyan}Client ID:${colors.reset} `);
  if (!clientId) {
    error('Client ID is required.');
    return null;
  }

  const clientSecret = await prompt(`${colors.cyan}Client Secret:${colors.reset} `);
  if (!clientSecret) {
    error('Client Secret is required.');
    return null;
  }

  // Save for future use
  const config: Config = { clientId, clientSecret, redirectUri: DEFAULT_REDIRECT_URI };
  await saveConfig(config);
  success(`Config saved to ${CONFIG_FILE}\n`);

  return {
    clientId,
    clientSecret,
    redirectUri: DEFAULT_REDIRECT_URI,
  };
}

/**
 * Save credentials to file
 */
async function saveCredentials(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  
  const credentials: StoredCredentials = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    createdAt: Date.now(),
  };
  
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
  await fs.chmod(CREDENTIALS_FILE, 0o600); // Only owner can read/write
}

/**
 * Load stored credentials
 */
async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Clear stored credentials
 */
async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(CREDENTIALS_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Open URL in browser
 */
async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import('open');
  await open(url);
}

// Create CLI
const program = new Command();

program
  .name('teamleader-mcp')
  .description('Teamleader Focus MCP - CLI tools')
  .version(VERSION);

// Auth command group
const auth = program
  .command('auth')
  .description('Authenticate with Teamleader Focus');

// Default auth action (start OAuth flow)
auth
  .action(async () => {
    console.log(`\n${colors.bright}🔐 Teamleader Focus Authentication${colors.reset}\n`);
    
    const config = await getOAuthConfig();

    if (!config) {
      error('Setup cancelled.\n');
      process.exit(1);
    }
    
    // Generate authorization URL
    const state = Math.random().toString(36).substring(7);
    const authUrl = getAuthorizationUrl(config, state);
    
    info(`Opening browser for authorization...\n`);
    console.log(`${colors.dim}If the browser doesn't open, visit:${colors.reset}`);
    console.log(`${colors.cyan}${authUrl}${colors.reset}\n`);
    
    try {
      // Open browser
      await openBrowser(authUrl);
      
      // Start local server to receive callback
      const result = await startAuthServer(config, DEFAULT_PORT);
      
      // Save credentials
      await saveCredentials(result.accessToken, result.refreshToken, result.expiresIn);
      
      console.log('');
      success('Authentication successful!\n');
      info(`Credentials saved to: ${CREDENTIALS_FILE}`);
      info(`Token expires in: ${Math.round(result.expiresIn / 60)} minutes\n`);
      
      console.log(`${colors.dim}Your tokens will be automatically refreshed when needed.${colors.reset}\n`);
      
    } catch (err) {
      console.log('');
      error(`Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  });

// Auth status subcommand
auth
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    console.log(`\n${colors.bright}🔐 Authentication Status${colors.reset}\n`);
    
    const credentials = await loadCredentials();
    
    if (!credentials) {
      warn('Not authenticated\n');
      console.log(`Run ${colors.cyan}teamleader-mcp auth${colors.reset} to authenticate.\n`);
      process.exit(1);
    }
    
    success('Authenticated\n');
    
    // Check expiry
    if (credentials.expiresAt) {
      const now = Date.now();
      const expiresIn = credentials.expiresAt - now;
      
      if (expiresIn <= 0) {
        warn('Access token has expired (will be refreshed on next use)');
      } else {
        const minutes = Math.round(expiresIn / 60000);
        if (minutes > 60) {
          info(`Access token expires in: ${Math.round(minutes / 60)} hours`);
        } else {
          info(`Access token expires in: ${minutes} minutes`);
        }
      }
    }
    
    // Show when authenticated
    if (credentials.createdAt) {
      const date = new Date(credentials.createdAt);
      info(`Authenticated on: ${date.toLocaleString()}`);
    }
    
    info(`Credentials file: ${CREDENTIALS_FILE}`);
    console.log('');
  });

// Auth logout subcommand
auth
  .command('logout')
  .description('Clear stored authentication tokens')
  .action(async () => {
    console.log(`\n${colors.bright}🔐 Logout${colors.reset}\n`);
    
    const credentials = await loadCredentials();
    
    if (!credentials) {
      info('No credentials stored.\n');
      return;
    }
    
    await clearCredentials();
    success('Credentials cleared.\n');
  });

// If no arguments provided, start the MCP server
if (process.argv.length <= 2) {
  const { startServer } = await import('./server.js');
  const { createTokenManagerFromEnv, createTokenManagerFromStoredCredentials } = await import('./auth/token-manager.js');

  let tokenManager = createTokenManagerFromEnv();
  if (!tokenManager) {
    tokenManager = await createTokenManagerFromStoredCredentials();
  }

  if (!tokenManager) {
    console.error('Error: No Teamleader credentials found.');
    console.error('Run: teamleader-mcp auth');
    process.exit(1);
  }

  await startServer(tokenManager);
} else {
  program.parse();
}
