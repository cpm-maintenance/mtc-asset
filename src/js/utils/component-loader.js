/**
 * Component Loader Utility
 * Handles dynamic loading of HTML templates for MTC-Asset
 * 
 * Usage:
 *   const loader = new ComponentLoader();
 *   await loader.loadPage('Dashboard');
 */

export class ComponentLoader {
  constructor() {
    this.cache = new Map();
    this.basePath = '/pages';
  }

  /**
   * Load a page template and inject into target element
   * @param {string} pageName - Name of the page (e.g., 'Dashboard')
   * @param {HTMLElement} targetElement - Element to inject HTML into
   * @returns {Promise<void>}
   */
  async loadPage(pageName, targetElement = null) {
    try {
      const html = await this.fetchTemplate(pageName);
      
      if (targetElement) {
        targetElement.innerHTML = html;
      }
      
      return html;
    } catch (error) {
      console.error(`Failed to load page: ${pageName}`, error);
      throw error;
    }
  }

  /**
   * Fetch template with caching
   * @param {string} pageName 
   * @returns {Promise<string>}
   */
  async fetchTemplate(pageName) {
    // Check cache first
    if (this.cache.has(pageName)) {
      return this.cache.get(pageName);
    }

    // Fetch from server
    const response = await fetch(`${this.basePath}/${pageName}.html`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Cache for future use
    this.cache.set(pageName, html);
    
    return html;
  }

  /**
   * Preload multiple pages for better performance
   * @param {string[]} pageNames 
   */
  async preload(pageNames) {
    const promises = pageNames.map(name => this.fetchTemplate(name));
    await Promise.all(promises);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      size: this.cache.size,
      pages: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
export const componentLoader = new ComponentLoader();

// Export for global access if needed
if (typeof window !== 'undefined') {
  window.componentLoader = componentLoader;
}
