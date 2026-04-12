import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import { NPC } from './NPCManagement'

const NPC_TYPES = ['agent', 'ghost'] as const
const NPC_BEHAVIORS = [
  'stay_at_desk',
  'wander_room',
  'wander_freely',
  'go_to_meeting',
  'face_user',
] as const

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nexvoffice_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const API_BASE = `${window.location.protocol}//${window.location.host}`

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: '#eee',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#64b5f6' },
  },
  '& .MuiInputLabel-root': { color: '#aaa' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#64b5f6' },
}

interface Props {
  npc: NPC | null
  onClose: () => void
  onSaved: (npc: NPC, isNew: boolean) => void
}

export default function NPCForm({ npc, onClose, onSaved }: Props) {
  const isNew = npc === null

  const [name, setName] = useState(npc?.name ?? '')
  const [type, setType] = useState<'agent' | 'ghost'>(npc?.type ?? 'agent')
  const [avatar, setAvatar] = useState(npc?.avatar ?? '')
  const [systemPrompt, setSystemPrompt] = useState(npc?.systemPrompt ?? '')
  const [greeting, setGreeting] = useState(npc?.greeting ?? 'Hello! How can I help you?')
  const [behavior, setBehavior] = useState<string>((npc as any)?.behavior ?? 'stay_at_desk')
  const [spawnX, setSpawnX] = useState<string>(npc?.spawnX != null ? String(npc.spawnX) : '')
  const [spawnY, setSpawnY] = useState<string>(npc?.spawnY != null ? String(npc.spawnY) : '')
  const [roomPlacementId, setRoomPlacementId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || !avatar.trim() || (!npc && !systemPrompt.trim())) {
      setError('Name, avatar, and system prompt are required.')
      return
    }

    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      avatar: avatar.trim(),
      greeting: greeting.trim(),
      behavior,
      spawnX: spawnX !== '' ? Number(spawnX) : null,
      spawnY: spawnY !== '' ? Number(spawnY) : null,
      roomPlacementId: roomPlacementId.trim() || null,
    }
    if (systemPrompt.trim()) payload.systemPrompt = systemPrompt.trim()

    try {
      const url = isNew ? `${API_BASE}/api/npcs` : `${API_BASE}/api/npcs/${npc!.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      const saved = await res.json() as NPC
      onSaved(saved, isNew)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)', color: '#eee' },
      }}
    >
      <DialogTitle sx={{ color: '#eee', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {isNew ? 'Create NPC' : `Edit NPC — ${npc!.name}`}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel>Type</InputLabel>
              <Select
                value={type}
                label="Type"
                onChange={(e) => setType(e.target.value as 'agent' | 'ghost')}
                sx={{ color: '#eee', '& .MuiSvgIcon-root': { color: '#aaa' } }}
                MenuProps={{ PaperProps: { sx: { background: '#1a1d2e', color: '#eee' } } }}
              >
                {NPC_TYPES.map((t) => (
                  <MenuItem key={t} value={t} sx={{ color: '#eee' }}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Avatar (sprite key) *"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel>Behavior</InputLabel>
              <Select
                value={behavior}
                label="Behavior"
                onChange={(e) => setBehavior(e.target.value)}
                sx={{ color: '#eee', '& .MuiSvgIcon-root': { color: '#aaa' } }}
                MenuProps={{ PaperProps: { sx: { background: '#1a1d2e', color: '#eee' } } }}
              >
                {NPC_BEHAVIORS.map((b) => (
                  <MenuItem key={b} value={b} sx={{ color: '#eee' }}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label={isNew ? 'System Prompt *' : 'System Prompt (leave blank to keep existing)'}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              fullWidth
              multiline
              minRows={8}
              size="small"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField
              label="Spawn X"
              type="number"
              value={spawnX}
              onChange={(e) => setSpawnX(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField
              label="Spawn Y"
              type="number"
              value={spawnY}
              onChange={(e) => setSpawnY(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Room Placement ID"
              value={roomPlacementId}
              onChange={(e) => setRoomPlacementId(e.target.value)}
              fullWidth
              size="small"
              placeholder="UUID of room placement (optional)"
              sx={inputSx}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving}
          sx={{ background: '#64b5f6', '&:hover': { background: '#42a5f5' } }}
        >
          {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
