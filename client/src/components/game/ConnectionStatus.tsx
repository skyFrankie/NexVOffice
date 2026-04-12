import React, { useEffect, useState } from 'react'
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material'
import networkService, { ConnectionState } from '../../services/NetworkService'

export default function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>(networkService.getConnectionState())
  const [attempt, setAttempt] = useState<number>(0)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    const unsub = networkService.onConnectionStateChange((newState, newAttempt) => {
      setState(newState)
      if (newAttempt !== undefined) setAttempt(newAttempt)
    })
    return unsub
  }, [])

  if (state === 'connected') return null

  const isReconnecting = state === 'reconnecting'

  return (
    <Box
      sx={{
        position: 'fixed',
        top: isMobile ? 8 : 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        px: isMobile ? 2 : 3,
        py: isMobile ? 0.75 : 1,
        borderRadius: 2,
        backgroundColor: isReconnecting
          ? 'rgba(234, 179, 8, 0.15)'
          : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${isReconnecting ? '#eab308' : '#ef4444'}`,
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        animation: isReconnecting ? 'pulse 1.4s ease-in-out infinite' : 'none',
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
        maxWidth: isMobile ? 'calc(100vw - 32px)' : 'auto',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isReconnecting ? '#eab308' : '#ef4444',
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          color: isReconnecting ? '#fef08a' : '#fca5a5',
          fontWeight: 500,
          fontSize: isMobile ? '0.75rem' : '0.875rem',
          whiteSpace: 'nowrap',
        }}
      >
        {isReconnecting
          ? `Reconnecting… (attempt ${attempt}/5)`
          : 'Disconnected — please refresh the page'}
      </Typography>
    </Box>
  )
}
