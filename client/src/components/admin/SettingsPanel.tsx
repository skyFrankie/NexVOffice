import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import AddIcon from '@mui/icons-material/Add'
import { useAppSelector, useAppDispatch } from '../../hooks'
import { fetchSettings, updateSetting, deleteSetting } from '../../stores/adminStore'

export default function SettingsPanel() {
  const dispatch = useAppDispatch()
  const { settings, loading } = useAppSelector((state) => state.admin)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [addError, setAddError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    dispatch(fetchSettings())
  }, [dispatch])

  function startEdit(key: string, value: unknown) {
    setEditingKey(key)
    setEditValue(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    setEditError('')
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
    setEditError('')
  }

  async function saveEdit(key: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(editValue)
    } catch {
      parsed = editValue
    }
    try {
      await dispatch(updateSetting({ key, value: parsed })).unwrap()
      setEditingKey(null)
      setEditValue('')
    } catch {
      setEditError('Failed to save setting')
    }
  }

  async function handleDelete(key: string) {
    await dispatch(deleteSetting(key))
  }

  async function handleAdd() {
    if (!newKey.trim()) {
      setAddError('Key is required')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(newValue)
    } catch {
      parsed = newValue
    }
    try {
      await dispatch(updateSetting({ key: newKey.trim(), value: parsed })).unwrap()
      setNewKey('')
      setNewValue('')
      setShowAddForm(false)
      setAddError('')
    } catch {
      setAddError('Failed to add setting')
    }
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" sx={{ color: '#eee' }}>
          Settings
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setShowAddForm((v) => !v)}
        >
          Add Setting
        </Button>
      </Box>

      {showAddForm && (
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: '#ccc' }}>
            New Setting
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField
              label="Key"
              size="small"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              sx={{ flex: 1, minWidth: 150 }}
            />
            <TextField
              label="Value (JSON or string)"
              size="small"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              sx={{ flex: 2, minWidth: 200 }}
            />
            <Button variant="contained" onClick={handleAdd} size="small">
              Save
            </Button>
            <Button variant="outlined" onClick={() => { setShowAddForm(false); setAddError('') }} size="small">
              Cancel
            </Button>
          </Box>
          {addError && <Alert severity="error" sx={{ mt: 1 }}>{addError}</Alert>}
        </Paper>
      )}

      {loading && settings.length === 0 ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.05)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#aaa', fontWeight: 600 }}>Key</TableCell>
                <TableCell sx={{ color: '#aaa', fontWeight: 600 }}>Value</TableCell>
                <TableCell sx={{ color: '#aaa', fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ color: '#666', textAlign: 'center' }}>
                    No settings yet
                  </TableCell>
                </TableRow>
              )}
              {settings.map((s) => (
                <TableRow key={s.key}>
                  <TableCell sx={{ color: '#eee', fontFamily: 'monospace' }}>{s.key}</TableCell>
                  <TableCell sx={{ color: '#ccc' }}>
                    {editingKey === s.key ? (
                      <Box>
                        <TextField
                          size="small"
                          multiline
                          fullWidth
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
                        />
                        {editError && <Alert severity="error" sx={{ mt: 0.5 }}>{editError}</Alert>}
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                      >
                        {typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingKey === s.key ? (
                      <>
                        <IconButton size="small" onClick={() => saveEdit(s.key)} color="success">
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEdit}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton size="small" onClick={() => startEdit(s.key, s.value)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(s.key)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
