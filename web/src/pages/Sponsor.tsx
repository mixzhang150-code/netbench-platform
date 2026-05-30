import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip,
  Alert, Paper, Stepper, Step, StepLabel, StepContent,
  useMediaQuery, useTheme, Snackbar, IconButton,
} from '@mui/material';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import Terminal from '@mui/icons-material/Terminal';
import CloseIcon from '@mui/icons-material/Close';
import DnsIcon from '@mui/icons-material/Dns';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PublicIcon from '@mui/icons-material/Public';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { SponsorShowcase } from '../components/SponsorShowcase';

const INSTALL_CMD = "curl -fsSL https://dl.hydun.com/netbench/node/install.sh | sudo bash";
const UNINSTALL_CMD = "bash /opt/netbench-agent/uninstall.sh";
const CHECK_CMD = "systemctl status netbench-agent && journalctl -u netbench-agent -f";

export function Sponsor() {
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('md'));
  const [copied, setCopied] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const steps = [
    {
      label: '一键安装',
      description: '在 Linux 服务器上执行安装命令',
      content: (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>支持 Ubuntu/Debian/CentOS/RHEL/Fedora/Alpine 等主流发行版</Alert>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.900', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Terminal sx={{ color: 'grey.400' }} />
              <Typography variant="body2" color="text.secondary">安装 / 更新</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <code style={{ fontSize: isMobile ? 12 : 14, wordBreak: 'break-all', color: '#e2e8f0', fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace' }}>{INSTALL_CMD}</code>
              <Button
                size="small" startIcon={copied === 'install' ? <CheckCircleIcon /> : <CopyAllIcon />}
                onClick={() => copyToClipboard(INSTALL_CMD, 'install')}
                color={copied === 'install' ? 'success' : 'primary'}
                variant="contained"
                sx={{ minWidth: 80 }}
              >
                {copied === 'install' ? '已复制' : '复制'}
              </Button>
            </Box>
          </Paper>
        </Box>
      ),
    },
    {
      label: '配置节点',
      description: '按提示输入服务器地址、节点名称等信息',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            安装脚本会自动检测你的 IP、地域、ISP 信息，只需填写：
          </Typography>
          <Grid container spacing={1} sx={{ maxWidth: 500 }}>
            {[
              { label: '服务器地址', example: 'https://net.hydun.com' },
              { label: '节点名称', example: '北京-电信' },
            ].map((item) => (
              <Grid item xs={12} key={item.label}>
                <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.example}</Typography>
                  </Box>
                  <Chip size="small" label="必填" color="primary" />
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleIcon />}>
            地域信息会自动从 IP 检测，也可手动修改
          </Alert>
        </Box>
      ),
    },
    {
      label: '验证运行',
      description: '确认节点已成功注册并正常运行',
      content: (
        <Box>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.900', borderRadius: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Terminal sx={{ color: 'grey.400' }} />
              <Typography variant="body2" color="text.secondary">查看状态</Typography>
            </Box>
            <code style={{ fontSize: isMobile ? 12 : 14, wordBreak: 'break-all', display: 'block', whiteSpace: 'pre-wrap', color: '#e2e8f0', fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace' }}>{CHECK_CMD}</code>
          </Paper>
          <Typography variant="body2" color="text.secondary">
            正常日志应显示：<code>Node registered</code> 和 <code>Heartbeat sent</code>
          </Typography>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 50%, ${t.palette.secondary.main} 100%)`,
          color: '#fff',
          py: { xs: 5, md: 8 },
          px: 2,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, letterSpacing: -0.5 }}>
          贡献测试节点
        </Typography>
        <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.9, mb: 3 }}>
          一条命令，让您的服务器成为网络测速平台的一部分
        </Typography>
        <Chip icon={<DnsIcon />} label="全球覆盖" sx={{ mr: 1, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
        <Chip icon={<SpeedIcon />} label="低资源占用" sx={{ mr: 1, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
        <Chip icon={<SecurityIcon />} label="安全可靠" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />

        {/* CTA 按钮 */}
        <Box sx={{ mt: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'center' }}>
          <Paper
            component="button"
            onClick={() => copyToClipboard(INSTALL_CMD, 'hero')}
            sx={{
              cursor: 'pointer',
              border: 'none',
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              bgcolor: 'rgba(0,0,0,0.25)',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: { xs: 11, sm: 13 },
              width: { xs: '100%', sm: 'auto' },
              maxWidth: 600,
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.4)', transform: 'scale(1.01)' },
            }}
          >
            <Terminal sx={{ mr: 1, opacity: 0.7 }} />
            <span>{INSTALL_CMD}</span>
          </Paper>
        </Box>

        {copied === 'hero' && (
          <Box sx={{ mt: 2 }}>
            <Chip icon={<CheckCircleIcon />} label="命令已复制到剪贴板！" color="success" variant="filled" sx={{ color: '#fff', fontWeight: 600, '& .MuiChip-icon': { color: '#fff' } }} />
          </Box>
        )}
      </Box>

      {/* 特性介绍 */}
      <Box sx={{ py: { xs: 4, md: 6 }, px: 2 }}>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
          为什么贡献节点？
        </Typography>
        <Grid container spacing={3}>
          {[
            {
              icon: <PublicIcon sx={{ fontSize: 36 }} />,
              title: '扩大测速范围',
              desc: '您所在的位置将成为新的测试节点，帮助更多用户了解当地网络质量',
              color: 'primary',
            },
            {
              icon: <DnsIcon sx={{ fontSize: 36 }} />,
              title: '极低资源占用',
              desc: 'Agent 仅需 Node.js 运行时，内存占用 < 30MB，CPU 占用几乎为零（仅在执行测试时有少量消耗）',
              color: 'success',
            },
            {
              icon: <SupportAgentIcon sx={{ fontSize: 36 }} />,
              title: '自动化管理',
              desc: '安装后自动注册、心跳保活、任务轮询全部自动化，无需人工干预',
              color: 'secondary',
            },
            {
              icon: <SecurityIcon sx={{ fontSize: 36 }} />,
              title: '安全隔离',
              desc: 'Agent 仅与服务器通信，不开放任何入站端口，不影响服务器其他服务',
              color: 'warning',
            },
          ].map((feature) => (
            <Grid item xs={12} sm={6} key={feature.title}>
              <Card sx={{ height: '100%', borderTop: `4px solid`, borderColor: `${feature.color}.main` }}>
                <CardContent sx={{ pt: 3 }}>
                  <Box sx={{ color: `${feature.color}.main`, mb: 1 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{feature.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{feature.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 安装步骤 */}
      <Box sx={{ py: { xs: 4, md: 6 }, px: 2, bgcolor: 'grey.50' }}>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
          三步完成部署
        </Typography>
        <Stepper activeStep={activeStep} orientation={isMobile ? 'vertical' : 'horizontal'} nonLinear sx={{ maxWidth: 700, mx: 'auto' }}>
          {steps.map((step, index) => (
            <Step key={step.label} completed={false}>
              <StepLabel
                onClick={() => setActiveStep(index)}
                sx={{ cursor: 'pointer', '& .MuiStepLabel-label': { cursor: 'pointer' } }}
              >
                {step.label}
              </StepLabel>
              <StepContent>{step.content}</StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* 系统要求 */}
      <Box sx={{ py: { xs: 4, md: 6 }, px: 2 }}>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
          系统要求
        </Typography>
        <Grid container spacing={2} sx={{ maxWidth: 600, mx: 'auto' }}>
          {[
            { label: '操作系统', value: 'Linux (Ubuntu/Debian/CentOS/RHEL/Fedora/Alpine)' },
            { label: 'CPU', value: '任意架构 (x86_64 / ARM64)' },
            { label: '内存', value: '≥ 128MB 可用 RAM' },
            { label: '磁盘', value: '≥ 100MB 可用空间' },
            { label: '网络', value: '可访问外网（用于上报测试结果）' },
            { label: '权限', value: 'root 或 sudo 权限（用于安装 systemd 服务）' },
          ].map((req) => (
            <Grid item xs={12} sm={6} key={req.label}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="caption" color="primary" fontWeight={600}>{req.label}</Typography>
                <Typography variant="body2">{req.value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 常用命令 */}
      <Box sx={{ py: { xs: 4, md: 6 }, px: 2, bgcolor: 'grey.50' }}>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
          常用命令参考
        </Typography>
        <Grid container spacing={2} sx={{ maxWidth: 750, mx: 'auto' }}>
          {[
            { cmd: INSTALL_CMD, label: '安装 / 更新 Agent', type: 'install' },
            { cmd: UNINSTALL_CMD, label: '卸载 Agent', type: 'uninstall' },
            { cmd: 'systemctl status netbench-agent', label: '查看运行状态', type: 'status' },
            { cmd: 'journalctl -u netbench-agent -f', label: '实时查看日志', type: 'logs' },
            { cmd: 'systemctl restart netbench-agent', label: '重启 Agent', type: 'restart' },
            { cmd: 'cat /opt/netbench-agent/.env', label: '查看配置文件', type: 'config' },
          ].map((item) => (
            <Grid item xs={12} key={item.type}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                  <Button
                    size="small"
                    startIcon={copied === item.type ? <CheckCircleIcon /> : <CopyAllIcon />}
                    onClick={() => copyToClipboard(item.cmd, item.type)}
                    color={copied === item.type ? 'success' : 'inherit'}
                  >
                    {copied === item.type ? '已复制' : '复制'}
                  </Button>
                </Box>
                <code style={{ fontSize: 12, wordBreak: 'break-all', display: 'block', whiteSpace: 'pre-wrap', color: '#e2e8f0', backgroundColor: '#1e293b', padding: '6px 8px', borderRadius: 4, fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace' }}>{item.cmd}</code>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* FAQ */}
      <Box sx={{ py: { xs: 4, md: 6 }, px: 2 }}>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
          常见问题
        </Typography>
        <Grid container spacing={2} sx={{ maxWidth: 750, mx: 'auto' }}>
          {[
            {
              q: 'Agent 会影响服务器性能吗？',
              a: '不会。Agent 在空闲时仅发送心跳（每 30 秒一次），几乎零 CPU 和内存开销。只有在被分配到测试任务时才会短暂使用带宽。',
            },
            {
              q: '如何更新 Agent？',
              a: '重新执行安装命令即可：curl -fsSL https://dl.hydun.com/netbench/node/install.sh | sudo bash。脚本会自动检测已有配置并保留，无需手动操作。',
            },
            {
              q: '同名的节点重复安装怎么办？',
              a: '不用担心。同名的节点会复用原有的 ID 和 Token，不会产生重复记录。您可以随时在后台管理页面编辑或删除节点。',
            },
            {
              q: 'Agent 需要开放端口吗？',
              a: '不需要。Agent 作为客户端主动连接服务器，不需要开放任何入站端口，不会增加安全风险。',
            },
            {
              q: '卸载后数据还在吗？',
              a: '是的。卸载仅删除 Agent 程序本身，服务器端的历史测试数据会被完整保留。',
            },
          ].map((faq) => (
            <Grid item xs={12} key={faq.q}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>❓ {faq.q}</Typography>
                  <Typography variant="body2" color="text.secondary">{faq.a}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 底部 CTA */}
      <Box sx={{ py: { xs: 5, md: 8 }, textAlign: 'center', bgcolor: (t) => t.palette.grey[50] }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
          准备好贡献您的节点了吗？
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
          一行命令即可完成部署，加入全球网络测速社区
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<DownloadIcon />}
          onClick={() => copyToClipboard(INSTALL_CMD, 'final')}
          sx={{ px: 4, py: 1.5, fontSize: 16 }}
        >
          复制安装命令
        </Button>
      </Box>

      <SponsorShowcase page="sponsor" position="footer" />

      <Snackbar
        open={!!copied}
        autoHideDuration={2000}
        onClose={() => setCopied('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" icon={<CheckIcon fontSize="small" />}>
          已复制到剪贴板
        </Alert>
      </Snackbar>
    </Box>
  );
}

import CheckIcon from '@mui/icons-material/Check';
