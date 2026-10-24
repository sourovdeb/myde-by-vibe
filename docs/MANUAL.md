# My MCP Connector - User Manual

## 📖 Welcome

This manual will guide you through installing, configuring, and using the My MCP Connector plugin with Mistral AI.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install the Plugin

**Option A: Copy to Vibe Plugins (Recommended)**

```powershell
# Open PowerShell as Administrator
cd C:\Users\souro\.vibe\plugins

# Create directory
mkdir my-mcp-connector

# Copy files from D:\my-mcp-connector\.vibe\plugins\my-mcp-connector
Copy-Item -Path "D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\*" -Destination ".\my-mcp-connector" -Recurse
```

**Option B: Clone Repository**

```bash
cd ~/.vibe/plugins
git clone https://github.com/sourovdeb/my-mcp-connector.git my-mcp-connector
```

### Step 2: Reload Vibe

```bash
vibe /reload
```

**Expected Output:**
```
Plugin 'my-mcp-connector' loaded successfully
Connectors: my-mcp-connector
```

### Step 3: Start Your MCP Server

```bash
cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
npm install
npm start
```

**Expected Output:**
```
Server running on stdio
Listening for MCP requests...
```

### Step 4: Add Connector in Mistral AI

1. Go to: [https://chat.mistral.ai/connections/marketplace](https://chat.mistral.ai/connections/marketplace)
2. Click **"Add custom connector"**
3. Fill in the form:
   - **Connector name**: `My Custom MCP Connector`
   - **Server**: `http://localhost:3000/mcp` (or your server URL)
   - **Description**: `Custom MCP server for Sourov's workflows`
4. Click **"Auto-detect"** for authentication
5. Click **"Save"**

### Step 5: Test the Connection

In Mistral AI chat:
```
Use the connector to check system status
```

Or test via command line:
```bash
# Test health check
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "health_check"
  }
}'
```

---

## 📋 Detailed Installation Guide

### Prerequisites

✅ **Required:**
- Vibe CLI installed
- Node.js 18 or higher
- npm (comes with Node.js)
- Mistral AI account
- Windows PC (for local testing)

❌ **Not Required:**
- Docker (optional)
- PM2 (optional, for production)
- Git (optional, for cloning)

### Installation Methods

#### Method 1: Manual Copy (Recommended for Beginners)

1. **Download the package** from D:\my-mcp-connector\
2. **Copy to Vibe plugins:**
   ```powershell
   # As Administrator
   Copy-Item -Path "D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\*" \
             -Destination "C:\Users\souro\.vibe\plugins\my-mcp-connector" \
             -Recurse -Force
   ```
3. **Verify files:**
   ```bash
   ls C:\Users\souro\.vibe\plugins\my-mcp-connector
   # Should show: plugin.json, connectors.json
   ```

#### Method 2: Git Clone

```bash
cd ~/.vibe/plugins
# Clone the repository (replace with your actual repo URL)
git clone https://github.com/sourovdeb/my-mcp-connector.git my-mcp-connector
cd my-mcp-connector
```

#### Method 3: ZIP Download

1. Zip the D:\my-mcp-connector folder
2. Extract to C:\Users\souro\.vibe\plugins\
3. Rename folder to `my-mcp-connector`

---

## 🔧 Configuration Guide

### Environment Setup

#### 1. Create .env File

```bash
cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
copy .env.example .env
```

Edit `.env`:
```env
PORT=3000
MCP_SERVER_NAME="My MCP Connector"
LOG_LEVEL=info
NODE_ENV=development
# Add other environment variables here
```

#### 2. Common Configuration Options

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | 3000 | 8080 |
| `HOST` | Server host | localhost | 0.0.0.0 |
| `LOG_LEVEL` | Logging level | info | debug, warn, error |
| `MCP_SERVER_NAME` | Server name | My MCP Connector | Custom Name |
| `MAX_CONNECTIONS` | Max concurrent connections | 100 | 500 |

### Connector Configuration

Edit `connectors.json`:

```json
{
  "schemaVersion": 1,
  "connectors": [
    {
      "id": "my-mcp-connector",
      "name": "My Custom MCP Connector",
      "description": "Custom MCP server for Sourov's workflows",
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

**Authentication Types:**
- `none` - No authentication
- `bearer` - Bearer token in Authorization header
- `api_key` - Custom header with API key
- `oauth2` - OAuth 2.0 flow

---

## 🛠️ Using the Connector

### Available Tools

| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| **health_check** | Check if server is alive | `{"action": "health_check"}` |
| **system_info** | Get system resources | `{"action": "system_info"}` |
| **one_stop_shop_status** | Check pipeline folders | `{"action": "one_stop_shop_status"}` |
| **credential_env_present** | List environment variables | `{"action": "credential_env_present"}` |
| **vibe_skill_list** | List installed skills | `{"action": "vibe_skill_list"}` |

### Example 1: Health Check

**In Mistral AI:**
```
Use the health_check tool to verify the connector is working
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-10-23T19:48:00Z"
}
```

### Example 2: System Information

**Command Line:**
```bash
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "system_info"
  }
}'
```

**Expected Response:**
```json
{
  "os": "Windows_NT",
  "node": "v18.17.1",
  "cpu_count": 8,
  "memory": "16GB",
  "uptime": 3600
}
```

### Example 3: ONE-STOP-SHOP Status

**In Mistral AI:**
```
Check the status of my ONE-STOP-SHOP pipelines
```

**Expected Response:**
```json
{
  "exists": true,
  "dirs": {
    "00-drop-recording": 12,
    "01-edit": 8,
    "02-ready-to-post": 5,
    "03-uploaded": 3
  }
}
```

### Example 4: List Skills

**Command Line:**
```bash
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "vibe_skill_list"
  }
}'
```

**Expected Response:**
```json
{
  "count": 140,
  "skills": [
    "01-cv-writing-pdf-export",
    "02-job-opportunity-collection",
    "03-sector-targeted-email-writing",
    "wp-content-health",
    "wp-link-checker"
  ]
}
```

---

## 🐛 Troubleshooting

### Issue 1: Plugin Not Loading

**Symptoms:**
- `/reload` command doesn't show the plugin
- Connector not appearing in Mistral AI

**Solutions:**

1. **Check plugin.json:**
   ```bash
   cat C:\Users\souro\.vibe\plugins\my-mcp-connector\plugin.json
   ```
   - Verify `$schema` URL is correct
   - Verify `name` matches directory name

2. **Check file permissions:**
   ```powershell
   icacls C:\Users\souro\.vibe\plugins\my-mcp-connector
   ```
   - Ensure your user has read access

3. **Run Vibe in verbose mode:**
   ```bash
   VIBE_LOG_LEVEL=debug vibe /reload
   ```

4. **Check Vibe logs:**
   ```bash
   cat ~/.vibe/logs/vibe.log | grep "my-mcp-connector"
   ```

### Issue 2: MCP Server Not Starting

**Symptoms:**
- `npm start` fails
- No "Server running" message

**Solutions:**

1. **Check Node.js installation:**
   ```bash
   node --version
   npm --version
   ```
   - Should show Node.js 18+ and npm 8+

2. **Install dependencies:**
   ```bash
   cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check port availability:**
   ```powershell
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

4. **Check .env file:**
   ```bash
   cat .env
   ```
   - Ensure PORT is set correctly

### Issue 3: Connector Not Appearing in Mistral AI

**Symptoms:**
- Connector not in marketplace
- "Add custom connector" button doesn't show your connector

**Solutions:**

1. **Verify server URL:**
   - Make sure the server is running: `http://localhost:3000/mcp`
   - Test with curl: `curl http://localhost:3000/mcp`

