/**
 * Realistic benchmarks for simple-minifier.
 * Measures actual token savings, quality impact, and performance.
 */

import { minifyCode } from '../simple-minifier';

// Approximate token counter (4 chars ≈ 1 token)
const countTokens = (text: string): number => Math.ceil(text.length / 4);

describe('Minifier Benchmarks', () => {
  describe('Token Savings (Real)', () => {
    it('TypeScript: Service class with comments', () => {
      const code = `
/**
 * User authentication service
 */
export class AuthService {
  private readonly db: Database;
  private readonly jwt: JWTService;

  /**
   * Initialize the auth service
   */
  constructor(db: Database, jwt: JWTService) {
    this.db = db;
    this.jwt = jwt;
  }

  /**
   * Authenticate user with email and password
   * @param email - User email address
   * @param password - User password
   * @returns JWT token
   */
  async login(email: string, password: string): Promise<string> {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Invalid credentials');
    }

    // Find user in database
    const user = await this.db.users.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password hash
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid password');
    }

    // Generate JWT token
    return this.jwt.sign({ userId: user.id });
  }

  /**
   * Logout user and invalidate token
   */
  async logout(token: string): Promise<void> {
    // Add token to blacklist
    await this.db.blacklist.insert({ token, expiresAt: new Date() });
  }
}
      `;

      const result = minifyCode(code, 'typescript');
      const originalTokens = countTokens(code);
      const minifiedTokens = countTokens(result.minified);
      const tokensSaved = originalTokens - minifiedTokens;
      const percentSaved = ((tokensSaved / originalTokens) * 100).toFixed(1);

      console.log('\n📊 TypeScript Service Class:');
      console.log(`   Original: ${originalTokens} tokens`);
      console.log(`   Minified: ${minifiedTokens} tokens`);
      console.log(`   Saved: ${tokensSaved} tokens (${percentSaved}%)`);

      // Realistic expectation: 20-35% savings
      expect(tokensSaved).toBeGreaterThan(originalTokens * 0.20);
      expect(tokensSaved).toBeLessThan(originalTokens * 0.40);
    });

    it('Python: Data processing script', () => {
      const code = `
# Data processing utilities for user analytics

import pandas as pd
from typing import List, Dict

class UserAnalytics:
    """
    Process and analyze user behavior data.
    Provides aggregation and reporting functions.
    """
    
    def __init__(self, data_path: str):
        """Initialize with data file path."""
        self.data = pd.read_csv(data_path)
    
    def aggregate_by_day(self) -> pd.DataFrame:
        """
        Aggregate user events by day.
        Returns a DataFrame with daily counts.
        """
        # Group by date
        daily = self.data.groupby('date').size()
        
        # Calculate rolling average
        rolling = daily.rolling(window=7).mean()
        
        return pd.DataFrame({
            'daily_count': daily,
            'rolling_avg': rolling
        })
    
    def get_top_users(self, n: int = 10) -> List[Dict]:
        """
        Get the top N most active users.
        Returns list of user dictionaries.
        """
        # Count events per user
        user_counts = self.data.groupby('user_id').size()
        
        # Get top N
        top_users = user_counts.nlargest(n)
        
        # Format results
        return [
            {'user_id': user_id, 'event_count': count}
            for user_id, count in top_users.items()
        ]
      `;

      const result = minifyCode(code, 'python');
      const originalTokens = countTokens(code);
      const minifiedTokens = countTokens(result.minified);
      const tokensSaved = originalTokens - minifiedTokens;
      const percentSaved = ((tokensSaved / originalTokens) * 100).toFixed(1);

      console.log('\n📊 Python Data Processing:');
      console.log(`   Original: ${originalTokens} tokens`);
      console.log(`   Minified: ${minifiedTokens} tokens`);
      console.log(`   Saved: ${tokensSaved} tokens (${percentSaved}%)`);

      // Realistic expectation: 25-50% savings (more docstrings)
      expect(tokensSaved).toBeGreaterThan(originalTokens * 0.25);
      expect(tokensSaved).toBeLessThan(originalTokens * 0.50);
    });

    it('Rust: System module', () => {
      const code = `
/// File system operations module
use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

/// Represents a file operation result
pub type Result<T> = std::result::Result<T, io::Error>;

/// File handler for reading and writing operations
pub struct FileHandler {
    path: String,
}

impl FileHandler {
    /// Create a new file handler for the given path
    pub fn new(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
        }
    }

    /// Read the entire file contents
    /// 
    /// # Errors
    /// Returns error if file cannot be read
    pub fn read(&self) -> Result<String> {
        // Open file
        let mut file = fs::File::open(&self.path)?;
        
        // Read contents
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        
        Ok(contents)
    }

    /// Write data to file, creating it if needed
    /// 
    /// # Errors
    /// Returns error if file cannot be written
    pub fn write(&self, data: &str) -> Result<()> {
        // Create or truncate file
        let mut file = fs::File::create(&self.path)?;
        
        // Write data
        file.write_all(data.as_bytes())?;
        
        Ok(())
    }
}
      `;

      const result = minifyCode(code, 'rust');
      const originalTokens = countTokens(code);
      const minifiedTokens = countTokens(result.minified);
      const tokensSaved = originalTokens - minifiedTokens;
      const percentSaved = ((tokensSaved / originalTokens) * 100).toFixed(1);

      console.log('\n📊 Rust System Module:');
      console.log(`   Original: ${originalTokens} tokens`);
      console.log(`   Minified: ${minifiedTokens} tokens`);
      console.log(`   Saved: ${tokensSaved} tokens (${percentSaved}%)`);

      // Realistic expectation: 20-45% savings
      expect(tokensSaved).toBeGreaterThan(originalTokens * 0.20);
      expect(tokensSaved).toBeLessThan(originalTokens * 0.50);
    });
  });

  describe('Quality Impact (A/B Comparison)', () => {
    it('should preserve all type information', () => {
      const code = `
        // Generic API response wrapper
        interface ApiResponse<T> {
          data: T;
          meta: {
            timestamp: number;
            requestId: string;
          };
        }

        // Fetch user data from API
        async function fetchUser(id: string): Promise<ApiResponse<User>> {
          const response = await fetch(\`/api/users/\${id}\`);
          return response.json();
        }
      `;

      const result = minifyCode(code, 'typescript');

      // All type annotations must be present
      expect(result.minified).toContain('interface ApiResponse<T>');
      expect(result.minified).toContain('data: T');
      expect(result.minified).toContain('timestamp: number');
      expect(result.minified).toContain('Promise<ApiResponse<User>>');
      expect(result.minified).toContain('id: string');
    });

    it('should preserve function logic completely', () => {
      const code = `
        // Binary search implementation
        function binarySearch(arr: number[], target: number): number {
          let left = 0;
          let right = arr.length - 1;

          // Search loop
          while (left <= right) {
            const mid = Math.floor((left + right) / 2);

            if (arr[mid] === target) {
              return mid; // Found
            } else if (arr[mid] < target) {
              left = mid + 1; // Search right
            } else {
              right = mid - 1; // Search left
            }
          }

          return -1; // Not found
        }
      `;

      const result = minifyCode(code, 'typescript');

      // All logic operators and control flow preserved
      expect(result.minified).toContain('while (left <= right)');
      expect(result.minified).toContain('Math.floor((left + right) / 2)');
      expect(result.minified).toContain('arr[mid] === target');
      expect(result.minified).toContain('left = mid + 1');
      expect(result.minified).toContain('return -1');
    });

    it('should maintain readability of minified code', () => {
      const code = `
        // User validation utilities
        export const validators = {
          // Email validation
          email: (value: string) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value),
          
          // Password strength check
          password: (value: string) => value.length >= 8 && /[A-Z]/.test(value),
          
          // Username format
          username: (value: string) => /^[a-zA-Z0-9_]{3,20}$/.test(value),
        };
      `;

      const result = minifyCode(code, 'typescript');

      // Should still be readable (not a compressed blob)
      const lines = result.minified.split('\n');
      expect(lines.length).toBeGreaterThan(5); // Not collapsed to one line
      expect(result.minified).toContain('export const validators');
      expect(result.minified).toMatch(/email.*value: string/);
    });
  });

  describe('Performance Overhead', () => {
    it('should minify small files quickly (<10ms)', () => {
      const smallCode = `
        // Small utility file
        export function add(a: number, b: number): number {
          return a + b;
        }
      `.repeat(10);

      const start = performance.now();
      minifyCode(smallCode, 'typescript');
      const duration = performance.now() - start;

      console.log(`\n⚡ Small file (${smallCode.length} chars): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
    });

    it('should minify medium files reasonably fast (<50ms)', () => {
      const mediumCode = `
        /**
         * Complex service with multiple methods
         */
        export class DataService {
          private cache = new Map();

          async fetchData(id: string): Promise<Data> {
            // Check cache first
            if (this.cache.has(id)) {
              return this.cache.get(id);
            }

            // Fetch from API
            const response = await fetch(\`/api/data/\${id}\`);
            const data = await response.json();

            // Store in cache
            this.cache.set(id, data);

            return data;
          }
        }
      `.repeat(20);

      const start = performance.now();
      minifyCode(mediumCode, 'typescript');
      const duration = performance.now() - start;

      console.log(`⚡ Medium file (${mediumCode.length} chars): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('should handle large files without timeout (<200ms)', () => {
      const largeCode = `
        // Large codebase file
        export class LargeService {
          method1() { return 1; }
          method2() { return 2; }
          method3() { return 3; }
          // ... many more methods
        }
      `.repeat(100);

      const start = performance.now();
      minifyCode(largeCode, 'typescript');
      const duration = performance.now() - start;

      console.log(`⚡ Large file (${largeCode.length} chars): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Comparison: With vs Without Minification', () => {
    it('should demonstrate clear token savings advantage', () => {
      const testFiles = [
        {
          name: 'auth.ts',
          code: `
            // Authentication service
            export class AuthService {
              // Login method
              async login(email: string, password: string) {
                return this.jwt.sign({ email });
              }
            }
          `.repeat(5),
        },
        {
          name: 'utils.py',
          code: `
            # Utility functions
            def process_data(items):
                """Process a list of items."""
                # Filter valid items
                return [x for x in items if x.is_valid()]
          `.repeat(5),
        },
        {
          name: 'handler.rs',
          code: `
            /// Request handler
            pub fn handle(req: Request) -> Response {
                // Parse request
                let data = req.parse();
                // Process
                Response::ok(data)
            }
          `.repeat(5),
        },
      ];

      console.log('\n📈 With vs Without Minification:');
      console.log('─'.repeat(60));

      let totalOriginal = 0;
      let totalMinified = 0;

      for (const file of testFiles) {
        const lang = file.name.split('.').pop()!;
        const langMap: Record<string, string> = {
          ts: 'typescript',
          py: 'python',
          rs: 'rust',
        };

        const result = minifyCode(file.code, langMap[lang]);
        const originalTokens = countTokens(file.code);
        const minifiedTokens = countTokens(result.minified);

        totalOriginal += originalTokens;
        totalMinified += minifiedTokens;

        const saved = originalTokens - minifiedTokens;
        const percent = ((saved / originalTokens) * 100).toFixed(1);

        console.log(`${file.name}:`);
        console.log(`  Without: ${originalTokens} tokens`);
        console.log(`  With:    ${minifiedTokens} tokens`);
        console.log(`  Saved:   ${saved} tokens (${percent}%)`);
      }

      const totalSaved = totalOriginal - totalMinified;
      const totalPercent = ((totalSaved / totalOriginal) * 100).toFixed(1);

      console.log('─'.repeat(60));
      console.log(`Total:`);
      console.log(`  Without: ${totalOriginal} tokens`);
      console.log(`  With:    ${totalMinified} tokens`);
      console.log(`  Saved:   ${totalSaved} tokens (${totalPercent}%)`);
      console.log('─'.repeat(60));

      // Should save meaningful tokens overall
      expect(totalSaved).toBeGreaterThan(totalOriginal * 0.20);
    });
  });
});
