import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { nodeApi, userApi, monitorApi, sponsorShowcaseApi } from '../api';
import {
  Box, Typography, Card, CardContent, Grid, Chip,
  LinearProgress, Button, Paper, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, FormControlLabel, Select, MenuItem, InputLabel, FormControl, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Tooltip, Alert, Snackbar,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import DownloadIcon from '@mui/icons-material/Download';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { SponsorShowcaseItem, SponsorShowcaseConfig } from '../api';

interface ServiceHealth {
  service: string;
  status: string;
  uptime?: number;
  dependencies?: Record<string, string>;
}

export function Admin() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [stats, setStats] = useState({
    totalNodes: 0, onlineNodes: 0, offlineNodes: 0,
    totalUsers: 0, adminUsers: 0,
  });
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const [sponsorConfigs, setSponsorConfigs] = useState<SponsorShowcaseConfig[]>([]);
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorShowcaseItem | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>('ping');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadAll(); const t = setInterval(loadAll, 60000); return () => clearInterval(t); }, []);

  const loadAll = async () => {
    try {
      const [nodesRes, onlineRes, usersRes, monRes] = await Promise.allSettled([
        nodeApi.list(1, 1),
        nodeApi.list(1, 1000),
        userApi.list(1, 1000),
        monitorApi.services(),
      ]);

      const totalNodes = nodesRes.status === 'fulfilled' ? (nodesRes.value.data.meta?.total || 0) : 0;
      const nodeData = onlineRes.status === 'fulfilled' ? (onlineRes.value.data.data || []) : [];
      const onlineNodes = nodeData.filter((n: { status: string }) => n.status === 'online').length;
      const userData = usersRes.status === 'fulfilled' ? (usersRes.value.data.data || []) : [];

      setStats({
        totalNodes,
        onlineNodes,
        offlineNodes: totalNodes - onlineNodes,
        totalUsers: userData.length,
        adminUsers: userData.filter((u: { role: string }) => u.role === 'admin').length,
      });

      if (monRes.status === 'fulfilled' && monRes.value.data?.data) {
        setServices(monRes.value.data.data);
      }
    } catch {} finally { setLoading(false); }
  };

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return '#2e7d32';
    if (status === 'degraded') return '#ed6c02';
    return '#d32f2f';
  };

  const loadSponsorConfigs = async () => {
    try {
      const res = await sponsorShowcaseApi.getAllConfigs();
      if (res.data.success && res.data.data) {
        setSponsorConfigs(res.data.data);
      }
    } catch {}
  };

  useEffect(() => { loadSponsorConfigs(); }, []);

  const currentConfig = sponsorConfigs.find(c => c.page === selectedPage);
  const currentSponsors = currentConfig?.sponsors || [];

  const handleTogglePageConfig = async (page: string, enabled: boolean) => {
    try {
      await sponsorShowcaseApi.updatePageConfig(page, { enabled });
      setSnackbar({ open: true, message: `${page} 页面赞助商展示已${enabled ? '启用' : '禁用'}`, severity: 'success' });
      loadSponsorConfigs();
    } catch {
      setSnackbar({ open: true, message: '操作失败', severity: 'error' });
    }
  };

  const handleSaveSponsor = async (sponsorData: Partial<SponsorShowcaseItem>) => {
    try {
      if (editingSponsor?.id) {
        await sponsorShowcaseApi.updateSponsor(editingSponsor.id, sponsorData);
        setSnackbar({ open: true, message: '赞助商已更新', severity: 'success' });
      } else {
        await sponsorShowcaseApi.createSponsor(sponsorData as Omit<SponsorShowcaseItem, 'id' | 'createdAt' | 'updatedAt'>);
        setSnackbar({ open: true, message: '赞助商已添加', severity: 'success' });
      }
      setSponsorDialogOpen(false);
      setEditingSponsor(null);
      loadSponsorConfigs();
    } catch {
      setSnackbar({ open: true, message: '保存失败', severity: 'error' });
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!confirm('确定要删除这个赞助商吗？')) return;
    try {
      await sponsorShowcaseApi.deleteSponsor(id);
      setSnackbar({ open: true, message: '赞助商已删除', severity: 'success' });
      loadSponsorConfigs();
    } catch {
      setSnackbar({ open: true, message: '删除失败', severity: 'error' });
    }
  };
  const getStatusLabel = (s: string) => s === 'healthy' ? '正常' : s === 'degraded' ? '降级' : '异常';

  const quickActions = [
    { icon: <DnsIcon color="success" sx={{ fontSize: 32 }} />, title: '节点管理', desc: `${stats.onlineNodes}/${stats.totalNodes} 在线 | 支持赞助商设置`, path: '/admin/nodes', color: 'success' },
    { icon: <CorporateFareIcon color="secondary" sx={{ fontSize: 32 }} />, title: '赞助商管理', desc: '批量设置节点赞助商信息', path: '/admin/nodes', color: 'secondary' },
    { icon: <PeopleIcon color="primary" sx={{ fontSize: 32 }} />, title: '用户管理', desc: `${stats.adminUsers} 管理员 / ${stats.totalUsers} 用户`, path: '/admin/users', color: 'primary' },
    { icon: <MonitorHeartIcon color="info" sx={{ fontSize: 32 }} />, title: '系统监控', desc: `${services.filter(s => s.status === 'healthy').length}/${services.length} 服务正常`, path: undefined, color: 'info' },
    { icon: <DownloadIcon color="warning" sx={{ fontSize: 32 }} />, title: '节点赞助页面', desc: '公开的安装指南和脚本', path: '/sponsor', color: 'warning' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>后台管理</Typography>
          <Typography variant="body2" color="text.secondary">欢迎, {user?.username}</Typography>
        </Box>
        <Button size="small" onClick={loadAll} disabled={loading}>刷新</Button>
      </Box>

      {/* 统计卡片 */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: '总节点数', value: stats.totalNodes, sub: `离线 ${stats.offlineNodes}`, color: 'text.primary' },
          { label: '在线节点', value: stats.onlineNodes, sub: '', color: 'success.main' },
          { label: '总用户数', value: stats.totalUsers, sub: `管理员 ${stats.adminUsers}`, color: 'text.primary' },
          { label: '服务状态', value: `${services.filter(s => s.status === 'healthy').length}/${services.length}`, sub: '正常', color: services.some(s => s.status !== 'healthy') ? 'warning.main' : 'success.main' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Typography variant="h4" fontWeight={700} color={s.color}>{loading ? '-' : s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                {s.sub && <Typography variant="caption" color="text.disabled">{s.sub}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 快捷操作 */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2.5, flexWrap: 'wrap', justifyContent: 'stretch' }}>
        {quickActions.map((a) => (
          <Card
            key={a.title}
            sx={{
              cursor: a.path ? 'pointer' : 'default',
              '&:hover': a.path ? { boxShadow: 6, transform: 'translateY(-2px)' } : {},
              borderLeft: `4px solid`,
              borderColor: `${a.color}.main`,
              transition: 'all 0.2s ease-in-out',
              flex: '1 1 calc(20% - 20px)',
              minWidth: '220px',
              maxWidth: 'calc(25% - 19px)',
            }}
            onClick={() => a.path && navigate(a.path)}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              {a.icon}
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{a.title}</Typography>
                <Typography variant="body2" color="text.secondary">{a.desc}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* 服务健康状态 */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>服务健康状态</Typography>
          {loading ? (
            <LinearProgress />
          ) : services.length > 0 ? (
            <Grid container spacing={2}>
              {services.map((svc) => (
                <Grid item xs={12} sm={6} md={4} key={svc.service}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {svc.status === 'healthy'
                        ? <CheckCircleIcon sx={{ color: getStatusColor(svc.status), fontSize: 20 }} />
                        : svc.status === 'degraded'
                          ? <WarningIcon sx={{ color: getStatusColor(svc.status), fontSize: 20 }} />
                          : <ErrorIcon sx={{ color: getStatusColor(svc.status), fontSize: 20 }} />}
                      <Typography variant="body2" fontWeight={600}>{svc.service}</Typography>
                      <Chip label={getStatusLabel(svc.status)} size="small"
                        color={svc.status === 'healthy' ? 'success' : svc.status === 'degraded' ? 'warning' : 'error'}
                        sx={{ ml: 'auto', height: 22, fontSize: 12 }} />
                    </Box>
                    {svc.uptime !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        运行时间: {Math.floor(svc.uptime / 3600)}h{Math.floor((svc.uptime % 3600) / 60)}m
                      </Typography>
                    )}
                    {svc.dependencies && Object.entries(svc.dependencies).map(([k, v]) => (
                      <Box key={k} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Typography variant="caption" color="text.disabled">{k}:</Typography>
                        <Typography variant="caption" color={v === 'connected' ? 'success.main' : 'error.main'}>{v}</Typography>
                      </Box>
                    ))}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>暂无服务监控数据</Typography>
          )}
        </CardContent>
      </Card>

      {/* 赞助商展示管理 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight={600}>
              <CorporateFareIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 24 }} />
              赞助商展示管理
            </Typography>
          </Box>

          {/* 页面选择和启用控制 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {['ping', 'http', 'dashboard', 'sponsor'].map((page) => {
              const config = sponsorConfigs.find(c => c.page === page);
              return (
                <Grid item xs={6} sm={3} key={page}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderColor: selectedPage === page ? 'primary.main' : 'divider',
                      bgcolor: selectedPage === page ? 'action.selected' : 'background.paper',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setSelectedPage(page)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {page === 'ping' ? 'Ping 测试' : page === 'http' ? 'HTTP 测试' : page === 'dashboard' ? '仪表盘' : '赞助页面'}
                      </Typography>
                      <Switch
                        size="small"
                        checked={config?.enabled || false}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleTogglePageConfig(page, e.target.checked);
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          {/* 当前页面的赞助商列表 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              当前页面赞助商 ({currentSponsors.length} 个)
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { setEditingSponsor(null); setSponsorDialogOpen(true); }}
            >
              添加赞助商
            </Button>
          </Box>

          {currentSponsors.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>名称</TableCell>
                    <TableCell>位置</TableCell>
                    <TableCell align="center">状态</TableCell>
                    <TableCell align="center">排序</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentSponsors.sort((a, b) => a.order - b.order).map((sponsor) => (
                    <TableRow key={sponsor.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {sponsor.logo && (
                            <Box component="img" src={sponsor.logo} alt="" sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          <Typography variant="body2" fontWeight={500}>{sponsor.name}</Typography>
                          {sponsor.url && (
                            <Tooltip title={sponsor.url}>
                              <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={sponsor.position} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={sponsor.enabled ? '启用' : '禁用'}
                          size="small"
                          color={sponsor.enabled ? 'success' : 'default'}
                          sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="center">{sponsor.order}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => { setEditingSponsor(sponsor); setSponsorDialogOpen(true); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteSponsor(sponsor.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>该页面暂无赞助商，点击上方按钮添加</Alert>
          )}
        </CardContent>
      </Card>

      {/* 赞助商编辑对话框 */}
      <SponsorEditDialog
        open={sponsorDialogOpen}
        onClose={() => { setSponsorDialogOpen(false); setEditingSponsor(null); }}
        onSave={handleSaveSponsor}
        sponsor={editingSponsor}
        defaultPosition={selectedPage === 'ping' || selectedPage === 'http' ? 'top' : 'top'}
      />

      {/* Snackbar 提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity as any} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface SponsorEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<SponsorShowcaseItem>) => void;
  sponsor: SponsorShowcaseItem | null;
  defaultPosition: 'top' | 'sidebar' | 'footer';
}

function SponsorEditDialog({ open, onClose, onSave, sponsor, defaultPosition }: SponsorEditDialogProps) {
  const [form, setForm] = useState({
    name: '',
    logo: '',
    url: '',
    description: '',
    position: defaultPosition,
    enabled: true,
    order: 0,
  });

  useEffect(() => {
    if (sponsor) {
      setForm({
        name: sponsor.name,
        logo: sponsor.logo || '',
        url: sponsor.url || '',
        description: sponsor.description || '',
        position: sponsor.position,
        enabled: sponsor.enabled,
        order: sponsor.order,
      });
    } else {
      setForm({
        name: '',
        logo: '',
        url: '',
        description: '',
        position: defaultPosition,
        enabled: true,
        order: 0,
      });
    }
  }, [sponsor, open]);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(sponsor ? { ...form, id: sponsor.id } : form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{sponsor ? '编辑赞助商' : '添加赞助商'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="名称 *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Logo URL"
              value={form.logo}
              onChange={(e) => setForm({ ...form, logo: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="链接地址"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="描述"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>位置</InputLabel>
              <Select
                value={form.position}
                label="位置"
                onChange={(e) => setForm({ ...form, position: e.target.value as any })}
              >
                <MenuItem value="top">顶部</MenuItem>
                <MenuItem value="sidebar">侧边栏</MenuItem>
                <MenuItem value="footer">底部</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              size="small"
              label="排序"
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
            />
          </Grid>
          <Grid item xs={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  size="small"
                />
              }
              label="启用"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!form.name.trim()}>
          {sponsor ? '保存' : '添加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
