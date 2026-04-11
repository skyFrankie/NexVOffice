import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../stores'
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  setSelectedTab,
  Task,
  Schedule,
} from '../stores/taskStore'

export function useTasks() {
  const dispatch = useDispatch<AppDispatch>()
  const { tasks, schedules, loading, selectedTab } = useSelector(
    (state: RootState) => state.tasks
  )
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id)

  const myTasks = tasks.filter((t) => t.assignedTo === currentUserId)
  const teamTasks = tasks

  return {
    tasks,
    myTasks,
    teamTasks,
    schedules,
    loading,
    selectedTab,
    currentUserId,
    fetchTasks: () => dispatch(fetchTasks()),
    createTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
      dispatch(createTask(data)),
    updateTask: (data: Partial<Task> & { id: string }) => dispatch(updateTask(data)),
    deleteTask: (id: string) => dispatch(deleteTask(id)),
    fetchSchedules: () => dispatch(fetchSchedules()),
    createSchedule: (data: Omit<Schedule, 'id'>) => dispatch(createSchedule(data)),
    updateSchedule: (data: Partial<Schedule> & { id: string }) =>
      dispatch(updateSchedule(data)),
    deleteSchedule: (id: string) => dispatch(deleteSchedule(id)),
    setSelectedTab: (tab: 'my' | 'team') => dispatch(setSelectedTab(tab)),
  }
}
