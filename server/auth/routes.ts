import { Router } from 'express'
import { authService } from './service'
import { authMiddleware } from './middleware'

const router = Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  const result = await authService.login(username, password)
  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  res.json(result)
})

router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const success = await authService.changePassword(req.user!.id, currentPassword, newPassword)
  if (!success) {
    return res.status(400).json({ error: 'Current password is incorrect' })
  }

  res.json({ success: true })
})

export default router
