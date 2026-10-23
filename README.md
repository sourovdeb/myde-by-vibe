# My MCP Connector

A custom MCP server connector plugin for Mistral AI workflows.

## 📋 Overview

This plugin provides a managed connector definition for a custom MCP server, enabling seamless integration between Mistral AI and your workflow server.

## 🎯 Features

- ✅ Managed connector definition
- ✅ 5 built-in tools (health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list)
- ✅ Vibe plugin structure with AI extension
- ✅ HTTP MCP server (port 3000) - **NEW!**
- ✅ Stdio MCP server (alternative transport)
- ✅ Skill integration
- ✅ Authentication configuration
- ✅ Future update hooks

## 📁 Project Structure

```
my-mcp-connector/
├── .vibe/                     # Vibe plugin directory
│   └── plugins/
│       └── my-mcp-connector/
│           ├── plugin.json     # Agent Plugins 1.0 manifest
│           ├── mcp.json        # MCP server definitions
│           ├── connectors.json # Connector requirements
│           ├── package.json    # Plugin metadata
│           ├── README.md       # Plugin documentation
│           ├── server/         # MCP Server implementation
│           │   ├── http-server.js  # HTTP MCP server (main)
│           │   ├── index.js        # Stdio MCP server (alternative)
│           │   ├── package.json    # Server dependencies
│           │   └── .env.example    # Environment template
│           ├── skills/         # Vibe skills
│           │   └── workflow-tools/
│           │       └── SKILL.md
│           └── docs/           # Documentation
│               ├── MANUAL.md
│               ├── GUIDE.md
│               └── FUTURE-UPDATES.md
├── .agents/                    # Agent configuration
│   └── my-mcp-connector-agent.toml
├── docs/                       # Root documentation
│   ├── MANUAL.md
│   ├── GUIDE.md
│   └── FUTURE-UPDATES.md
├── README.md                   # This file
├── COMPLETION-SUMMARY.md       # Project summary
└── .gitignore
```

## 🚀 Quick Start

### 1. Install the Plugin

```bash
# Copy to Vibe plugins directory
cp -r D:\my-mcp-connector\.vibe\plugins\my-mcp-connector ~/.vibe/plugins/
```

### 2. Install Dependencies

```bash
cd ~/.vibe/plugins/my-mcp-connector/server
npm install
```

### 3. Start the HTTP Server

```bash
npm start
# or
node server/http-server.js
```

Server will run at: `http://localhost:3000/mcp`

### 4. Test the Server

```bash
# Health check
curl http://localhost:3000/health

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 5. Add Connector in Mistral AI

Go to: https://chat.mistral.ai/connections/marketplace

- **Connector name**: `My Custom MCP Connector`
- **Server**: `http://localhost:3000/mcp`
- **Description**: Custom MCP server for Sourov's workflows
- **Authentication**: None (or Auto-detect)

## 🔧 Available Tools

| Tool | Description | Usage |
|------|-------------|-------|
| `health_check` | Verify server is alive | `{"name": "health_check"}` |
| `system_info` | Get system resources | `{"name": "system_info"}` |
| `one_stop_shop_status` | Check pipeline folders | `{"name": "one_stop_shop_status"}` |
| `credential_env_present` | List env vars | `{"name": "credential_env_present"}` |
| `vibe_skill_list` | List installed skills | `{"name": "vibe_skill_list"}` |

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Vibe CLI installed
- Mistral AI account

### Environment Variables

Create `.env` file in the server directory:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

## 📊 Monitoring

### Health Checks

```bash
curl http://localhost:3000/health
# Should return: {"status": "ok", "service": "my-mcp-connector", ...}
```

### Logs

```bash
# Server logs to console
# For production, use PM2:
npm install -g pm2
pm2 start server/http-server.js --name "mcp-connector"
pm2 logs mcp-connector
```

## 🚀 Deployment

### PM2 (Production)

```bash
npm install -g pm2
pm2 start server/http-server.js --name "mcp-connector"
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
EXPOSE 3000
CMD ["node", "server/http-server.js"]
```

## 📚 Documentation

- **MANUAL.md** - User guide with step-by-step instructions
- **GUIDE.md** - Technical implementation guide
- **FUTURE-UPDATES.md** - Roadmap for new features

## 🔐 Security

- ✅ Read-only operations - No RCE vulnerabilities
- ✅ No shell access - Safe execution
- ✅ Input validation - All parameters validated
- ✅ CORS enabled - Browser compatible
- ✅ Authentication support - 4 types available

## 📄 License

MIT License

## 🆘 Support

- **GitHub**: https://github.com/sourovdeb/myde-by-vibe
- **Issues**: Create an issue on GitHub

---

**Version**: 1.0.0  
**Author**: Sourov  
**Created**: 2026-10-23  
**Updated**: 2026-10-23 (HTTP server added)
