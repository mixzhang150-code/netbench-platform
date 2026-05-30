import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { userApi } from '../api';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, TextField,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, IconButton, Tooltip, Select, MenuItem,
  FormControl, InputLabel, LinearProgress, Grid, useMediaQuery, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

interface UserInfo {
  id: string; username: string; email: string;
  role: string; createdAt: string;
}

export function Users() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 角色修改
  const [roleTarget, setRoleTarget] = useState<UserInfo | null>(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await userApi.list(1, 100);
      setUsers(res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const handleUpdateRole = async () => {
    if (!roleTarget || !newRole) return;
    try {
      await userApi.updateRole(roleTarget.id, newRole);
      setUsers(prev => prev.map(u => u.id === roleTarget.id ? { ...u, role: newRole } : u));
      setSnackbar({ open: true, message: `已将 ${roleTarget.username} 的角色改为 ${newRole}`, severity: 'success' });
      setRoleTarget(null);
    } catch {
      setSnackbar({ open: true, message: '修改失败', severity: 'error' });
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(filter.toLowerCase()) ||
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  const getRoleChip = (role: string) => {
    switch (role) {
      case 'admin': return <Chip label="管理员" size="small" color="error" />;
      case 'sponsor': return <Chip label="赞助者" size="small" color="warning" />;
      default: return <Chip label="用户" size="small" color="default" />;
    }
  };

  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));

  if (currentUser?.role !== 'admin') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">无权限访问</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/admin')}>返回</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700}>用户管理</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>管理系统用户和角色权限</Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            size="small"
            placeholder="搜索用户名或邮箱..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ maxWidth: 400 }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
          <Typography variant="body2" color="text.secondary">共 {filteredUsers.length} 个用户</Typography>
        </CardContent>
      </Card>

      {loading ? (
        <LinearProgress />
      ) : (
        <Card>
          {isMobile ? (
            <Box sx={{ p: 1 }}>
              {filteredUsers.map((u) => (
                <Card key={u.id} variant="outlined" sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                      {getRoleChip(u.role)}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.disabled">
                        {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                      </Typography>
                      {u.id !== currentUser?.id && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { setRoleTarget(u); setNewRole(u.role); }}
                        >
                          改角色
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>用户名</TableCell><TableCell>邮箱</TableCell><TableCell>角色</TableCell><TableCell>注册时间</TableCell><TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell><Typography fontWeight={500}>{u.username}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{u.email}</Typography></TableCell>
                      <TableCell>{getRoleChip(u.role)}</TableCell>
                      <TableCell>{new Date(u.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                      <TableCell align="center">
                        {u.id !== currentUser?.id && (
                          <Tooltip title="修改角色">
                            <Button size="small" variant="outlined"
                              onClick={() => { setRoleTarget(u); setNewRole(u.role); }}>改角色</Button>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {filteredUsers.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">{filter ? '未找到匹配用户' : '暂无用户数据'}</Typography>
            </Box>
          )}
        </Card>
      )}

      {/* 角色修改对话框 */}
      <Dialog open={!!roleTarget} onClose={() => setRoleTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>修改用户角色</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>用户: <strong>{roleTarget?.username}</strong> ({roleTarget?.email})</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>新角色</InputLabel>
            <Select value={newRole} label="新角色" onChange={(e) => setNewRole(e.target.value)}>
              <MenuItem value="user">普通用户</MenuItem>
              <MenuItem value="sponsor">赞助者</MenuItem>
              <MenuItem value="admin">管理员</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleTarget(null)}>取消</Button>
          <Button variant="contained" onClick={handleUpdateRole} disabled={!newRole || newRole === roleTarget?.role}>
            确认修改
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" icon={<CloseIcon fontSize="small" />}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
