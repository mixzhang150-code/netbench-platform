import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { nodeApi } from '../api';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Chip,
  LinearProgress, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Snackbar, Alert, Tooltip,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import MemoryIcon from '@mui/icons-material/Memory';
import SpeedIcon from '@mui/icons-material/Speed';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

interface NodeData {
  id: string;
  name: string;
  ownerId: string | null;
  status: string;
  version: string;
  platform: string;
  platformDetails: string;
  ip: string;
  location: {
    country: string;
    region?: string;
    city: string;
    lat?: number;
    lon?: number;
    isp: string;
  };
  capabilities: {
    ping: boolean;
    http: boolean;
    speedtest: boolean;
    maxConcurrentTasks?: number;
  };
  token: string;
  reputation: {
    score: number;
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    avgResponseTime: number;
    uptime: number;
    lastEvaluated: string;
  };
  stats: {
    currentTasks: number;
    totalTasksCompleted: number;
    totalUptime: number;
    lastTestAt: string;
    cpuUsage: number;
    memoryUsage: number;
  };
  lastHeartbeat: string;
  registeredAt: string;
  sponsor?: string;
}

export function Nodes() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (user?.role !== 'admin') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">无权限访问</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/admin')}>返回后台管理</Button>
      </Box>
    );
  }

  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 删除
  const [deleteTarget, setDeleteTarget] = useState<NodeData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑
  const [editTarget, setEditTarget] = useState<NodeData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', city: '', isp: '', platform: '', sponsor: '' });
  const [editLoading, setEditLoading] = useState(false);

  // 注册
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: '', platform: 'linux', ip: '', city: '', isp: '' });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameChecking, setNameChecking] = useState(false);

  // 批量编辑赞助商
  const [batchSponsorOpen, setBatchSponsorOpen] = useState(false);
  const [batchSponsorLoading, setBatchSponsorLoading] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [batchSponsorValue, setBatchSponsorValue] = useState('');

  useEffect(() => { loadNodes(); const interval = setInterval(loadNodes, 30000); return () => clearInterval(interval); }, []);

  const loadNodes = async () => {
    try { const response = await nodeApi.list(1, 100); setNodes(response.data.data || []); } catch {} finally { setLoading(false); }
  };

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await nodeApi.delete(deleteTarget.id);
      setSnackbar({ open: true, message: `节点 "${deleteTarget.name}" 已删除`, severity: 'success' });
      setDeleteTarget(null);
      loadNodes();
    } catch {
      setSnackbar({ open: true, message: '删除失败，请重试', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  const handleEditOpen = (node: NodeData) => {
    setEditTarget(node);
    setEditForm({
      name: node.name,
      city: node.location?.city || '',
      isp: node.location?.isp || '',
      platform: node.platform || 'linux',
      sponsor: node.sponsor || '',
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) return;

    setEditLoading(true);
    try {
      await nodeApi.update(editTarget.id, {
        name: editForm.name.trim(),
        platform: editForm.platform,
        location: {
          country: editTarget.location?.country || 'CN',
          city: editForm.city,
          isp: editForm.isp,
          lat: 0, lon: 0,
        },
      });

      if (editForm.sponsor !== (editTarget.sponsor || '')) {
        await nodeApi.updateSponsor(editTarget.id, editForm.sponsor);
      }

      setSnackbar({ open: true, message: `节点 "${editForm.name}" 已更新`, severity: 'success' });
      setEditTarget(null);
      loadNodes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || '更新失败';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const checkNameUnique = async (name: string, excludeId?: string) => {
    if (!name.trim()) return;
    setNameChecking(true);
    try {
      const res = await nodeApi.checkName(name.trim());
      if (!res.data.success || !res.data.available) {
        setNameError('节点名称已存在，请使用其他名称');
      } else {
        setNameError('');
      }
    } catch { setNameError(''); }
    setNameChecking(false);
  };

  const handleNameChange = (value: string) => {
    setRegisterForm(prev => ({ ...prev, name: value }));
    setNameError('');
  };

  const handleBatchSponsor = async () => {
    if (selectedNodes.length === 0) return;

    setBatchSponsorLoading(true);
    try {
      const updates = selectedNodes.map(nodeId => ({
        nodeId,
        sponsor: batchSponsorValue,
      }));

      await nodeApi.batchUpdateSponsor(updates);

      setSnackbar({
        open: true,
        message: `已成功更新 ${selectedNodes.length} 个节点的赞助商信息`,
        severity: 'success',
      });
      setBatchSponsorOpen(false);
      setSelectedNodes([]);
      setBatchSponsorValue('');
      loadNodes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || '批量更新失败';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setBatchSponsorLoading(false);
    }
  };

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleRegister = async () => {
    if (!registerForm.name.trim()) { setNameError('节点名称不能为空'); return; }
    if (nameError) return;

    setRegisterLoading(true);
    try {
      await nodeApi.register({
        name: registerForm.name.trim(),
        platform: registerForm.platform,
        ip: registerForm.ip || undefined,
        location: {
          country: 'CN',
          city: registerForm.city || '',
          isp: registerForm.isp || '',
          lat: 0, lon: 0,
        },
      });
      setSnackbar({ open: true, message: `节点 "${registerForm.name}" 注册成功`, severity: 'success' });
      setRegisterOpen(false);
      setRegisterForm({ name: '', platform: 'linux', ip: '', city: '', isp: '' });
      loadNodes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || '注册失败';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setRegisterLoading(false);
    }
  };

  const filteredNodes = nodes.filter(node =>
    node.name.toLowerCase().includes(filter.toLowerCase()) ||
    node.location?.city?.toLowerCase().includes(filter.toLowerCase())
  );

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'online': return <Chip label="在线" size="small" color="success" />;
      case 'offline': return <Chip label="离线" size="small" color="error" />;
      case 'maintenance': return <Chip label="维护中" size="small" color="warning" />;
      default: return <Chip label={status} size="small" />;
    }
  };

  const getReputationColor = (score: number) => { if (score >= 80) return '#2e7d32'; if (score >= 50) return '#ed6c02'; return '#d32f2f'; };

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天 ${hours}时`;
    if (hours > 0) return `${hours}时 ${mins}分`;
    return `${mins}分`;
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '-';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  const getCpuColor = (usage: number) => {
    if (usage < 30) return 'success';
    if (usage < 70) return 'warning';
    return 'error';
  };
  const getMemColor = (usage: number) => {
    if (usage < 50) return 'success';
    if (usage < 80) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700}>节点管理</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>查看、编辑、注册和删除测试节点</Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="搜索节点名称或城市..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ maxWidth: 400, flexGrow: 1 }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegisterOpen(true)}>
            注册节点
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setBatchSponsorOpen(true)}
            disabled={selectedNodes.length === 0}
          >
            批量编辑赞助商 {selectedNodes.length > 0 && `(${selectedNodes.length})`}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><LinearProgress sx={{ maxWidth: 200, mx: 'auto' }} /></Box>
      ) : (
        <Grid container spacing={2}>
          {filteredNodes.map((node) => (
            <Grid item xs={12} sm={6} md={4} key={node.id}>
              <Card
                sx={{
                  position: 'relative',
                  border: selectedNodes.includes(node.id) ? '2px solid' : '1px solid',
                  borderColor: selectedNodes.includes(node.id) ? 'secondary.main' : 'divider',
                  cursor: 'pointer',
                }}
                onClick={() => toggleNodeSelection(node.id)}
              >
                <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: selectedNodes.includes(node.id) ? 'secondary.main' : 'grey.400',
                      backgroundColor: selectedNodes.includes(node.id) ? 'secondary.main' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedNodes.includes(node.id) && (
                      <Typography sx={{ color: 'white', fontSize: 16, fontWeight: 700 }}>✓</Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditOpen(node); }} sx={{ color: 'text.secondary' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(node); }} sx={{ color: 'text.secondary' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <CardContent sx={{ pr: 7 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={600}>{node.name}</Typography>
                    {getStatusChip(node.status)}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                    <FingerprintIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Tooltip title={node.ip}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{node.ip}</Typography>
                    </Tooltip>
                    {node.version && (
                      <Chip label={`v${node.version}`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">位置</Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right', maxWidth: '60%' }}>
                        {[node.location?.city, node.location?.region, node.location?.country].filter(Boolean).join(', ') || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">平台</Typography>
                      <Typography variant="body2" fontWeight={500}>{node.platformDetails || node.platform || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">ISP</Typography>
                      <Typography variant="body2" fontWeight={500}>{node.location?.isp || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">赞助商</Typography>
                      <Typography variant="body2" fontWeight={500} color={node.sponsor ? 'secondary.main' : 'text.disabled'}>
                        {node.sponsor || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <SpeedIcon sx={{ fontSize: 14 }} /> 系统负载
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MemoryIcon sx={{ fontSize: 16, color: `${getCpuColor(node.stats?.cpuUsage ?? 0)}.main` }} />
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={node.stats?.cpuUsage ?? 0}
                            color={getCpuColor(node.stats?.cpuUsage ?? 0)}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" fontWeight={600} sx={{ minWidth: 36, textAlign: 'right' }}>
                            {(node.stats?.cpuUsage ?? 0).toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MemoryIcon sx={{ fontSize: 16, color: `${getMemColor(node.stats?.memoryUsage ?? 0)}.main` }} />
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={node.stats?.memoryUsage ?? 0}
                            color={getMemColor(node.stats?.memoryUsage ?? 0)}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" fontWeight={600} sx={{ minWidth: 36, textAlign: 'right' }}>
                            {(node.stats?.memoryUsage ?? 0).toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, mt: 1 }}>
                    <Grid container spacing={1} columns={3}>
                      <Grid item xs={1}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">信誉</Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ color: getReputationColor(node.reputation?.score || 0) }}>{node.reputation?.score || 0}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={1}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">可用率</Typography>
                          <Typography variant="body2" fontWeight={500}>{node.reputation?.uptime?.toFixed(0) || 0}%</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={1}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">任务</Typography>
                          <Typography variant="body2" fontWeight={500}>
                            <Typography component="span" sx={{ color: 'success.main' }}>{node.reputation?.successfulTasks || 0}</Typography>
                            /<Typography component="span" sx={{ color: 'error.main' }}>{node.reputation?.failedTasks || 0}</Typography>
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}><ScheduleIcon sx={{ fontSize: 12 }} /> 运行时间</Typography>
                      <Typography variant="caption" fontWeight={500}>{formatUptime(node.stats?.totalUptime ?? 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">当前/已完成</Typography>
                      <Typography variant="caption" fontWeight={500}>{node.stats?.currentTasks ?? 0} / {node.stats?.totalTasksCompleted ?? 0}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">最后心跳</Typography>
                      <Typography variant="caption" fontWeight={500}>{formatTimeAgo(node.lastHeartbeat)}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {node.capabilities?.ping && <Chip label="Ping" size="small" variant="outlined" color="primary" />}
                    {node.capabilities?.http && <Chip label="HTTP" size="small" variant="outlined" color="success" />}
                    {node.capabilities?.speedtest && <Chip label="Speed" size="small" variant="outlined" color="secondary" />}
                    {node.capabilities?.maxConcurrentTasks && (
                      <Tooltip title={`最大并发任务数: ${node.capabilities.maxConcurrentTasks}`}>
                        <Chip label={`${node.capabilities.maxConcurrentTasks}并发`} size="small" variant="outlined" color="info" />
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {filteredNodes.length === 0 && (
            <Grid item xs={12}><Card><CardContent sx={{ textAlign: 'center', py: 6 }}><Typography color="text.secondary">暂无节点数据</Typography></CardContent></Card></Grid>
          )}
        </Grid>
      )}

      {/* 编辑节点对话框 */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑节点 - {editTarget?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="节点名称 *"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>平台</InputLabel>
                <Select
                  value={editForm.platform}
                  label="平台"
                  onChange={(e) => setEditForm(prev => ({ ...prev, platform: e.target.value }))}
                >
                  <MenuItem value="linux">Linux</MenuItem>
                  <MenuItem value="windows">Windows</MenuItem>
                  <MenuItem value="macOS">macOS</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="ISP/运营商"
                value={editForm.isp}
                onChange={(e) => setEditForm(prev => ({ ...prev, isp: e.target.value }))}
                placeholder="如：中国电信"
                sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              label="城市"
              value={editForm.city}
              onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
              placeholder="如：北京"
              fullWidth
            />
            <TextField
              label="赞助商"
              value={editForm.sponsor}
              onChange={(e) => setEditForm(prev => ({ ...prev, sponsor: e.target.value }))}
              placeholder="如：腾讯云、阿里云（留空表示无赞助商）"
              fullWidth
              helperText="设置节点的赞助商信息，将在测试结果中显示"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>取消</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editLoading || !editForm.name.trim()}>
            {editLoading ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除节点</DialogTitle>
        <DialogContent>
          <Typography>确定要删除节点 <strong>{deleteTarget?.name}</strong> 吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 注册节点对话框 */}
      <Dialog open={registerOpen} onClose={() => { setRegisterOpen(false); setNameError(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>注册新节点</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="节点名称 *"
              value={registerForm.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={(e) => e.target.value.trim() && checkNameUnique(e.target.value)}
              error={!!nameError}
              helperText={nameError || (nameChecking ? '正在检查名称唯一性...' : '')}
              required
              fullWidth
            />
            <TextField
              label="IP 地址"
              value={registerForm.ip}
              onChange={(e) => setRegisterForm(prev => ({ ...prev, ip: e.target.value }))}
              placeholder="留空则自动检测"
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="平台"
                select
                value={registerForm.platform}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, platform: e.target.value }))}
                sx={{ flex: 1 }}
                SelectProps={{ native: true }}
              >
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
                <option value="macOS">macOS</option>
              </TextField>
              <TextField
                label="ISP/运营商"
                value={registerForm.isp}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, isp: e.target.value }))}
                placeholder="如：中国电信"
                sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              label="城市"
              value={registerForm.city}
              onChange={(e) => setRegisterForm(prev => ({ ...prev, city: e.target.value }))}
              placeholder="如：北京"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRegisterOpen(false); setNameError(''); }}>取消</Button>
          <Button variant="contained" onClick={handleRegister} disabled={registerLoading || !!nameError || !registerForm.name.trim()}>
            {registerLoading ? '注册中...' : '确认注册'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 批量编辑赞助商对话框 */}
      <Dialog open={batchSponsorOpen} onClose={() => setBatchSponsorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>批量编辑赞助商</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              已选择 {selectedNodes.length} 个节点，将为它们设置相同的赞助商信息：
            </Typography>
            <TextField
              label="赞助商名称"
              value={batchSponsorValue}
              onChange={(e) => setBatchSponsorValue(e.target.value)}
              placeholder="如：腾讯云、阿里云（留空则清除所有选中节点的赞助商）"
              fullWidth
              helperText="支持任意文本，将显示在测试结果的区域统计中"
            />
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>选中的节点：</Typography>
              {selectedNodes.map(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                return (
                  <Chip
                    key={nodeId}
                    label={node?.name || nodeId}
                    size="small"
                    onDelete={() => toggleNodeSelection(nodeId)}
                    sx={{ m: 0.5 }}
                  />
                );
              })}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchSponsorOpen(false)}>取消</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBatchSponsor}
            disabled={batchSponsorLoading || selectedNodes.length === 0}
          >
            {batchSponsorLoading ? '更新中...' : `确认更新 ${selectedNodes.length} 个节点`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} icon={<CloseIcon fontSize="small" />}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
