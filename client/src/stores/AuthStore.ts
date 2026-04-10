import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthUser {
  id: string
  username: string
  displayName: string
  avatar: string
  role: 'admin' | 'member'
  mustChangePassword: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  loginError: string | null
  isLoading: boolean
}

const savedToken = typeof window !== 'undefined' ? localStorage.getItem('nexvoffice_token') : null
const savedUser = typeof window !== 'undefined' ? localStorage.getItem('nexvoffice_user') : null

const initialState: AuthState = {
  user: savedUser ? JSON.parse(savedUser) : null,
  token: savedToken,
  isAuthenticated: !!savedToken,
  isAdmin: savedUser ? JSON.parse(savedUser).role === 'admin' : false,
  loginError: null,
  isLoading: false,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true
      state.loginError = null
    },
    loginSuccess: (state, action: PayloadAction<{ user: AuthUser; token: string }>) => {
      const { user, token } = action.payload
      state.user = user
      state.token = token
      state.isAuthenticated = true
      state.isAdmin = user.role === 'admin'
      state.isLoading = false
      state.loginError = null
      localStorage.setItem('nexvoffice_token', token)
      localStorage.setItem('nexvoffice_user', JSON.stringify(user))
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false
      state.loginError = action.payload
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.isAdmin = false
      state.loginError = null
      localStorage.removeItem('nexvoffice_token')
      localStorage.removeItem('nexvoffice_user')
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        state.isAdmin = state.user.role === 'admin'
        localStorage.setItem('nexvoffice_user', JSON.stringify(state.user))
      }
    },
    clearMustChangePassword: (state) => {
      if (state.user) {
        state.user.mustChangePassword = false
        localStorage.setItem('nexvoffice_user', JSON.stringify(state.user))
      }
    },
  },
})

export const { loginStart, loginSuccess, loginFailure, logout, updateUser, clearMustChangePassword } =
  authSlice.actions
export default authSlice.reducer
