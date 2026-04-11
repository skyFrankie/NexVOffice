import { Router } from 'express'
import { authMiddleware } from '../auth/middleware'
import { db } from '../db/connection'
import { tasks, dailySchedules, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { Message } from '../../types/Messages'

const router = Router()

router.use(authMiddleware)

// GET /api/tasks
router.get('/', async (req, res) => {
  const userId = req.user!.id
  const { assigned_to, created_by, status } = req.query

  const conditions: ReturnType<typeof eq>[] = []

  if (assigned_to) {
    const assigneeId = assigned_to === 'me' ? userId : String(assigned_to)
    conditions.push(eq(tasks.assigneeId, assigneeId))
  }

  if (created_by) {
    const creatorId = created_by === 'me' ? userId : String(created_by)
    conditions.push(eq(tasks.assignedBy, creatorId))
  }

  if (status && ['todo', 'in_progress', 'done'].includes(String(status))) {
    conditions.push(eq(tasks.status, status as 'todo' | 'in_progress' | 'done'))
  }

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      assigneeId: tasks.assigneeId,
      assignedBy: tasks.assignedBy,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  res.json({ tasks: rows })
})

// POST /api/tasks
router.post('/', async (req, res) => {
  const userId = req.user!.id
  const { title, description, assigneeId, dueDate } = req.body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' })
  }

  const result = await db
    .insert(tasks)
    .values({
      title: title.trim(),
      description: description || null,
      assigneeId: assigneeId || null,
      assignedBy: userId,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      assigneeId: tasks.assigneeId,
      assignedBy: tasks.assignedBy,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })

  const task = result[0]

  // Prepare TASK_ASSIGNED notification data (broadcast wired in integration layer)
  if (assigneeId) {
    const taskAssignedData = {
      taskId: task.id,
      assignedTo: assigneeId,
      assignedBy: userId,
      title: task.title,
    }
    // Attach to response so integration layer can broadcast via Colyseus
    return res.status(201).json({ task, notification: { type: Message.TASK_ASSIGNED, data: taskAssignedData } })
  }

  res.status(201).json({ task })
})

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id
  const { title, description, status, assigneeId, dueDate } = req.body

  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = String(title).trim()
  if (description !== undefined) updates.description = description
  if (status !== undefined && ['todo', 'in_progress', 'done'].includes(status)) {
    updates.status = status
  }
  if (assigneeId !== undefined) updates.assigneeId = assigneeId
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null
  if (assigneeId !== undefined) updates.assignedBy = userId

  const result = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      assigneeId: tasks.assigneeId,
      assignedBy: tasks.assignedBy,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })

  const task = result[0]

  // Prepare TASK_UPDATED notification data
  const notificationData = {
    taskId: task.id,
    status: task.status,
  }

  res.json({ task, notification: { type: Message.TASK_UPDATED, data: notificationData } })
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const task = existing[0]
  if (req.user!.role !== 'admin' && task.assignedBy !== userId) {
    return res.status(403).json({ error: 'Only the creator or admin can delete a task' })
  }

  await db.delete(tasks).where(eq(tasks.id, id))
  res.json({ success: true })
})

// GET /api/schedules
router.get('/schedules', async (req, res) => {
  const userId = req.user!.id
  const isAdmin = req.user!.role === 'admin'
  const { userId: filterUserId } = req.query

  let rows
  if (isAdmin && !filterUserId) {
    rows = await db.select().from(dailySchedules)
  } else {
    const targetId = filterUserId ? String(filterUserId) : userId
    rows = await db.select().from(dailySchedules).where(eq(dailySchedules.userId, targetId))
  }

  res.json({ schedules: rows })
})

// POST /api/schedules
router.post('/schedules', async (req, res) => {
  const userId = req.user!.id
  const { dayOfWeek, startTime, endTime, label } = req.body

  if (dayOfWeek === undefined || !startTime || !endTime || !label) {
    return res.status(400).json({ error: 'dayOfWeek, startTime, endTime, and label are required' })
  }

  if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ error: 'dayOfWeek must be 0–6' })
  }

  const result = await db
    .insert(dailySchedules)
    .values({
      userId,
      dayOfWeek,
      startTime: String(startTime),
      endTime: String(endTime),
      label: String(label),
    })
    .returning()

  res.status(201).json({ schedule: result[0] })
})

// PUT /api/schedules/:id
router.put('/schedules/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id
  const { dayOfWeek, startTime, endTime, label } = req.body

  const existing = await db.select().from(dailySchedules).where(eq(dailySchedules.id, id)).limit(1)
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Schedule item not found' })
  }

  if (req.user!.role !== 'admin' && existing[0].userId !== userId) {
    return res.status(403).json({ error: 'Can only update your own schedule' })
  }

  const updates: Record<string, any> = {}
  if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek
  if (startTime !== undefined) updates.startTime = String(startTime)
  if (endTime !== undefined) updates.endTime = String(endTime)
  if (label !== undefined) updates.label = String(label)

  const result = await db
    .update(dailySchedules)
    .set(updates)
    .where(eq(dailySchedules.id, id))
    .returning()

  res.json({ schedule: result[0] })
})

// DELETE /api/schedules/:id
router.delete('/schedules/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  const existing = await db.select().from(dailySchedules).where(eq(dailySchedules.id, id)).limit(1)
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Schedule item not found' })
  }

  if (req.user!.role !== 'admin' && existing[0].userId !== userId) {
    return res.status(403).json({ error: 'Can only delete your own schedule' })
  }

  await db.delete(dailySchedules).where(eq(dailySchedules.id, id))
  res.json({ success: true })
})

export default router
