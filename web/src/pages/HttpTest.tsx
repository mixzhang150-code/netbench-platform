import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { testApi, createTestWebSocket, NodeTestResult } from '../api';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Alert, Paper, Collapse, IconButton, useMediaQuery, useTheme, MenuItem,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CodeIcon from '@mui/icons-material/Code';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import CloudIcon from '@mui/icons-material/Cloud';
import PublicIcon from '@mui/icons-material/Public';
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

export function HttpTest() {
  const [searchParams] = useSearchParams();
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [timeout, setTimeout_] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, NodeTestResult>>(new Map());
  const [totalNodes, setTotalNodes] = useState(0);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);

  const toggleRow = useCallback((taskId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  const normalizeUrl = useCallback((input: string): string => {
    if (!input.trim()) return input;
    let normalized = input.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    return normalized;
  }, []);

  const handleResult = useCallback((taskResult: NodeTestResult) => {
    setResults(prev => { const next = new Map(prev); next.set(taskResult.taskId, taskResult); return next; });
  }, []);

  useEffect(() => { return () => { wsRef.current?.close(); if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await testApi.getBatch(id);
        if (res.data.success && res.data.data) { const batch = res.data.data; for (const task of batch.tasks) handleResult(task); if (['completed', 'partial', 'failed'].includes(batch.status)) { if (pollRef.current) clearInterval(pollRef.current); setLoading(false); } }
      } catch {}
    }, 2000);
  };

  const handleTest = useCallback(async (testUrl?: string) => {
    const finalUrl = testUrl ?? url;
    const normalizedUrl = normalizeUrl(finalUrl);
    if (!normalizedUrl) { setError('请输入URL'); return; }
    setLoading(true); setError(''); setResults(new Map()); setBatchId(null); setExpandedRows(new Set());
    try {
      let parsedHeaders: Record<string, string> | undefined;
      if (headers.trim()) parsedHeaders = JSON.parse(headers);
      const response = await testApi.http({ url: normalizedUrl, method, headers: parsedHeaders, body: body || undefined, timeout, followRedirects: true, validateCert: true, maxNodes: 50 });
      if (response.data.success && response.data.data) {
        const batch = response.data.data;
        setBatchId(batch.batchId); setTotalNodes(batch.totalNodes);
        try { wsRef.current?.close(); wsRef.current = createTestWebSocket((msg) => { if (msg.type === 'test:result' && msg.data) { const data = msg.data as { batchId: string; task: NodeTestResult }; if (data.batchId === batch.batchId) handleResult(data.task); } }); } catch {}
        startPolling(batch.batchId);
      }
    } catch (err: unknown) { const axiosErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string }; setError(axiosErr.response?.data?.error?.message || axiosErr.message || '测试失败'); setLoading(false); }
  }, [url, method, headers, body, timeout, normalizeUrl]);

  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const methodParam = searchParams.get('method');
      if (methodParam && ['GET', 'POST', 'PUT', 'HEAD'].includes(methodParam.toUpperCase())) {
        setMethod(methodParam.toUpperCase() as any);
      }
      const timeoutParam = searchParams.get('timeout');
      if (timeoutParam) setTimeout_(parseInt(timeoutParam) || 10000);
      setUrl(urlParam);
      setTimeout(() => handleTest(urlParam), 300);
    }
  }, [searchParams]);

  const rawResults = Array.from(results.values());
  const sortedNodeList = buildSortedNodeList(rawResults);
  const sortedResults = sortedNodeList.map(item => item.originalTask);
  const nodeDisplayMap = new Map(sortedNodeList.map(item => [item.originalTask.taskId, item]));
  const completedCount = sortedResults.filter(r => r.status === 'completed' || r.status === 'failed').length;
  const successCount = sortedResults.filter(r => r.status === 'completed').length;
  const failedCount = sortedResults.filter(r => r.status === 'failed').length;

  const getResponseTimeColor = (ms: number) => { if (ms < 200) return 'success.main'; if (ms < 500) return 'info.main'; if (ms < 1000) return 'warning.main'; if (ms < 3000) return 'warning.dark'; return 'error.main'; };
  const getStatusChipColor = (code: number) => { if (code >= 200 && code < 300) return 'success'; if (code >= 300 && code < 400) return 'info'; if (code >= 400 && code < 500) return 'warning'; if (code >= 500) return 'error'; return 'default' };

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
      const responseTime = (r?.responseTime as number) || 0;
      
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
        value: task.status === 'completed' ? responseTime : undefined,
        valueType: 'responseTime' as const,
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
          <LanguageIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.2}>HTTP 多点测速</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>从全球多个节点同时请求目标URL，检测各地HTTP响应状态</Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6}>
              <TextField label="URL" size="small" fullWidth value={url}
                onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                placeholder="https://example.com"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: '0 0 0 1px rgba(37,99,235,0.15)' },
                    '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(37,99,235,0.12)' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="方法" select size="small" value={method} onChange={(e) => setMethod(e.target.value)} fullWidth
                SelectProps={{ native: true }}>
                <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="HEAD">HEAD</option>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button variant="outlined" onClick={() => setShowAdvanced(!showAdvanced)}
                startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ width: '100%', height: '100%', transition: 'all 0.2s', '&:hover': { boxShadow: '0 2px 8px rgba(37,99,235,0.15)' } }}>{showAdvanced ? '收起' : '高级'}</Button>
            </Grid>
          </Grid>
          <Box sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<LanguageIcon />} disabled={loading} onClick={() => handleTest()} fullWidth
              sx={{
                transition: 'all 0.2s ease-in-out',
                '&:not(:disabled):hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                },
                '&:not(:disabled):active': { transform: 'translateY(0)' },
              }}
            >{loading ? '测试中...' : '开始测试'}</Button>
          </Box>
          <Collapse in={showAdvanced}>
            <Grid container spacing={2} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Grid item xs={12} md={4}><TextField label="请求头 (JSON)" size="small" multiline rows={2} value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder='{"Authorization": "Bearer token"}' fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="请求体" size="small" multiline rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"key": "value"}' fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="超时(ms)" type="number" size="small" value={timeout} onChange={(e) => setTimeout_(parseInt(e.target.value) || 10000)} fullWidth /></Grid>
            </Grid>
          </Collapse>
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
              { label: '失败', value: failedCount, color: 'error', icon: <LanguageIcon sx={{ fontSize: 18 }} /> },
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

          {results.size > 0 && <MapView nodes={mapNodes} height={380} testType="http" />}

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
                  <LanguageIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  测试结果
                </Typography>
                <Chip label="按响应时间排序" size="small" variant="outlined" sx={{ fontSize: '0.72rem', height: 24 }} />
              </Box>

              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {sortedResults.map((task) => {
                    const r = task.result as Record<string, unknown> | undefined;
                    const isRunning = task.status === 'running' || task.status === 'pending';
                    const statusCode = (r?.statusCode as number) || 0;
                    const resolvedIp = r?.resolvedIp as string | undefined;
                    const responseHeaders = r?.headers as Record<string, string> | undefined;
                    const targetLoc = r?.targetLocation as Record<string, string> | undefined;
                    const responseTime = (r?.responseTime as number) || 0;
                    const ttfb = (r?.ttfb as number) || 0;
                    const downloadSize = (r?.downloadSize as number) || 0;
                    const expanded = expandedRows.has(task.taskId);
                    const nodeInfo = nodeDisplayMap.get(task.taskId) || classifyNode(task.nodeName);
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
                                color: getOperatorColor(nodeInfo.operator), borderColor: getOperatorColor(nodeInfo.operator), flexShrink: 0,
                              }} variant="outlined" />
                              <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>{nodeInfo.displayName}</Typography>
                            </Box>
                            {isRunning && <Chip label="..." size="small" color="warning" sx={{ height: 22 }} />}
                            {task.status === 'completed' && <Chip label={statusCode} size="small" color={getStatusChipColor(statusCode)} sx={{ height: 22 }} />}
                            {task.status === 'failed' && <Chip label="失败" size="small" color="error" sx={{ height: 22 }} />}
                          </Box>
                          <Typography variant="caption" color="text.secondary">{task.nodeLocation}</Typography>
                          {resolvedIp && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'info.main', display: 'block', mt: 0.25 }}>{resolvedIp}</Typography>}
                          {targetLoc && (
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.1 }}>
                              {targetLoc.country} {targetLoc.region} {targetLoc.city}{targetLoc.isp ? ` ${simplifyISP(targetLoc.isp)}` : ''}
                            </Typography>
                          )}
                          <Grid container spacing={1} sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                            {[
                              { label: '总耗时', value: `${responseTime.toFixed(0)}ms`, color: getResponseTimeColor(responseTime) },
                              { label: 'TTFB', value: `${ttfb.toFixed(0)}ms` },
                              { label: '大小', value: downloadSize ? `${(downloadSize / 1024).toFixed(1)}KB` : '-' },
                            ].map((m) => (
                              <Grid item xs={4} key={m.label}>
                                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace', color: m.color, letterSpacing: '-0.02em' }}>{m.value}</Typography>
                              </Grid>
                            ))}
                          </Grid>
                          {task.status === 'completed' && responseHeaders && Object.keys(responseHeaders).length > 0 && (
                            <>
                              <Button size="small" startIcon={<CodeIcon />} onClick={() => toggleRow(task.taskId)} sx={{ mt: 0.75, fontSize: '0.7rem' }}>
                                {expanded ? '收起响应头' : `查看响应头 (${Object.keys(responseHeaders).length})`}
                              </Button>
                              <Collapse in={expanded}>
                                <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'grey.900', maxHeight: 200, overflow: 'auto' }}>
                                  {Object.entries(responseHeaders).map(([key, val]) => (
                                    <Box key={key} sx={{ mb: 0.3 }}>
                                      <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'success.light', mr: 0.5 }}>{key}:</Typography>
                                      <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'grey.300', wordBreak: 'break-all' }}>{val}</Typography>
                                    </Box>
                                  ))}
                                </Paper>
                              </Collapse>
                            </>
                          )}
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
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        {['节点', '赞助商', '解析IP', '目标归属地', '状态码', '总耗时', 'TTFB', 'DNS', '大小', ''].map((h, i) => (
                          <TableCell
                            key={h || i}
                            align={i === 0 ? 'left' : i === 3 ? 'left' : i === 9 ? 'center' : i >= 5 && i <= 8 ? 'right' : 'center'}
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
                        const statusCode = (r?.statusCode as number) || 0;
                        const resolvedIp = r?.resolvedIp as string | undefined;
                        const responseHeaders = r?.headers as Record<string, string> | undefined;
                        const targetLoc = r?.targetLocation as Record<string, string> | undefined;
                        const responseTime = (r?.responseTime as number) || 0;
                        const ttfb = (r?.ttfb as number) || 0;
                        const dnsTime = (r?.dnsTime as number) || 0;
                        const downloadSize = (r?.downloadSize as number) || 0;
                        const expanded = expandedRows.has(task.taskId);
                        const nodeInfo = nodeDisplayMap.get(task.taskId) || classifyNode(task.nodeName);
                        const opColor = getOperatorColor(nodeInfo.operator);
                        return (
                          <>
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
                                  <Chip icon={nodeInfo.operatorIcon as React.ReactElement} label={nodeInfo.operatorLabel} size="small" sx={{ height: 22, fontSize: '0.7rem', '& .MuiChip-icon': { fontSize: 14 }, color: opColor, borderColor: opColor, flexShrink: 0 }} variant="outlined" />
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
                                {isRunning && <Chip label="..." size="small" color="warning" />}
                                {task.status === 'completed' && <Chip label={statusCode} size="small" color={getStatusChipColor(statusCode)} />}
                                {task.status === 'failed' && <Chip label="失败" size="small" color="error" />}
                              </TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: getResponseTimeColor(responseTime), letterSpacing: '-0.01em' }}>{responseTime.toFixed(0)}ms</TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'text.secondary', letterSpacing: '-0.01em' }}>{ttfb.toFixed(0)}ms</TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'text.secondary', letterSpacing: '-0.01em' }}>{dnsTime.toFixed(0)}ms</TableCell>
                              <TableCell align="right" color="text.secondary">{downloadSize ? `${(downloadSize / 1024).toFixed(1)}KB` : '-'}</TableCell>
                              <TableCell align="center">
                                {task.status === 'completed' && responseHeaders && Object.keys(responseHeaders).length > 0 && (
                                  <IconButton size="small" onClick={() => toggleRow(task.taskId)}>
                                    <CodeIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                            {expanded && responseHeaders && (
                              <TableRow>
                                <TableCell colSpan={10} sx={{ p: 0 }}>
                                  <Collapse in={expanded}>
                                    <Paper variant="outlined" sx={{ mx: 2, my: 0.5, p: 1.5, bgcolor: 'grey.900', maxHeight: 250, overflow: 'auto' }}>
                                      <Typography variant="caption" color="grey.400" sx={{ mb: 0.5, display: 'block' }}>HTTP 响应头 ({Object.keys(responseHeaders).length} 条)</Typography>
                                      {Object.entries(responseHeaders).map(([key, val]) => (
                                        <Box key={key} sx={{ mb: 0.3, pl: 1 }}>
                                          <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'success.light', mr: 1 }}>{key}:</Typography>
                                          <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'grey.300', wordBreak: 'break-all' }}>{val}</Typography>
                                        </Box>
                                      ))}
                                    </Paper>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
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
      <SponsorShowcase page="http" position="footer" />
    </Box>
  );
}
