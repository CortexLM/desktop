/**
 * Tests for token counting
 */

import { HeuristicTokenCounter, ProviderTokenCounter, TokenBudgetManager } from '../token-counter';

describe('HeuristicTokenCounter', () => {
  let counter: HeuristicTokenCounter;

  beforeEach(() => {
    counter = new HeuristicTokenCounter();
  });

  it('should count tokens based on character length', () => {
    const text = 'This is a test sentence with some words.';
    const tokens = counter.count(text);
    
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length); // Should be less than character count
  });

  it('should add overhead for special characters', () => {
    const plain = 'simple text';
    const special = 'text with {special} [characters] (and) symbols!';
    
    const plainTokens = counter.count(plain);
    const specialTokens = counter.count(special);
    
    expect(specialTokens).toBeGreaterThan(plainTokens);
  });

  it('should estimate message tokens', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' },
    ];
    
    const tokens = counter.estimateMessageTokens(messages);
    
    expect(tokens).toBeGreaterThan(0);
    // Should include message overhead
    expect(tokens).toBeGreaterThan(
      counter.count(messages[0].content) + counter.count(messages[1].content)
    );
  });
});

describe('ProviderTokenCounter', () => {
  it('should use provider-specific counting for Anthropic', () => {
    const counter = new ProviderTokenCounter('anthropic');
    const text = 'Hello, world!';
    
    const tokens = counter.count(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should adjust for code content', () => {
    const counter = new ProviderTokenCounter('anthropic');
    
    const plainText = 'This is plain text with some words in it.';
    const codeText = '```typescript\nfunction test() { return 42; }\n```';
    
    const plainTokens = counter.count(plainText);
    const codeTokens = counter.count(codeText);
    
    // Code should be more token-efficient per character
    const plainRatio = plainTokens / plainText.length;
    const codeRatio = codeTokens / codeText.length;
    
    expect(codeRatio).toBeLessThan(plainRatio);
  });

  it('should handle different providers', () => {
    const anthropic = new ProviderTokenCounter('anthropic');
    const openai = new ProviderTokenCounter('openai');
    const grok = new ProviderTokenCounter('grok');
    
    const text = 'Same text for all providers';
    
    expect(anthropic.count(text)).toBeGreaterThan(0);
    expect(openai.count(text)).toBeGreaterThan(0);
    expect(grok.count(text)).toBeGreaterThan(0);
  });
});

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager(200_000, 4_096);
  });

  it('should allocate budget with priorities', () => {
    const budget = manager.allocate({
      systemTokens: 5_000,
      contextTokens: 150_000,
      userTokens: 2_000,
    });
    
    expect(budget.system).toBe(5_000);
    expect(budget.user).toBe(2_000);
    expect(budget.context).toBeLessThanOrEqual(150_000);
    expect(budget.output).toBe(4_096);
    expect(budget.total).toBeLessThanOrEqual(200_000);
  });

  it('should trim context when over budget', () => {
    const budget = manager.allocate({
      systemTokens: 10_000,
      contextTokens: 190_000, // Too much
      userTokens: 5_000,
    });
    
    // Should prioritize system and user over context
    expect(budget.system).toBe(10_000);
    expect(budget.user).toBe(5_000);
    expect(budget.context).toBeLessThan(190_000);
    expect(budget.total).toBeLessThanOrEqual(200_000);
  });

  it('should check if budget would exceed', () => {
    const overBudget = {
      system: 10_000,
      user: 5_000,
      context: 190_000,
      output: 10_000,
      total: 215_000,
    };
    
    expect(manager.wouldExceed(overBudget)).toBe(true);
  });

  it('should calculate remaining budget', () => {
    const budget = {
      system: 5_000,
      user: 2_000,
      context: 50_000,
      output: 4_096,
      total: 61_096,
    };
    
    const remaining = manager.getRemaining(budget);
    expect(remaining).toBe(200_000 - 61_096);
  });

  it('should recommend compaction ratio', () => {
    expect(manager.getRecommendedCompactionRatio(150_000)).toBeNull();
    expect(manager.getRecommendedCompactionRatio(220_000)).toBe(2);
    expect(manager.getRecommendedCompactionRatio(280_000)).toBe(5);
    expect(manager.getRecommendedCompactionRatio(400_000)).toBe(10);
  });
});
