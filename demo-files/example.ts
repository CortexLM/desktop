/**
 * Demo Test File - TypeScript Example
 * This file demonstrates the Monaco Editor integration
 */

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

class UserService {
  private users: Map<string, User> = new Map();

  constructor() {
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    const defaultUser: User = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      createdAt: new Date(),
    };
    
    this.users.set(defaultUser.id, defaultUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async listUsers(role?: User['role']): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    
    if (role) {
      return allUsers.filter(user => user.role === role);
    }
    
    return allUsers;
  }
}

// Example usage
const userService = new UserService();

async function demo() {
  // Create a new user
  const newUser = await userService.createUser({
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
  });

  console.log('Created user:', newUser);

  // Get user by ID
  const user = await userService.getUser(newUser.id);
  console.log('Retrieved user:', user);

  // Update user
  const updated = await userService.updateUser(newUser.id, {
    role: 'admin',
  });
  console.log('Updated user:', updated);

  // List all admins
  const admins = await userService.listUsers('admin');
  console.log('All admins:', admins);
}

demo().catch(console.error);

export { UserService, type User };
