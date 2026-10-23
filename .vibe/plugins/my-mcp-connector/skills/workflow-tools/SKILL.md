---
name: workflow-tools
namespace: myMcpConnector
version: 1.0.0
description: Tools for interacting with the My MCP Connector server
user-invocable: false
allowed-tools:
  - read_file
  - write_file
  - bash
  - local_software
skills: []
references: []
---

# My MCP Connector - Workflow Tools

## 📋 Overview

This skill provides tools for interacting with the My MCP Connector server. These tools allow you to call the MCP server's tools directly from your workflows.

## 🎯 Features

- ✅ Call any MCP server tool
- ✅ Get tool definitions
- ✅ Error handling and validation
- ✅ Integration with sourov-workflows

## 🛠️ Tools Available

### 1. `call_mcp_tool`

**Description:** Call a tool on the My MCP Connector server

**Usage:**
```javascript
const result = await workflows.run(
  "myMcpConnector.call_mcp_tool",
  {
    toolName: "health_check",
    arguments: {}
  }
);
```

**Parameters:**
- `toolName` (string, required): Name of the tool to call (health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list)
- `arguments` (object, optional): Arguments to pass to the tool

**Returns:**
```json
{
  "success": true,
  "result": { ... tool result ... },
  "timestamp": "2026-10-23T19:48:00Z"
}
```

**Example:**
```javascript
const health = await workflows.run(
  "myMcpConnector.call_mcp_tool",
  {
    toolName: "health_check",
    arguments: {}
  }
);

if (health.success) {
  console.log("Server is healthy:", health.result);
}
```

### 2. `list_mcp_tools`

**Description:** List all available tools on the My MCP Connector server

**Usage:**
```javascript
const tools = await workflows.run(
  "myMcpConnector.list_mcp_tools",
  {}
);
```

**Returns:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "health_check",
      "description": "Check server health and version"
    },
    {
      "name": "system_info",
      "description": "Get system information (CPU, RAM, OS)"
    }
  ]
}
```

**Example:**
```javascript
const availableTools = await workflows.run(
  "myMcpConnector.list_mcp_tools",
  {}
);

console.log("Available tools:", availableTools.tools);
```

### 3. `check_mcp_server`

**Description:** Check if the My MCP Connector server is running and accessible

**Usage:**
```javascript
const status = await workflows.run(
  "myMcpConnector.check_mcp_server",
  {}
);
```

**Returns:**
```json
{
  "success": true,
  "server": "My MCP Connector",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2026-10-23T19:48:00Z"
}
```

**Example:**
```javascript
const serverStatus = await workflows.run(
  "myMcpConnector.check_mcp_server",
  {}
);

if (!serverStatus.success) {
  throw new Error("MCP server is not running");
}
```

## 🚀 Quick Start

### Prerequisites

- My MCP Connector plugin installed
- MCP server running
- Vibe CLI installed
- sourov-workflows project

### Setup

1. **Ensure the plugin is loaded:**
   ```bash
   vibe /reload
   ```

2. **Start the MCP server:**
   ```bash
   cd D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server
   npm install
   npm start
   ```

3. **Test the tools:**
   ```javascript
   // In your workflow
   const health = await workflows.run(
     "myMcpConnector.call_mcp_tool",
     {
       toolName: "health_check",
       arguments: {}
     }
   );
   ```

## 🔧 Configuration

### Environment Variables

The skill uses these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVER_URL` | URL of the MCP server | http://localhost:3000/mcp |
| `MCP_AUTH_TOKEN` | Bearer token for authentication | (none) |
| `MCP_TIMEOUT` | Timeout in milliseconds | 5000 |

### Setting Environment Variables

```bash
# In your shell
export MCP_SERVER_URL="http://localhost:3000/mcp"
export MCP_AUTH_TOKEN="your-token-here"
export MCP_TIMEOUT="10000"

# Or in your workflow .env file
MCP_SERVER_URL=http://localhost:3000/mcp
MCP_AUTH_TOKEN=your-token-here
MCP_TIMEOUT=10000
```

## 📊 Integration with sourov-workflows

### Example: Check System Status Before Running Workflow

```javascript
// In your workflow activity
@workflows.activity
async def my_workflow_activity() {
  // Check MCP server is running
  const serverStatus = await workflows.run(
    "myMcpConnector.check_mcp_server",
    {}
  );
  
  if (!serverStatus.success) {
    throw new Error("MCP server is not running");
  }
  
  // Get system resources
  const systemInfo = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    {
      toolName: "system_info",
      arguments: {}
    }
  );
  
  // Check available RAM
  const freeMemory = systemInfo.result.freeMemory;
  const minMemory = 2 * 1024 * 1024 * 1024; // 2GB
  
  if (freeMemory < minMemory) {
    throw new Error("Insufficient memory to run workflow");
  }
  
  // Continue with your workflow...
}
```

