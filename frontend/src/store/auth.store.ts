import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '../lib/query-client'
import { clearOperationKeys } from '../lib/operation-key'

interface AuthState {
  token: string | null
  user: { id: string; name: string; email: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        queryClient.clear()
        clearOperationKeys()
        set({ token, user })
      },
      logout: () => {
        queryClient.clear()
        clearOperationKeys()
        set({ token: null, user: null })
      },
    }),
    { name: 'ctlab-auth' },
  ),
)
