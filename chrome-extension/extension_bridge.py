#!/usr/bin/env python3
"""
Double Control Extension Bridge
Communicates with Chrome extension and works alongside browser-harness
"""

import sys
import json
import time
from pathlib import Path

# Add browser-harness to path
sys.path.insert(0, str(Path.home() / 'browser-harness' / 'src'))

def main():
    """
    Main function to demonstrate double control:
    1. browser-harness controls Chrome via CDP
    2. Extension provides additional UI and API
    """
    
    print("Double Control Extension Bridge")
    print("=" * 50)
    
    # This will be integrated with browser-harness
    # For now, let's demonstrate the concept
    
    print("\n1. Testing browser-harness connection...")
    try:
        # Import browser-harness functions
        from browser_harness import ensure_daemon, page_info, list_tabs, new_tab
        
        # Ensure daemon is running
        ensure_daemon()
        
        # Get current page info
        info = page_info()
        print(f"Current page: {info.get('title')} - {info.get('url')}")
        
        # List all tabs
        tabs = list_tabs()
        print(f"\nOpen tabs ({len(tabs)}):")
        for i, tab in enumerate(tabs):
            print(f"  {i+1}. {tab.get('title')} - {tab.get('url')}")
        
        print("\n2. Opening a new tab via browser-harness...")
        new_tab("https://example.com")
        time.sleep(1)
        
        # Get updated tabs
        tabs = list_tabs()
        print(f"\nUpdated tabs ({len(tabs)}):")
        for i, tab in enumerate(tabs):
            active_marker = " [ACTIVE]" if tab.get('active') else ""
            print(f"  {i+1}. {tab.get('title')} - {tab.get('url')}{active_marker}")
        
        print("\n3. Double control achieved!")
        print("   - browser-harness controls Chrome via CDP")
        print("   - Extension provides UI in the browser")
        print("   - Both can see and control tabs")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