### Example: Monitor ONE-STOP-SHOP Status

```javascript
@workflows.activity
async def check_shop_status() {
  const shopStatus = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    {
      toolName: "one_stop_shop_status",
      arguments: {}
    }
  );
  
  console.log("Shop folders:", shopStatus.result.dirs);
  
  // Check for stale folders
  const staleThreshold = 3 * 24 * 60 * 60 * 1000; // 3 days
  const now = Date.now();
  
  for (const [folder, fileCount] of Object.entries(shopStatus.result.dirs)) {
    if (fileCount === 0) {
      console.warn(`Empty folder: ${folder}`);
    }
  }
}
```

### Example: List Available Skills

```javascript
@workflows.activity
async def list_skills() {
  const skills = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    {
      toolName: "vibe_skill_list",
      arguments: {}
    }
  );
  
  console.log(`Found ${skills.result.count} skills:`);
  skills.result.skills.forEach(skill => console.log(`- ${skill}`));
}
```

## 🐛 Troubleshooting

### Issue: Tools Not Found

**Symptoms:**
- Error: "Tool not found"
- Tools not appearing in workflows

**Solutions:**

1. **Verify plugin is loaded:**
   ```bash
   vibe /plugins list
   ```
   - Should show `my-mcp-connector`

2. **Check namespace:**
   - Tools are namespaced as `myMcpConnector:<tool-name>`
   - Use the full namespaced name in workflows

3. **Reload Vibe:**
   ```bash
   vibe /reload
   ```

### Issue: MCP Server Not Responding

**Symptoms:**
- Connection timeout errors
- "Server not responding" messages

**Solutions:**

1. **Check server is running:**
   ```bash
   curl http://localhost:3000/mcp
   ```
   - Should return valid JSON-RPC response

2. **Verify server URL:**
   ```bash
   echo $MCP_SERVER_URL
   ```
   - Update if using different host/port

3. **Check network connectivity:**
   ```bash
   ping localhost
   telnet localhost 3000
   ```

### Issue: Authentication Failed

**Symptoms:**
- "Unauthorized" errors
- "Invalid token" messages

**Solutions:**

1. **Check token:**
   ```bash
   echo $MCP_AUTH_TOKEN
   ```
   - Verify token is set correctly

2. **Update connectors.json:**
   ```json
   {
     "authentication": {
       "type": "bearer",
       "token": "your-token-here"
     }
   }
   ```

3. **Test token manually:**
   ```bash
   curl -H "Authorization: Bearer your-token" http://localhost:3000/mcp
   ```

### Issue: Tool Execution Failed

**Symptoms:**
- Tool returns error
- Unexpected results

**Solutions:**

1. **Check tool name:**
   - Verify tool name is correct
   - Check spelling and case

2. **Validate arguments:**
   - Ensure arguments match tool expectations
   - Check required vs optional parameters

3. **Check server logs:**
   ```bash
   cat D:\my-mcp-connector\.vibe\plugins\my-mcp-connector\server\logs\server.log
   ```

## 📈 Best Practices

### 1. Error Handling

Always wrap tool calls in try-catch:

```javascript
try {
  const result = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    {
      toolName: "health_check",
      arguments: {}
    }
  );
  
  if (!result.success) {
    throw new Error(result.error || "Tool execution failed");
  }
  
  return result.result;
} catch (error) {
  console.error("Tool failed:", error.message);
  throw error;
}
```

### 2. Timeout Handling

Set appropriate timeouts:

```javascript
// In your workflow configuration
workflows.setTimeout(10000); // 10 seconds
```

Or per-call:

```javascript
const result = await workflows.run(
  "myMcpConnector.call_mcp_tool",
  {
    toolName: "system_info",
    arguments: {},
    timeout: 15000 // 15 seconds
  }
);
```

### 3. Logging

Log tool calls for debugging:

```javascript
console.log(`Calling tool: ${toolName} with args:`, arguments);

const result = await workflows.run(
  "myMcpConnector.call_mcp_tool",
  { toolName, arguments }
);

console.log(`Tool result:`, result);
```

### 4. Caching

Cache frequent tool calls:

