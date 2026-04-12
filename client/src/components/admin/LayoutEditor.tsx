import React, { useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import RoomPalette from './RoomPalette'

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

export interface RoomTemplate {
  id: string
  name: string
  category: string
  widthBlocks: number
  heightBlocks: number
  features: Record<string, unknown>
}

export interface Placement {
  id?: string
  templateId: string
  gridX: number
  gridY: number
  roomName?: string | null
  config?: Record<string, unknown>
  template?: RoomTemplate
}

interface LayoutData {
  id: string
  gridWidth: number
  gridHeight: number
  placements: Placement[]
}

interface CellPopoverState {
  anchorEl: HTMLElement
  placement: Placement
}

export default function LayoutEditor() {
  const [gridWidth, setGridWidth] = useState(5)
  const [gridHeight, setGridHeight] = useState(4)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  // Palette dialog state
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [targetCell, setTargetCell] = useState<{ x: number; y: number } | null>(null)
  const [changingPlacement, setChangingPlacement] = useState<Placement | null>(null)

  // Cell popover state
  const [popover, setPopover] = useState<CellPopoverState | null>(null)

  const loadLayout = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/layout`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to load layout')
      const data = await res.json() as LayoutData | null
      if (data) {
        setGridWidth(data.gridWidth)
        setGridHeight(data.gridHeight)
        setPlacements(data.placements || [])
      }
    } catch {
      // keep defaults if no layout yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLayout()
  }, [loadLayout])

  function getPlacementAt(x: number, y: number): Placement | undefined {
    return placements.find((p) => p.gridX === x && p.gridY === y)
  }

  function handleEmptyCellClick(x: number, y: number) {
    setTargetCell({ x, y })
    setChangingPlacement(null)
    setPaletteOpen(true)
  }

  function handleOccupiedCellClick(event: React.MouseEvent<HTMLElement>, placement: Placement) {
    setPopover({ anchorEl: event.currentTarget, placement })
  }

  function handleRemovePlacement(placement: Placement) {
    setPlacements((prev) => prev.filter((p) => !(p.gridX === placement.gridX && p.gridY === placement.gridY)))
    setPopover(null)
  }

  function handleChangePlacement(placement: Placement) {
    setTargetCell({ x: placement.gridX, y: placement.gridY })
    setChangingPlacement(placement)
    setPopover(null)
    setPaletteOpen(true)
  }

  function handleTemplateSelected(template: RoomTemplate) {
    if (!targetCell) return
    const newPlacement: Placement = {
      templateId: template.id,
      gridX: targetCell.x,
      gridY: targetCell.y,
      template,
      config: {},
    }
    setPlacements((prev) => {
      // Remove existing placement at this cell (for change operation)
      const filtered = prev.filter((p) => !(p.gridX === targetCell.x && p.gridY === targetCell.y))
      return [...filtered, newPlacement]
    })
    setPaletteOpen(false)
    setTargetCell(null)
    setChangingPlacement(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveStatus('idle')
    setSaveError('')
    try {
      const body = {
        gridWidth,
        gridHeight,
        placements: placements.map((p) => ({
          templateId: p.templateId,
          gridX: p.gridX,
          gridY: p.gridY,
          config: p.config || {},
        })),
      }
      const res = await fetch(`${API_BASE}/api/admin/layout`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        throw new Error(err.error || 'Save failed')
      }
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e: unknown) {
      setSaveStatus('error')
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function adjustWidth(delta: number) {
    const next = Math.max(1, Math.min(20, gridWidth + delta))
    if (next < gridWidth) {
      // Remove placements outside new bounds
      setPlacements((prev) => prev.filter((p) => p.gridX < next))
    }
    setGridWidth(next)
  }

  function adjustHeight(delta: number) {
    const next = Math.max(1, Math.min(20, gridHeight + delta))
    if (next < gridHeight) {
      setPlacements((prev) => prev.filter((p) => p.gridY < next))
    }
    setGridHeight(next)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" sx={{ color: '#eee' }}>
          Layout Editor
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Grid size controls */}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ color: '#aaa' }}>Width:</Typography>
            <IconButton size="small" onClick={() => adjustWidth(-1)} sx={{ color: '#ccc' }}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="body1" sx={{ color: '#eee', minWidth: 20, textAlign: 'center' }}>
              {gridWidth}
            </Typography>
            <IconButton size="small" onClick={() => adjustWidth(1)} sx={{ color: '#ccc' }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ color: '#aaa' }}>Height:</Typography>
            <IconButton size="small" onClick={() => adjustHeight(-1)} sx={{ color: '#ccc' }}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="body1" sx={{ color: '#eee', minWidth: 20, textAlign: 'center' }}>
              {gridHeight}
            </Typography>
            <IconButton size="small" onClick={() => adjustHeight(1)} sx={{ color: '#ccc' }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            size="small"
          >
            Save Layout
          </Button>
        </Box>
      </Box>

      {saveStatus === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveStatus('idle')}>
          Layout saved successfully
        </Alert>
      )}
      {saveStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveStatus('idle')}>
          {saveError}
        </Alert>
      )}

      {/* Grid Canvas */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridWidth}, 120px)`,
          gridTemplateRows: `repeat(${gridHeight}, 90px)`,
          gap: '4px',
          overflowX: 'auto',
          pb: 1,
        }}
      >
        {Array.from({ length: gridHeight }, (_, y) =>
          Array.from({ length: gridWidth }, (_, x) => {
            const placement = getPlacementAt(x, y)
            const category = placement?.template?.category
            const color = category ? CATEGORY_COLORS[category] : undefined

            if (placement) {
              return (
                <Tooltip
                  key={`${x}-${y}`}
                  title={`${placement.template?.name ?? 'Room'} (${placement.template?.widthBlocks ?? 1}x${placement.template?.heightBlocks ?? 1})`}
                >
                  <Box
                    onClick={(e) => handleOccupiedCellClick(e, placement)}
                    sx={{
                      width: 120,
                      height: 90,
                      bgcolor: color ? `${color}33` : 'rgba(255,255,255,0.08)',
                      border: `2px solid ${color ?? 'rgba(255,255,255,0.2)'}`,
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'filter 0.15s',
                      '&:hover': { filter: 'brightness(1.2)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: color ?? '#fff',
                        mb: 0.5,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: color ?? '#ccc',
                        fontWeight: 600,
                        textAlign: 'center',
                        px: 0.5,
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {placement.template?.name ?? 'Room'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: 10 }}>
                      {placement.template?.category}
                    </Typography>
                  </Box>
                </Tooltip>
              )
            }

            return (
              <Tooltip key={`${x}-${y}`} title={`Add room at (${x}, ${y})`}>
                <Box
                  onClick={() => handleEmptyCellClick(x, y)}
                  sx={{
                    width: 120,
                    height: 90,
                    border: '2px dashed rgba(255,255,255,0.15)',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.2)',
                    transition: 'border-color 0.15s, color 0.15s',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.4)',
                      color: 'rgba(255,255,255,0.5)',
                    },
                  }}
                >
                  <AddIcon fontSize="small" />
                </Box>
              </Tooltip>
            )
          })
        )}
      </Box>

      {/* Occupied cell popover */}
      <Popover
        open={Boolean(popover)}
        anchorEl={popover?.anchorEl}
        onClose={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          sx: { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.15)', p: 1.5, minWidth: 180 },
        }}
      >
        {popover && (
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#eee', mb: 1 }}>
              {popover.placement.template?.name ?? 'Room'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
              {popover.placement.template?.category} &bull; ({popover.placement.gridX}, {popover.placement.gridY})
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SwapHorizIcon />}
                onClick={() => handleChangePlacement(popover.placement)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Change Room
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => handleRemovePlacement(popover.placement)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Remove
              </Button>
            </Box>
          </Box>
        )}
      </Popover>

      {/* Room palette dialog */}
      <RoomPalette
        open={paletteOpen}
        onClose={() => { setPaletteOpen(false); setTargetCell(null); setChangingPlacement(null) }}
        onSelect={handleTemplateSelected}
        excludePlacementAt={changingPlacement ? { x: changingPlacement.gridX, y: changingPlacement.gridY } : undefined}
      />
    </Box>
  )
}
