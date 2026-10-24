# My MCP Connector - Technical Implementation Guide

## 🔧 Architecture Overview

This guide provides deep technical details about the plugin architecture, MCP server implementation, and integration patterns.

---

## 🏗️ Plugin Architecture

### Component Diagram

```
Mistral AI Chat
       ↓
[Managed Connector]
       ↓
My MCP Connector Plugin (.vibe/plugins/my-mcp-connector)
       ↓
├── plugin.json          # Plugin manifest (Agent Plugins 1.0 schema)
├── connectors.json      # Connector definition
├── mcp.json             # MCP server definitions
├── skills/              # Optional skills
│   └── workflow-tools/
│       └── SKILL.md
└── server/              # MCP server implementation
    ├── index.js         # Server entry point
    ├── package.json     # Dependencies
    └── logs/            # Log files
```

### Plugin Manifest (plugin.json)

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-mcp-connector",
  "version": "1.0.0",
  "description": "Custom MCP server connector for Sourov's workflows",
  "author": {
    "name": "Sourov",
    "email": "sourov@example.com",
    "url": "https://sourovdeb.com"
  },
  "homepage": "https://sourovdeb.com/my-mcp-connector",
  "repository": "https://github.com/sourovdeb/my-mcp-connector",
  "license": "MIT",
  "keywords": ["mcp", "workflows", "automation", "mistral"],
  "extensions": {
    "ai.mistral.vibe": {
      "schemaVersion": 1,
      "displayName": "My MCP Connector",
      "toolNamespace": "myMcpConnector"
    }
  }
}
```

**Key Fields:**
- `$schema`: Must use Agent Plugins 1.0 schema URL
- `name`: Must match directory name, lowercase with hyphens
- `version`: Semantic versioning (MAJOR.MINOR.PATCH)
- `extensions.ai.mistral.vibe`: Required for Vibe-specific features

### Connector Definition (connectors.json)

```json
{
  "schemaVersion": 1,
  "connectors": [
    {
      "id": "my-mcp-connector",
      "name": "My Custom MCP Connector",
      "description": "Custom MCP server connector for Sourov's workflows",
      "server": "http://localhost:3000/mcp",
      "authentication": {
        "type": "bearer",
        "token": "your-secret-token-here"
      },
      "tools": [
        "health_check",
        "system_info",
        "one_stop_shop_status",
        "credential_env_present",
        "vibe_skill_list"
      ]
    }
  ]
}
```

**Connector Fields:**
- `id`: Unique identifier (used in tool namespacing)
- `name`: Human-readable name
- `server`: MCP server endpoint URL
- `authentication`: Authentication configuration
- `tools`: List of exposed tools

**Authentication Types:**
```json
{
  "type": "none"
}

{
  "type": "bearer",
  "token": "your-token"
}

{
  "type": "api_key",
  "header": "X-API-Key",
  "key": "your-api-key"
}

{
  "type": "oauth2",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "authorizationUrl": "https://auth.example.com/oauth/authorize",
  "tokenUrl": "https://auth.example.com/oauth/token"
}
```

---

## 🌐 MCP Server Implementation

### Protocol Overview

MCP (Model Context Protocol) is a JSON-RPC 2.0 based protocol for AI assistants to interact with tools and resources.

**Transport Types:**
1. **stdio** - Standard input/output (for local development)
2. **http** - HTTP/HTTPS server
3. **streamable-http** - HTTP with streaming support
4. **sse** - Server-Sent Events

### Server Architecture

```
┌───────────────────────────────────────────────────────┐
│                   MCP Server                          │
├───────────────────┬───────────────────┬───────────────┤
│   Request Handler │   Tool Registry   │  Auth Layer   │
└─────────┬─────────┴─────────┬─────────┴───────┬───────┘
          │                   │                 │
          ↓                   ↓                 ↓
