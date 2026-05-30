#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

INSTALL_DIR="/opt/netbench-agent"
SERVICE_NAME="netbench-agent"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} 请使用 root 权限运行此脚本"
    exit 1
fi

echo ""
echo "确定要卸载 NetBench Agent 吗?"
read -p "输入 yes 确认: " CONFIRM < /dev/tty
if [ "$CONFIRM" != "yes" ]; then
    echo "已取消"
    exit 0
fi

info "正在停止服务..."
systemctl stop $SERVICE_NAME 2>/dev/null || true
systemctl disable $SERVICE_NAME 2>/dev/null || true
rm -f /etc/systemd/system/$SERVICE_NAME.service
systemctl daemon-reload

info "正在删除文件..."
rm -f /usr/local/bin/netbench-agent
rm -rf $INSTALL_DIR

ok "NetBench Agent 已卸载"