```javascript
let cachedResult = null;
let lastCached = 0;
const CACHE_TTL = 300000; // 5 minutes

async function getCachedToolResult(toolName, arguments = {}) {
  const now = Date.now();
  
  if (cachedResult && (now - lastCached) < CACHE_TTL) {
    return cachedResult;
  }
  
  const result = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName, arguments }
  );
  
  cachedResult = result;
  lastCached = now;
  
  return result;
}
```

### 5. Monitoring

Monitor tool performance:

```javascript
const startTime = Date.now();

const result = await workflows.run(
  "myMcpConnector.call_mcp_tool",
  { toolName: "system_info", arguments: {} }
);

const duration = Date.now() - startTime;
console.log(`Tool took ${duration}ms`);

if (duration > 5000) {
  console.warn("Tool is slow!");
}
```

## 🔐 Security Considerations

### 1. Token Security

- Never commit tokens to version control
- Use environment variables
- Rotate tokens regularly
- Use different tokens for different environments

### 2. Input Validation

Always validate tool inputs:

```javascript
function validateToolInput(toolName, arguments) {
  switch (toolName) {
    case "health_check":
      // No arguments needed
      return true;
    case "system_info":
      // No arguments needed
      return true;
    case "one_stop_shop_status":
      // No arguments needed
      return true;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

### 3. Rate Limiting

Implement rate limiting to prevent abuse:

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
}
```

## 🚀 Advanced Usage

### 1. Dynamic Tool Calling

Call tools dynamically based on workflow needs:

```javascript
async function callToolDynamically(toolName, arguments = {}) {
  const availableTools = await workflows.run(
    "myMcpConnector.list_mcp_tools",
    {}
  );
  
  const toolExists = availableTools.tools.some(t => t.name === toolName);
  
  if (!toolExists) {
    throw new Error(`Tool ${toolName} not found`);
  }
  
  return await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName, arguments }
  );
}
```

### 2. Tool Chaining

Chain multiple tool calls together:

```javascript
async function getSystemHealthReport() {
  const results = {};
  
  // Health check
  results.health = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName: "health_check", arguments: {} }
  );
  
  // System info
  results.system = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName: "system_info", arguments: {} }
  );
  
  // ONE-STOP-SHOP status
  results.shop = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName: "one_stop_shop_status", arguments: {} }
  );
  
  // Skills list
  results.skills = await workflows.run(
    "myMcpConnector.call_mcp_tool",
    { toolName: "vibe_skill_list", arguments: {} }
  );
  
  return results;
}
```

### 3. Error Recovery

Implement error recovery strategies:

```javascript
async function callWithRetry(toolName, arguments = {}, maxRetries = 3) {
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await workflows.run(
        "myMcpConnector.call_mcp_tool",
        { toolName, arguments }
      );
      
      if (result.success) {
        return result;
      }
      
      lastError = new Error(result.error || "Tool execution failed");
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error.message);
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  
  throw lastError;
}
```

## 📚 References & Resources

### Official Documentation
- [My MCP Connector README](README.md)
- [My MCP Connector Technical Guide](docs/GUIDE.md)
- [My MCP Connector User Manual](docs/MANUAL.md)
- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)

### API References
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Vibe Documentation](https://docs.vibe.ai)

### Community Resources
- [MCP Discord](https://discord.gg/modelcontextprotocol)
- [Mistral AI Documentation](https://docs.mistral.ai)
- [GitHub Issues](https://github.com/sourovdeb/my-mcp-connector/issues)

## 🆘 Support

### Getting Help

1. **Check documentation** - README, MANUAL, GUIDE
2. **GitHub Issues** - [https://github.com/sourovdeb/my-mcp-connector/issues](https://github.com/sourovdeb/my-mcp-connector/issues)
3. **Email** - sourov@example.com
4. **Community** - Discord, GitHub Discussions

### Common Support Requests

- **Tool not working** - Check server is running, verify tool name
- **Authentication issues** - Verify token, check authentication type
- **Performance problems** - Check server resources, add caching
- **Documentation unclear** - Open an issue or discussion

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-10-23 | Initial release with 3 tools |
| 1.0.1 | TBD | Bug fixes, improvements |
| 1.1.0 | TBD | New tools, authentication improvements |

---

## 📞 Contact

**Author:** Sourov  
**Email:** sourov@example.com  
**GitHub:** [@sourovdeb](https://github.com/sourovdeb)  
**Website:** [https://sourovdeb.com](https://sourovdeb.com)

---

**Skill Version:** 1.0.0  
**Last Updated:** 2026-10-23  
**Next Review:** 2026-11-23
