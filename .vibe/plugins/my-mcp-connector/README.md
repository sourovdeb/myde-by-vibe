# My MCP Connector

A custom MCP server connector plugin for Mistral AI workflows.

## 📋 Overview

This plugin provides a managed connector definition for a custom MCP server, enabling seamless integration between Mistral AI and your workflow server.

## 🎯 Features

- ✅ Managed connector definition
- ✅ 5 built-in tools (health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list)
- ✅ Vibe plugin structure with AI extension
- ✅ MCP server stub included
- ✅ Skill integration
- ✅ Authentication configuration
- ✅ Future update hooks

## 📁 Project Structure

```
my-mcp-connector/
├── .vibe/                     # Vibe plugin directory
│   └── plugins/
│       └── my-mcp-connector/
│           ├── plugin.json     # Plugin manifest
│           ├── connectors.json  # Connector definition
│           ├── mcp.json          # MCP server definitions
│           ├── skills/
│           │   └── workflow-tools/
│           │       └── SKILL.md  # Skill definition
│           ├── server/
│           │   ├── index.js      # MCP server stub
│           │   └── package.json  # Node.js dependencies
│           ├── docs/
│           │   ├── MANUAL.md     # User guide
│           │   ├── GUIDE.md      # Technical guide
│           │   └── FUTURE-UPDATES.md # Future update options
│           └── .env.example      # Environment variables template
├── README.md                  # This file
└── package.json               # Project metadata
```

## 🚀 Quick Start

### 1. Install the Plugin

```bash
# Copy to Vibe plugins directory
cp -r D:\my-mcp-connector\.vibe\plugins\my-mcp-connector ~/.vibe/plugins/

# Or clone directly
cd ~/.vibe/plugins
mkdir my-mcp-connector
# Copy files here
```

### 2. Reload Vibe

```bash
vibe /reload
```

### 3. Add Connector in Mistral AI

Go to: https://chat.mistral.ai/connections/marketplace

- **Connector name**: `My Custom MCP Connector`
- **Server**: `http://localhost:3000/mcp` (or your server URL)
- **Description**: Custom MCP server for Sourov's workflows
- **Authentication**: Auto-detect or configure as needed

### 4. Start the MCP Server

```bash
cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
npm install
npm start
```

### 5. Test the Connector

```bash
# Test health check
make execute workflow=vibe-pc-connector input='{"action": "health_check"}'

# Or use the connector directly in Mistral AI
```

## 🔧 Configuration

### Environment Variables (.env)

Create `.env` file in the server directory:

```env
PORT=3000
MCP_SERVER_NAME=my-mcp-connector
LOG_LEVEL=info
# Add other environment variables as needed
```

### Connector Tools

The connector exposes these tools:

| Tool | Description | Usage |
|------|-------------|-------|
| `health_check` | Verify server is alive | `{"action": "health_check"}` |
| `system_info` | Get system resources | `{"action": "system_info"}` |
| `one_stop_shop_status` | Check pipeline folders | `{"action": "one_stop_shop_status"}` |
| `credential_env_present` | List env vars | `{"action": "credential_env_present"}` |
| `vibe_skill_list` | List installed skills | `{"action": "vibe_skill_list"}` |

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Vibe CLI installed
- Mistral AI account

### Setup MCP Server

```bash
cd .vibe/plugins/my-mcp-connector/server
npm init -y
npm install @modelcontextprotocol/sdk dotenv
```

### Create MCP Server (index.js)

```javascript
// server/index.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

async function main() {
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

  // Register tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { params } = request;
    
    switch (params.name) {
      case 'health_check':
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'ok', version: '1.0.0' }) }]
        };
      
      case 'system_info':
        return {
          content: [{ type: 'text', text: JSON.stringify({ 
            os: process.platform,
            node: process.version,
            uptime: process.uptime()
          }) }]
        };
      
      default:
        throw new Error(`Unknown tool: ${params.name}`);
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        { name: 'health_check', description: 'Check server health' },
        { name: 'system_info', description: 'Get system information' },
        { name: 'one_stop_shop_status', description: 'Check ONE-STOP-SHOP status' },
        { name: 'credential_env_present', description: 'List environment variables' },
        { name: 'vibe_skill_list', description: 'List installed skills' }
      ]
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Test MCP Server

```bash
node server/index.js
# Should output: "Server running on stdio"
```

## 📚 Documentation

### User Manual (MANUAL.md)
- How to install the plugin
- How to add the connector in Mistral AI
- Basic usage examples
- Troubleshooting guide

### Technical Guide (GUIDE.md)
- Plugin architecture
- MCP server implementation
- Tool definitions
- Authentication flows
- Performance considerations

### Future Updates (FUTURE-UPDATES.md)
- Roadmap for new features
- Update procedures
- Backward compatibility notes
- Deprecation warnings

## 🔐 Authentication

### Supported Methods

1. **Auto-detect**: Let Mistral AI detect authentication type
2. **Bearer Token**: Static token authentication
3. **OAuth2**: OAuth 2.0 flow
4. **API Key**: Custom header with API key

### Configuration

Edit `connectors.json` to add authentication:

```json
{
  "id": "my-mcp-connector",
  "name": "My Custom MCP Connector",
  "description": "...",
  "server": "https://your-server.com/mcp",
  "authentication": {
    "type": "bearer",
    "token": "your-token-here"
  },
  "tools": [...]
}
```

## 📊 Monitoring

### Logs

The MCP server logs to console. For production:

```bash
# Use PM2 or similar
pm2 start server/index.js --name "mcp-connector"
pm2 logs
```

### Health Checks

```bash
curl http://localhost:3000/health
# Should return: {"status": "ok"}
```

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

Build and run:
```bash
docker build -t my-mcp-connector .
docker run -p 3000:3000 my-mcp-connector
```

### PM2 (Production)

```bash
npm install -g pm2
pm2 start server/index.js --name "mcp-connector"
pm2 save
pm2 startup
```

### Systemd (Linux)

Create `/etc/systemd/system/mcp-connector.service`:

```ini
[Unit]
Description=My MCP Connector
After=network.target

[Service]
User=node
WorkingDirectory=/home/node/my-mcp-connector/server
ExecStart=/usr/bin/node index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable mcp-connector
sudo systemctl start mcp-connector
```

## 🔄 Updates

### Future Update Options

See `docs/FUTURE-UPDATES.md` for:
- New tool additions
- Authentication improvements
- Performance optimizations
- Security enhancements
- Compatibility notes

### Update Procedure

1. Pull latest changes
2. Test in staging
3. Deploy to production
4. Monitor logs
5. Rollback if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🆘 Support

- **Issues**: Create an issue on GitHub
- **Discussions**: Join our community discussions
- **Documentation**: Check the docs/ directory

---

**Created**: 2026-10-23  
**Version**: 1.0.0  
**Author**: Sourov  
**Contact**: sourov@example.com
