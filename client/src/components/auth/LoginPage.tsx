import React, { useState } from 'react'
import styled from 'styled-components'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { useAuth } from '../../hooks/useAuth'

const Backdrop = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`

const LoginCard = styled(Paper)`
  padding: 40px;
  max-width: 400px;
  width: 100%;
  text-align: center;
`

export default function LoginPage() {
  const { login, changePassword, isLoading, loginError, user } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changeError, setChangeError] = useState('')
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(username, password)
    if (success) {
      // Store the password used for login in case we need it for the change-password flow
      setCurrentPasswordForChange(password)
    }
  }

  // After login, if mustChangePassword, show the change password dialog
  React.useEffect(() => {
    if (user?.mustChangePassword) {
      setShowChangePassword(true)
    }
  }, [user?.mustChangePassword])

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setChangeError('Password must be at least 6 characters')
      return
    }
    const result = await changePassword(currentPasswordForChange, newPassword)
    if (result.success) {
      setShowChangePassword(false)
    } else {
      setChangeError(result.error || 'Failed to change password')
    }
  }

  return (
    <Backdrop>
      <LoginCard elevation={3}>
        <Typography variant="h4" gutterBottom>
          NexVOffice
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Virtual Office
        </Typography>
        <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            autoFocus
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
          />
          {loginError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {loginError}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading || !username || !password}
            sx={{ mt: 2 }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </LoginCard>

      <Dialog open={showChangePassword} disableEscapeKeyDown>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            You must change your password before continuing.
          </Typography>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
          />
          {changeError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {changeError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleChangePassword} variant="contained">
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Backdrop>
  )
}
