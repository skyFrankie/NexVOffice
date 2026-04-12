import React, { useEffect } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import PeopleIcon from '@mui/icons-material/People'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import GridViewIcon from '@mui/icons-material/GridView'
import SettingsIcon from '@mui/icons-material/Settings'
import { useAppSelector, useAppDispatch } from '../../hooks'
import { fetchUsers, fetchSettings } from '../../stores/adminStore'

const API_BASE = `${window.location.protocol}//${window.location.host}`

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card sx={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {icon}
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
        <Typography variant="h4" color="text.primary">{value}</Typography>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const dispatch = useAppDispatch()
  const { users, settings, loading } = useAppSelector((state) => state.admin)
  const [npcCount, setNpcCount] = React.useState<number>(0)

  useEffect(() => {
    dispatch(fetchUsers())
    dispatch(fetchSettings())
    // Fetch NPC count
    const token = localStorage.getItem('nexvoffice_token')
    fetch(`${API_BASE}/api/npcs`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => r.json())
      .then((data: unknown[]) => setNpcCount(data.filter((n: any) => n.isActive).length))
      .catch(() => {})
  }, [dispatch])

  if (loading && users.length === 0) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    )
  }

  const activeUsers = users.filter((u) => u.isActive).length

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: '#eee', mb: 3 }}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<PeopleIcon color="primary" />}
            label="Total Users"
            value={users.length}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<PeopleIcon color="success" />}
            label="Active Users"
            value={activeUsers}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<SmartToyIcon color="secondary" />}
            label="Active NPCs"
            value={npcCount}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<SettingsIcon color="warning" />}
            label="Settings"
            value={settings.length}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
