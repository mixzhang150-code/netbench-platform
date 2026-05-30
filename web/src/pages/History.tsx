import { useState, useEffect } from 'react';
import { dataApi } from '../api';
import {
  Box, Typography, Card, CardContent, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, LinearProgress, Container, alpha, Grid, Paper, Select, FormControl, SelectChangeEvent,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import LanguageIcon from '@mui/icons-material/Language';
import SpeedIcon from '@mui/icons-material/Speed';
import CircleIcon from '@mui/icons-material/Circle';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InboxIcon from '@mui/icons-material/Inbox';

export function History() {
  const [results, setResults] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { loadHistory(); }, [type, page]);

  const loadHistory = async () => {
    setLoading(true);
    try { 
      const response = await dataApi.history({ type: type || undefined, page, limit: 20 }); 
      setResults(response.data.data || []); 
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch {} 
    finally { setLoading(false); }
  };

  const getTypeLabel = (t: string) => { 
    switch (t) { 
      case 'ping': return 'Ping'; 
      case 'http': return 'HTTP'; 
      case 'speedtest': return '测速'; 
      default: return t; 
    } 
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'ping': return <WifiTetheringIcon sx={{ fontSize: 16 }} />;
      case 'http': return <LanguageIcon sx={{ fontSize: 16 }} />;
      case 'speedtest': return <SpeedIcon sx={{ fontSize: 16 }} />;
      default: return <CircleIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'ping': return '#667eea';
      case 'http': return '#f5576c';
      case 'speedtest': return '#00f2fe';
      default: return '#0ea5e9';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': case 'completed': return '#22c55e';
      case 'failed': case 'error': return '#ef4444';
      case 'pending': case 'running': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const handleTypeChange = (e: SelectChangeEvent<string>) => {
    setType(e.target.value);
    setPage(1);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 6 }}>
      {/* Hero Section */}
      <Box sx={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
        color: '#fff',
        py: { xs: 4, md: 6 },
        px: 2,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Chip 
              icon={<HistoryIcon sx={{ fontSize: 16, color: '#fff !important' }} />}
              label="历史记录"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: '#fff',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
              }}
            />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 1, letterSpacing: -0.5 }}>
            测试历史
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 500, mx: 'auto' }}>
            查看所有测试记录，回顾历史测试数据和结果分析
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -3, position: 'relative', zIndex: 2 }}>
        {/* Filter Card */}
        <Card elevation={4} sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                筛选条件
              </Typography>
              <Box sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={type}
                  onChange={handleTypeChange}
                  displayEmpty
                  sx={{ 
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                >
                  <MenuItem value="">全部类型</MenuItem>
                  <MenuItem value="ping">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WifiTetheringIcon sx={{ fontSize: 18, color: '#667eea' }} />
                      Ping 测试
                    </Box>
                  </MenuItem>
                  <MenuItem value="http">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LanguageIcon sx={{ fontSize: 18, color: '#f5576c' }} />
                      HTTP 测试
                    </Box>
                  </MenuItem>
                  <MenuItem value="speedtest">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon sx={{ fontSize: 18, color: '#00f2fe' }} />
                      网络测速
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ 
            bgcolor: 'grey.50', 
            px: 3, 
            py: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon color="action" />
              <Typography variant="h6" fontWeight={600}>测试记录</Typography>
              <Chip 
                size="small" 
                label={`共 ${results.length} 条`}
                sx={{ bgcolor: alpha('#0ea5e9', 0.1), color: '#0ea5e9', fontWeight: 600 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">按时间倒序排列</Typography>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <LinearProgress sx={{ maxWidth: 300, mx: 'auto', mb: 2, borderRadius: 2 }} />
              <Typography color="text.secondary">加载中...</Typography>
            </Box>
          ) : results.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <InboxIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>暂无测试记录</Typography>
              <Typography variant="body2" color="text.secondary">
                开始一个测试后，记录将显示在这里
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>类型</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>目标</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">状态</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>节点</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>时间</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(results as Record<string, unknown>[]).map((row, i) => (
                      <TableRow 
                        key={i}
                        sx={{ 
                          '&:hover': { bgcolor: alpha('#0ea5e9', 0.04) },
                          borderLeft: `3px solid transparent`,
                          transition: 'all 0.2s'
                        }}
                      >
                        <TableCell>
                          <Chip 
                            icon={getTypeIcon(row.type as string)}
                            label={getTypeLabel(row.type as string)} 
                            size="small"
                            sx={{ 
                              bgcolor: alpha(getTypeColor(row.type as string), 0.1),
                              color: getTypeColor(row.type as string),
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: getTypeColor(row.type as string) }
                            }} 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.target as string}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                            <CircleIcon sx={{ fontSize: 8, color: getStatusColor(row.status as string) }} />
                            <Chip 
                              label={row.status === 'success' || row.status === 'completed' ? '成功' : row.status === 'failed' || row.status === 'error' ? '失败' : (row.status as string)} 
                              size="small"
                              sx={{ 
                                bgcolor: alpha(getStatusColor(row.status as string), 0.1),
                                color: getStatusColor(row.status as string),
                                fontWeight: 500,
                                height: 24
                              }} 
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.node_location as string || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(row.created_at as string).toLocaleString('zh-CN', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                px: 3, 
                py: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50'
              }}>
                <Typography variant="body2" color="text.secondary">
                  第 {page} 页 {totalPages > 1 ? `/ 共 ${totalPages} 页` : ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined"
                    startIcon={<ChevronLeftIcon />}
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    sx={{ borderRadius: 2 }}
                  >
                    上一页
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined"
                    endIcon={<ChevronRightIcon />}
                    onClick={() => setPage(p => p + 1)}
                    disabled={results.length < 20}
                    sx={{ borderRadius: 2 }}
                  >
                    下一页
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Card>
      </Container>
    </Box>
  );
}
