# MCP Control Skills

Vibe/Pi agent skills for managing the 4 local MCP servers on Sourov's PC.

## Skills

| Skill | Port | Tools | Description |
|-------|------|-------|-------------|
| `mcp-control` | ALL | — | Master skill: start/stop/status/configure all 4 MCPs at once |
| `latch-mcp` | 3939 | 6 | Latch MCP: file ops + DaVinci Resolve/OBS bridges |
| `unified-mcp-gateway` | 3002 | 39 | Unified Gateway: 13 native + 26 proxied PC control tools |
| `my-mcp-connector` | 3000 | 5 | System info, health, skills, credentials check |
| `browser-control-mcp` | 3001 | 15 | Chrome CDP automation (tabs, navigate, click, type, screenshot) |

## Installation

### Vibe (global)
```bash
cp -r skills/* ~/.vibe/skills/skills/
```

### Pi agent
```bash
cp -r skills/* E:/ONE-STOP-SHOP/.pi/agent/skills/
```

## Usage

```
/mcp-control          # Master control — all 4 MCPs
/latch-mcp            # Latch only (port 3939)
/unified-mcp-gateway  # Gateway only (port 3002)
/my-mcp-connector     # Connector only (port 3000)
/browser-control-mcp  # Browser MCP only (port 3001)
```

## Live Status (2026-10-27)

| Server | Port | PID | Status |
|--------|------|-----|--------|
| Latch | 3939 | 12756 | UP |
| Gateway | 3002 | 8268 | UP |
| Connector | 3000 | 5812 | UP |
| Browser MCP | 3001 | 2312 | UP |
