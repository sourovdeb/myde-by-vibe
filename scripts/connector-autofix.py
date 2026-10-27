#!/usr/bin/env python3
"""
Mistral Connector Auto-Fixer
============================
Reads tunnel URLs from TUNNEL-URLS-latest.md and updates Mistral AI connectors.
Deletes broken/duplicate connectors and creates fresh ones with current URLs.

Usage:
    python connector-autofix.py --check       # Show current state only
    python connector-autofix.py --fix         # Delete broken, create fresh
    python connector-autofix.py --fix --dry-run  # Show what would be done

Requires:
    - MISTRAL_API_KEY in environment (HKCU)
    - mistralai Python SDK (pip install mistralai)
    - TUNNEL-URLS-latest.md with current tunnel URLs
"""

import os
import re
import sys
import json
import argparse
import subprocess
from pathlib import Path

# Connector definitions: what we want to exist
# Each entry: (name, title, port, mcp_path, description)
WANTED_CONNECTORS = [
    {
        "name": "browser_control_mcp",
        "title": "Browser Control MCP",
        "port": 3001,
        "mcp_path": "/mcp",
        "description": "Control local Chrome browser via CDP - list tabs, navigate, click, type, screenshot, execute JS",
    },
    {
        "name": "system_info_mcp",
        "title": "System Info MCP",
        "port": 3000,
        "mcp_path": "/mcp",
        "description": "System monitoring: health check, system info, pipeline status, credentials audit, skill inventory",
    },
    {
        "name": "sourov_gateway",
        "title": "Sourov Gateway — Full PC Control",
        "port": 3002,
        "mcp_path": "/mcp",
        "description": "Unified MCP Gateway — 39 tools for full PC control",
        "requires_auth": True,  # Gateway needs Bearer token
    },
    {
        "name": "latch_mcp",
        "title": "Latch MCP (Local PC Tools)",
        "port": 3939,
        "mcp_path": "/mcp/mistral",
        "description": "Local MCP server for file read/list/search on Sourov PC. Read-only access to E:/tools/latch-share.",
    },
]

# Connectors to keep (don't delete these even if they look broken)
KEEP_CONNECTORS = {
    "wordpress_mcp_46cb",       # Direct WordPress, not tunnel-based
    "sourovdeb_wordpress_easy_mcp_bridge_read_only_token_a71a",  # Direct WordPress
    "biorender",                 # External service
    "paypal",                    # External service
}

# System connectors to never touch
SYSTEM_PREFIXES = ("atlassian", "notion", "box", "stripe", "linear", "slack",
                   "github_app", "outlook", "gmail", "google_", "document_library",
                   "sharepoint", "bigquery", "gitlab")


def get_api_key():
    """Get Mistral API key from environment or Windows registry."""
    key = os.environ.get("MISTRAL_API_KEY", "")
    if key:
        return key
    # Try Windows registry via PowerShell
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command",
             '[System.Environment]::GetEnvironmentVariable("MISTRAL_API_KEY","User")'],
            capture_output=True, text=True, timeout=10
        )
        key = result.stdout.strip()
        if key:
            return key
    except Exception:
        pass
    return None


def get_gateway_token():
    """Get gateway auth token from environment (never print it)."""
    token = os.environ.get("GATEWAY_AUTH_TOKEN", "")
    if token:
        return token
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command",
             '[System.Environment]::GetEnvironmentVariable("GATEWAY_AUTH_TOKEN","User")'],
            capture_output=True, text=True, timeout=10
        )
        token = result.stdout.strip()
        if token:
            return token
    except Exception:
        pass
    return None


def read_tunnel_urls():
    """Read tunnel URLs from TUNNEL-URLS-latest.md."""
    doc_path = Path("C:/Users/souro/.vibe/docs/TUNNEL-URLS-latest.md")
    if not doc_path.exists():
        # Try the dated version
        docs_dir = Path("C:/Users/souro/.vibe/docs")
        candidates = sorted(docs_dir.glob("TUNNEL-URLS-*.md"), reverse=True)
        if candidates:
            doc_path = candidates[0]
        else:
            return None
    
    content = doc_path.read_text(encoding="utf-8")
    urls = {}
    # Parse table rows, handling markdown bold (**text**) and various column orders
    # Format 1: | name | port | url | mcp_endpoint | status |
    # Format 2: | **name** | **port** | **url** | **pid** | **verified** |
    for line in content.split("\n"):
        if not line.startswith("|") or "trycloudflare.com" not in line:
            continue
        # Strip markdown bold/italic markers
        clean = line.replace("**", "").replace("*", "")
        parts = [p.strip() for p in clean.split("|")]
        # Find the URL part and the port part
        url = None
        port = None
        for part in parts:
            if "trycloudflare.com" in part and part.startswith("http"):
                # Extract base URL (remove /mcp path if present)
                url = re.sub(r'/mcp.*$', '', part)
            elif part.isdigit() and 1000 <= int(part) <= 9999:
                port = int(part)
        if url and port:
            urls[port] = url
    
    return urls if urls else None


