import React, { useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import { NPC } from './NPCManagement'

const MAX_CHARS = 100_000

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
  npc: NPC
  onClose: () => void
}

export default function KnowledgeUpload({ npc, onClose }: Props) {
  const [sourceName, setSourceName] = useState('')
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ sourceId: string; chunkCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const charCount = text.length
  const overLimit = charCount > MAX_CHARS

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result
      if (typeof content === 'string') {
        setText(content)
        if (!sourceName) setSourceName(file.name)
      }
    }
    reader.readAsText(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  async function handleUpload() {
    if (!text.trim()) {
      setError('Document text is required.')
      return
    }
    if (overLimit) {
      setError(`Text exceeds ${MAX_CHARS.toLocaleString()} character limit.`)
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${API_BASE}/api/npcs/${npc.id}/knowledge`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: text.trim(),
          sourcePath: sourceName.trim() || 'manual-upload',
          sourceType: 'text',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || `Upload failed: ${res.status}`)
      }
      const result = await res.json() as { sourceId: string; chunkCount: number }
      setSuccess(result)
      setText('')
      setSourceName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUploading(false)
    }
  }

  const charPct = Math.min((charCount / MAX_CHARS) * 100, 100)
  const charColor = overLimit ? '#f44336' : charCount > MAX_CHARS * 0.85 ? '#ffb74d' : '#81c784'

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
        Upload Knowledge — {npc.name}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            Uploaded successfully. Source ID: {success.sourceId} &mdash; {success.chunkCount} chunks indexed.
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <TextField
            label="Source Name"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. company-policy.md"
            sx={inputSx}
          />
        </Box>

        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#aaa' }}>
            Document Text
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            sx={{
              color: '#64b5f6',
              borderColor: 'rgba(100,181,246,0.4)',
              fontSize: 12,
              py: 0.25,
              '&:hover': { borderColor: '#64b5f6', background: 'rgba(100,181,246,0.08)' },
            }}
          >
            Load .txt / .md file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </Box>

        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          multiline
          minRows={10}
          maxRows={20}
          placeholder="Paste document text here, or use the button above to load a file..."
          size="small"
          sx={{
            ...inputSx,
            '& .MuiOutlinedInput-root': {
              ...inputSx['& .MuiOutlinedInput-root'],
              fontFamily: 'monospace',
              fontSize: 13,
            },
          }}
        />

        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={charPct}
            sx={{
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': { background: charColor, borderRadius: 2 },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: charColor }}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }} disabled={uploading}>
          Close
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={uploading || overLimit || !text.trim()}
          sx={{ background: '#81c784', color: '#1a1d2e', '&:hover': { background: '#66bb6a' } }}
        >
          {uploading ? 'Uploading...' : 'Upload Knowledge'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
