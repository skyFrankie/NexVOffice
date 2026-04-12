import React, { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import type { RoomTemplate } from './LayoutEditor'

const API_BASE = `${window.location.protocol}//${window.location.host}`

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nexvoffice_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  lobby: '#FFB74D',
  meeting: '#64B5F6',
  workspace: '#81C784',
  social: '#FFD54F',
  utility: '#90A4AE',
  hallway: '#CE93D8',
}

const CATEGORY_ORDER = ['lobby', 'meeting', 'workspace', 'social', 'utility', 'hallway']

interface RoomPaletteProps {
  open: boolean
  onClose: () => void
  onSelect: (template: RoomTemplate) => void
  excludePlacementAt?: { x: number; y: number }
}

export default function RoomPalette({ open, onClose, onSelect }: RoomPaletteProps) {
  const [templates, setTemplates] = useState<RoomTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setLoading(true)
    fetch(`${API_BASE}/api/map/templates`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data: RoomTemplate[]) => setTemplates(data))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [open])

  function handleConfirm() {
    const template = templates.find((t) => t.id === selected)
    if (template) onSelect(template)
  }

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, RoomTemplate[]>>((acc, cat) => {
    const items = templates.filter((t) => t.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  // Also add any categories not in CATEGORY_ORDER
  for (const t of templates) {
    if (!CATEGORY_ORDER.includes(t.category) && !grouped[t.category]) {
      grouped[t.category] = templates.filter((x) => x.category === t.category)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.15)' },
      }}
    >
      <DialogTitle sx={{ color: '#eee', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        Select Room Template
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Typography sx={{ color: '#888', textAlign: 'center', py: 4 }}>
            No room templates available
          </Typography>
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            {Object.entries(grouped).map(([category, items]) => {
              const color = CATEGORY_COLORS[category] ?? '#aaa'
              return (
                <Box key={category}>
                  <Typography
                    variant="overline"
                    sx={{
                      color,
                      fontWeight: 700,
                      display: 'block',
                      mb: 1,
                      borderBottom: `1px solid ${color}44`,
                      pb: 0.5,
                    }}
                  >
                    {category}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={0.75}>
                    {items.map((t) => {
                      const isSelected = selected === t.id
                      const featureList = Array.isArray((t.features as Record<string, unknown>)?.list)
                        ? ((t.features as Record<string, unknown>).list as string[])
                        : typeof t.features === 'object' && t.features
                          ? Object.keys(t.features).filter((k) => k !== 'itemSlots')
                          : []

                      return (
                        <Box
                          key={t.id}
                          onClick={() => setSelected(t.id)}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: isSelected
                              ? `2px solid ${color}`
                              : '2px solid rgba(255,255,255,0.08)',
                            bgcolor: isSelected ? `${color}18` : 'rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, background-color 0.15s',
                            '&:hover': {
                              borderColor: `${color}88`,
                              bgcolor: `${color}10`,
                            },
                          }}
                        >
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: '#eee', fontWeight: 600 }}>
                              {t.name}
                            </Typography>
                            <Chip
                              label={`${t.widthBlocks}x${t.heightBlocks}`}
                              size="small"
                              sx={{
                                bgcolor: `${color}22`,
                                color,
                                fontWeight: 600,
                                height: 20,
                                fontSize: 11,
                              }}
                            />
                          </Box>
                          {featureList.length > 0 && (
                            <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.75}>
                              {featureList.map((f) => (
                                <Chip
                                  key={f}
                                  label={f}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: 10,
                                    bgcolor: 'rgba(255,255,255,0.06)',
                                    color: '#aaa',
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', px: 2, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selected}
        >
          Place Room
        </Button>
      </DialogActions>
    </Dialog>
  )
}
