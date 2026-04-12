import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { useAppDispatch } from '../../hooks'
import { AdminUser, createUser, updateUser, fetchUsers } from '../../stores/adminStore'

interface UserFormProps {
  open: boolean
  editUser: AdminUser | null
  onClose: () => void
}

export default function UserForm({ open, editUser, onClose }: UserFormProps) {
  const dispatch = useAppDispatch()
  const isEdit = editUser !== null

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [avatar, setAvatar] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (editUser) {
        setUsername(editUser.username)
        setDisplayName(editUser.displayName)
        setRole(editUser.role)
        setAvatar(editUser.avatar)
        setPassword('')
      } else {
        setUsername('')
        setDisplayName('')
        setPassword('')
        setRole('member')
        setAvatar('')
      }
      setError('')
    }
  }, [open, editUser])

  const validate = () => {
    if (!isEdit && !username.trim()) return 'Username is required'
    if (!displayName.trim()) return 'Display name is required'
    if (!isEdit && password.length < 6) return 'Password must be at least 6 characters'
    if (isEdit && password.length > 0 && password.length < 6) return 'Password must be at least 6 characters'
    return ''
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isEdit) {
        const fields: { id: string; displayName?: string; avatar?: string; role?: 'admin' | 'member'; password?: string } = { id: editUser!.id }
        if (displayName.trim()) fields.displayName = displayName.trim()
        if (avatar.trim()) fields.avatar = avatar.trim()
        if (role !== editUser!.role) fields.role = role
        if (password.length >= 6) fields.password = password
        await dispatch(updateUser(fields)).unwrap()
      } else {
        await dispatch(createUser({
          username: username.trim(),
          password,
          displayName: displayName.trim(),
          role,
          avatar: avatar.trim() || undefined,
        })).unwrap()
      }
      await dispatch(fetchUsers())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isEdit}
            required={!isEdit}
            fullWidth
            size="small"
          />
          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            fullWidth
            size="small"
          />
          <TextField
            label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            fullWidth
            size="small"
          />
          <TextField
            label="Role"
            select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
            fullWidth
            size="small"
          >
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <TextField
            label="Avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. adam"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
