'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { Role, User } from './types'
import { mockUsers } from './mock-data'

interface AppContextType {
  currentUser: User | null
  currentRole: Role
  setCurrentRole: (role: Role) => void
  setCurrentUser: (user: User | null) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentRole, setCurrentRole] = useState<Role>('student')

  // Initialize from localStorage
  useEffect(() => {
    const savedUserId = localStorage.getItem('currentUserId')
    const savedRole = localStorage.getItem('currentRole') as Role | null

    if (savedUserId) {
      const user = mockUsers.find((u) => u.id === savedUserId)
      if (user) {
        setCurrentUser(user)
        setCurrentRole(user.role)
      }
    } else if (savedRole) {
      setCurrentRole(savedRole)
      // Set a default user for the role
      const defaultUser = mockUsers.find((u) => u.role === savedRole)
      if (defaultUser) {
        setCurrentUser(defaultUser)
      }
    } else {
      // Default to first student
      const defaultStudent = mockUsers.find((u) => u.role === 'student')
      if (defaultStudent) {
        setCurrentUser(defaultStudent)
        setCurrentRole('student')
      }
    }
  }, [])

  // Save to localStorage when changed
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUserId', currentUser.id)
      localStorage.setItem('currentRole', currentUser.role)
    }
  }, [currentUser])

  const handleSetRole = (role: Role) => {
    setCurrentRole(role)
    // Find a user with the new role
    const user = mockUsers.find((u) => u.role === role)
    if (user) {
      setCurrentUser(user)
    }
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole,
        setCurrentRole: handleSetRole,
        setCurrentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
