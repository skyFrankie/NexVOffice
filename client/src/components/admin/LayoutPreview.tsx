import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'

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

interface PreviewPlacement {
  gridX: number
  gridY: number
  template?: {
    name: string
    category: string
  }
}

interface LayoutData {
  gridWidth: number
  gridHeight: number
  placements: PreviewPlacement[]
}

export default function LayoutPreview() {
  const [layout, setLayout] = useState<LayoutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/layout`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data: LayoutData | null) => setLayout(data))
      .catch(() => setLayout(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (!layout) {
    return (
      <Typography variant="caption" sx={{ color: '#666' }}>
        No layout configured
      </Typography>
    )
  }

  const { gridWidth, gridHeight, placements } = layout

  function getPlacementAt(x: number, y: number): PreviewPlacement | undefined {
    return placements.find((p) => p.gridX === x && p.gridY === y)
  }

  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
        Office Layout ({gridWidth}x{gridHeight})
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridWidth}, 40px)`,
          gridTemplateRows: `repeat(${gridHeight}, 30px)`,
          gap: '2px',
        }}
      >
        {Array.from({ length: gridHeight }, (_, y) =>
          Array.from({ length: gridWidth }, (_, x) => {
            const placement = getPlacementAt(x, y)
            const category = placement?.template?.category
            const color = category ? CATEGORY_COLORS[category] : undefined
            const name = placement?.template?.name ?? ''
            const abbr = name.length > 4 ? name.slice(0, 4) : name

            return (
              <Tooltip
                key={`${x}-${y}`}
                title={placement ? `${name} (${category})` : `Empty (${x},${y})`}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 30,
                    bgcolor: color ? `${color}33` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${color ?? 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {abbr && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: color ?? '#555',
                        fontSize: 9,
                        fontWeight: 600,
                        lineHeight: 1,
                        textAlign: 'center',
                      }}
                    >
                      {abbr}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            )
          })
        )}
      </Box>
    </Box>
  )
}