def list_connectors(client):
    """List all connectors from Mistral AI."""
    result = client.beta.connectors.list()
    return result.items


def is_system_connector(conn):
    """Check if a connector is a system connector (don't touch)."""
    owner = getattr(conn, "owner_type", "")
    return owner == "system"


def is_our_connector(conn):
    """Check if a connector is one we created (user/workspace/org owned MCP with trycloudflare URL)."""
    if is_system_connector(conn):
        return False
    server = getattr(conn, "server", None) or ""
    name = getattr(conn, "name", "")
    # Our connectors have trycloudflare.com URLs or are in our known list
    if "trycloudflare.com" in str(server):
        return True
    if name in KEEP_CONNECTORS:
        return True
    # Check if name matches our wanted connectors
    for wanted in WANTED_CONNECTORS:
        if name.startswith(wanted["name"]):
            return True
    return False


def find_broken_connectors(connectors, current_urls):
    """
    Find connectors that need to be deleted:
    - Our connectors with dead tunnel URLs
    - Duplicate connectors (same title, multiple instances)
    """
    broken = []
    seen_titles = {}
    
    for conn in connectors:
        if not is_our_connector(conn):
            continue
        
        name = getattr(conn, "name", "")
        title = getattr(conn, "title", "") or name
        server = str(getattr(conn, "server", "") or "")
        conn_id = getattr(conn, "id", "")
        
        # Skip connectors we want to keep (non-tunnel)
        if name in KEEP_CONNECTORS and "trycloudflare.com" not in server:
            continue
        
        # Check if URL is a dead tunnel
        is_dead_tunnel = False
        if "trycloudflare.com" in server:
            # Extract the tunnel base URL
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', server)
            if match:
                tunnel_url = match.group(0)
                # Check if this URL is in our current working URLs
                if current_urls:
                    current_bases = list(current_urls.values())
                    if tunnel_url not in current_bases:
                        is_dead_tunnel = True
                else:
                    is_dead_tunnel = True  # No current URLs = all tunnels dead
        
        # Check for duplicates (same title appearing multiple times)
        is_duplicate = False
        if title in seen_titles:
            # Keep the first one, mark subsequent as duplicates
            # But if the first one has a dead URL, keep the newer one
            prev = seen_titles[title]
            if is_dead_tunnel and not prev.get("dead", False):
                # Current is dead, previous is alive - mark current as broken
                is_duplicate = True
            elif not is_dead_tunnel and prev.get("dead", False):
                # Current is alive, previous is dead - mark previous as broken
                broken.append(prev["conn"])
                seen_titles[title] = {"conn": conn, "dead": is_dead_tunnel, "id": conn_id}
            else:
                # Both same state - mark newer as duplicate
                is_duplicate = True
        else:
            seen_titles[title] = {"conn": conn, "dead": is_dead_tunnel, "id": conn_id}
        
        if is_dead_tunnel or is_duplicate:
            broken.append(conn)
    
    return broken


def delete_connector(client, conn_id):
    """Delete a connector by ID."""
    try:
        client.beta.connectors.delete(integration_id=conn_id)
        return True
    except Exception as e:
        print(f"    Error deleting {conn_id}: {e}")
        return False


