/**
 * Tool use prompts optimized for MCP tools and function calling
 * Handles parallel invocation, error recovery, and efficient tool selection
 */

export interface ToolPromptConfig {
  enableParallel?: boolean;
  maxParallelCalls?: number;
  includeErrorRecovery?: boolean;
}

/**
 * General tool use instructions
 */
export const TOOL_USE_BASE = (config: ToolPromptConfig = {}): string => {
  const parallelConfig = config.enableParallel ? `
# PARALLEL TOOL INVOCATION
- When multiple tools don't depend on each other, call them in parallel
- Maximum ${config.maxParallelCalls || 5} parallel calls per turn
- Example: Reading multiple files, checking multiple endpoints, querying independent data sources
` : '';

  const errorRecovery = config.includeErrorRecovery ? `
# ERROR RECOVERY
- If a tool fails, analyze the error before retrying
- Don't retry the same call more than twice without changing parameters
- Consider alternative tools or approaches after failures
- Log tool errors for debugging context
` : '';

  return `# TOOL USAGE GUIDELINES

## Tool Selection Strategy
1. **Identify the Goal**: What information or action is needed?
2. **Find Relevant Tools**: Which tools can accomplish this?
3. **Choose Efficiently**: Prefer tools that directly solve the problem
4. **Avoid Redundancy**: Don't call multiple tools for the same information

## Function Calling Best Practices
- Provide complete, valid parameters (no placeholders)
- Use appropriate types for all arguments
- Include optional parameters when they improve results
- Validate inputs before calling tools

## Tool Call Patterns
\`\`\`typescript
// GOOD: Direct, single-purpose call
readFile({ path: "/src/config.ts" })

// GOOD: Parallel independent calls
[
  readFile({ path: "/src/user.ts" }),
  readFile({ path: "/src/types.ts" }),
  readFile({ path: "/src/utils.ts" })
]

// BAD: Sequential calls that could be parallel
readFile({ path: "/src/user.ts" })
// wait...
readFile({ path: "/src/types.ts" })

// BAD: Unnecessary tool calls
readFile({ path: "/src/config.ts" })
readFile({ path: "/src/config.ts" }) // duplicate!
\`\`\`
${parallelConfig}${errorRecovery}
## Efficiency Rules
- Batch operations when possible
- Read multiple files in one parallel batch
- Use search tools before reading entire files
- Cache tool results mentally to avoid re-calling
- Prefer specific queries over broad scans`;
};

/**
 * MCP-specific tool instructions
 */
export const MCP_TOOL_USE = (): string => `# MCP TOOL USAGE

## MCP Tool Pattern
MCP (Model Context Protocol) tools provide structured access to external systems.

### Discovery Phase
1. List available MCP servers if unknown
2. Query tool schemas to understand parameters
3. Check tool availability before calling

### Execution Phase
\`\`\`typescript
// 1. Call MCP tool with proper structure
{
  server: "mcp-server-name",
  tool: "tool_name",
  arguments: {
    param1: "value1",
    param2: "value2"
  }
}

// 2. Handle response
{
  content: [...],  // Tool output
  isError: false
}

// 3. Process results
// Extract relevant data from content array
\`\`\`

### Error Handling
- **404 Not Found**: Tool or server doesn't exist, verify names
- **400 Bad Request**: Invalid parameters, check schema
- **500 Server Error**: MCP server issue, may need retry
- **Timeout**: Long operation, consider async pattern

## Common MCP Tools

### File System Tools
- \`fs_read\`: Read file contents
- \`fs_write\`: Write file contents  
- \`fs_list\`: List directory contents
- \`fs_search\`: Search for files by pattern

### Git Tools
- \`git_status\`: Check repository status
- \`git_diff\`: View changes
- \`git_log\`: View commit history
- \`git_commit\`: Create commits

### Database Tools
- \`db_query\`: Execute SQL queries
- \`db_schema\`: Get schema information
- \`db_migrate\`: Run migrations

## Best Practices
- Always validate MCP tool parameters against schema
- Use appropriate timeout values for long operations
- Handle partial failures in batch operations
- Log MCP errors with full context for debugging`;

/**
 * Parallel tool invocation optimizer
 */
