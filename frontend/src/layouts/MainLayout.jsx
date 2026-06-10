import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Drawer, List,
  ListItemButton, ListItemIcon, ListItemText, useMediaQuery, useTheme,
  Badge, Avatar, Menu, MenuItem, Divider, Stack, Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { useState } from 'react';
import { useAuthStore } from '../store/auth.store.js';
import { authApi } from '../services/api.js';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../services/api.js';
import { useFCM } from '../hooks/useFCM.js';

const DRAWER_WIDTH = 270;

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardRoundedIcon /> },
  { label: 'Groups', path: '/groups', icon: <GroupsRoundedIcon /> },
  { label: 'Notifications', path: '/notifications', icon: <NotificationsRoundedIcon /> },
  { label: 'Profile', path: '/profile', icon: <PersonRoundedIcon /> },
];

export default function MainLayout() {
  useFCM();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const { data } = await notificationsApi.unreadCount();
      return data.data.count;
    },
    refetchInterval: 60_000,
  });

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <AccountBalanceWalletRoundedIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.02em' }} className="gradient-text">
            Split Expense
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(139, 92, 246, 0.08)', mx: 2 }} />

      {/* Navigation */}
      <List sx={{ flex: 1, pt: 2, px: 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.path}
              onClick={() => { navigate(item.path); setDrawerOpen(false); }}
              selected={active}
              sx={{
                mb: 0.5,
                borderRadius: 2.5,
                mx: 1,
                py: 1.2,
                ...(active && {
                  background: 'rgba(99, 102, 241, 0.12)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: -8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 4,
                    height: 24,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #6366f1, #a855f7)',
                  },
                }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: active ? '#818cf8' : 'text.secondary' }}>
                {item.label === 'Notifications' ? (
                  <Badge badgeContent={unreadData || 0} color="error" max={99}>
                    {item.icon}
                  </Badge>
                ) : item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 400,
                  color: active ? '#e2e8f0' : 'text.secondary',
                  fontSize: '0.9rem',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* User section */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 3,
            background: 'rgba(99, 102, 241, 0.06)',
            border: '1px solid rgba(139, 92, 246, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar sx={{ width: 36, height: 36, fontSize: 14, background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{user?.full_name}</Typography>
            <Typography variant="caption" color="text.disabled" noWrap>{user?.email}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              background: 'rgba(15, 15, 35, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(139, 92, 246, 0.08)',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            background: 'rgba(15, 15, 35, 0.75)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
          }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1, color: '#94a3b8' }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Notifications">
              <IconButton onClick={() => navigate('/notifications')} sx={{ color: '#94a3b8' }}>
                <Badge badgeContent={unreadData || 0} color="error" max={99}>
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
              <Avatar sx={{ width: 34, height: 34, fontSize: 14, background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 180 } } }}
            >
              <MenuItem disabled sx={{ opacity: 0.7 }}>
                <Typography variant="body2" fontWeight={600}>{user?.full_name}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
                <PersonRoundedIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} /> Profile
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                <LogoutRoundedIcon fontSize="small" sx={{ mr: 1.5 }} /> Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3, md: 4 },
            maxWidth: 1200,
            width: '100%',
            mx: 'auto',
          }}
        >
          <Box sx={{ animation: 'fadeInUp 0.3s ease forwards' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>

      {isMobile && (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {drawer}
        </Drawer>
      )}
    </Box>
  );
}
