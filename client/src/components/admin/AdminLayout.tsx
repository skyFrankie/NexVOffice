import React from 'react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import GridViewIcon from '@mui/icons-material/GridView'
import SettingsIcon from '@mui/icons-material/Settings'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useAppSelector, useAppDispatch } from '../../hooks'
import { setActiveTab } from '../../stores/adminStore'
import AdminDashboard from './AdminDashboard'
import SettingsPanel from './SettingsPanel'
import UserManagement from './UserManagement'
import LayoutEditor from './LayoutEditor'
import NPCManagement from './NPCManagement'

const DRAWER_WIDTH = 220

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'users', label: 'Users', icon: <PeopleIcon /> },
  { id: 'layout', label: 'Layout Editor', icon: <GridViewIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  { id: 'npcs', label: 'NPCs', icon: <SmartToyIcon /> },
]

interface Props {
  onClose: () => void
}

export default function AdminLayout({ onClose }: Props) {
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector((state) => state.admin.activeTab)

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />
      case 'settings':
        return <SettingsPanel />
      case 'users':
        return <UserManagement />
      case 'layout':
        return <LayoutEditor />
      case 'npcs':
        return <NPCManagement />
      default:
        return null
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#1a1d2e',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000,
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            background: '#13152a',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            color: '#eee',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={onClose} sx={{ color: '#aaa' }} title="Back to Office">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ color: '#eee', fontWeight: 600 }}>
            Admin Panel
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
        <List dense>
          {TABS.map((tab) => (
            <ListItem key={tab.id} disablePadding>
              <ListItemButton
                selected={activeTab === tab.id}
                onClick={() => dispatch(setActiveTab(tab.id))}
                sx={{
                  '&.Mui-selected': {
                    background: 'rgba(100, 181, 246, 0.15)',
                    '&:hover': { background: 'rgba(100, 181, 246, 0.2)' },
                  },
                  '&:hover': { background: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon sx={{ color: activeTab === tab.id ? '#64b5f6' : '#888', minWidth: 36 }}>
                  {tab.icon}
                </ListItemIcon>
                <ListItemText
                  primary={tab.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    color: activeTab === tab.id ? '#64b5f6' : '#ccc',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          overflowY: 'auto',
          color: '#eee',
        }}
      >
        {renderContent()}
      </Box>
    </Box>
  )
}
