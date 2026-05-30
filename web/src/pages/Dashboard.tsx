import { useState, useEffect } from 'react';
import { nodeApi, testApi } from '../api';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Paper, Chip, InputAdornment, Container, useMediaQuery, useTheme, alpha,
  LinearProgress, Avatar, Skeleton, Fade
} from '@mui/material';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import LanguageIcon from '@mui/icons-material/Language';
import SpeedIcon from '@mui/icons-material/Speed';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PublicIcon from '@mui/icons-material/Public';
import DnsIcon from '@mui/icons-material/Dns';
import SecurityIcon from '@mui/icons-material/Security';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CircleIcon from '@mui/icons-material/Circle';
import SearchIcon from '@mui/icons-material/Search';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GppGoodIcon from '@mui/icons-material/GppGood';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';
import BoltIcon from '@mui/icons-material/Bolt';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { SponsorShowcase } from '../components/SponsorShowcase';

export function Dashboard() {
  const [stats, setStats] = useState({ totalNodes: 0, onlineNodes: 0, offlineNodes: 0, totalTests: 0, avgLatency: 0 });
  const [regionData, setRegionData] = useState<Array<{ name: string; nodes: number; percent: number }>>([]);
  const [quickTarget, setQuickTarget] = useState('');
  const [selectedTest, setSelectedTest] = useState<'ping' | 'http'>('ping');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const [nodesRes, statsRes] = await Promise.all([
        nodeApi.publicStats(),
        testApi.stats().catch(() => ({ data: { data: { totalTests: 0, todayTests: 0, avgLatency: 0 } } })),
      ]);
      const nodeData = nodesRes.data?.data || {};
      setStats({
        totalNodes: nodeData.totalNodes || 0,
        onlineNodes: nodeData.onlineNodes || 0,
        offlineNodes: nodeData.offlineNodes || 0,
        totalTests: statsRes.data.data?.todayTests || 0,
        avgLatency: statsRes.data.data?.avgLatency || 0,
      });
      if (nodeData.regions) {
        setRegionData(nodeData.regions);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleQuickTest = () => {
    if (!quickTarget.trim()) return;
    if (selectedTest === 'ping') navigate(`/ping?target=${encodeURIComponent(quickTarget)}`);
    else navigate(`/http?url=${encodeURIComponent(quickTarget)}`);
  };

  const testTemplates = [
    { name: 'Google', target: 'google.com', icon: '🌐' },
    { name: 'Cloudflare', target: 'cloudflare.com', icon: '☁️' },
    { name: 'AWS', target: 'aws.amazon.com', icon: '🟠' },
    { name: '阿里云', target: 'aliyun.com', icon: '🟢' },
    { name: '腾讯云', target: 'cloud.tencent.com', icon: '🔵' },
    { name: '百度', target: 'baidu.com', icon: '🔴' },
  ];

  const testTools = [
    {
      icon: <WifiTetheringIcon sx={{ fontSize: 32 }} />,
      title: 'Ping 多点测试',
      desc: '从多个节点同时 Ping，检测各地连通性和延迟',
      path: '/ping',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#667eea',
      badge: '热门',
    },
    {
      icon: <LanguageIcon sx={{ fontSize: 32 }} />,
      title: 'HTTP 多点测试',
      desc: '多节点 HTTP/HTTPS 请求，检测各地响应状态',
      path: '/http',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      color: '#f5576c',
      badge: '推荐',
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 32 }} />,
      title: '网络多点测速',
      desc: '多节点下载/上传速度和延迟测试',
      path: '/speedtest',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      color: '#00f2fe',
      badge: null,
    },
  ];

  const features = [
    { icon: <PublicIcon />, title: '多点并发测试', desc: '从全球所有在线节点同时发起测试', color: 'primary' },
    { icon: <DnsIcon />, title: '节点赞助', desc: '贡献测试节点，帮助扩大覆盖范围', color: 'secondary' },
    { icon: <BarChartIcon />, title: '实时结果', desc: 'WebSocket 实时推送测试结果', color: 'success' },
    { icon: <SecurityIcon />, title: '安全可靠', desc: '通信加密、信誉积分、自动故障转移', color: 'warning' },
  ];

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      pb: 6,
    }}>
      {/* Hero Section */}
      <Box sx={{
        background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 50%, ${t.palette.secondary.main} 100%)`,
        color: '#fff',
        py: { xs: 5, md: 8 },
        px: 2,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.5,
        }
      }}>
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Chip
              icon={<FingerprintIcon sx={{ fontSize: 16 }} />}
              label="全球在线节点实时监测"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: '#fff',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
                '& .MuiChip-icon': { color: '#4ade80' }
              }}
            />
          </Box>
          <Typography variant="h2" fontWeight={800} sx={{ mb: 1.5, letterSpacing: -1, fontSize: { xs: '1.8rem', md: '2.8rem' } }}>
            NetBench 网络测速平台
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 4, fontWeight: 400, maxWidth: 600, mx: 'auto' }}>
            从全球多个节点同时测试网络性能，实时掌握各地区网络质量
          </Typography>

          {/* Quick Stats */}
          <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: 700, mx: 'auto' }}>
            {[
              { label: '在线节点', value: stats.onlineNodes, sub: `共 ${stats.totalNodes} 个`, icon: <CircleIcon sx={{ fontSize: 12, color: '#4ade80' }} />, color: '#4ade80' },
              { label: '今日测试', value: stats.totalTests, sub: '次测试', icon: <BoltIcon sx={{ fontSize: 18 }} />, color: '#fbbf24' },
              { label: '平均延迟', value: stats.avgLatency ? `${stats.avgLatency}` : '-', sub: stats.avgLatency ? 'ms' : '-', icon: <AccessTimeIcon sx={{ fontSize: 18 }} />, color: '#60a5fa' },
            ].map((stat) => (
              <Grid item xs={4} key={stat.label}>
                <Paper sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 3,
                  p: 2,
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.18)',
                    transform: 'translateY(-2px)',
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                    <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                    <Typography variant="h4" fontWeight={700}>{loading ? '-' : stat.value}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>{stat.label}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.65, fontSize: '0.7rem' }}>{stat.sub}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Region Distribution */}
          {!loading && (
            <Fade in timeout={1000}>
              <Paper sx={{
                mt: 3,
                bgcolor: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                p: 2,
                maxWidth: 500,
                mx: 'auto'
              }}>
                <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mb: 1 }}>节点分布</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {regionData.map((r) => (
                    <Chip
                      key={r.name}
                      size="small"
                      icon={<LocationOnIcon sx={{ fontSize: 14 }} />}
                      label={`${r.name} ${r.nodes}`}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.15)',
                        '& .MuiChip-icon': { color: '#4ade80' }
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            </Fade>
          )}
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 2 }}>
        {/* Quick Test Card */}
        <Card elevation={8} sx={{ mb: 4, borderRadius: 3, overflow: 'visible' }}>
          <CardContent sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Avatar sx={{
                bgcolor: 'primary.main',
                width: 44,
                height: 44,
              }}>
                <RocketLaunchIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>快速开始测试</Typography>
                <Typography variant="body2" color="text.secondary">输入目标地址，立即开始全球多点测速</Typography>
              </Box>
            </Box>

            {/* Test Type Toggle */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              {[
                { type: 'ping' as const, label: 'Ping 测试', icon: <WifiTetheringIcon /> },
                { type: 'http' as const, label: 'HTTP 测试', icon: <LanguageIcon /> },
              ].map((tab) => (
                <Chip
                  key={tab.type}
                  icon={tab.icon}
                  label={tab.label}
                  onClick={() => setSelectedTest(tab.type)}
                  variant={selectedTest === tab.type ? 'filled' : 'outlined'}
                  color={selectedTest === tab.type ? 'primary' : 'default'}
                  sx={{
                    fontWeight: 600,
                    px: 2,
                    py: 0.5,
                    transition: 'all 0.2s',
                    ...(selectedTest === tab.type && {
                      boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.35)}`
                    })
                  }}
                />
              ))}
            </Box>

            {/* Input */}
            <Paper
              variant="outlined"
              sx={{
                p: 0.5,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'grey.50',
                borderRadius: 2,
                border: '2px solid transparent',
                '&:focus-within': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
                  bgcolor: '#fff'
                }
              }}
            >
              <Box sx={{ pl: 2, pr: 1, display: 'flex', alignItems: 'center' }}>
                <SearchIcon color="action" />
              </Box>
              <TextField
                fullWidth
                variant="standard"
                placeholder={selectedTest === 'ping' ? "输入域名或 IP，如：baidu.com、192.168.1.1" : "输入 URL，如：https://example.com/api"}
                value={quickTarget}
                onChange={(e) => setQuickTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickTest()}
                InputProps={{
                  disableUnderline: true,
                  sx: { fontSize: '1.05rem', bgcolor: 'transparent' }
                }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleQuickTest}
                disabled={!quickTarget.trim()}
                startIcon={<BoltIcon />}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  fontWeight: 600,
                  textTransform: 'none',
                  ml: 1,
                  flexShrink: 0,
                  boxShadow: (t) => quickTarget.trim() ? `0 4px 14px ${alpha(t.palette.primary.main, 0.4)}` : 'none',
                }}
              >
                开始测试
              </Button>
            </Paper>

            {/* Quick Templates */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <HistoryIcon sx={{ fontSize: 16 }} /> 快捷目标：
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {testTemplates.map((tmpl) => (
                  <Chip
                    key={tmpl.target}
                    label={<span>{tmpl.icon} {tmpl.name}</span>}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setQuickTarget(tmpl.target);
                      if (selectedTest === 'ping') navigate(`/ping?target=${encodeURIComponent(tmpl.target)}`);
                      else navigate(`/http?url=${encodeURIComponent(tmpl.target)}`);
                    }}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'primary.50',
                        borderColor: 'primary.main',
                        transform: 'translateX(2px)'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Test Tools Grid */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AnalyticsIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>测试工具</Typography>
        </Box>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {testTools.map((tool) => (
            <Grid item xs={12} sm={6} md={4} key={tool.path}>
              <Card
                onClick={() => navigate(tool.path)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  height: '100%',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: (t) => `0 12px 28px ${alpha(tool.color, 0.25)}`,
                  }
                }}
              >
                {tool.badge && (
                  <Chip
                    label={tool.badge}
                    size="small"
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 1,
                      fontWeight: 600,
                      fontSize: '0.7rem'
                    }}
                  />
                )}
                <Box sx={{
                  height: 100,
                  background: tool.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  }
                }}>
                  <Box sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    p: 2,
                    color: '#fff',
                  }}>
                    {tool.icon}
                  </Box>
                </Box>
                <CardContent sx={{ pt: 2 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>{tool.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{tool.desc}</Typography>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: tool.color,
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}>
                    立即使用 <ArrowForwardIcon sx={{ fontSize: 16 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Features Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <GppGoodIcon color="success" />
          <Typography variant="h6" fontWeight={700}>平台特性</Typography>
        </Box>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {features.map((f) => (
            <Grid item xs={6} md={3} key={f.title}>
              <Paper
                sx={{
                  p: 3,
                  height: '100%',
                  textAlign: 'center',
                  borderRadius: 3,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: `${f.color}.50`,
                    borderColor: `${f.color}.main`,
                    transform: 'translateY(-4px)',
                    boxShadow: (t) => `0 8px 24px ${alpha((t.palette[f.color as 'primary' | 'secondary' | 'success' | 'warning'] as { main: string }).main, 0.15)}`
                  }
                }}
                elevation={0}
              >
                <Box sx={{
                  color: `${f.color}.main`,
                  mb: 1.5,
                  display: 'flex',
                  justifyContent: 'center',
                  transform: 'scale(1.2)'
                }}>
                  {f.icon}
                </Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>{f.title}</Typography>
                <Typography variant="caption" color="text.secondary">{f.desc}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Sponsor CTA */}
        <Card
          onClick={() => navigate('/sponsor')}
          sx={{
            cursor: 'pointer',
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
            color: '#fff',
            borderRadius: 3,
            transition: 'all 0.3s',
            overflow: 'hidden',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -40,
              right: -40,
              width: 150,
              height: 150,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.08)',
            },
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: (t) => `0 16px 48px ${alpha(t.palette.secondary.main, 0.4)}`,
            }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 3, py: 4, position: 'relative' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              width: 72,
              height: 72,
            }}>
              <DnsIcon sx={{ fontSize: 36 }} />
            </Avatar>
            <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>成为节点赞助商</Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                一条命令即可部署您的专属测试节点，助力全球网络监测
              </Typography>
            </Box>
            <Button
              endIcon={<ArrowForwardIcon />}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.15)',
                  borderColor: '#fff'
                }
              }}
              variant="outlined"
            >
              查看安装指南
            </Button>
          </CardContent>
        </Card>
        <SponsorShowcase page="dashboard" position="footer" />
      </Container>
    </Box>
  );
}
