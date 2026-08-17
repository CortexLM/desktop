/**
 * Few-shot examples for different task types
 * High-quality examples that demonstrate expected input/output patterns
 * Keep examples concise to conserve tokens
 */

export interface Example {
  task: string;
  input: string;
  output: string;
  tokens: number;
}

export interface ExampleSet {
  description: string;
  examples: Example[];
  totalTokens: number;
}

/**
 * Code generation examples
 */
export const CODE_GENERATION_EXAMPLES: ExampleSet = {
  description: 'High-quality code generation patterns',
  examples: [
    {
      task: 'Add error handling to async function',
      input: `async function fetchUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
      output: `async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(\`/api/users/\${id}\`);
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch user: \${response.statusText}\`);
    }
    
    const data = await response.json();
    return data as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error(\`Unable to fetch user with id \${id}\`);
  }
}`,
      tokens: 180
    },
    {
      task: 'Convert callback to Promise',
      input: `function readConfig(callback) {
  fs.readFile('config.json', 'utf8', (err, data) => {
    if (err) return callback(err);
    callback(null, JSON.parse(data));
  });
}`,
      output: `function readConfig(): Promise<Config> {
  return new Promise((resolve, reject) => {
    fs.readFile('config.json', 'utf8', (err, data) => {
      if (err) {
        reject(new Error(\`Failed to read config: \${err.message}\`));
        return;
      }
      
      try {
        const config = JSON.parse(data) as Config;
        resolve(config);
      } catch (parseError) {
        reject(new Error(\`Invalid config format: \${parseError.message}\`));
      }
    });
  });
}`,
      tokens: 160
    },
    {
      task: 'Add TypeScript types to JavaScript object',
      input: `const config = {
  port: 3000,
  host: 'localhost',
  features: ['auth', 'api', 'websocket']
};`,
      output: `interface ServerConfig {
  port: number;
  host: string;
  features: readonly string[];
}

const config: ServerConfig = {
  port: 3000,
  host: 'localhost',
  features: ['auth', 'api', 'websocket'] as const
};`,
      tokens: 120
    }
  ],
  totalTokens: 460
};

/**
 * Debugging examples
 */
export const DEBUGGING_EXAMPLES: ExampleSet = {
  description: 'Root cause analysis patterns',
  examples: [
    {
      task: 'Identify null reference error',
      input: `Error: Cannot read property 'name' of undefined
  at UserProfile.render (profile.tsx:45)
  at Component.mount (react.js:234)
  
Context: User logged in successfully but profile page crashes`,
      output: `## Root Cause
User object is undefined when profile component tries to access user.name

## Evidence
- Error occurs at profile.tsx:45 where user.name is accessed
- User login succeeds, suggesting auth works
- Likely the user data fetch failed or returned before completion

## Fix
Add null check before accessing user properties:
\`\`\`typescript
if (!user) {
  return <LoadingSpinner />;
}
return <div>{user.name}</div>;
\`\`\`

## Prevention
- Use optional chaining: user?.name
- Add loading states for async data
- Implement proper error boundaries`,
      tokens: 200
    },
    {
      task: 'Diagnose race condition',
      input: `Issue: Sometimes the form submits with old data
Logs show:
[10:23:45.123] Form state updated: {name: "New"}
[10:23:45.125] Submit clicked
[10:23:45.124] Form submitted: {name: "Old"}`,
      output: `## Root Cause
Race condition: submit handler captures stale state closure before state update completes

## Evidence
- Timestamp 10:23:45.124 (submit) is BEFORE 10:23:45.125 (click)
- This indicates async state update hasn't propagated
- Classic React stale closure issue

## Fix
Use ref or callback to get latest state:
\`\`\`typescript
const latestState = useRef(formState);
useEffect(() => { latestState.current = formState; }, [formState]);

const handleSubmit = () => {
  submitForm(latestState.current);
};
\`\`\`

## Prevention
- Use functional state updates: setState(prev => ...)
- Avoid capturing state in closures
- Consider useReducer for complex state`,
      tokens: 220
    }
  ],
  totalTokens: 420
};

/**
 * Refactoring examples
 */
export const REFACTORING_EXAMPLES: ExampleSet = {
  description: 'Safe refactoring patterns',
  examples: [
    {
      task: 'Extract reusable hook',
      input: `function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <Spinner />;
  if (error) return <Error />;
  return <div>{user.name}</div>;
}`,
      output: `// hooks/useUser.ts
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  return { user, loading, error };
}

// components/UserProfile.tsx
function UserProfile() {
  const { user, loading, error } = useUser();
  
  if (loading) return <Spinner />;
  if (error) return <Error />;
  return <div>{user!.name}</div>;
}`,
      tokens: 240
    },
    {
      task: 'Replace prop drilling with context',
      input: `function App() {
  const [theme, setTheme] = useState('light');
  return <Layout theme={theme} setTheme={setTheme} />;
}

function Layout({ theme, setTheme }) {
  return <Header theme={theme} setTheme={setTheme} />;
}

function Header({ theme, setTheme }) {
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
    {theme}
  </button>;
}`,
      output: `// context/ThemeContext.tsx
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

// App.tsx
function App() {
  return (
    <ThemeProvider>
      <Layout />
    </ThemeProvider>
  );
}

function Layout() {
  return <Header />;
}

function Header() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}`,
      tokens: 280
    }
  ],
  totalTokens: 520
};

/**
 * Select relevant examples based on task type and available token budget
 */
export function selectExamples(
  taskType: 'code_generation' | 'debugging' | 'refactoring',
  maxTokens: number = 500
): Example[] {
  const exampleSets = {
    code_generation: CODE_GENERATION_EXAMPLES,
    debugging: DEBUGGING_EXAMPLES,
    refactoring: REFACTORING_EXAMPLES,
  };

  const set = exampleSets[taskType];
  const selected: Example[] = [];
  let tokenCount = 0;

  // Greedily select examples until budget is exhausted
  for (const example of set.examples) {
    if (tokenCount + example.tokens <= maxTokens) {
      selected.push(example);
      tokenCount += example.tokens;
    }
  }

  return selected;
}

/**
 * Format examples for inclusion in prompt
 */
export function formatExamples(examples: Example[]): string {
  if (examples.length === 0) return '';

  const formatted = examples
    .map((ex, i) => {
      return `### Example ${i + 1}: ${ex.task}

Input:
\`\`\`
${ex.input}
\`\`\`

Expected Output:
\`\`\`
${ex.output}
\`\`\``;
    })
    .join('\n\n');

  return `# Few-Shot Examples\n\n${formatted}\n\n# Now complete the user's task following these patterns:\n`;
}

/**
 * Get example statistics
 */
export function getExampleStats() {
  return {
    code_generation: {
      count: CODE_GENERATION_EXAMPLES.examples.length,
      tokens: CODE_GENERATION_EXAMPLES.totalTokens,
    },
    debugging: {
      count: DEBUGGING_EXAMPLES.examples.length,
      tokens: DEBUGGING_EXAMPLES.totalTokens,
    },
    refactoring: {
      count: REFACTORING_EXAMPLES.examples.length,
      tokens: REFACTORING_EXAMPLES.totalTokens,
    },
  };
}
