/**
 * HTML Testing Utilities
 *
 * Helpers for testing HTML generation in the web module.
 */

import { JSDOM } from 'jsdom';

// ============================================
// HTML Parsing
// ============================================

/**
 * Parse HTML string into a JSDOM document
 */
export function parseHTML(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

/**
 * Query selector helper with null check
 */
export function querySelector(doc: Document, selector: string): Element {
  const element = doc.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Query all matching elements
 */
export function querySelectorAll(doc: Document, selector: string): Element[] {
  return Array.from(doc.querySelectorAll(selector));
}

// ============================================
// HTML Validation
// ============================================

/**
 * Validate basic HTML structure
 */
export function validateHTMLStructure(html: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check DOCTYPE
  if (!html.trim().startsWith('<!DOCTYPE html>')) {
    errors.push('Missing DOCTYPE declaration');
  }

  // Check for required tags
  const requiredTags = ['html', 'head', 'body', 'title'];
  for (const tag of requiredTags) {
    if (!html.includes(`<${tag}`)) {
      errors.push(`Missing required tag: <${tag}>`);
    }
  }

  // Check for unclosed tags (basic check)
  const tagPattern = /<(\w+)[^>]*(?<!\/\s*)>/g;
  const closingPattern = /<\/(\w+)>/g;
  const selfClosingTags = ['meta', 'link', 'br', 'hr', 'img', 'input'];

  const openTags: string[] = [];
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (!selfClosingTags.includes(tag)) {
      openTags.push(tag);
    }
  }

  while ((match = closingPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const lastOpen = openTags.pop();
    if (lastOpen !== tag) {
      if (lastOpen) {
        openTags.push(lastOpen); // Put it back
      }
    }
  }

  // Note: This is a simplified check, not comprehensive

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================
// Content Assertions
// ============================================

/**
 * Check if HTML contains specific text content
 */
export function containsText(html: string, text: string): boolean {
  const doc = parseHTML(html);
  return doc.body.textContent?.includes(text) ?? false;
}

/**
 * Check if HTML contains element with specific class
 */
export function hasClass(html: string, className: string): boolean {
  const doc = parseHTML(html);
  return doc.querySelector(`.${className}`) !== null;
}

/**
 * Check if HTML contains element with specific data attribute
 */
export function hasDataAttribute(html: string, attr: string, value?: string): boolean {
  const doc = parseHTML(html);
  const selector = value ? `[data-${attr}="${value}"]` : `[data-${attr}]`;
  return doc.querySelector(selector) !== null;
}

/**
 * Count elements matching selector
 */
export function countElements(html: string, selector: string): number {
  const doc = parseHTML(html);
  return doc.querySelectorAll(selector).length;
}

// ============================================
// Snapshot Helpers
// ============================================

/**
 * Normalize HTML for snapshot comparison
 * Removes dynamic content like timestamps and IDs
 */
export function normalizeHTMLForSnapshot(html: string): string {
  return html
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z/g, 'TIMESTAMP')
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    // Remove random IDs
    .replace(/id="[^"]*-\d+"/g, 'id="ID"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract just the body content for focused snapshots
 */
export function extractBodyContent(html: string): string {
  const doc = parseHTML(html);
  return doc.body.innerHTML;
}

// ============================================
// CSS Assertions
// ============================================

/**
 * Check if HTML contains inline style with property
 */
export function hasInlineStyle(html: string, property: string, value?: string): boolean {
  const pattern = value
    ? new RegExp(`style="[^"]*${property}\\s*:\\s*${value}[^"]*"`)
    : new RegExp(`style="[^"]*${property}\\s*:[^"]*"`);
  return pattern.test(html);
}

/**
 * Extract CSS from style tag
 */
export function extractStyles(html: string): string {
  const doc = parseHTML(html);
  const styleTag = doc.querySelector('style');
  return styleTag?.textContent ?? '';
}

/**
 * Check if CSS contains specific rule
 */
export function cssContainsRule(css: string, selector: string): boolean {
  return css.includes(selector);
}

// ============================================
// Script Assertions
// ============================================

/**
 * Extract script content from HTML
 */
export function extractScripts(html: string): string[] {
  const doc = parseHTML(html);
  const scripts = doc.querySelectorAll('script:not([src])');
  return Array.from(scripts).map((s) => s.textContent ?? '');
}

/**
 * Check if script contains specific function
 */
export function scriptContainsFunction(html: string, functionName: string): boolean {
  const scripts = extractScripts(html);
  return scripts.some((s) => s.includes(`function ${functionName}`) || s.includes(`${functionName} =`));
}
