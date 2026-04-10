import { Request, Response, NextFunction } from 'express'
import { authService, AuthPayload } from './service'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = header.slice(7)
  const user = await authService.verifyToken(token)
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = user
  next()
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
