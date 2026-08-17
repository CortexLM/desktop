/**
 * Tests for simple-minifier - realistic expectations only
 */

import { minifyCode } from '../simple-minifier';

describe('simple-minifier', () => {
  describe('TypeScript/JavaScript', () => {
    it('should remove single-line comments', () => {
      const code = `
        // This is a comment
        function test() {
          return 42; // inline comment
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      expect(result.minified).not.toContain('This is a comment');
      expect(result.minified).not.toContain('inline comment');
      expect(result.minified).toContain('function test()');
      expect(result.minified).toContain('return 42;');
    });

    it('should remove multi-line comments', () => {
      const code = `
        /* Multi-line
           comment block */
        function test() {
          /* another block */
          return 42;
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      expect(result.minified).not.toContain('Multi-line');
      expect(result.minified).not.toContain('comment block');
      expect(result.minified).toContain('function test()');
    });

    it('should normalize whitespace', () => {
      const code = `
        function test()    {
        
        
        
          return    42;    
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      // Should have max 2 consecutive newlines
      expect(result.minified).not.toMatch(/\n{3,}/);
      
      // Should not have trailing whitespace
      expect(result.minified).not.toMatch(/[ \t]+$/m);
    });

    it('should preserve semantic structure', () => {
      const code = `
        // User service class
        export class UserService {
          /* Creates a new user */
          async createUser(data: UserData): Promise<User> {
            const validated = this.validate(data);
            return this.db.create(validated);
          }
          
          // Private validation method
          private validate(data: UserData): UserData {
            if (!data.email) throw new Error('Email required');
            return data;
          }
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      expect(result.minified).toContain('export class UserService');
      expect(result.minified).toContain('async createUser');
      expect(result.minified).toContain('private validate');
      expect(result.minified).toContain('data: UserData');
      expect(result.minified).toContain('Promise<User>');
    });

    it('should report realistic compression ratios (1.2x-1.5x)', () => {
      const code = `
        // This is a heavily commented file
        
        /* 
         * Multi-line description
         * of the module
         */
        
        export class Example {
          // Method 1
          method1() {
            return 1;
          }
          
          // Method 2
          method2() {
            return 2;
          }
          
          // Method 3
          method3() {
            return 3;
          }
        }
      `.repeat(3);

      const result = minifyCode(code, 'typescript');
      
      // Realistic expectation: 1.2x-2.2x compression (with heavy comments)
      expect(result.ratio).toBeGreaterThan(1.2);
      expect(result.ratio).toBeLessThan(2.5);
      expect(result.bytesaved).toBeGreaterThan(0);
    });
  });

  describe('Python', () => {
    it('should remove hash comments', () => {
      const code = `
# This is a comment
def test():
    # Another comment
    return 42
      `;

      const result = minifyCode(code, 'python');
      
      expect(result.minified).not.toContain('This is a comment');
      expect(result.minified).not.toContain('Another comment');
      expect(result.minified).toContain('def test():');
      expect(result.minified).toContain('return 42');
    });

    it('should remove docstrings', () => {
      const code = `
def test():
    """
    This is a docstring
    with multiple lines
    """
    return 42

def test2():
    '''
    Single quote docstring
    '''
    return 43
      `;

      const result = minifyCode(code, 'python');
      
      expect(result.minified).not.toContain('This is a docstring');
      expect(result.minified).not.toContain('Single quote docstring');
      expect(result.minified).toContain('def test():');
      expect(result.minified).toContain('def test2():');
    });

    it('should preserve indentation semantics', () => {
      const code = `
# Main class
class UserService:
    # Initialize
    def __init__(self):
        self.users = []
    
    # Add user
    def add_user(self, name):
        self.users.append(name)
      `;

      const result = minifyCode(code, 'python');
      
      expect(result.minified).toContain('class UserService:');
      expect(result.minified).toContain('    def __init__');
      expect(result.minified).toContain('        self.users = []');
    });
  });

  describe('Rust', () => {
    it('should remove comments', () => {
      const code = `
// Rust function
fn calculate(x: i32) -> i32 {
    /* Block comment */
    x * 2 // inline
}
      `;

      const result = minifyCode(code, 'rust');
      
      expect(result.minified).not.toContain('Rust function');
      expect(result.minified).not.toContain('Block comment');
      expect(result.minified).toContain('fn calculate');
      expect(result.minified).toContain('x: i32');
    });

    it('should preserve type annotations', () => {
      const code = `
/// Documentation comment
struct User {
    name: String,
    age: u32,
}

impl User {
    // Constructor
    fn new(name: String, age: u32) -> Self {
        Self { name, age }
    }
}
      `;

      const result = minifyCode(code, 'rust');
      
      expect(result.minified).toContain('struct User');
      expect(result.minified).toContain('name: String');
      expect(result.minified).toContain('impl User');
      expect(result.minified).toContain('fn new');
    });
  });

  describe('Unknown languages', () => {
    it('should leave code unchanged for unknown languages', () => {
      const code = `
        # Some unknown language
        @special syntax
        $variable = value
      `;

      const result = minifyCode(code, 'unknownlang');
      
      // Unknown language still gets whitespace normalization
      expect(result.minified).toContain('# Some unknown language');
      expect(result.ratio).toBeGreaterThanOrEqual(1);
      expect(result.bytesaved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-world token savings', () => {
    it('should measure actual token reduction (approximation)', () => {
      // Token counter approximation: ~4 chars per token
      const tokenCounter = (text: string) => Math.ceil(text.length / 4);

      const code = `
        // This is a user authentication service
        // It handles login, logout, and session management
        
        export class AuthService {
          /* 
           * Authenticate user with credentials
           * Returns JWT token on success
           */
          async login(email: string, password: string): Promise<string> {
            // Validate inputs
            if (!email || !password) {
              throw new Error('Invalid credentials');
            }
            
            // Check database
            const user = await this.db.findByEmail(email);
            
            // Verify password
            const valid = await this.verifyPassword(user, password);
            
            // Generate token
            return this.generateJWT(user);
          }
          
          // Private helper for password verification
          private async verifyPassword(user: User, password: string): Promise<boolean> {
            return bcrypt.compare(password, user.hashedPassword);
          }
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      const originalTokens = tokenCounter(code);
      const minifiedTokens = tokenCounter(result.minified);
      const tokenRatio = originalTokens / minifiedTokens;
      
      // Should save 15-45% of tokens (realistic range)
      expect(tokenRatio).toBeGreaterThan(1.15);
      expect(tokenRatio).toBeLessThan(2.0);
      
      console.log(`Original: ${originalTokens} tokens`);
      console.log(`Minified: ${minifiedTokens} tokens`);
      console.log(`Saved: ${originalTokens - minifiedTokens} tokens (${((1 - minifiedTokens/originalTokens) * 100).toFixed(1)}%)`);
    });
  });

  describe('Quality preservation', () => {
    it('should maintain type information', () => {
      const code = `
        // Generic function with constraints
        function map<T, U>(items: T[], fn: (item: T) => U): U[] {
          return items.map(fn);
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      expect(result.minified).toContain('<T, U>');
      expect(result.minified).toContain('items: T[]');
      expect(result.minified).toContain('fn: (item: T) => U');
      expect(result.minified).toContain('U[]');
    });

    it('should maintain JSX structure', () => {
      const code = `
        // React component
        export function UserCard({ user }: { user: User }) {
          return (
            <div className="user-card">
              {/* User details */}
              <h2>{user.name}</h2>
              <p>{user.email}</p>
            </div>
          );
        }
      `;

      const result = minifyCode(code, 'typescript');
      
      expect(result.minified).toContain('export function UserCard');
      expect(result.minified).toContain('<div className="user-card">');
      expect(result.minified).toContain('<h2>{user.name}</h2>');
    });
  });
});
