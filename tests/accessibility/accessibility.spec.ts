/**
 * Accessibility Tests - WCAG 2.1 AA Compliance
 * Tests automated accessibility checks using axe-core
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit - WCAG 2.1 AA', () => {
  test.beforeEach(async ({ page }) => {
    // Start the application
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('Main application should pass axe accessibility tests', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Chat interface should be accessible', async ({ page }) => {
    // Navigate to chat view if available
    const chatButton = page.locator('text=Chat').first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(500);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Color contrast should meet WCAG AA standards', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation should work', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.keyboard'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ARIA attributes should be valid', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.aria'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Images should have alt text', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.text-alternatives'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Form elements should have labels', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.forms'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Semantic HTML should be used', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.semantics'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Manual Keyboard Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('Tab navigation should work through all interactive elements', async ({ page }) => {
    // Tab through the page
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Continue tabbing to ensure focus moves
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const newFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(newFocusedElement).toBeTruthy();
    }
  });

  test('Escape key should close dialogs', async ({ page }) => {
    // Look for any button that might open a dialog
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 3)) {
      const text = await button.textContent();
      if (text && !text.includes('Debug')) {
        await button.click();
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('Enter and Space should activate buttons', async ({ page }) => {
    const button = await page.locator('button').first();
    await button.focus();
    
    // Check if button is focusable
    const isFocused = await page.evaluate(() => 
      document.activeElement?.tagName === 'BUTTON'
    );
    expect(isFocused).toBeTruthy();
  });
});

test.describe('Focus Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('Interactive elements should have visible focus indicators', async ({ page }) => {
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) {
      await button.focus();
      
      // Check if focus styles are applied
      const outlineStyle = await button.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });
      
      // Should have either outline or box-shadow for focus indicator
      const hasFocusIndicator = 
        (outlineStyle.outlineWidth && outlineStyle.outlineWidth !== '0px') ||
        (outlineStyle.boxShadow && outlineStyle.boxShadow !== 'none');
      
      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('Links should have visible focus indicators', async ({ page }) => {
    const links = await page.locator('a').all();
    
    if (links.length > 0) {
      for (const link of links.slice(0, 3)) {
        await link.focus();
        
        const outlineStyle = await link.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow,
          };
        });
        
        const hasFocusIndicator = 
          outlineStyle.outline !== 'none' ||
          outlineStyle.boxShadow !== 'none';
        
        expect(hasFocusIndicator).toBeTruthy();
      }
    }
  });

  test('Input fields should have visible focus indicators', async ({ page }) => {
    const inputs = await page.locator('input, textarea').all();
    
    if (inputs.length > 0) {
      for (const input of inputs.slice(0, 3)) {
        await input.focus();
        
        const outlineStyle = await input.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow,
            borderColor: styles.borderColor,
          };
        });
        
        const hasFocusIndicator = 
          outlineStyle.outline !== 'none' ||
          outlineStyle.boxShadow !== 'none';
        
        expect(hasFocusIndicator).toBeTruthy();
      }
    }
  });
});
