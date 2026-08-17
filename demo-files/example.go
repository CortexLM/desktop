package main

import (
	"fmt"
	"time"
)

// UserRole represents the role of a user
type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
	RoleGuest UserRole = "guest"
)

// User represents a user in the system
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// UserService manages user operations
type UserService struct {
	users map[string]*User
}

// NewUserService creates a new UserService
func NewUserService() *UserService {
	service := &UserService{
		users: make(map[string]*User),
	}
	service.initializeDefaultUsers()
	return service
}

func (s *UserService) initializeDefaultUsers() {
	defaultUser := &User{
		ID:        "1",
		Name:      "John Doe",
		Email:     "john@example.com",
		Role:      RoleAdmin,
		CreatedAt: time.Now(),
	}
	s.users[defaultUser.ID] = defaultUser
}

// GetUser retrieves a user by ID
func (s *UserService) GetUser(id string) (*User, error) {
	user, exists := s.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found: %s", id)
	}
	return user, nil
}

// CreateUser creates a new user
func (s *UserService) CreateUser(name, email string, role UserRole) (*User, error) {
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	
	newUser := &User{
		ID:        id,
		Name:      name,
		Email:     email,
		Role:      role,
		CreatedAt: time.Now(),
	}
	
	s.users[newUser.ID] = newUser
	return newUser, nil
}

// UpdateUser updates user fields
func (s *UserService) UpdateUser(id string, updates map[string]interface{}) (*User, error) {
	user, err := s.GetUser(id)
	if err != nil {
		return nil, err
	}
	
	if name, ok := updates["name"].(string); ok {
		user.Name = name
	}
	if email, ok := updates["email"].(string); ok {
		user.Email = email
	}
	if role, ok := updates["role"].(UserRole); ok {
		user.Role = role
	}
	
	return user, nil
}

// DeleteUser removes a user by ID
func (s *UserService) DeleteUser(id string) error {
	if _, exists := s.users[id]; !exists {
		return fmt.Errorf("user not found: %s", id)
	}
	delete(s.users, id)
	return nil
}

// ListUsers returns all users, optionally filtered by role
func (s *UserService) ListUsers(role *UserRole) []*User {
	var result []*User
	
	for _, user := range s.users {
		if role == nil || user.Role == *role {
			result = append(result, user)
		}
	}
	
	return result
}

func main() {
	service := NewUserService()
	
	// Create a new user
	newUser, _ := service.CreateUser("Jane Smith", "jane@example.com", RoleUser)
	fmt.Printf("Created user: %+v\n", newUser)
	
	// Get user by ID
	user, _ := service.GetUser(newUser.ID)
	fmt.Printf("Retrieved user: %+v\n", user)
	
	// Update user
	updates := map[string]interface{}{
		"role": RoleAdmin,
	}
	updated, _ := service.UpdateUser(newUser.ID, updates)
	fmt.Printf("Updated user: %+v\n", updated)
	
	// List all admins
	adminRole := RoleAdmin
	admins := service.ListUsers(&adminRole)
	fmt.Printf("All admins: %+v\n", admins)
}
