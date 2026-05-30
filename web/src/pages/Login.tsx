import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { userApi } from '../api';
import { useAuthStore } from '../store/auth';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Link,
} from '@mui/material';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await userApi.login(username, password);
      const { id, username: name, email, role, token } = response.data.data;
      login({ id, username: name, email, role }, token);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || '登录失败');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
      <Card sx={{ maxWidth: 420, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight={700} color="primary">NetBench</Typography>
            <Typography variant="body2" color="text.secondary">网络测试平台 - 登录</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="用户名" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            <TextField fullWidth label="密码" type="password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 3, mb: 2 }}>{loading ? '登录中...' : '登录'}</Button>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/register" variant="body2">还没有账号？立即注册</Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
