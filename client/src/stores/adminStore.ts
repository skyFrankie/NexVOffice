import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  avatar: string
  role: 'admin' | 'member'
  isActive: boolean
  createdAt: string
}

export interface OfficeSetting {
  id: string
  key: string
  value: unknown
  updatedAt: string
}

interface AdminState {
  users: AdminUser[]
  settings: OfficeSetting[]
  loading: boolean
  activeTab: string
}

const initialState: AdminState = {
  users: [],
  settings: [],
  loading: false,
  activeTab: 'dashboard',
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nexvoffice_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const API_BASE = `${window.location.protocol}//${window.location.host}`

export const fetchUsers = createAsyncThunk('admin/fetchUsers', async () => {
  const res = await fetch(`${API_BASE}/api/users`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error('Failed to fetch users')
  return (await res.json()) as AdminUser[]
})

export const fetchSettings = createAsyncThunk('admin/fetchSettings', async () => {
  const res = await fetch(`${API_BASE}/api/settings`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return (await res.json()) as OfficeSetting[]
})

export const updateSetting = createAsyncThunk(
  'admin/updateSetting',
  async ({ key, value }: { key: string; value: unknown }) => {
    const res = await fetch(`${API_BASE}/api/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error('Failed to update setting')
    return (await res.json()) as OfficeSetting
  }
)

export const deleteSetting = createAsyncThunk('admin/deleteSetting', async (key: string) => {
  const res = await fetch(`${API_BASE}/api/settings/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete setting')
  return key
})

export const createUser = createAsyncThunk(
  'admin/createUser',
  async (payload: { username: string; password: string; displayName: string; avatar?: string; role?: 'admin' | 'member' }) => {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create user' }))
      throw new Error(err.error || 'Failed to create user')
    }
    return (await res.json()) as AdminUser
  }
)

export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ id, ...fields }: { id: string; displayName?: string; avatar?: string; role?: 'admin' | 'member'; password?: string; isActive?: boolean }) => {
    const res = await fetch(`${API_BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(fields),
    })
    if (!res.ok) throw new Error('Failed to update user')
    return (await res.json()) as AdminUser
  }
)

export const deactivateUser = createAsyncThunk('admin/deactivateUser', async (id: string) => {
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to deactivate user')
  return id
})

export const reactivateUser = createAsyncThunk('admin/reactivateUser', async (id: string) => {
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive: true }),
  })
  if (!res.ok) throw new Error('Failed to reactivate user')
  return id
})

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.loading = true })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload
      })
      .addCase(fetchUsers.rejected, (state) => { state.loading = false })
      .addCase(fetchSettings.pending, (state) => { state.loading = true })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = action.payload
      })
      .addCase(fetchSettings.rejected, (state) => { state.loading = false })
      .addCase(updateSetting.fulfilled, (state, action) => {
        const idx = state.settings.findIndex((s) => s.key === action.payload.key)
        if (idx >= 0) {
          state.settings[idx] = action.payload
        } else {
          state.settings.push(action.payload)
        }
      })
      .addCase(deleteSetting.fulfilled, (state, action) => {
        state.settings = state.settings.filter((s) => s.key !== action.payload)
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.push(action.payload)
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        const idx = state.users.findIndex((u) => u.id === action.payload.id)
        if (idx >= 0) {
          state.users[idx] = action.payload
        }
      })
      .addCase(deactivateUser.fulfilled, (state, action) => {
        const user = state.users.find((u) => u.id === action.payload)
        if (user) user.isActive = false
      })
      .addCase(reactivateUser.fulfilled, (state, action) => {
        const user = state.users.find((u) => u.id === action.payload)
        if (user) user.isActive = true
      })
  },
})

export const { setActiveTab } = adminSlice.actions
export default adminSlice.reducer