export const PARALLEL_TOOL_OPTIMIZER = (): string => `# PARALLEL TOOL INVOCATION OPTIMIZER

## When to Use Parallel Calls
✅ Reading multiple independent files
✅ Querying multiple independent APIs
✅ Running multiple independent checks
✅ Fetching data from different sources

❌ Sequential operations (read then write)
❌ Dependent operations (result of A needed for B)
❌ Operations with side effects that must be ordered
❌ More than 5-7 concurrent operations

## Parallel Call Pattern
\`\`\`typescript
// Identify independent operations
const operations = [
  { type: 'read', path: '/src/user.ts' },
  { type: 'read', path: '/src/auth.ts' },
  { type: 'read', path: '/src/types.ts' }
];

// Execute in parallel (pseudo-code)
const results = await Promise.all(
  operations.map(op => executeToolCall(op))
);

// Process results
results.forEach(result => {
  // Handle each result
});
\`\`\`

## Optimization Rules
1. **Batch Size**: Limit to 5-7 parallel calls
2. **Timeout**: Set appropriate timeouts for each call
3. **Error Isolation**: One failure shouldn't block others
4. **Result Ordering**: Maintain operation context
5. **Rate Limiting**: Respect API rate limits

## Example Optimization
\`\`\`
❌ BEFORE (Sequential - Slow):
file1 = readFile("/src/a.ts")      // 100ms
file2 = readFile("/src/b.ts")      // 100ms  
file3 = readFile("/src/c.ts")      // 100ms
Total: 300ms

✅ AFTER (Parallel - Fast):
[file1, file2, file3] = parallel([
  readFile("/src/a.ts"),
  readFile("/src/b.ts"),
  readFile("/src/c.ts")
])
Total: 100ms
\`\`\``;

/**
 * Tool error recovery strategies
 */
export const TOOL_ERROR_RECOVERY = (): string => `# TOOL ERROR RECOVERY STRATEGIES

## Error Categories

### 1. Transient Errors (Retry-able)
- Network timeouts
- Rate limit errors (with backoff)
- Temporary server errors (503)
- Lock conflicts

**Recovery**: Retry with exponential backoff

### 2. Parameter Errors (Fix-able)
- Invalid path/file not found
- Missing required parameters
- Type validation errors
- Out of range values

**Recovery**: Correct parameters and retry

### 3. Permission Errors (Alternative-able)
- Access denied
- Authentication failed
- Insufficient permissions

**Recovery**: Use alternative approach or request user intervention

### 4. Fatal Errors (Abort-able)
- Tool not found
- Unsupported operation
- Corrupted data
- System limitations

**Recovery**: Abort and report to user

## Recovery Decision Tree
\`\`\`
Tool Call Failed
    │
    ├─ Transient? ─→ Retry (max 2x)
    │
    ├─ Parameter Error? ─→ Fix params → Retry (max 1x)
    │
    ├─ Permission Error? ─→ Try alternative OR ask user
    │
    └─ Fatal? ─→ Report error and abort
\`\`\`

## Example Recoveries
\`\`\`typescript
// Scenario 1: File not found
readFile("/src/config.ts") → Error: ENOENT

Recovery: Try alternative locations
readFile("/config.ts") or readFile("/src/config.json")

// Scenario 2: Rate limited
apiCall() → Error: 429 Too Many Requests

Recovery: Wait and retry
wait(1000ms) → apiCall()

// Scenario 3: Permission denied
writeFile("/system/config") → Error: EACCES

Recovery: Report to user
"Cannot write to system directory. Please check permissions or provide alternative location."
\`\`\`

## Best Practices
- Log all tool errors with full context
- Don't retry indefinitely (max 2-3 attempts)
- Explain failures to users clearly
- Suggest alternatives when primary approach fails
- Include error details in debugging output`;

/**
 * Tool result processing guidance
 */
export const TOOL_RESULT_PROCESSING = (): string => `# TOOL RESULT PROCESSING

## Result Validation
Always validate tool results before using them:

\`\`\`typescript
// 1. Check for errors
if (result.isError) {
  handleError(result.error);
  return;
}

// 2. Validate expected structure
if (!result.content || result.content.length === 0) {
  handleEmptyResult();
  return;
}

// 3. Extract and type-check data
const data = parseToolResult(result.content);
if (!isValidData(data)) {
  handleInvalidData();
  return;
}

// 4. Use validated data
processData(data);
\`\`\`

## Efficient Result Usage
- Extract only needed information
- Don't re-process the same result multiple times
- Cache processed results for reuse
- Avoid passing huge results back to user

## Result Formatting
When presenting tool results to users:
- Summarize large outputs
- Highlight key findings
- Use structured format (tables, lists)
- Include source attribution
- Omit raw technical details unless requested`;

/**
 * Build complete tool use prompt
 */
export function buildToolUsePrompt(config: ToolPromptConfig = {}): string {
  const sections = [
    TOOL_USE_BASE(config),
    MCP_TOOL_USE(),
  ];

  if (config.enableParallel) {
    sections.push(PARALLEL_TOOL_OPTIMIZER());
  }

  if (config.includeErrorRecovery) {
    sections.push(TOOL_ERROR_RECOVERY());
  }

  sections.push(TOOL_RESULT_PROCESSING());

  return sections.join('\n\n---\n\n');
}

/**
 * Quick tool use reminders (token-efficient)
 */
export const TOOL_USE_QUICK_TIPS = `
**Tool Use Quick Tips:**
- Parallel: Independent ops → call together
- Errors: Max 2 retries, fix params first
- Results: Validate before use, summarize for user
- Efficiency: Batch reads, cache results, avoid redundant calls
`.trim();