┌───────────────────┐ ┌───────────────┐ ┌───────────────┐
│   JSON-RPC 2.0    │ │   Tool        │ │ Authentication│
│   Protocol        │ │   Implementations││   Middleware  │
└───────────────────┘ └───────────────┘ └───────────────┘
```

### Server Implementation (Node.js)

#### File: `server/index.js`

```javascript
// Import MCP SDK
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const config = {
  name: process.env.MCP_SERVER_NAME || 'my-mcp-connector',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Initialize server
const server = new Server(
  {
    name: config.name,
    version: config.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
  }
);

// Tool Registry
const tools = {
  health_check: {
    description: 'Check server health and version',
    handler: async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            version: config.version,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          })
        }]
      };
    }
  },
  
  system_info: {
    description: 'Get system information (CPU, RAM, OS)',
    handler: async () => {
      try {
        const os = require('os');
        const process = require('process');
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              os: os.platform(),
              osRelease: os.release(),
              osVersion: os.version(),
              cpuCount: os.cpus().length,
              cpuModel: os.cpus()[0]?.model,
              totalMemory: os.totalmem(),
              freeMemory: os.freemem(),
              memoryUsage: process.memoryUsage(),
              nodeVersion: process.version,
              architecture: os.arch()
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get system info: ${error.message}`);
      }
    }
  },
  
  one_stop_shop_status: {
    description: 'Check ONE-STOP-SHOP pipeline folders',
    handler: async () => {
      try {
        const path = require('path');
        const fs = require('fs');
        
        const shopRoot = process.env.ONE_STOP_SHOP_DIR || 'E:\\ONE-STOP-SHOP';
        const shopPath = path.normalize(shopRoot);
        
        if (!fs.existsSync(shopPath)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                exists: false,
                error: 'ONE-STOP-SHOP directory does not exist'
              })
            }]
          };
        }
        
        const dirs = {};
        const items = fs.readdirSync(shopPath);
        
        for (const item of items) {
          const itemPath = path.join(shopPath, item);
          if (fs.statSync(itemPath).isDirectory() && !item.startsWith('.')) {
            try {
              const files = fs.readdirSync(itemPath).length;
              dirs[item] = files;
            } catch (e) {
              dirs[item] = -1; // Error reading directory
            }
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              exists: true,
              root: shopPath,
              dirs: dirs,
              totalFolders: Object.keys(dirs).length
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to check ONE-STOP-SHOP: ${error.message}`);
      }
    }
  },
  
  credential_env_present: {
    description: 'List expected environment variables (names only, no values)',
    handler: async () => {
      const expectedEnv = [
        'MISTRAL_API_KEY',
        'MISTRAL_WORKFLOWS_API_KEY',
        'AGNES_API_KEY',
        'TYPESAFE_API_KEY',
        'HOSTINGER_API_TOKEN',
        'DEVTO_API_KEY',
        'CORE_API_KEY',
        'SKYVERN_API_KEY',
        'WP_SITE_URL',
        'WP_REST_BASE',
        'WP_USERNAME',
        'WP_APP_PASSWORD',
        'WP_INDEXNOW_KEY',
        'FRANCE_TRAVAIL_CLIENT_ID',
        'FRANCE_TRAVAIL_CLIENT_SECRET'
      ];
      
      const result = {};
      
      for (const name of expectedEnv) {
        const value = process.env[name];
        result[name] = {
          set: !!value,
          length: value ? value.length : 0,
          present: !!value
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  },
  
  vibe_skill_list: {
    description: 'List installed skills in Vibe',
    handler: async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const skillRoots = [
          path.join(process.env.HOME || process.env.USERPROFILE, '.vibe', 'skills', 'skills'),
          'C:\\Users\\souro\\.vibe\\skills\\skills',
          'E:\\apps\\agent-skills',
          'H:\\00_SKILLS_AGENTS',
          'E:\\jev-skill-router\\skills'
        ];
        
        const allSkills = new Set();
        
        for (const root of skillRoots) {
          try {
            if (fs.existsSync(root)) {
              const items = fs.readdirSync(root);
              for (const item of items) {
                const itemPath = path.join(root, item);
                if (fs.statSync(itemPath).isDirectory()) {
                  const skillFile = path.join(itemPath, 'SKILL.md');
                  if (fs.existsSync(skillFile)) {
                    allSkills.add(item);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Could not read skills from ${root}: ${e.message}`);
          }
        }
        
        const skillsArray = Array.from(allSkills).sort();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: skillsArray.length,
              skills: skillsArray,
              timestamp: new Date().toISOString()
            })
          }]
        };
      } catch (error) {
        throw new Error(`Failed to list skills: ${error.message}`);
      }
    }
  }
};

// Register tools with server
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { params } = request;
  
  if (!params.name) {
    throw new Error('Tool name is required');
  }
  
  const tool = tools[params.name];
  
  if (!tool) {
    throw new Error(`Unknown tool: ${params.name}`);
  }
  
  try {
    return await tool.handler(params.arguments || {});
  } catch (error) {
    console.error(`Tool ${params.name} failed:`, error);
    throw new Error(`Tool execution failed: ${error.message}`);
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolList = Object.entries(tools).map(([name, definition]) => ({
    name: name,
    description: definition.description,
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }));
  
  return {
    tools: toolList
  };
});

// Authentication Middleware (example)
server.use(async (ctx, next) => {
  // Check authentication
  const authHeader = ctx.req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Validate token against expected value
    if (token !== process.env.MCP_AUTH_TOKEN) {
      ctx.res = {
        jsonrpc: '2.0',
        id: ctx.req.id,
        error: {
          code: -32000,
          message: 'Invalid authentication token'
        }
      };
      return;
    }
  }
  
  await next();
});

// Error Handling
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start server
async function startServer() {
  try {
    console.log(`Starting ${config.name} v${config.version}...`);
    console.log(`Server: ${config.host}:${config.port}`);
    console.log(`Log Level: ${config.logLevel}`);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log('Server running on stdio');
    console.log('Listening for MCP requests...');
    
    // For HTTP transport (alternative)
    // const httpTransport = new HttpServerTransport({
    //   port: config.port,
    //   host: config.host
    // });
    // await server.connect(httpTransport);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await server.close();
  process.exit(0);
});
```

### Package.json for Server

```json
{
  "name": "my-mcp-connector-server",
  "version": "1.0.0",
  "description": "MCP server for My MCP Connector plugin",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "node test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "ai",
    "workflows"
  ],
  "author": "Sourov",
  "license": "MIT"
}
```

---

## 🔐 Authentication Implementation

### Authentication Flow

```
Mistral AI → Connector → MCP Server → Authentication Middleware → Tool Execution
```

### Authentication Types Implementation

#### 1. Bearer Token

**In connectors.json:**
```json
{
  "authentication": {
    "type": "bearer",
    "token": "your-secret-token"
  }
}
```

**In server/index.js:**
```javascript
server.use(async (ctx, next) => {
  const authHeader = ctx.req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token !== process.env.MCP_AUTH_TOKEN) {
      ctx.res = {
        jsonrpc: '2.0',
        id: ctx.req.id,
        error: {
          code: -32000,
          message: 'Invalid authentication token'
        }
      };
      return;
    }
  }
  
  await next();
});
```

#### 2. API Key

**In connectors.json:**
```json
{
  "authentication": {
    "type": "api_key",
    "header": "X-API-Key",
    "key": "your-api-key-here"
  }
}
```

**In server/index.js:**
```javascript
server.use(async (ctx, next) => {
  const apiKey = ctx.req.headers['x-api-key'];
  
  if (apiKey !== process.env.MCP_API_KEY) {
    ctx.res = {
      jsonrpc: '2.0',
      id: ctx.req.id,
      error: {
        code: -32000,
        message: 'Invalid API key'
      }
    };
    return;
  }
  
  await next();
});
```

#### 3. OAuth2

**In connectors.json:**
```json
{
  "authentication": {
    "type": "oauth2",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "authorizationUrl": "https://auth.example.com/oauth/authorize",
    "tokenUrl": "https://auth.example.com/oauth/token"
  }
}
```

**In server/index.js:**
```javascript
// Implement OAuth2 token validation
// Use a library like 'simple-oauth2' or 'axios' to validate tokens
```

#### 4. None (Public Access)

**In connectors.json:**
```json
{
  "authentication": {
    "type": "none"
  }
}
```

---

## 🛠️ Tool Development Guide

### Creating a New Tool

#### Step 1: Define the Tool

```javascript
// In server/index.js
const tools = {
  // ... existing tools ...
  
  custom_tool: {
    description: 'Description of what this tool does',
    handler: async (params) => {
      // Validate input
      if (!params.requiredField) {
        throw new Error('requiredField is required');
      }
      
      // Execute logic
      const result = await doSomething(params);
      
      // Return result
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  }
};
```

#### Step 2: Register the Tool

The tool is automatically registered via the `tools` object.

#### Step 3: Update connectors.json

```json
{
  "tools": [
    "health_check",
    "system_info",
    "custom_tool"
  ]
}
```

#### Step 4: Test the Tool

```bash
# Test with curl
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "custom_tool",
    "arguments": {
      "requiredField": "value"
    }
  }
}'
```

### Tool Best Practices

1. **Input Validation:** Always validate input parameters
2. **Error Handling:** Provide meaningful error messages
3. **Logging:** Log tool execution for debugging
4. **Performance:** Optimize expensive operations
5. **Security:** Never expose sensitive data
6. **Documentation:** Update tool descriptions

---

## 📊 Performance Optimization

### Caching

```javascript
// Cache system info for 5 seconds
let cachedSystemInfo = null;
let lastCacheUpdate = 0;

const CACHE_TTL = 5000; // 5 seconds

async function getSystemInfo() {
  const now = Date.now();
  
  if (cachedSystemInfo && (now - lastCacheUpdate) < CACHE_TTL) {
    return cachedSystemInfo;
  }
  
  // Expensive operation
  const os = require('os');
  const result = {
    os: os.platform(),
    cpu: os.cpus().length,
    memory: os.totalmem()
  };
  
  cachedSystemInfo = result;
  lastCacheUpdate = now;
  
  return result;
}
```

### Rate Limiting

```javascript
const rateLimits = new Map();

async function checkRateLimit(ip, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const key = `rate_limit:${ip}`;
  
  let requests = rateLimits.get(key) || [];
  
  // Remove old requests
  requests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (requests.length >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }
  
  requests.push(now);
  rateLimits.set(key, requests);
  
  // Clean up old entries
  setInterval(() => {
    rateLimits.delete(key);
  }, windowMs + 1000);
}
```

### Connection Pooling

```javascript
// For HTTP-based MCP servers
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 60000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 60000
});
```

---

## 🔧 Deployment Strategies

### Development Deployment

```bash
# Start server
cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
npm install
npm start
```

### Production Deployment Options

#### Option 1: PM2 (Recommended)

```bash
npm install -g pm2
pm2 start server/index.js --name "mcp-connector"
pm2 save
pm2 startup
```

#### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

```bash
docker build -t my-mcp-connector .
docker run -d -p 3000:3000 --name mcp-connector my-mcp-connector
```

#### Option 3: Systemd (Linux)

```ini
# /etc/systemd/system/mcp-connector.service
[Unit]
Description=My MCP Connector
After=network.target

[Service]
User=node
WorkingDirectory=/home/node/my-mcp-connector/server
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mcp-connector
sudo systemctl start mcp-connector
```

#### Option 4: Windows Service

```powershell
# Using NSSM (Non-Sucking Service Manager)
nssm install "MCP Connector" "C:\Program Files\nodejs\node.exe"
nssm set "MCP Connector" AppParameters "C:\path\to\server\index.js"
nssm set "MCP Connector" AppDirectory "C:\path\to\server"
nssm set "MCP Connector" AppStdout "C:\logs\mcp-connector.log"
nssm set "MCP Connector" AppStderr "C:\logs\mcp-connector-error.log"
nssm start "MCP Connector"
```

---

## 📈 Monitoring and Logging

### Logging Levels

```javascript
const log = {
  debug: (message, data = {}) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
  info: (message, data = {}) => {
    if (['debug', 'info'].includes(process.env.LOG_LEVEL)) {
      console.info(`[INFO] ${message}`, data);
    }
  },
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${message}`, data);
  },
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
  }
};
```

### Structured Logging

```bash
# Use Winston or similar
npm install winston
```

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/server.log' })
  ]
});

// Usage
logger.info('Server started', { version: '1.0.0' });
logger.error('Tool failed', { tool: 'health_check', error: error.message });
```

### Health Checks

```javascript
// Add health check endpoint
server.setRequestHandler('health_check', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
});
```

---

## 🔄 Future Update Options

See `docs/FUTURE-UPDATES.md` for:

### Planned Features

1. **New Tools:**
   - `file_system_access` - Safe file system operations
   - `process_monitor` - Monitor running processes
   - `network_status` - Check network connectivity
   - `database_query` - Safe database queries

2. **Authentication Improvements:**
   - OAuth2 PKCE flow
   - JWT token validation
   - Certificate-based authentication
   - IP whitelisting

3. **Performance Optimizations:**
   - Request batching
   - Response compression
   - Caching layer
   - Connection pooling

4. **Security Enhancements:**
   - Rate limiting per IP
   - Tool allow/deny lists
   - Input sanitization
   - Audit logging

5. **Monitoring:**
   - Prometheus metrics endpoint
   - Grafana dashboard
   - Alerting rules
   - Sentry integration

6. **Compatibility:**
   - Python MCP server implementation
   - Go MCP server implementation
   - Rust MCP server implementation
   - Multi-language support

### Update Procedure

```bash
# 1. Pull latest changes
git pull origin main

# 2. Update dependencies
npm update

# 3. Test in staging
npm test

# 4. Deploy to production
# Choose your deployment method (PM2, Docker, Systemd, etc.)

# 5. Monitor logs
pm2 logs mcp-connector

# 6. Verify functionality
curl http://localhost:3000/health
```

### Backward Compatibility

- New tools are opt-in
- Existing tools maintain same interface
- Deprecation warnings for old features
- Versioned API endpoints

---

## 🧪 Testing Guide

### Unit Tests

```javascript
// test/tools.test.js
const assert = require('assert');
const { tools } = require('../server/index.js');

describe('Tools', () => {
  describe('health_check', () => {
    it('should return server status', async () => {
      const result = await tools.health_check.handler({});
      assert.strictEqual(result.content[0].type, 'text');
      const data = JSON.parse(result.content[0].text);
      assert.strictEqual(data.status, 'ok');
    });
  });
  
  describe('system_info', () => {
    it('should return system information', async () => {
      const result = await tools.system_info.handler({});
      assert.strictEqual(result.content[0].type, 'text');
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.os);
      assert.ok(data.cpuCount);
    });
  });
});
```

### Integration Tests

```javascript
// test/integration.test.js
const axios = require('axios');

describe('MCP Server Integration', () => {
  const serverUrl = 'http://localhost:3000/mcp';
  
  it('should respond to health check', async () => {
    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'health_check'
      }
    });
    
    assert.strictEqual(response.data.result.content[0].type, 'text');
  });
});
```

### Load Testing

```bash
# Using artillery
npm install -g artillery

cat > load-test.yml <<EOF
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
    - post:
        url: "/mcp"
        json:
          jsonrpc: "2.0"
          id: 1
          method: "tools/call"
          params:
            name: "health_check"
EOF

artillery run load-test.yml
```

---

## 📚 References

### MCP Protocol Specification
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

### Agent Plugins 1.0
- [Agent Plugins Specification](https://agent-plugins.org)
- [Plugin Schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [MCP Schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)

### Vibe Documentation
- [Vibe CLI Documentation](https://github.com/mistralai/vibe)
- [Vibe Plugins Guide](https://docs.vibe.ai/plugins)
- [Vibe Connector System](https://docs.vibe.ai/connectors)

### Best Practices
- [MCP Best Practices](https://github.com/modelcontextprotocol/specification/blob/main/best_practices.md)
- [Security Best Practices](https://cheatsheetseries.owasp.org/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#1-project-structure-practices)

---

## 🆘 Troubleshooting Guide

### Common Issues

#### Issue: Server Not Starting
**Symptoms:** `npm start` fails with error

**Solutions:**
1. Check Node.js version: `node --version` (must be 18+)
2. Install dependencies: `npm install`
3. Check port availability: `netstat -ano | findstr :3000`
4. Verify .env file exists
5. Check error logs

#### Issue: Tools Not Found
**Symptoms:** Mistral AI reports "Tool not found"

**Solutions:**
1. Verify tool name in connectors.json
2. Check server is running
3. Verify tool is registered in server/index.js
4. Check for typos
5. Reload Vibe plugin: `vibe /reload`

#### Issue: Authentication Failing
**Symptoms:** "Unauthorized" errors

**Solutions:**
1. Verify authentication type in connectors.json
2. Check token/API key in .env
3. Test token manually with curl
4. Verify server middleware is working
5. Check headers are being sent

#### Issue: High Latency
**Symptoms:** Slow tool responses

**Solutions:**
1. Add caching for expensive operations
2. Optimize tool implementations
3. Check server resources (CPU, RAM)
4. Enable compression
5. Review network connectivity

---

## 📝 Version Control

### Git Workflow

```bash
# Clone repository
git clone https://github.com/sourovdeb/my-mcp-connector.git
cd my-mcp-connector

# Create feature branch
git checkout -b feature/new-tool

# Make changes
# ...

# Commit changes
git add .
git commit -m "feat: add new custom tool"

# Push to remote
git push origin feature/new-tool

# Create pull request
```

### Semantic Versioning

| Version | Changes |
|---------|---------|
| **MAJOR** | Breaking changes |
| **MINOR** | New features, backward compatible |
| **PATCH** | Bug fixes, minor updates |

**Examples:**
- `1.0.0` → `1.0.1` (patch: bug fix)
- `1.0.0` → `1.1.0` (minor: new tool)
- `1.0.0` → `2.0.0` (major: breaking change)

---

## 🤝 Contributing

### Code Style

- Use ESLint with standard config
- Follow Node.js best practices
- Write JSDoc comments
- Use async/await for I/O
- Validate all inputs

### Code Review Checklist

- [ ] Code follows project standards
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance is acceptable
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate

### Pull Request Template

```markdown
## Description

What does this PR do?

## Related Issues

- Fixes #123
- Related to #456

## Changes Made

- Added new tool: custom_tool
- Updated authentication middleware
- Improved error handling

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance tested

## Checklist

- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Tests added
- [ ] No breaking changes
```

---

## 📞 Contact & Support

**Author:** Sourov  
**Email:** sourov@example.com  
**GitHub:** [@sourovdeb](https://github.com/sourovdeb)  
**Website:** [https://sourovdeb.com](https://sourovdeb.com)

### Support Channels

1. **GitHub Issues**: [https://github.com/sourovdeb/my-mcp-connector/issues](https://github.com/sourovdeb/my-mcp-connector/issues)
2. **GitHub Discussions**: [https://github.com/sourovdeb/my-mcp-connector/discussions](https://github.com/sourovdeb/my-mcp-connector/discussions)
3. **Email**: sourov@example.com

---

## 📄 License

MIT License

Copyright (c) 2026 Sourov

Permission is hereby granted... [full license text]

---

**Last Updated:** 2026-10-23  
**Document Version:** 1.0.0  
**Next Review:** 2026-11-23
