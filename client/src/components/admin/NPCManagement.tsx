import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
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
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import EditIcon from '@mui/icons-material/Edit'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import BuildIcon from '@mui/icons-material/Build'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import AddIcon from '@mui/icons-material/Add'
import NPCForm from './NPCForm'
import KnowledgeUpload from './KnowledgeUpload'

export interface NPC {
  id: string
  name: string
  type: 'agent' | 'ghost'
  avatar: string
  systemPrompt?: string
  greeting: string
  spawnX: number | null
  spawnY: number | null
  isActive: boolean
  createdAt: string
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nexvoffice_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const API_BASE = `${window.location.protocol}//${window.location.host}`

export default function NPCManagement() {
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null)
  const [knowledgeNpc, setKnowledgeNpc] = useState<NPC | null>(null)
  const [toolsNpc, setToolsNpc] = useState<NPC | null>(null)
  const [tools, setTools] = useState<unknown[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)

  async function fetchNpcs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/npcs`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch NPCs')
      const data = await res.json() as NPC[]
      setNpcs(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const [confirmDeactivate, setConfirmDeactivate] = useState<NPC | null>(null)

  async function deactivateNpc(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/npcs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to deactivate NPC')
      setNpcs((prev) => prev.map((n) => (n.id === id ? { ...n, isActive: false } : n)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setConfirmDeactivate(null)
    }
  }

  async function viewTools(npc: NPC) {
    setToolsNpc(npc)
    setToolsLoading(true)
    setTools([])
    try {
      const res = await fetch(`${API_BASE}/api/npcs/${npc.id}/tools`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch tools')
      const data = await res.json() as unknown[]
      setTools(data)
    } catch {
      setTools([])
    } finally {
      setToolsLoading(false)
    }
  }

  useEffect(() => {
    fetchNpcs()
  }, [])

  function handleFormSaved(npc: NPC, isNew: boolean) {
    if (isNew) {
      setNpcs((prev) => [...prev, npc])
    } else {
      setNpcs((prev) => prev.map((n) => (n.id === npc.id ? { ...n, ...npc } : n)))
    }
    setFormOpen(false)
    setEditingNpc(null)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: '#eee', fontWeight: 600 }}>
          NPC Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditingNpc(null); setFormOpen(true) }}
          sx={{ background: '#64b5f6', '&:hover': { background: '#42a5f5' } }}
        >
          Create NPC
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#64b5f6' }} />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ background: '#13152a', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }}>Name</TableCell>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }}>Type</TableCell>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }}>Avatar</TableCell>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }}>Spawn</TableCell>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }}>Status</TableCell>
                <TableCell sx={{ color: '#aaa', borderColor: 'rgba(255,255,255,0.08)' }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {npcs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ color: '#666', borderColor: 'rgba(255,255,255,0.08)', py: 4 }}
                  >
                    No NPCs found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                npcs.map((npc) => (
                  <TableRow key={npc.id} sx={{ '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#eee', borderColor: 'rgba(255,255,255,0.08)' }}>
                      {npc.name}
                    </TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Chip
                        label={npc.type}
                        size="small"
                        sx={{
                          background: npc.type === 'agent'
                            ? 'rgba(0, 188, 212, 0.2)'
                            : 'rgba(158, 158, 158, 0.2)',
                          color: npc.type === 'agent' ? '#00bcd4' : '#9e9e9e',
                          border: `1px solid ${npc.type === 'agent' ? 'rgba(0,188,212,0.4)' : 'rgba(158,158,158,0.4)'}`,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#ccc', borderColor: 'rgba(255,255,255,0.08)', fontSize: 13 }}>
                      {npc.avatar}
                    </TableCell>
                    <TableCell sx={{ color: '#ccc', borderColor: 'rgba(255,255,255,0.08)', fontSize: 13 }}>
                      {npc.spawnX != null && npc.spawnY != null
                        ? `(${npc.spawnX}, ${npc.spawnY})`
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Chip
                        label={npc.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          background: npc.isActive
                            ? 'rgba(76, 175, 80, 0.2)'
                            : 'rgba(244, 67, 54, 0.2)',
                          color: npc.isActive ? '#4caf50' : '#f44336',
                          border: `1px solid ${npc.isActive ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.4)'}`,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Tooltip title="Edit NPC">
                        <IconButton
                          size="small"
                          onClick={() => { setEditingNpc(npc); setFormOpen(true) }}
                          sx={{ color: '#64b5f6' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Upload Knowledge">
                        <IconButton
                          size="small"
                          onClick={() => setKnowledgeNpc(npc)}
                          sx={{ color: '#81c784' }}
                        >
                          <UploadFileIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View MCP Tools">
                        <IconButton
                          size="small"
                          onClick={() => viewTools(npc)}
                          sx={{ color: '#ffb74d' }}
                        >
                          <BuildIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {npc.isActive && (
                        <Tooltip title="Deactivate NPC">
                          <IconButton
                            size="small"
                            onClick={() => setConfirmDeactivate(npc)}
                            sx={{ color: '#e57373' }}
                          >
                            <PersonOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {formOpen && (
        <NPCForm
          npc={editingNpc}
          onClose={() => { setFormOpen(false); setEditingNpc(null) }}
          onSaved={handleFormSaved}
        />
      )}

      {knowledgeNpc && (
        <KnowledgeUpload
          npc={knowledgeNpc}
          onClose={() => setKnowledgeNpc(null)}
        />
      )}

      {confirmDeactivate && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setConfirmDeactivate(null)}
        >
          <Box
            sx={{
              background: '#1a1d2e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              p: 3,
              minWidth: 340,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ color: '#eee', mb: 2 }}>
              Deactivate NPC?
            </Typography>
            <Typography sx={{ color: '#aaa', mb: 3, fontSize: 14 }}>
              Are you sure you want to deactivate <strong>{confirmDeactivate.name}</strong>? The NPC will no longer appear in the office.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button onClick={() => setConfirmDeactivate(null)} sx={{ color: '#aaa' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => deactivateNpc(confirmDeactivate.id)}
              >
                Deactivate
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {toolsNpc && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setToolsNpc(null)}
        >
          <Box
            sx={{
              background: '#1a1d2e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              p: 3,
              minWidth: 380,
              maxWidth: 560,
              maxHeight: '70vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ color: '#eee', mb: 2 }}>
              MCP Tools — {toolsNpc.name}
            </Typography>
            {toolsLoading ? (
              <CircularProgress size={24} sx={{ color: '#64b5f6' }} />
            ) : tools.length === 0 ? (
              <Typography sx={{ color: '#888', fontSize: 14 }}>
                No MCP tools configured for this NPC.
              </Typography>
            ) : (
              <Box component="pre" sx={{ color: '#ccc', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(tools, null, 2)}
              </Box>
            )}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setToolsNpc(null)} sx={{ color: '#aaa' }}>
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