def create_connector(client, spec, tunnel_url):
    """Create a new connector with the given tunnel URL."""
    mcp_endpoint = f"{tunnel_url}{spec['mcp_path']}"
    
    kwargs = {
        "name": spec["name"],
        "title": spec["title"],
        "server": mcp_endpoint,
        "protocol": "mcp",
    }
    
    # Gateway needs auth header
    if spec.get("requires_auth"):
        token = get_gateway_token()
        if token:
            kwargs["headers"] = {"Authorization": f"Bearer {token}"}
    
    try:
        result = client.beta.connectors.create(**kwargs)
        return result
    except Exception as e:
        print(f"    Error creating {spec['name']}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Mistral Connector Auto-Fixer")
    parser.add_argument("--check", action="store_true", help="Show current state only")
    parser.add_argument("--fix", action="store_true", help="Delete broken, create fresh")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    args = parser.parse_args()
    
    if not args.check and not args.fix:
        args.check = True  # Default to check
    
    # Get API key
    api_key = get_api_key()
    if not api_key:
        print("ERROR: MISTRAL_API_KEY not found in environment or registry")
        sys.exit(1)
    print(f"API key found (length: {len(api_key)})")
    
    # Read current tunnel URLs
    tunnel_urls = read_tunnel_urls()
    if tunnel_urls:
        print(f"\nCurrent tunnel URLs:")
        for port, url in tunnel_urls.items():
            print(f"  Port {port}: {url}")
    else:
        print("\nWARNING: No current tunnel URLs found. All tunnel-based connectors will be considered broken.")
    
    # Connect to Mistral
    from mistralai.client import Mistral
    client = Mistral(api_key=api_key)
    
    # List connectors
    connectors = list_connectors(client)
    print(f"\nTotal connectors: {len(connectors)}")
    
    # Categorize
    system_conns = [c for c in connectors if is_system_connector(c)]
    our_conns = [c for c in connectors if is_our_connector(c)]
    other_conns = [c for c in connectors if not is_system_connector(c) and not is_our_connector(c)]
    
    print(f"  System: {len(system_conns)} (don't touch)")
    print(f"  Ours: {len(our_conns)}")
    print(f"  Other user: {len(other_conns)}")
    
    # Show our connectors
    print(f"\nOur connectors:")
    for conn in our_conns:
        name = getattr(conn, "name", "N/A")
        title = getattr(conn, "title", "") or "(no title)"
        server = str(getattr(conn, "server", "") or "(no server)")
        conn_id = getattr(conn, "id", "N/A")
        if len(server) > 70:
            server = server[:70] + "..."
        print(f"  - {name} | {title} | {server}")
        print(f"    ID: {conn_id}")
    
    # Find broken connectors
    broken = find_broken_connectors(connectors, tunnel_urls)
    print(f"\nBroken/duplicate connectors to remove: {len(broken)}")
    for conn in broken:
        name = getattr(conn, "name", "N/A")
        title = getattr(conn, "title", "") or "(no title)"
        server = str(getattr(conn, "server", "") or "(no server)")
        conn_id = getattr(conn, "id", "N/A")
        if len(server) > 70:
            server = server[:70] + "..."
        print(f"  - {name} | {title} | {server} | ID: {conn_id}")
    
    # Determine what to create
    if tunnel_urls:
        print(f"\nConnectors to create (with current tunnel URLs):")
        for spec in WANTED_CONNECTORS:
            port = spec["port"]
            if port in tunnel_urls:
                url = tunnel_urls[port]
                endpoint = f"{url}{spec['mcp_path']}"
                print(f"  - {spec['title']} -> {endpoint}")
            else:
                print(f"  - {spec['title']} -> NO TUNNEL for port {port}")
    
    if args.check:
        print("\n(Check mode - no changes made)")
        return
    
    if args.dry_run:
        print("\n(Dry run - no changes made)")
        return
    
    # Fix mode
    print(f"\n=== Applying fixes ===")
    
    # Delete broken connectors
    deleted = 0
    for conn in broken:
        conn_id = getattr(conn, "id", "")
        name = getattr(conn, "name", "N/A")
        print(f"  Deleting: {name} ({conn_id})")
        if delete_connector(client, conn_id):
            deleted += 1
            print(f"    OK")
        else:
            print(f"    FAILED")
    
    print(f"\nDeleted {deleted}/{len(broken)} broken connectors")
    
    # Create fresh connectors
    if tunnel_urls:
        created = 0
        for spec in WANTED_CONNECTORS:
            port = spec["port"]
            if port not in tunnel_urls:
                print(f"  Skipping {spec['title']} - no tunnel for port {port}")
                continue
            
            url = tunnel_urls[port]
            print(f"  Creating: {spec['title']} -> {url}{spec['mcp_path']}")
            result = create_connector(client, spec, url)
            if result:
                created += 1
                new_id = getattr(result, "id", "N/A")
                print(f"    OK (ID: {new_id})")
            else:
                print(f"    FAILED")
        
        print(f"\nCreated {created} new connectors")
        print("\nNOTE: You may need to click 'Connect' on each new connector in the Mistral AI UI.")
        print("Go to: https://chat.mistral.ai/connections")
    else:
        print("\nNo tunnel URLs available - cannot create new connectors.")
        print("Run tunnel-manager.ps1 -Auto first to establish tunnels.")


if __name__ == "__main__":
    main()
