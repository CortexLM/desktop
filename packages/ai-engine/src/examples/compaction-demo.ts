/**
 * Example: Simple code minification
 */

import { minifyCode } from '../compaction';

async function minificationExample() {
  // Large code context with comments
  const codeWithComments = `
    // User dashboard component
    import { Component } from 'react';
    
    /**
     * Main dashboard component for user management
     */
    export class UserDashboard extends Component {
      constructor(props) {
        super(props);
        // Initialize state
        this.state = {
          users: [],
          loading: true,
        };
      }
      
      // Lifecycle method
      componentDidMount() {
        // Fetch users on mount
        this.fetchUsers();
      }
      
      // Fetch users from API
      async fetchUsers() {
        try {
          const response = await fetch('/api/users');
          const data = await response.json();
          this.setState({ users: data, loading: false });
        } catch (error) {
          console.error('Failed to fetch users:', error);
        }
      }
    }
  `.repeat(50);

  // Approximate token counter (4 chars ≈ 1 token)
  const countTokens = (text: string) => Math.ceil(text.length / 4);

  const originalTokens = countTokens(codeWithComments);
  
  console.log(`Original: ${originalTokens.toLocaleString()} tokens`);
  console.log(`Size: ${codeWithComments.length.toLocaleString()} bytes\n`);

  // Minify the code
  const result = minifyCode(codeWithComments, 'typescript');

  const minifiedTokens = countTokens(result.minified);
  const tokensSaved = originalTokens - minifiedTokens;

  console.log('Minification Result:');
  console.log(`  Minified: ${minifiedTokens.toLocaleString()} tokens`);
  console.log(`  Saved: ${tokensSaved.toLocaleString()} tokens (${((tokensSaved / originalTokens) * 100).toFixed(1)}%)`);
  console.log(`  Ratio: ${result.ratio.toFixed(2)}x`);
  console.log(`  Bytes saved: ${result.bytesaved.toLocaleString()}`);

  console.log('\nMinified Preview:');
  console.log(result.minified.substring(0, 500) + '...');
}

minificationExample().catch(console.error);
