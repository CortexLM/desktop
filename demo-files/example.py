"""
Demo Test File - Python Example
This file demonstrates Python syntax highlighting in Monaco Editor
"""

from typing import List, Optional, Dict
from datetime import datetime
from dataclasses import dataclass
from enum import Enum


class UserRole(Enum):
    """User role enumeration"""
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


@dataclass
class User:
    """User data class"""
    id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime


class UserRepository:
    """User repository with CRUD operations"""
    
    def __init__(self):
        self._users: Dict[str, User] = {}
        self._initialize_default_users()
    
    def _initialize_default_users(self) -> None:
        """Initialize with default users"""
        default_user = User(
            id="1",
            name="John Doe",
            email="john@example.com",
            role=UserRole.ADMIN,
            created_at=datetime.now()
        )
        self._users[default_user.id] = default_user
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self._users.get(user_id)
    
    async def create_user(
        self,
        name: str,
        email: str,
        role: UserRole = UserRole.USER
    ) -> User:
        """Create a new user"""
        import uuid
        
        new_user = User(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            role=role,
            created_at=datetime.now()
        )
        
        self._users[new_user.id] = new_user
        return new_user
    
    async def update_user(
        self,
        user_id: str,
        **kwargs
    ) -> Optional[User]:
        """Update user fields"""
        user = self._users.get(user_id)
        if not user:
            return None
        
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        return user
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete user by ID"""
        return self._users.pop(user_id, None) is not None
    
    async def list_users(
        self,
        role: Optional[UserRole] = None
    ) -> List[User]:
        """List all users, optionally filtered by role"""
        users = list(self._users.values())
        
        if role:
            users = [u for u in users if u.role == role]
        
        return users


async def demo():
    """Demo usage of UserRepository"""
    repo = UserRepository()
    
    # Create a new user
    new_user = await repo.create_user(
        name="Jane Smith",
        email="jane@example.com",
        role=UserRole.USER
    )
    print(f"Created user: {new_user}")
    
    # Get user by ID
    user = await repo.get_user(new_user.id)
    print(f"Retrieved user: {user}")
    
    # Update user
    updated = await repo.update_user(new_user.id, role=UserRole.ADMIN)
    print(f"Updated user: {updated}")
    
    # List all admins
    admins = await repo.list_users(role=UserRole.ADMIN)
    print(f"All admins: {admins}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(demo())
