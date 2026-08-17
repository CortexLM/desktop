import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * AI Chat Page Object - Handles AI chat interactions
 */
export class AIChatPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    chatPanel: '[data-testid="ai-chat-panel"]',
    messageInput: '[data-testid="chat-input"]',
    sendButton: '[data-testid="send-message"]',
    messageList: '[data-testid="message-list"]',
    userMessage: '[data-testid="user-message"]',
    assistantMessage: '[data-testid="assistant-message"]',
    codeBlock: '[data-testid="code-block"]',
    copyCodeButton: '[data-testid="copy-code"]',
    applyCodeButton: '[data-testid="apply-code"]',
    sessionList: '[data-testid="session-list"]',
    newSessionButton: '[data-testid="new-session"]',
    sessionItem: '[data-testid="session-item"]',
    streamingIndicator: '[data-testid="streaming"]',
    modelSelector: '[data-testid="model-selector"]',
    stopGenerationButton: '[data-testid="stop-generation"]'
  };

  /**
   * Open AI chat panel
   */
  async openChatPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-ai-chat"]');
    await this.waitForElement(this.selectors.chatPanel);
  }

  /**
   * Start a chat session
   *
   * The panel opens on an empty state; ChatView (and therefore the message
   * input) only mounts once a session exists.
   */
  async startSession(): Promise<void> {
    if ((await this.page.locator(this.selectors.messageInput).count()) > 0) return;

    await this.page.click(this.selectors.newSessionButton);
    await this.waitForElement(this.selectors.messageInput, 20000);
  }

  /**
   * Send a message
   */
  async sendMessage(message: string): Promise<void> {
    await this.startSession();
    await this.page.fill(this.selectors.messageInput, message);
    await this.page.click(this.selectors.sendButton);
  }

  /**
   * Wait for AI response to complete
   */
  async waitForResponse(timeout = 30000): Promise<void> {
    // Wait for streaming indicator to disappear
    await this.page.waitForSelector(this.selectors.streamingIndicator, { 
      state: 'hidden', 
      timeout 
    }).catch(() => {
      // If no streaming indicator, just wait a bit
    });
    await this.page.waitForTimeout(500);
  }

  /**
   * Get last assistant message
   */
  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator(this.selectors.assistantMessage);
    const count = await messages.count();
    if (count === 0) return '';
    return messages.nth(count - 1).textContent() || '';
  }

  /**
   * Get all messages
   */
  async getAllMessages(): Promise<{ role: string; content: string }[]> {
    const userMessages = await this.page.locator(this.selectors.userMessage).allTextContents();
    const assistantMessages = await this.page.locator(this.selectors.assistantMessage).allTextContents();
    
    const messages: { role: string; content: string }[] = [];
    for (let i = 0; i < Math.max(userMessages.length, assistantMessages.length); i++) {
      if (i < userMessages.length) {
        messages.push({ role: 'user', content: userMessages[i] });
      }
      if (i < assistantMessages.length) {
        messages.push({ role: 'assistant', content: assistantMessages[i] });
      }
    }
    return messages;
  }

  /**
   * Check if streaming is in progress
   */
  async isStreaming(): Promise<boolean> {
    return this.page.locator(this.selectors.streamingIndicator).isVisible();
  }

  /**
   * Stop generation
   */
  async stopGeneration(): Promise<void> {
    await this.page.click(this.selectors.stopGenerationButton);
  }

  /**
   * Create new chat session
   */
  async createNewSession(): Promise<void> {
    await this.page.click(this.selectors.newSessionButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to session by index
   */
  async switchToSession(index: number): Promise<void> {
    const sessions = this.page.locator(this.selectors.sessionItem);
    await sessions.nth(index).click();
  }

  /**
   * Get code blocks from messages
   */
  async getCodeBlocks(): Promise<string[]> {
    const blocks = this.page.locator(this.selectors.codeBlock);
    return blocks.allTextContents();
  }

  /**
   * Copy code block
   */
  async copyCodeBlock(index: number): Promise<void> {
    const blocks = this.page.locator(this.selectors.codeBlock);
    const block = blocks.nth(index);
    await block.hover();
    await block.locator(this.selectors.copyCodeButton).click();
  }

  /**
   * Apply code block to editor
   */
  async applyCodeBlock(index: number): Promise<void> {
    const blocks = this.page.locator(this.selectors.codeBlock);
    const block = blocks.nth(index);
    await block.hover();
    await block.locator(this.selectors.applyCodeButton).click();
  }

  /**
   * Select AI model
   */
  async selectModel(modelName: string): Promise<void> {
    await this.page.click(this.selectors.modelSelector);
    await this.page.click(`[data-model="${modelName}"]`);
  }
}