2. **Check Mistral AI connection:**
   - Go to: https://chat.mistral.ai/connections
   - Click "Add custom connector"
   - Verify the form fields are correct

3. **Clear browser cache:**
   - Sometimes Mistral AI caches connector list
   - Refresh the page or clear cache

### Issue 4: Tools Not Working

**Symptoms:**
- Tools return errors
- Tools not listed in Mistral AI

**Solutions:**

1. **Check tool names:**
   ```bash
   cat connectors.json | grep tools
   ```
   - Verify tool names match what your server exposes

2. **Check MCP server implementation:**
   ```bash
   cat server/index.js | grep "server.setRequestHandler"
   ```
   - Ensure all tools are registered

3. **Test with curl:**
   ```bash
   curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/list"
   }'
   ```

### Issue 5: Authentication Problems

**Symptoms:**
- "Unauthorized" errors
- Authentication prompts failing

**Solutions:**

1. **Check authentication type:**
   ```bash
   cat connectors.json | grep authentication
   ```

2. **For Bearer Token:**
   - Ensure token is set in connectors.json
   - Test token manually: `curl -H "Authorization: Bearer your-token" http://localhost:3000/mcp`

3. **For API Key:**
   - Update headers in your MCP server

---

## 📊 Monitoring & Maintenance

