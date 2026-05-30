import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { testApi, createTestWebSocket, NodeTestResult } from '../api';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Alert, Paper, useMediaQuery, useTheme,
} from '@mui/material';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import CloudIcon from '@mui/icons-material/Cloud';
import PublicIcon from '@mui/icons-material/Public';
import HubIcon from '@mui/icons-material/Hub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { MapView, MapNodeData } from '../components/MapView';
import { SponsorShowcase } from '../components/SponsorShowcase';
import { classifyNode, sortNodesByOperator, buildSortedNodeList } from '../utils/nodeHelper';

const CITY_COORDS: Record<string, [number, number]> = {
  '北京': [39.9042, 116.4074],
  '上海': [31.2304, 121.4737],
  '广州': [23.1291, 113.2644],
  '深圳': [22.5431, 114.0579],
  '杭州': [30.2741, 120.1551],
  '南京': [32.0603, 118.7969],
  '武汉': [30.5928, 114.3055],
  '成都': [30.5728, 104.0668],
  '重庆': [29.4316, 106.9123],
  '西安': [34.3416, 108.9398],
  '郑州': [34.7466, 113.6254],
  '济南': [36.6512, 116.9972],
  '青岛': [36.0671, 120.3826],
  '大连': [38.9140, 121.6147],
  '沈阳': [41.8057, 123.4315],
  '哈尔滨': [45.8038, 126.5350],
  '天津': [39.0842, 117.2009],
  '苏州': [31.2989, 120.5853],
  '长沙': [28.2282, 112.9388],
  '福州': [26.0745, 119.2965],
  '厦门': [24.4798, 118.0894],
  '昆明': [25.0389, 102.7183],
  '贵阳': [26.6470, 106.6302],
  '南宁': [22.8170, 108.3665],
  '海口': [20.0444, 110.1999],
  '石家庄': [38.0428, 114.5149],
  '太原': [37.8706, 112.5489],
  '合肥': [31.8206, 117.2272],
  '南昌': [28.6820, 115.8579],
  '兰州': [36.0611, 103.8343],
  '银川': [38.4684, 106.2782],
  '西宁': [36.6171, 101.7782],
  '乌鲁木齐': [43.8256, 87.6168],
  '呼和浩特': [40.8426, 111.7500],
  '香港': [22.3193, 114.1694],
  '台北': [25.0330, 121.5654],
  '香港特别行政区': [22.3193, 114.1694],
  '澳门': [22.1987, 113.5439],
};

