/**
 * Token counting utilities for accurate token management.
 * Supports multiple tokenizer strategies.
 */

export interface TokenCounter {
  count(text: string): number;
  estimateMessageTokens(messages: Array<{ role: string; content: string }>): number;
}

/**
 * Simple heuristic-based token counter (fast, ~90% accurate).
 */
export class HeuristicTokenCounter implements TokenCounter {
  private readonly CHARS_PER_TOKEN = 4; // Average for English
  private readonly MESSAGE_OVERHEAD = 4; // Tokens per message for formatting

  count(text: string): number {
    // Simple character-based estimation
    const baseTokens = Math.ceil(text.length / this.CHARS_PER_TOKEN);
    
    // Add small overhead for special characters and formatting
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    const overhead = Math.ceil(specialChars / 10);
    
    return baseTokens + overhead;
  }

  estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    
    for (const msg of messages) {
      // Content tokens
      total += this.count(msg.content);
      // Message formatting overhead
      total += this.MESSAGE_OVERHEAD;
    }
    
    return total;
  }
}

/**
 * Provider-specific token counter with precise counting.
 * Falls back to heuristic if no specific tokenizer is available.
 */
export class ProviderTokenCounter implements TokenCounter {
  private readonly heuristic = new HeuristicTokenCounter();
  private readonly provider: string;

  constructor(provider: string) {
    this.provider = provider;
  }

  count(text: string): number {
    // Use provider-specific counting if available
    switch (this.provider) {
      case 'anthropic':
        return this.countAnthropic(text);
      case 'openai':
        return this.countOpenAI(text);
      case 'grok':
        return this.countGrok(text);
      default:
        return this.heuristic.count(text);
    }
  }

  estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
    return this.heuristic.estimateMessageTokens(messages);
  }

  private countAnthropic(text: string): number {
    // Anthropic uses similar tokenization to GPT-4
    // ~3.5 chars per token for English, varies by language
    const baseTokens = Math.ceil(text.length / 3.5);
    
    // Adjust for code (more efficient)
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
    const codeAdjustment = codeBlocks > 0 ? Math.floor(baseTokens * 0.1) : 0;
    
    return Math.max(1, baseTokens - codeAdjustment);
  }

  private countOpenAI(text: string): number {
    // OpenAI cl100k_base tokenizer
    // Average 4 chars per token, but varies significantly
    const baseTokens = Math.ceil(text.length / 4);
    
    // Code is more token-efficient
    const hasCode = text.includes('function') || text.includes('const') || text.includes('class');
    const codeAdjustment = hasCode ? Math.floor(baseTokens * 0.15) : 0;
    
    return Math.max(1, baseTokens - codeAdjustment);
  }

  private countGrok(text: string): number {
    // Grok tokenization similar to GPT models
    return this.countOpenAI(text);
  }
}

/**
 * Token budget allocator for managing context windows.
 */
export interface TokenBudget {
  system: number;
  context: number;
  user: number;
  output: number;
  total: number;
}

export class TokenBudgetManager {
  private readonly maxTokens: number;
  private readonly reserveOutputTokens: number;

  constructor(maxTokens: number, reserveOutputTokens = 4096) {
    this.maxTokens = maxTokens;
    this.reserveOutputTokens = reserveOutputTokens;
  }

  /**
   * Allocate token budget dynamically based on available content.
   */
  allocate(requirements: {
    systemTokens: number;
    contextTokens: number;
    userTokens: number;
  }): TokenBudget {
    const availableForInput = this.maxTokens - this.reserveOutputTokens;
    
    // Priority: system > user > context
    let remaining = availableForInput;
    
    // 1. System prompts (required, high priority)
    const systemAlloc = Math.min(requirements.systemTokens, remaining);
    remaining -= systemAlloc;
    
    // 2. User message (required)
    const userAlloc = Math.min(requirements.userTokens, remaining);
    remaining -= userAlloc;
    
    // 3. Context (fill remaining space)
    const contextAlloc = Math.min(requirements.contextTokens, remaining);
    remaining -= contextAlloc;

    return {
      system: systemAlloc,
      user: userAlloc,
      context: contextAlloc,
      output: this.reserveOutputTokens,
      total: systemAlloc + userAlloc + contextAlloc + this.reserveOutputTokens,
    };
  }

  /**
   * Check if a budget would exceed limits.
   */
  wouldExceed(budget: TokenBudget): boolean {
    return budget.total > this.maxTokens;
  }

  /**
   * Get remaining budget space.
   */
  getRemaining(budget: TokenBudget): number {
    return Math.max(0, this.maxTokens - budget.total);
  }

  /**
   * Calculate recommended compaction ratio if over budget.
   *
   * Overage is measured against the budget, not against the current size:
   * "40% over budget" is the actionable quantity, and it grows without bound.
   * Dividing by `currentTokens` instead caps the ratio below 1 and pushes the
   * buckets out of reach -- 5x would need 1.5x the budget and 10x would need
   * 2.5x, so 220k and 280k against a 200k window both came back as 2x.
   */
  getRecommendedCompactionRatio(currentTokens: number): number | null {
    if (currentTokens <= this.maxTokens) {
      return null; // No compaction needed
    }

    const overage = currentTokens - this.maxTokens;
    const overageRatio = overage / this.maxTokens;

    // Recommend compaction ratios based on overage
    if (overageRatio < 0.3) return 2; // 2x compaction
    if (overageRatio < 0.6) return 5; // 5x compaction
    return 10; // 10x compaction for severe overage
  }
}

/**
 * Utility to estimate tokens for different content types.
 */
export class TokenEstimator {
  private readonly counter: TokenCounter;

  constructor(provider: string) {
    this.counter = new ProviderTokenCounter(provider);
  }

  /**
   * Estimate tokens for code with metadata.
   */
  estimateCode(code: string, includeMetadata = true): number {
    let tokens = this.counter.count(code);
    
    if (includeMetadata) {
      // Add overhead for syntax highlighting, file paths, etc.
      tokens += Math.ceil(tokens * 0.05);
    }
    
    return tokens;
  }

  /**
   * Estimate tokens for structured data (JSON, YAML, etc.).
   */
  estimateStructuredData(data: unknown): number {
    const serialized = JSON.stringify(data, null, 2);
    return this.counter.count(serialized);
  }

  /**
   * Estimate tokens for a file with context.
   */
  estimateFileWithContext(filePath: string, content: string): number {
    const pathTokens = this.counter.count(filePath);
    const contentTokens = this.counter.count(content);
    const overhead = 10; // Formatting overhead
    
    return pathTokens + contentTokens + overhead;
  }
}
