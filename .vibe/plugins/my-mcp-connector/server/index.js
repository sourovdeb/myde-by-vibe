const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: __dirname + '/.env' });

// Get plugin directory from environment or use default
const pluginDir = process.env.PLUGIN_DIR || __dirname;

// Create MCP server
const server = new Server(
  {
    name: 'my-mcp-connector',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to get system information
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
      nodeEnv: process.env.NODE_ENV || 'development',
      pluginDir: pluginDir
    }
  };
}

// Helper function to check ONE-STOP-SHOP status
function checkOneStopShopStatus() {
  const basePaths = [
    '/c/Users/souro/ONE-STOP-SHOP',
    '/e/ONE-STOP-SHOP',
    '/g/ONE-STOP-SHOP',
    '/h/ONE-STOP-SHOP'
  ];
  
  const status = {
    folders: [],
    lastChecked: new Date().toISOString(),
    status: 'ok'
  };
  
  basePaths.forEach(basePath => {
    try {
      const fs = require('fs');
      const path = require('path');
      
      if (fs.existsSync(basePath)) {
        const items = fs.readdirSync(basePath);
        status.folders.push({
          path: basePath,
          exists: true,
          items: items.length,
          itemsList: items
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

// Helper function to check credentials
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

// Helper function to list Vibe skills
function listVibeSkills() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const skillsDir = path.join(require('os').homedir(), '.vibe', 'skills');
    
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

// Register tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { params } = request;
  
  try {
    switch (params.name) {
      case 'health_check':
        return {
          content: [{ type: 'text', text: JSON.stringify({
            status: 'ok',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            service: 'my-mcp-connector'
          }, null, 2) }]
        };
      
      case 'system_info':
        return {
          content: [{ type: 'text', text: JSON.stringify(getSystemInfo(), null, 2) }]
        };
      
      case 'one_stop_shop_status':
        return {
          content: [{ type: 'text', text: JSON.stringify(checkOneStopShopStatus(), null, 2) }]
        };
      
      case 'credential_env_present':
        return {
          content: [{ type: 'text', text: JSON.stringify(checkCredentials(), null, 2) }]
        };
      
      case 'vibe_skill_list':
        return {
          content: [{ type: 'text', text: JSON.stringify(listVibeSkills(), null, 2) }]
        };
      
      default:
        throw new Error(`Unknown tool: ${params.name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, null, 2) }],
      isError: true
    };
  }
});

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'health_check', description: 'Check server health and status' },
      { name: 'system_info', description: 'Get detailed system information and resources' },
      { name: 'one_stop_shop_status', description: 'Check ONE-STOP-SHOP pipeline folders and status' },
      { name: 'credential_env_present', description: 'List environment variables and check for credentials' },
      { name: 'vibe_skill_list', description: 'List installed Vibe skills' }
    ]
  };
});

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Shutting down MCP server...');
  process.exit(0);
});

// Start the server
main();