export function PingTest() {
  const [searchParams] = useSearchParams();
  const [target, setTarget] = useState('');
  const [count, setCount] = useState(4);
  const [timeout, setTimeout_] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, NodeTestResult>>(new Map());
  const [totalNodes, setTotalNodes] = useState(0);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);

  const handleResult = useCallback((taskResult: NodeTestResult) => {
    setResults(prev => { const next = new Map(prev); next.set(taskResult.taskId, taskResult); return next; });
  }, []);

  useEffect(() => { return () => { wsRef.current?.close(); if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await testApi.getBatch(id);
        if (res.data.success && res.data.data) {
          const batch = res.data.data;
          for (const task of batch.tasks) handleResult(task);
          if (['completed', 'partial', 'failed'].includes(batch.status)) { if (pollRef.current) clearInterval(pollRef.current); setLoading(false); }
        }
      } catch {}
    }, 2000);
  };

  const handleTest = useCallback(async (testTarget?: string) => {
    const finalTarget = testTarget ?? target;
    if (!finalTarget.trim()) { setError('请输入目标主机'); return; }
    setLoading(true); setError(''); setResults(new Map()); setBatchId(null);
    try {
      const response = await testApi.ping({ target: finalTarget.trim(), count, timeout, maxNodes: 50 });
      if (response.data.success && response.data.data) {
        const batch = response.data.data;
        setBatchId(batch.batchId); setTotalNodes(batch.totalNodes);
        try { wsRef.current?.close(); wsRef.current = createTestWebSocket((msg) => { if (msg.type === 'test:result' && msg.data) { const data = msg.data as { batchId: string; task: NodeTestResult }; if (data.batchId === batch.batchId) handleResult(data.task); } }); } catch {}
        startPolling(batch.batchId);
      }
    } catch (err: unknown) { const msg = (err && typeof err === 'object' && 'response' in err) ? ((err as any).response?.data?.error?.message || (err as any).message) : (err instanceof Error ? err.message : ''); setError(msg || '测试失败'); setLoading(false); }
  }, [target, count, timeout]);

  useEffect(() => {
    const urlTarget = searchParams.get('target');
    if (urlTarget && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const urlCount = searchParams.get('count');
      const urlTimeout = searchParams.get('timeout');
      if (urlCount) setCount(parseInt(urlCount) || 4);
      if (urlTimeout) setTimeout_(parseInt(urlTimeout) || 5000);
      setTarget(urlTarget);
      setTimeout(() => handleTest(urlTarget), 300);
    }
  }, [searchParams]);

  const rawResults = Array.from(results.values());
  const sortedNodeList = buildSortedNodeList(rawResults);
  const sortedResults = sortedNodeList.map(item => item.originalTask);
  const nodeDisplayMap = new Map(sortedNodeList.map(item => [item.originalTask.taskId, item]));
  const completedCount = sortedResults.filter(r => r.status === 'completed' || r.status === 'failed').length;
  const successCount = sortedResults.filter(r => r.status === 'completed').length;
  const failedCount = sortedResults.filter(r => r.status === 'failed').length;

  const getLatencyColor = (ms: number) => { if (ms < 50) return 'success.main'; if (ms < 100) return 'success.light'; if (ms < 200) return 'warning.main'; if (ms < 500) return 'warning.dark'; return 'error.main'; };
  const getPacketLossColor = (loss: number) => { if (loss === 0) return 'success.main'; if (loss < 5) return 'warning.main'; if (loss < 20) return 'warning.dark'; return 'error.main'; };

  const getOperatorColor = (operator: string) => {
    if (operator === 'telecom') return 'primary.main';
    if (operator === 'unicom') return 'secondary.main';
    if (operator === 'mobile') return 'success.main';
    if (operator === 'cloud') return 'info.main';
    if (operator === 'overseas') return 'warning.main';
    return 'text.secondary';
  };

  const simplifyISP = (isp: string): string => {
    const lowerIsp = isp.toLowerCase();
    if (lowerIsp.includes('tencent') || lowerIsp.includes('腾讯')) return '腾讯云';
    if (lowerIsp.includes('alibaba') || lowerIsp.includes('aliyun') || lowerIsp.includes('阿里')) return '阿里云';
    if (lowerIsp.includes('huawei') || lowerIsp.includes('华为')) return '华为云';
    if (lowerIsp.includes('amazon') || lowerIsp.includes('aws')) return 'AWS';
    if (lowerIsp.includes('microsoft') || lowerIsp.includes('azure')) return 'Azure';
    if (lowerIsp.includes('google') || lowerIsp.includes('gcp')) return 'GCP';
    if (lowerIsp.includes('cloudflare')) return 'Cloudflare';
    return isp;
  };

  const mapNodes: MapNodeData[] = useMemo(() => {
    return Array.from(results.values()).map(task => {
      const r = task.result as Record<string, unknown> | undefined;
      const avgRtt = (r?.avgRtt as number) || 0;
      const packetLoss = (r?.packetLoss as number) || 0;
      
      let [lat, lon] = [35.8617, 104.1954];
      const location = task.nodeLocation || '';
      
      for (const [city, coords] of Object.entries(CITY_COORDS)) {
        if (location.includes(city)) {
          [lat, lon] = coords;
          break;
        }
      }

      return {
        id: task.taskId,
        name: task.nodeName,
        location,
        lat,
        lon,
        status: task.status === 'running' || task.status === 'pending' ? 'running' : task.status === 'completed' ? 'completed' : 'failed',
        value: task.status === 'completed' ? avgRtt : undefined,
        valueType: 'latency' as const,
        details: r || undefined,
        sponsor: task.sponsor || r?.sponsor as string || undefined,
      };
    });
  }, [results]);

  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px',
          bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
        }}>
          <WifiTetheringIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.2}>Ping 多点测速</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>从全球多个节点同时 Ping 目标主机，检测各地网络连通性</Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <SignalCellularAltIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            Ping 测试
          </Typography>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth size="small"
                label="目标地址"
                placeholder="域名或 IP 地址，如: baidu.com"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: '0 0 0 1px rgba(37,99,235,0.15)' },
                    '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(37,99,235,0.12)' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" select label="测试次数" value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                SelectProps={{ native: true }}
              >
                {[4, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button variant="contained" fullWidth startIcon={<WifiTetheringIcon />} onClick={() => handleTest()} disabled={loading || !target.trim()}
                sx={{
                  height: 37,
                  transition: 'all 0.2s ease-in-out',
                  '&:not(:disabled):hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                  },
                  '&:not(:disabled):active': { transform: 'translateY(0)' },
                }}
              >
                {loading ? '测试中...' : '开始 Ping'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {batchId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: '测试节点', value: totalNodes, color: 'primary', icon: <PublicIcon sx={{ fontSize: 18 }} /> },
              { label: '已完成', value: `${completedCount}/${totalNodes}`, color: 'info', icon: <SignalCellularAltIcon sx={{ fontSize: 18 }} /> },
              { label: '成功', value: successCount, color: 'success', icon: <CloudIcon sx={{ fontSize: 18 }} /> },
              { label: '失败', value: failedCount, color: 'error', icon: <WifiTetheringIcon sx={{ fontSize: 18 }} /> },
            ].map((s) => (
              <Grid item xs={6} md={3} key={s.label}>
                <Card sx={{
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                  },
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    bgcolor: `${s.color}.main`,
                  }} />
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '8px',
                        bgcolor: `${s.color}.main`,
                        opacity: 0.12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'absolute', top: 0, left: 0,
                      }} />
                      <Box sx={{ position: 'relative', zIndex: 1, color: `${s.color}.main`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.icon}
                      </Box>
                    </Box>
                    <Typography variant="h5" fontWeight={700} color={`${s.color}.main`} sx={{ lineHeight: 1.3 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {results.size > 0 && <MapView nodes={mapNodes} height={380} testType="ping" />}

          {loading && (
            <Box sx={{ mb: 3, px: { xs: 0, sm: 1 } }}>
              <Box sx={{ position: 'relative' }}>
                <LinearProgress
                  variant="determinate"
                  value={totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0}
                  sx={{
                    height: 8, borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    },
                  }}
                />
                <Typography
                  variant="caption" color="text.secondary"
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 1, mt: 1,
                    '&::before': {
                      content: '""', width: 6, height: 6, borderRadius: '50%',
                      bgcolor: 'warning.main', animation: 'pulse 1.2s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.3 },
                      },
                    },
                  }}
                >
                  正在测试... {completedCount}/{totalNodes} 节点已完成
                </Typography>
              </Box>
            </Box>
          )}

          <Card sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                mb: 2.5, pb: 1.5,
                borderBottom: '1px solid', borderColor: 'divider',
              }}>
                <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <SignalCellularAltIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  测试结果
                </Typography>
                <Chip label="按运营商排序" size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 24 }} />
              </Box>

              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {sortedResults.map((task) => {
                    const r = task.result as Record<string, unknown> | undefined;
                    const isRunning = task.status === 'running' || task.status === 'pending';
                    const avgRtt = (r?.avgRtt as number) || 0;
                    const packetLoss = (r?.packetLoss as number) || 0;
                    const packetsSent = (r?.packetsSent as number) || 0;
                    const packetsReceived = (r?.packetsReceived as number) || 0;
                    const resolvedIp = r?.resolvedIp as string | undefined;
                    const targetLoc = r?.targetLocation as Record<string, string> | undefined;
                    const nodeInfo = nodeDisplayMap.get(task.taskId) || classifyNode(task.nodeName);
                    const opColor = getOperatorColor(nodeInfo.operator);
                    return (
                      <Card key={task.taskId} variant="outlined"
                        sx={{
                          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                          },
                          ...(isRunning ? {
                            bgcolor: 'warning.50',
                            borderColor: 'warning.light',
                            borderLeftWidth: 3,
                            borderLeftColor: 'warning.main',
                          } : task.status === 'failed' ? {
                            bgcolor: 'error.50',
                            borderColor: 'error.light',
                            borderLeftWidth: 3,
                            borderLeftColor: 'error.main',
                          } : {}),
                        }}
                      >
                        <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip icon={nodeInfo.operatorIcon as React.ReactElement} label={nodeInfo.operatorLabel} size="small" sx={{
                                height: 22, fontSize: '0.7rem',
                                '& .MuiChip-icon': { fontSize: 14 },
                                color: opColor, borderColor: opColor, flexShrink: 0,
                              }} variant="outlined" />
                              <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>{nodeInfo.displayName}</Typography>
                            </Box>
                            {isRunning && <Chip label="测试中" size="small" color="warning" sx={{ height: 22 }} />}
                            {task.status === 'completed' && <Chip label="正常" size="small" color="success" sx={{ height: 22 }} />}
                            {task.status === 'failed' && <Chip label="失败" size="small" color="error" sx={{ height: 22 }} />}
                          </Box>
                          {resolvedIp && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'info.main', display: 'block', mt: 0.25 }}>{resolvedIp}</Typography>}
                          {targetLoc && (
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.1 }}>
                              {targetLoc.country} {targetLoc.region} {targetLoc.city}{targetLoc.isp ? ` ${simplifyISP(targetLoc.isp)}` : ''}
                            </Typography>
                          )}
                          <Grid container spacing={1} sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                            {[
                              { label: '平均延迟', value: `${avgRtt.toFixed(1)}ms`, color: getLatencyColor(avgRtt) },
                              { label: '丢包率', value: `${packetLoss.toFixed(1)}%`, color: getPacketLossColor(packetLoss) },
                              { label: '发送/接收', value: `${packetsSent}/${packetsReceived}`, color: 'text.primary' },
                            ].map((m) => (
                              <Grid item xs={4} key={m.label}>
                                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace', color: m.color, letterSpacing: '-0.02em' }}>{m.value}</Typography>
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              ) : (
                <TableContainer sx={{
                  borderRadius: 2, border: '1px solid', borderColor: 'divider',
                  '& .MuiTableHead-root': {
                    position: 'sticky', top: 0, zIndex: 1,
                  },
                }}>
                  <Table size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        {['节点', '赞助商', '解析IP', '目标归属地', '状态', '最小延迟', '平均延迟', '最大延迟', '丢包率', '发送/接收'].map((h, i) => (
                          <TableCell
                            key={h}
                            align={i === 0 ? 'left' : i === 3 || i === 9 ? 'left' : i === 1 || i === 2 || i === 4 || i >= 5 ? (i >= 5 && i <= 9 ? 'right' : 'center') : 'center'}
                            sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap', py: 1.25, borderBottom: '2px solid', borderColor: 'divider' }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedResults.map((task, idx) => {
                        const r = task.result as Record<string, unknown> | undefined;
                        const isRunning = task.status === 'running' || task.status === 'pending';
                        const minRtt = (r?.minRtt as number) || 0;
                        const avgRtt = (r?.avgRtt as number) || 0;
                        const maxRtt = (r?.maxRtt as number) || 0;
                        const packetLoss = (r?.packetLoss as number) || 0;
                        const packetsSent = (r?.packetsSent as number) || 0;
                        const packetsReceived = (r?.packetsReceived as number) || 0;
                        const resolvedIp = r?.resolvedIp as string | undefined;
                        const targetLoc = r?.targetLocation as Record<string, string> | undefined;
                        const nodeInfo = nodeDisplayMap.get(task.taskId) || classifyNode(task.nodeName);
                        const opColor = getOperatorColor(nodeInfo.operator);
                        return (
                          <TableRow key={task.taskId} sx={{
                            transition: 'background-color 0.15s',
                            ...(idx % 2 === 1 ? { bgcolor: 'grey.50' } : {}),
                            '&:hover': { bgcolor: 'primary.50 !important' },
                            ...(isRunning ? {
                              bgcolor: 'warning.50 !important',
                              borderLeftWidth: 3,
                              borderLeftColor: 'warning.main',
                              borderLeftStyle: 'solid',
                            } : task.status === 'failed' ? {
                              bgcolor: 'error.50 !important',
                              borderLeftWidth: 3,
                              borderLeftColor: 'error.main',
                              borderLeftStyle: 'solid',
                            } : {}),
                          }}>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', minWidth: 180 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Chip icon={nodeInfo.operatorIcon as React.ReactElement} label={nodeInfo.operatorLabel} size="small" sx={{ height: 22, fontSize: '0.7rem', '& .MuiChip-icon': { fontSize: 14 }, color: opColor, borderColor: opColor }} variant="outlined" />
                                <Typography component="span" sx={{ whiteSpace: 'nowrap' }}>{nodeInfo.displayName}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              {task.sponsor ? (
                                <Chip label={task.sponsor} size="small" variant="outlined" color="secondary" sx={{ height: 22, fontSize: '0.7rem' }} />
                              ) : (
                                <Typography variant="caption" color="text.disabled">-</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'info.main' }}>{resolvedIp || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '0.72rem' }}>
                              {targetLoc ? `${targetLoc.country} ${targetLoc.region} ${targetLoc.city}${targetLoc.isp ? ` ${simplifyISP(targetLoc.isp)}` : ''}` : '-'}
                            </TableCell>
                            <TableCell align="center">
                              {isRunning && <Chip label="测试中" size="small" color="warning" />}
                              {task.status === 'completed' && <Chip label="正常" size="small" color="success" />}
                              {task.status === 'failed' && <Chip label="失败" size="small" color="error" />}
                            </TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace', color: getLatencyColor(minRtt), letterSpacing: '-0.01em' }}>{minRtt.toFixed(1)}ms</TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: getLatencyColor(avgRtt), letterSpacing: '-0.01em' }}>{avgRtt.toFixed(1)}ms</TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace', color: getLatencyColor(maxRtt), letterSpacing: '-0.01em' }}>{maxRtt.toFixed(1)}ms</TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace', color: getPacketLossColor(packetLoss), letterSpacing: '-0.01em' }}>{packetLoss.toFixed(1)}%</TableCell>
                            <TableCell align="right" color="text.secondary">{`${packetsSent}/${packetsReceived}`}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {sortedResults.length === 0 && loading && (
                <Box sx={{ textAlign: 'center', py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: '3px solid', borderColor: 'divider', borderTopColor: 'primary.main',
                    animation: 'spin 0.8s linear infinite',
                    '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                  }} />
                  <Typography color="text.secondary">正在分配测试任务到各节点...</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <SponsorShowcase page="ping" position="footer" />
    </Box>
  );
}
