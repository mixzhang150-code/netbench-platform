import { useState, useEffect, useRef, useCallback } from 'react';
import { testApi, createTestWebSocket, NodeTestResult } from '../api';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Alert,
} from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';

export function SpeedTest() {
  const [duration, setDuration] = useState(10);
  const [parallel, setParallel] = useState(4);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, NodeTestResult>>(new Map());
  const [totalNodes, setTotalNodes] = useState(0);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResult = useCallback((taskResult: NodeTestResult) => {
    setResults(prev => { const next = new Map(prev); next.set(taskResult.taskId, taskResult); return next; });
  }, []);

  useEffect(() => { return () => { wsRef.current?.close(); if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try { const res = await testApi.getBatch(id); if (res.data.success && res.data.data) { const batch = res.data.data; for (const task of batch.tasks) handleResult(task); if (['completed', 'partial', 'failed'].includes(batch.status)) { if (pollRef.current) clearInterval(pollRef.current); setLoading(false); } } } catch {}
    }, 3000);
  };

  const handleTest = async () => {
    setLoading(true); setError(''); setResults(new Map()); setBatchId(null);
    try {
      const response = await testApi.speedtest({ duration, parallel, maxNodes: 20 });
      if (response.data.success && response.data.data) {
        const batch = response.data.data; setBatchId(batch.batchId); setTotalNodes(batch.totalNodes);
        try { wsRef.current?.close(); wsRef.current = createTestWebSocket((msg) => { if (msg.type === 'test:result' && msg.data) { const data = msg.data as { batchId: string; task: NodeTestResult }; if (data.batchId === batch.batchId) handleResult(data.task); } }); } catch {}
        startPolling(batch.batchId);
      }
    } catch (err: unknown) { const axiosErr = err as { response?: { data?: { error?: { message?: string } } } }; setError(axiosErr.response?.data?.error?.message || '测速失败'); setLoading(false); }
  };

  const formatSpeed = (mbps: number) => { if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`; if (mbps >= 1) return `${mbps.toFixed(2)} Mbps`; return `${(mbps * 1000).toFixed(0)} Kbps`; };
  const getSpeedColor = (mbps: number) => { if (mbps >= 100) return 'success.main'; if (mbps >= 50) return 'info.main'; if (mbps >= 20) return 'warning.main'; if (mbps >= 5) return 'warning.dark'; return 'error.main'; };
  const getLatencyColor = (ms: number) => { if (ms < 20) return 'success.main'; if (ms < 50) return 'info.main'; if (ms < 100) return 'warning.main'; if (ms < 200) return 'warning.dark'; return 'error.main'; };

  const sortedResults = Array.from(results.values()).sort((a, b) => { const aDown = (a.result as Record<string, number>)?.downloadSpeed ?? 0; const bDown = (b.result as Record<string, number>)?.downloadSpeed ?? 0; return bDown - aDown; });
  const completedCount = sortedResults.filter(r => r.status === 'completed' || r.status === 'failed').length;
  const completedResults = sortedResults.filter(r => r.status === 'completed');

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700}>网络多点测速</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>从多个节点测量下载/上传速度和延迟</Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <TextField label="时长(秒)" type="number" size="small" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 10)} sx={{ width: 130 }} inputProps={{ min: 1, max: 60 }} />
            <TextField label="并发数" type="number" size="small" value={parallel} onChange={(e) => setParallel(parseInt(e.target.value) || 4)} sx={{ width: 130 }} inputProps={{ min: 1, max: 16 }} />
            <Button variant="contained" startIcon={<SpeedIcon />} disabled={loading} onClick={handleTest} sx={{ py: 1 }}>{loading ? '测速中...' : '开始多点测速'}</Button>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {batchId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}><Card><CardContent sx={{ textAlign: 'center', py: 2 }}><Typography variant="h5" fontWeight={700} color="primary.main">{totalNodes}</Typography><Typography variant="caption" color="text.secondary">测试节点</Typography></CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent sx={{ textAlign: 'center', py: 2 }}><Typography variant="h5" fontWeight={700} color="info.main">{completedCount}/{totalNodes}</Typography><Typography variant="caption" color="text.secondary">已完成</Typography></CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent sx={{ textAlign: 'center', py: 2 }}><Typography variant="h5" fontWeight={700} color="success.main">{completedResults.length > 0 ? formatSpeed(Math.max(...completedResults.map(r => (r.result as Record<string, number>)?.downloadSpeed || 0))) : '-'}</Typography><Typography variant="caption" color="text.secondary">最快下载</Typography></CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent sx={{ textAlign: 'center', py: 2 }}><Typography variant="h5" fontWeight={700} color="secondary.main">{completedResults.length > 0 ? `${Math.min(...completedResults.map(r => (r.result as Record<string, number>)?.latency || Infinity)).toFixed(1)}ms` : '-'}</Typography><Typography variant="caption" color="text.secondary">最低延迟</Typography></CardContent></Card></Grid>
          </Grid>

          {loading && <Box sx={{ mb: 3 }}><LinearProgress variant="determinate" value={totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0} /><Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>正在测速... {completedCount}/{totalNodes} 节点已完成</Typography></Box>}

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>测速结果</Typography>
                <Typography variant="caption" color="text.secondary">按下载速度排序</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>节点</TableCell><TableCell>位置</TableCell><TableCell align="center">状态</TableCell>
                      <TableCell align="right">下载速度</TableCell><TableCell align="right">上传速度</TableCell><TableCell align="right">延迟</TableCell><TableCell align="right">抖动</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedResults.map((task) => {
                      const r = task.result as Record<string, number> | undefined;
                      const isRunning = task.status === 'running' || task.status === 'pending';
                      return (
                        <TableRow key={task.taskId} sx={isRunning ? { bgcolor: 'warning.50' } : task.status === 'failed' ? { bgcolor: 'error.50' } : {}}>
                          <TableCell sx={{ fontWeight: 600 }}>{task.nodeName}</TableCell>
                          <TableCell>{task.nodeLocation}</TableCell>
                          <TableCell align="center">
                            {isRunning && <Chip label="..." size="small" color="warning" />}
                            {task.status === 'completed' && <Chip label="正常" size="small" color="success" />}
                            {task.status === 'failed' && <Chip label="失败" size="small" color="error" />}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: r ? getSpeedColor(r.downloadSpeed || 0) : undefined }}>{r?.downloadSpeed ? formatSpeed(r.downloadSpeed) : '-'}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', color: r ? getSpeedColor(r.uploadSpeed || 0) : undefined }}>{r?.uploadSpeed ? formatSpeed(r.uploadSpeed) : '-'}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', color: r ? getLatencyColor(r.latency || 0) : undefined }}>{r?.latency?.toFixed(1) ?? '-'}ms</TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{r?.jitter?.toFixed(1) ?? '-'}ms</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {sortedResults.length === 0 && loading && <Box sx={{ textAlign: 'center', py: 4 }}><Typography color="text.secondary">正在分配测速任务到各节点...</Typography></Box>}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
