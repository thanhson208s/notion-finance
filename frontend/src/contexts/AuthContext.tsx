/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_BASE } from '../App'
import { getToken, setToken, isTokenValid } from '../lib/auth'

type AuthState = 'authorizing' | 'authorized' | 'unauthorized'

const AuthContext = createContext<AuthState>('authorizing')

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('authorizing')

  useEffect(() => {
    async function init() {
      // 1. Check stored token
      const stored = getToken()
      if (stored && isTokenValid(stored)) {
        setState('authorized')
        return
      }

      // 2. Check URL hash for #auth=<secret>
      const hash = window.location.hash
      const match = hash.match(/[#&]auth=([^&]+)/)
      if (match) {
        const secret = decodeURIComponent(match[1])
        try {
          const res = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret }),
          })
          if (res.ok) {
            const { token } = await res.json()
            setToken(token)
            // Clean the secret from URL without adding to history                                    
            history.replaceState(null, '', window.location.pathname + window.location.search)
            setState('authorized')
            return
          }
        } catch {
          // fall through to unauthorized
        }
      }

      setState('unauthorized')
    }

    init()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
