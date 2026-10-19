# Double Control Plugin - Instructions

This plugin integrates the Chrome Extension and browser-harness MCP server to provide seamless Chrome automation.

## What This Plugin Provides

1. **MCP Server**: browser-harness-mcp for external Chrome control via CDP
2. **Skill**: `browser-double-control` for unified tab management
3. **Knowledge**: Complete documentation of the Double Control system
4. **Hooks**: Automatic tips and warnings for browser operations

## Quick Start

### For Vibe Users

The plugin is automatically loaded from `C:\Users\souro\.vibe\plugins\double-control\`.

To reload the plugin after changes:
```
/reload
```

### Available Tools

Use these tools in your Vibe sessions:

```typescript
// List all tabs
tools.browser_harness.list_tabs()

// Open a new tab
await tools.browser_harness.new_tab({ url: "https://example.com" })

// Switch to a tab
await tools.browser_harness.switch_tab({ target_id: "..." })

// Take a screenshot
await tools.browser_harness.capture_screenshot({ path: "H:/screenshot.png" })
```

### Using the Chrome Extension

1. Click the 🎛️ icon in Chrome toolbar
2. View list of all tabs
3. Click any tab to switch to it
4. Click "Refresh Tabs" to update

## Plugin Structure

```
double-control/
├── plugin.json           # Plugin manifest
├── mcp.json              # MCP server configuration
├── INSTRUCTIONS.md       # This file
└── ai.mistral.vibe/
    ├── hooks.toml         # Browser operation hooks
    └── knowledge/
        └── double-control/
            └── KNOWLEDGE.md  # Complete documentation
└── skills/
    └── browser-double-control/
        └── SKILL.md       # Integration skill
```

## Configuration

The MCP server is configured in `mcp.json` to use the browser-harness-mcp executable.

The Vibe config (`C:\Users\souro\.vibe\config.toml`) also has this MCP server registered separately, which provides redundancy.

## Development

To add more features:

1. Add new tools to `mcp.json` (if adding new MCP servers)
2. Add new skills to `skills/` directory
3. Add new knowledge folders to `ai.mistral.vibe/knowledge/`
4. Add new hooks to `ai.mistral.vibe/hooks.toml`

## Testing

Test the plugin by:

```typescript
// Test list_tabs
const tabs = await tools.browser_harness.list_tabs()
console.log(`Found ${tabs.length} tabs`)

// Test new_tab
await tools.browser_harness.new_tab({ url: "https://github.com" })

// Test screenshot
await tools.browser_harness.capture_screenshot({ path: "H:/test.png" })
```

## Troubleshooting

If tools aren't available:
1. Check the MCP server is running: `browser-harness doctor`
2. Check Chrome is running with CDP enabled
3. Reload the plugin: `/reload`
4. Restart Vibe

## Related Files

- Extension source: `H:\chrome-communication-extension\`
- browser-harness: `E:\tools\uv-tools\bin\browser-harness.exe`
- browser-harness-mcp: `E:\tools\uv-tools\bin\browser-harness-mcp.exe`