### Checking Plugin Status

```bash
# List all plugins
vibe /plugins list

# Check specific plugin
vibe /plugins status my-mcp-connector
```

### Viewing Logs

```bash
# Vibe logs
cat ~/.vibe/logs/vibe.log | grep my-mcp-connector

# MCP server logs
cat D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server\logs\server.log
```

### Updating the Plugin

```bash
cd ~/.vibe/plugins/my-mcp-connector
# Pull latest changes
git pull origin main

# Or copy from D: drive
Copy-Item -Path "D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\*" \
          -Destination ".\" \
          -Recurse -Force

# Reload
vibe /reload
```

### Backup

```powershell
# Backup plugin
Compress-Archive -Path "C:\Users\souro\.vibe\plugins\my-mcp-connector" \
                 -DestinationPath "D:\backups\my-mcp-connector-$(Get-Date -Format 'yyyyMMdd').zip"

# Backup server
Compress-Archive -Path "D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server" \
                 -DestinationPath "D:\backups\mcp-server-$(Get-Date -Format 'yyyyMMdd').zip"
```

---

## 🎓 Advanced Usage

### Using with sourov-workflows

The connector is designed to work with the `sourov-workflows` project:

```bash
# Start both services
cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
npm start

cd C:\Users\souro\sourov-workflows
make start-worker
```

### Creating Custom Tools

To add a new tool:

1. **Edit server/index.js:**
   ```javascript
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     const { params } = request;
     
     switch (params.name) {
       case 'health_check':
         return { content: [{ type: 'text', text: JSON.stringify({ status: 'ok' }) }] };
       
       case 'custom_tool':
         return { content: [{ type: 'text', text: JSON.stringify({ result: 'custom data' }) }] };
       
       default:
         throw new Error(`Unknown tool: ${params.name}`);
     }
   });
   ```

2. **Update connectors.json:**
   ```json
   "tools": [
     "health_check",
     "system_info",
     "custom_tool"
   ]
   ```

3. **Reload:**
   ```bash
   vibe /reload
   ```

### Docker Deployment

```bash
# Build image
docker build -t my-mcp-connector D:\my-mcp-connector\.vibe\plugins\my-mcp-connector

# Run container
docker run -d -p 3000:3000 --name mcp-connector my-mcp-connector

# View logs
docker logs mcp-connector

# Stop container
docker stop mcp-connector
```

---

## 🆘 Getting Help

### Documentation
- **README.md** - Complete project documentation
- **GUIDE.md** - Technical implementation guide
- **FUTURE-UPDATES.md** - Roadmap and updates

### Support Channels

1. **GitHub Issues**: Create an issue at [https://github.com/sourovdeb/my-mcp-connector/issues](https://github.com/sourovdeb/my-mcp-connector/issues)
2. **Discussions**: Join discussions at [https://github.com/sourovdeb/my-mcp-connector/discussions](https://github.com/sourovdeb/my-mcp-connector/discussions)
3. **Email**: sourov@example.com

### Community

- Check the wiki for FAQs
- Review the troubleshooting section
- Search GitHub issues for similar problems

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-10-23 | Initial release with 5 tools |
| 1.0.1 | TBD | Bug fixes, documentation updates |
| 1.1.0 | TBD | New tools, authentication improvements |
| 2.0.0 | TBD | Major refactoring, performance optimizations |

---

## 📞 Contact

**Author**: Sourov  
**Email**: sourov@example.com  
**GitHub**: [@sourovdeb](https://github.com/sourovdeb)  
**Website**: [https://sourovdeb.com](https://sourovdeb.com)

---

**Last Updated**: 2026-10-23  
**Next Review**: 2026-11-23  
**Document Version**: 1.0.0
