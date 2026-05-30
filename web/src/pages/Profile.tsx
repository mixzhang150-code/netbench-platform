import { useState } from 'react';
import { userApi } from '../api';
import { useAuthStore } from '../store/auth';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Avatar, Alert, Snackbar, InputAdornment, IconButton,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

export function Profile() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setSnack({ open: true, msg: '请填写所有字段', severity: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setSnack({ open: true, msg: '新密码至少6位', severity: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnack({ open: true, msg: '两次输入的密码不一致', severity: 'error' });
      return;
    }
    if (currentPassword === newPassword) {
      setSnack({ open: true, msg: '新密码不能与当前密码相同', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setSnack({ open: true, msg: '密码修改成功', severity: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setSnack({ open: true, msg: err.response?.data?.error?.message || '修改失败，请检查当前密码', severity: 'error' });
    } finally { setLoading(false); }
  };

  const pwdField = (label: string, value: string, onChange: (v: string) => void, show: boolean, toggleShow: () => void) => (
    <TextField
      fullWidth size="small" margin="normal" label={label}
      type={show ? 'text' : 'password'} value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleChange()}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={toggleShow} edge="end" size="small">
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>个人设置</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>管理您的账户信息</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24, fontWeight: 700 }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{user?.username}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{user?.role === 'admin' ? '管理员' : user?.role === 'sponsor' ? '赞助者' : '用户'}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">{user?.email || '-'}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>修改密码</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>定期更换密码可以提高账户安全性</Typography>

              {pwdField('当前密码', currentPassword, setCurrentPassword, showCurrent, () => setShowCurrent(!showCurrent))}
              {pwdField('新密码', newPassword, setNewPassword, showNew, () => setShowNew(!showNew))}
              {pwdField('确认新密码', confirmPassword, setConfirmPassword, showConfirm, () => setShowConfirm(!showConfirm))}

              <Button
                variant="contained"
                onClick={handleChange}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                {loading ? '提交中...' : '确认修改'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
