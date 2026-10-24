const http = require('http');
const url = require('url');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: __dirname + '/.env' });

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Helper functions for tools
function getSystemInfo() {
  return {
    os: process.platform,
    node: process.version,
    uptime: process.uptime(),
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
      external: process.memoryUsage().external
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  };
}

function checkOneStopShopStatus() {
  const basePaths = [
    'C:\\Users\\souro\\ONE-STOP-SHOP',
    'E:\\ONE-STOP-SHOP',
    'G:\\ONE-STOP-SHOP',
    'H:\\ONE-STOP-SHOP'
  ];
  
  const status = {
    folders: [],
    lastChecked: new Date().toISOString(),
    status: 'ok'
  };
  
  basePaths.forEach(basePath => {
    try {
      const fs = require('fs');
      
      if (fs.existsSync(basePath)) {
        const items = fs.readdirSync(basePath);
        status.folders.push({
          path: basePath,
          exists: true,
          items: items.length,
          itemsList: items.slice(0, 10) // Limit to first 10 items
        });
      } else {
        status.folders.push({
          path: basePath,
          exists: false,
          items: 0
        });
        status.status = 'warning';
      }
    } catch (error) {
      status.folders.push({
        path: basePath,
        exists: false,
        error: error.message,
        items: 0
      });
      status.status = 'error';
    }
  });
  
  return status;
}

function checkCredentials() {
  const credentialVars = [
    'WP_APP_PASSWORD',
    'AGNES_API_KEY',
    'TYPESAFE_BASE_URL',
    'DEVTO_API_KEY',
    'GOOGLE_API_KEY',
    'MISTRAL_API_KEY'
  ];
  
  const found = [];
  const missing = [];
  
  credentialVars.forEach(varName => {
    if (process.env[varName]) {
      found.push(varName);
    } else {
      missing.push(varName);
    }
  });
  
  return {
    variables: credentialVars,
    found: found,
    missing: missing,
    count: {
      total: credentialVars.length,
      found: found.length,
      missing: missing.length
    }
  };
}

function listVibeSkills() {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const skillsDir = path.join(os.homedir(), '.vibe', 'skills');
    
    if (!fs.existsSync(skillsDir)) {
      return {
        skills: [],
        total: 0,
        message: 'Skills directory not found'
      };
    }
    
    const skills = fs.readdirSync(skillsDir)
      .filter(dir => fs.existsSync(path.join(skillsDir, dir, 'SKILL.md')))
      .map(dir => ({
        name: dir,
        path: path.join(skillsDir, dir, 'SKILL.md')
      }));
    
    return {
      skills: skills,
      total: skills.length
    };
  } catch (error) {
    return {
      skills: [],
      total: 0,
      error: error.message
    };
  }
}

// Tool definitions
const TOOLS = [
  {
    name: 'health_check',
    description: 'Check server health and status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'system_info',
    description: 'Get detailed system information and resources',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'one_stop_shop_status',
    description: 'Check ONE-STOP-SHOP pipeline folders and status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'credential_env_present',
    description: 'List environment variables and check for credentials',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'vibe_skill_list',
    description: 'List installed Vibe skills',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Execute a tool
function executeTool(name, args) {
  switch (name) {
    case 'health_check':
      return {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        service: 'my-mcp-connector',
        transport: 'http'
      };
    
    case 'system_info':
      return getSystemInfo();
    
    case 'one_stop_shop_status':
      return checkOneStopShopStatus();
    
    case 'credential_env_present':
      return checkCredentials();
    
    case 'vibe_skill_list':
      return listVibeSkills();
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Handle JSON-RPC requests
function handleJsonRpc(request) {
  const { jsonrpc, id, method, params } = request;
  
  // Validate JSON-RPC version
  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc must be "2.0"'
      }
    };
  }
  
  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'my-mcp-connector',
              version: '1.0.0'
            }
          }
        };
      
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: TOOLS
          }
        };
      
      case 'tools/call': {
        const { name, arguments: args } = params || {};
        
        if (!name) {
          return {
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32602,
              message: 'Invalid params: name is required'
            }
          };
        }
        
        const result = executeTool(name, args || {});
        
        return {
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };
      }
      
      case 'ping':
        return {
          jsonrpc: '2.0',
          id: id,
          result: {}
        };
      
      default:
        return {
          jsonrpc: '2.0',
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: -32603,
        message: error.message,
        data: {
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }
    };
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Health check endpoint
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'my-mcp-connector',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // MCP endpoint
  if (pathname === '/mcp' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        const response = handleJsonRpc(request);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error.message
          }
        }));
      }
    });
    
    return;
  }
  
  // Root endpoint - info
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'my-mcp-connector',
      version: '1.0.0',
      description: 'Custom MCP server for Sourov\'s workflows',
      endpoints: {
        mcp: '/mcp (POST)',
        health: '/health (GET)'
      },
      tools: TOOLS.map(t => t.name)
    }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not Found',
    message: `Route ${pathname} not found`
  }));
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 My MCP Connector HTTP Server running at http://${HOST}:${PORT}`);
  console.log(`📡 MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`💚 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🔧 Available tools: ${TOOLS.map(t => t.name).join(', ')}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP HTTP server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP HTTP server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});
