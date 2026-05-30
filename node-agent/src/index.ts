#!/usr/bin/env node

import { Command } from 'commander';
import * as os from 'os';
import { NodeAgent } from './agent';

const program = new Command();

program
  .name('netbench-agent')
  .description('NetBench 节点代理程序 - 安装后可贡献测试节点')
  .version('1.0.0');

program
  .command('start')
  .description('启动节点代理')
  .requiredOption('-s, --server <url>', 'NetBench 服务器地址')
  .option('-t, --token <token>', '节点认证 Token')
  .option('-n, --name <name>', '节点名称', `node-${os.hostname()}`)
  .option('--heartbeat <ms>', '心跳间隔(毫秒)', '30000')
  .action(async (options) => {
    const token = options.token || process.env.NETBENCH_TOKEN || '';

    if (!token) {
      console.warn('Warning: No token provided. Agent will attempt registration without token.');
    }

    const agent = new NodeAgent({
      serverUrl: options.server,
      token,
      name: options.name,
      heartbeatInterval: parseInt(options.heartbeat),
    });

    const cleanup = async () => {
      console.log('\nShutting down...');
      await agent.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
      await agent.start();
    } catch {
      console.error('Agent encountered an error during startup, but will keep running and retry...');
    }
  });

program
  .command('register')
  .description('注册新节点并获取 Token')
  .requiredOption('-s, --server <url>', 'NetBench 服务器地址')
  .option('-n, --name <name>', '节点名称', `node-${os.hostname()}`)
  .action(async (options) => {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.post(`${options.server}/api/nodes/register`, {
        name: options.name,
        platform: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
        capabilities: { ping: true, http: true, speedtest: true },
      });

      if (response.data.success) {
        const { id, token } = response.data.data;
        console.log('\n✅ 节点注册成功！');
        console.log(`   节点 ID: ${id}`);
        console.log(`   Token:   ${token}`);
        console.log(`\n使用以下命令启动代理：`);
        console.log(`   netbench-agent start -s ${options.server} -t ${token} -n ${options.name}`);
      }
    } catch (error) {
      console.error('注册失败:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
