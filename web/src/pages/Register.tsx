import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { userApi } from '../api';
import { useAuthStore } from '../store/auth';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Link, MenuItem,
} from '@mui/material';

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await userApi.register(username, email, password, role);
      const { id, username: name, email: userEmail, role: userRole, token } = response.data.data;
      login({ id, username: name, email: userEmail, role: userRole }, token);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || '注册失败');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
      <Card sx={{ maxWidth: 420, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight={700} color="primary">NetBench</Typography>
            <Typography variant="body2" color="text.secondary">网络测试平台 - 注册</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="用户名" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <TextField fullWidth label="邮箱" type="email" margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField fullWidth label="密码" type="password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required helperText="至少8位" />
            <TextField fullWidth select label="角色" margin="normal" value={role} onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="user">普通用户</MenuItem>
              <MenuItem value="sponsor">节点赞助者</MenuItem>
            </TextField>
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 3, mb: 2 }}>{loading ? '注册中...' : '注册'}</Button>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" variant="body2">已有账号？立即登录</Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
