import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Button, Divider, AppBar, Toolbar, IconButton,
  useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import LanguageIcon from '@mui/icons-material/Language';
import SpeedIcon from '@mui/icons-material/Speed';
import DnsIcon from '@mui/icons-material/Dns';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import { useAuthStore } from '../store/auth';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

const publicNavItems = [
  { path: '/', label: '仪表盘', icon: <DashboardIcon /> },
  { path: '/ping', label: 'Ping测试', icon: <WifiTetheringIcon /> },
  { path: '/http', label: 'HTTP测试', icon: <LanguageIcon /> },
  // { path: '/speedtest', label: '网络测速', icon: <SpeedIcon /> },
  { path: '/history', label: '历史记录', icon: <HistoryIcon /> },
  { path: '/sponsor', label: '节点赞助', icon: <DownloadIcon /> },
];

const adminSubNavItems = [
  { path: '/admin', label: '概览', icon: <SettingsIcon /> },
  { path: '/admin/nodes', label: '节点管理', icon: <DnsIcon /> },
  { path: '/admin/users', label: '用户管理', icon: <PeopleIcon /> },
];

function NavContent({ onNavigate, collapsed, onToggleCollapse }: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    onNavigate?.();
  };

  const navItemSx = (isActive: boolean) => ({
    borderRadius: 2,
    mb: collapsed ? 0.25 : 0.5,
    py: collapsed ? 1 : 1,
    px: collapsed ? 1 : undefined,
    mx: collapsed ? 0.75 : undefined,
    justifyContent: collapsed ? 'center' : 'flex-start',
    transition: 'all 0.2s ease-in-out',
    ...(isActive ? {
      bgcolor: 'primary.50',
      borderLeft: collapsed ? 'none' : '3px solid',
      borderColor: 'primary.main',
      '& .MuiListItemIcon-root': { color: 'primary.main' },
      '& .MuiListItemText-primary': { fontWeight: 700, color: 'primary.dark' },
      '&:hover': { bgcolor: 'primary.100' },
    } : {
      borderLeft: collapsed ? 'none' : '3px solid transparent',
      '&:hover': {
        bgcolor: 'grey.100',
        ...(collapsed ? {} : { transform: 'translateX(4px)' }),
      },
      '& .MuiListItemIcon-root': { color: 'text.secondary' },
    }),
  });

  const renderItem = (item: (typeof publicNavItems)[0], isActive: boolean) => (
    <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right" arrow>
      <ListItemButton
        component={NavLink}
        to={item.path}
        selected={isActive}
        onClick={() => onNavigate?.()}
        sx={navItemSx(isActive)}
      >
        <ListItemIcon sx={{ minWidth: collapsed ? 36 : 40 }}>{item.icon}</ListItemIcon>
        {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />}
      </ListItemButton>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        p: collapsed ? 1.5 : 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 1,
        minHeight: 64,
      }}>
        {!collapsed && (
          <>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              flexShrink: 0,
            }}>
              <SpeedIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="h6" fontWeight={700} color="primary" lineHeight={1.2}>NetBench</Typography>
              <Typography variant="caption" color="text.secondary">网络测试平台</Typography>
            </Box>
          </>
        )}
        {collapsed && (
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
          }}>
            <SpeedIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
        )}
      </Box>

      <List sx={{ flex: 1, px: collapsed ? 0 : 1.5, py: collapsed ? 1 : 1.5, overflow: 'auto' }}>
        {publicNavItems.map((item) => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return renderItem(item, isActive);
        })}

        {isAuthenticated && user?.role === 'admin' && (
          <>
            <Divider sx={{ my: collapsed ? 1 : 1.5, mx: collapsed ? 1 : undefined }} />
            {!collapsed && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, mb: 0.75, display: 'block', fontWeight: 600, letterSpacing: '0.04em' }}>管理</Typography>
            )}
            {adminSubNavItems.map((item) => {
              const isActive = item.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(item.path);
              return (
                <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right" arrow>
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    selected={isActive}
                    onClick={() => onNavigate?.()}
                    sx={{
                      ...navItemSx(isActive),
                      mb: collapsed ? 0.25 : 0.3,
                      py: collapsed ? 1 : 0.85,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: collapsed ? 36 : 40 }}>{item.icon}</ListItemIcon>
                    {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </>
        )}
      </List>

      <Box sx={{
        p: collapsed ? 1 : 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
      }}>
        {onToggleCollapse && (
          <IconButton onClick={onToggleCollapse} size="small"
            sx={{
              alignSelf: collapsed ? 'center' : 'flex-end',
              mb: 0.75,
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}

        {isAuthenticated ? (
          !collapsed ? (
            <>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5,
                p: 1.25, borderRadius: 2, bgcolor: 'grey.50',
              }}>
                <Avatar sx={{
                  width: 34, height: 34, bgcolor: 'primary.light',
                  fontSize: 14, fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(37,99,235,0.15)',
                }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{user?.username}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{user?.role}</Typography>
                </Box>
              </Box>
              <Button
                fullWidth size="small" startIcon={<PersonIcon />}
                onClick={() => { navigate('/profile'); onNavigate?.(); }}
                color="inherit"
                sx={{ justifyContent: 'flex-start', color: 'text.secondary', mb: 0.5, py: 0.7, borderRadius: 1.5, transition: 'all 0.15s', '&:hover': { bgcolor: 'grey.100', color: 'text.primary' } }}
              >
                个人设置
              </Button>
              <Button
                fullWidth size="small" startIcon={<LogoutIcon />}
                onClick={handleLogout} color="inherit"
                sx={{ justifyContent: 'flex-start', color: 'text.secondary', py: 0.7, borderRadius: 1.5, transition: 'all 0.15s', '&:hover': { bgcolor: 'error.50', color: 'error.main' } }}
              >
                退出登录
              </Button>
            </>
          ) : (
            <Tooltip title={`${user?.username}`} placement="right" arrow>
              <Avatar
                sx={{
                  width: 36, height: 36, bgcolor: 'primary.light',
                  fontSize: 13, fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(37,99,235,0.15)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'scale(1.08)' },
                }}
                onClick={() => { navigate('/profile'); onNavigate?.(); }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          )
        ) : (
          !collapsed ? (
            <Button fullWidth variant="contained" startIcon={<LoginIcon />} onClick={() => navigate('/login')}
              sx={{ py: 0.9, borderRadius: 2, transition: 'all 0.2s ease-in-out', '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' } }}
            >
              登录
            </Button>
          ) : (
            <Tooltip title="登录" placement="right" arrow>
              <IconButton onClick={() => navigate('/login')}
                sx={{
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'primary.50', color: 'primary.main' },
                }}
              >
                <LoginIcon />
              </IconButton>
            </Tooltip>
          )
        )}
      </Box>
    </Box>
  );
}

export function Layout() {
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return location.pathname.startsWith('/ping') || location.pathname.startsWith('/http');
  });

  useEffect(() => {
    if (isMobile) return;
    const isTestPage = location.pathname.startsWith('/ping') || location.pathname.startsWith('/http');
    setCollapsed(isTestPage);
  }, [location.pathname, isMobile]);

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
            <IconButton edge="start" onClick={() => setDrawerOpen(true)} size="small"
              sx={{
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '7px',
                bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
              }}>
                <SpeedIcon sx={{ color: '#fff', fontSize: 16 }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="primary" fontSize={{ xs: '1rem', sm: '1.25rem' }}>NetBench</Typography>
            </Box>
            <Box sx={{ width: 36 }} />
          </Toolbar>
        </AppBar>

        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
              borderRight: 'none',
            },
          }}
        >
          <NavContent onNavigate={() => setDrawerOpen(false)} />
        </Drawer>

        <Box component="main" sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.50' }}>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 1200, mx: 'auto' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <NavContent collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      </Drawer>

      <Box component="main" sx={{
        flex: 1, overflow: 'auto', bgcolor: 'grey.50',
        transition: theme.transitions.create('margin-left', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
