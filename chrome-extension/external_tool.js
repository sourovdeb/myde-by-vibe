#!/usr/bin/env node
/**
 * Double Control External Tool
 * Communicates with Chrome extension to provide external control
 * Works alongside browser-harness for dual control
 */

const { chromium } = require('playwright');

class DoubleControlTool {
  constructor() {
    this.extensionId = null;
    this.browser = null;
  }

  /**
   * Connect to Chrome with the extension loaded
   */
  async connect() {
    // Try to connect to existing Chrome instance
    try {
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('Connected to existing Chrome instance');
      
      // Get extension ID
      const context = this.browser.contexts()[0];
      const pages = await context.pages();
      
      // Look for the extension in the pages
      const extensionPage = pages.find(p => 
        p.url().includes('chrome-extension://') || 
        p.url().includes('chrome://')
      );
      
      if (extensionPage) {
        this.extensionId = extensionPage.url().match(/chrome-extension:\/\/([^\/]+)/)?.[1];
        console.log('Found extension ID:', this.extensionId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Chrome:', error);
      return false;
    }
  }

  /**
   * Get list of open tabs from Chrome
   */
  async getTabs() {
    if (!this.browser) {
      await this.connect();
    }
    
    try {
      const context = this.browser.contexts()[0];
      const pages = await context.pages();
      
      const tabs = pages.map(p => ({
        title: p.title(),
        url: p.url(),
        isClosed: p.isClosed()
      }));
      
      return tabs.filter(t => !t.isClosed);
    } catch (error) {
      console.error('Error getting tabs:', error);
      return [];
    }
  }

  /**
   * Open a new tab
   */
  async openTab(url) {
    if (!this.browser) {
      await this.connect();
    }
    
    try {
      const context = this.browser.contexts()[0];
      const page = await context.newPage();
      await page.goto(url);
      return { id: page.mainFrame().url(), title: await page.title() };
    } catch (error) {
      console.error('Error opening tab:', error);
      throw error;
    }
  }

  /**
   * Close a tab
   */
  async closeTab(pageOrUrl) {
    if (!this.browser) {
      await this.connect();
    }
    
    try {
      const context = this.browser.contexts()[0];
      const pages = await context.pages();
      
      const pageToClose = typeof pageOrUrl === 'object' 
        ? pageOrUrl 
        : pages.find(p => p.url().includes(pageOrUrl));
      
      if (pageToClose) {
        await pageToClose.close();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error closing tab:', error);
      throw error;
    }
  }

  /**
   * Execute JavaScript in a page
   */
  async executeScript(tabIdentifier, script) {
    if (!this.browser) {
      await this.connect();
    }
    
    try {
      const context = this.browser.contexts()[0];
      const pages = await context.pages();
      
      const page = typeof tabIdentifier === 'object' 
        ? tabIdentifier 
        : pages.find(p => p.url().includes(tabIdentifier));
      
      if (page) {
        return await page.evaluate(script);
      }
      throw new Error('Tab not found');
    } catch (error) {
      console.error('Error executing script:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Chrome
   */
  async disconnect() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Usage examples:
async function main() {
  const tool = new DoubleControlTool();
  
  try {
    await tool.connect();
    
    // Get tabs
    const tabs = await tool.getTabs();
    console.log('Open tabs:', tabs);
    
    // Open a new tab
    const newTab = await tool.openTab('https://example.com');
    console.log('Opened tab:', newTab);
    
    // Execute script in the new tab
    const result = await tool.executeScript('https://example.com', 'return document.title;');
    console.log('Page title:', result);
    
    // Close the tab
    await tool.closeTab('https://example.com');
    console.log('Tab closed');
    
    await tool.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for use as a module
module.exports = DoubleControlTool;

// Run if called directly
if (require.main === module) {
  main();
}
