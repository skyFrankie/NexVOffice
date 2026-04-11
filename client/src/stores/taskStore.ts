import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './index'

export interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  assignedTo: string
  createdBy: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  id: string
  userId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  endTime: string
  label: string
}

interface TaskState {
  tasks: Task[]
  schedules: Schedule[]
  loading: boolean
  selectedTab: 'my' | 'team'
}

const initialState: TaskState = {
  tasks: [],
  schedules: [],
  loading: false,
  selectedTab: 'my',
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nexvoffice_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const API_BASE = `${window.location.protocol}//${window.location.host}`

export const fetchTasks = createAsyncThunk('tasks/fetchTasks', async () => {
  const res = await fetch(`${API_BASE}/api/tasks`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json() as { tasks: Task[] }
  return data.tasks
})

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create task')
    const result = await res.json() as { task: Task }
    return result.task
  }
)

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ id, ...fields }: Partial<Task> & { id: string }) => {
    const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(fields),
    })
    if (!res.ok) throw new Error('Failed to update task')
    const result = await res.json() as { task: Task }
    return result.task
  }
)

export const deleteTask = createAsyncThunk('tasks/deleteTask', async (id: string) => {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete task')
  return id
})

export const fetchSchedules = createAsyncThunk('tasks/fetchSchedules', async () => {
  const res = await fetch(`${API_BASE}/api/tasks/schedules`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error('Failed to fetch schedules')
  const data = await res.json() as { schedules: Schedule[] }
  return data.schedules
})

export const createSchedule = createAsyncThunk(
  'tasks/createSchedule',
  async (data: Omit<Schedule, 'id'>) => {
    const res = await fetch(`${API_BASE}/api/tasks/schedules`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create schedule')
    const result = await res.json() as { schedule: Schedule }
    return result.schedule
  }
)

export const updateSchedule = createAsyncThunk(
  'tasks/updateSchedule',
  async ({ id, ...data }: Partial<Schedule> & { id: string }) => {
    const res = await fetch(`${API_BASE}/api/tasks/schedules/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update schedule')
    const result = await res.json() as { schedule: Schedule }
    return result.schedule
  }
)

export const deleteSchedule = createAsyncThunk('tasks/deleteSchedule', async (id: string) => {
  const res = await fetch(`${API_BASE}/api/tasks/schedules/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete schedule')
  return id
})

export const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setSelectedTab: (state, action: PayloadAction<'my' | 'team'>) => {
      state.selectedTab = action.payload
    },
    // Real-time updates from Colyseus messages
    upsertTask: (state, action: PayloadAction<Task>) => {
      const idx = state.tasks.findIndex((t) => t.id === action.payload.id)
      if (idx >= 0) {
        state.tasks[idx] = action.payload
      } else {
        state.tasks.push(action.payload)
      }
    },
    patchTaskStatus: (
      state,
      action: PayloadAction<{ taskId: string; status: Task['status'] }>
    ) => {
      const task = state.tasks.find((t) => t.id === action.payload.taskId)
      if (task) task.status = action.payload.status
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false
        state.tasks = action.payload
      })
      .addCase(fetchTasks.rejected, (state) => {
        state.loading = false
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.tasks.push(action.payload)
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        const idx = state.tasks.findIndex((t) => t.id === action.payload.id)
        if (idx >= 0) state.tasks[idx] = action.payload
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter((t) => t.id !== action.payload)
      })
      .addCase(fetchSchedules.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.loading = false
        state.schedules = action.payload
      })
      .addCase(fetchSchedules.rejected, (state) => {
        state.loading = false
      })
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.schedules.push(action.payload)
      })
      .addCase(updateSchedule.fulfilled, (state, action) => {
        const idx = state.schedules.findIndex((s) => s.id === action.payload.id)
        if (idx >= 0) state.schedules[idx] = action.payload
      })
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s.id !== action.payload)
      })
  },
})

export const { setSelectedTab, upsertTask, patchTaskStatus } = taskSlice.actions
export default taskSlice.reducer
