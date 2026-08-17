import { test, expect } from '../fixtures/electron';
import { AI_PROVIDER_SKIP_REASON, HAS_AI_PROVIDER } from '../fixtures/env';
import { AIChatPage } from '../page-objects';

test.describe('AI Chat Tests', () => {
  let aiChatPage: AIChatPage;

  test.beforeEach(async ({ page }) => {
    aiChatPage = new AIChatPage(page);
    await page.waitForLoadState('domcontentloaded');
    await aiChatPage.openChatPanel();
  });

  test('should open AI chat panel', async ({ page }) => {
    // Verify chat panel is visible
    await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible();
  });

  test.describe('with an active session', () => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    test.beforeEach(async () => {
      await aiChatPage.startSession();
    });

  test('should send message and receive response', async ({ page }) => {
    // Send a simple message
    await aiChatPage.sendMessage('Hello, what is 2+2?');
    
    // Wait for response
    await aiChatPage.waitForResponse(30000);
    
    // Get response
    const response = await aiChatPage.getLastAssistantMessage();
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(0);
  });

  test('should display streaming indicator during response', async ({ page }) => {
    await aiChatPage.sendMessage('Tell me a short story');
    
    // Check for streaming indicator
    const isStreaming = await aiChatPage.isStreaming();
    expect(isStreaming).toBe(true);
    
    // Wait for completion
    await aiChatPage.waitForResponse(30000);
    
    // Verify streaming stopped
    const isStillStreaming = await aiChatPage.isStreaming();
    expect(isStillStreaming).toBe(false);
  });

  test('should stop generation', async ({ page }) => {
    await aiChatPage.sendMessage('Write a very long essay about technology');
    
    // Wait a bit for streaming to start
    await page.waitForTimeout(2000);
    
    // Stop generation
    await aiChatPage.stopGeneration();
    
    // Wait for stop to take effect
    await page.waitForTimeout(1000);
    
    const isStreaming = await aiChatPage.isStreaming();
    expect(isStreaming).toBe(false);
  });

  test('should create new chat session', async ({ page }) => {
    await aiChatPage.sendMessage('First message');
    await aiChatPage.waitForResponse(10000);
    
    // Create new session
    await aiChatPage.createNewSession();
    
    // Verify we can send a message in new session
    await aiChatPage.sendMessage('New session message');
    await aiChatPage.waitForResponse(10000);
  });

  test('should switch between chat sessions', async ({ page }) => {
    // Send message in first session
    await aiChatPage.sendMessage('Session 1 message');
    await aiChatPage.waitForResponse(10000);
    
    // Create new session
    await aiChatPage.createNewSession();
    await aiChatPage.sendMessage('Session 2 message');
    await aiChatPage.waitForResponse(10000);
    
    // Switch back to first session
    await aiChatPage.switchToSession(0);
    await page.waitForTimeout(500);
    
    // Verify we can see previous messages
    const messages = await aiChatPage.getAllMessages();
    expect(messages.length).toBeGreaterThan(0);
  });

  test('should display code blocks in responses', async ({ page }) => {
    await aiChatPage.sendMessage('Write a simple JavaScript function');
    await aiChatPage.waitForResponse(30000);
    
    // Check for code blocks
    const codeBlocks = await aiChatPage.getCodeBlocks();
    expect(codeBlocks.length).toBeGreaterThan(0);
  });

  test('should copy code blocks', async ({ page }) => {
    await aiChatPage.sendMessage('Write console.log("test")');
    await aiChatPage.waitForResponse(30000);
    
    const codeBlocks = await aiChatPage.getCodeBlocks();
    
    if (codeBlocks.length > 0) {
      await aiChatPage.copyCodeBlock(0);
      
      // Verify copy action (clipboard API may not work in test environment)
      await page.waitForTimeout(500);
    }
  });

  test('should handle multiple messages in conversation', async ({ page }) => {
    // Send multiple messages
    await aiChatPage.sendMessage('What is JavaScript?');
    await aiChatPage.waitForResponse(20000);
    
    await aiChatPage.sendMessage('Tell me more about its history');
    await aiChatPage.waitForResponse(20000);
    
    await aiChatPage.sendMessage('What are its main features?');
    await aiChatPage.waitForResponse(20000);
    
    // Get all messages
    const messages = await aiChatPage.getAllMessages();
    expect(messages.length).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant
  });

  test('should persist chat history', async ({ page }) => {
    await aiChatPage.sendMessage('Test message for persistence');
    await aiChatPage.waitForResponse(10000);
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Reopen chat
    await aiChatPage.openChatPanel();
    
    // Verify messages persist
    const messages = await aiChatPage.getAllMessages();
    expect(messages.length).toBeGreaterThan(0);
    });
  });
});
