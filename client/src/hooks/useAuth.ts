import { useSelector, useDispatch } from 'react-redux'
import { loginStart, loginSuccess, loginFailure, logout, clearMustChangePassword } from '../stores/AuthStore'
import { RootState } from '../stores'

const API_BASE = `${window.location.protocol}//${window.location.host}`

export function useAuth() {
  const dispatch = useDispatch()
  const auth = useSelector((state: RootState) => state.auth)

  const login = async (username: string, password: string) => {
    dispatch(loginStart())
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        dispatch(loginFailure(data.error || 'Login failed'))
        return false
      }
      dispatch(loginSuccess({ user: data.user, token: data.token }))
      return true
    } catch (err) {
      dispatch(loginFailure('Network error'))
      return false
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error || 'Failed to change password' }
      }
      dispatch(clearMustChangePassword())
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error' }
    }
  }

  const doLogout = () => {
    dispatch(logout())
  }

  return {
    ...auth,
    login,
    changePassword,
    logout: doLogout,
  }
}
