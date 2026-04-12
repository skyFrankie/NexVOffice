import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import EditIcon from '@mui/icons-material/Edit'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import PersonIcon from '@mui/icons-material/Person'
import { useAppDispatch, useAppSelector } from '../../hooks'
import { AdminUser, fetchUsers, deactivateUser, reactivateUser } from '../../stores/adminStore'
import UserForm from './UserForm'

type RoleFilter = 'all' | 'admin' | 'member'
type ActiveFilter = 'all' | 'active' | 'inactive'

export default function UserManagement() {
  const dispatch = useAppDispatch()
  const { users, loading } = useAppSelector((state) => state.admin)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)

  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  useEffect(() => {
    dispatch(fetchUsers())
  }, [dispatch])

  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase()
      if (!u.displayName.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false
    }
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (activeFilter === 'active' && !u.isActive) return false
    if (activeFilter === 'inactive' && u.isActive) return false
    return true
  })

  const handleOpenCreate = () => {
    setEditUser(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (user: AdminUser) => {
    setEditUser(user)
    setFormOpen(true)
  }

  const handleToggleActive = (user: AdminUser) => {
    if (user.isActive) {
      setConfirmUser(user)
    } else {
      dispatch(reactivateUser(user.id))
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!confirmUser) return
    setConfirmSubmitting(true)
    await dispatch(deactivateUser(confirmUser.id))
    setConfirmSubmitting(false)
    setConfirmUser(null)
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: '#eee' }}>
          User Management
        </Typography>
        <Button variant="contained" onClick={handleOpenCreate}>
          Create User
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          label="Search"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or username"
          sx={{ minWidth: 200 }}
        />
        <TextField
          label="Role"
          select
          size="small"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">All Roles</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="member">Member</MenuItem>
        </TextField>
        <TextField
          label="Status"
          select
          size="small"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </Box>

      {loading && users.length === 0 ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.04)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Display Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    No users found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{user.username}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      size="small"
                      color={user.role === 'admin' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.isActive ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenEdit(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.isActive ? 'Deactivate' : 'Activate'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(user)}
                        color={user.isActive ? 'error' : 'success'}
                      >
                        {user.isActive ? (
                          <PersonOffIcon fontSize="small" />
                        ) : (
                          <PersonIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <UserForm
        open={formOpen}
        editUser={editUser}
        onClose={() => setFormOpen(false)}
      />

      <Dialog open={confirmUser !== null} onClose={() => setConfirmUser(null)}>
        <DialogTitle>Deactivate User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate{' '}
            <strong>{confirmUser?.displayName}</strong>? They will no longer be able to log in.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUser(null)} disabled={confirmSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeactivate}
            color="error"
            variant="contained"
            disabled={confirmSubmitting}
          >
            {confirmSubmitting ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
