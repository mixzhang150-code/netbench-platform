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
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

INSTALL_DIR="/opt/netbench-agent"
NODE_VERSION="20"
SERVICE_NAME="netbench-agent"
DOWNLOAD_URL="https://dl.hydun.com/netbench/node/node-agent.zip"
TMP_DIR="/tmp/netbench-install"
VERSION="2.0"

echo ""
echo "========================================="
echo "   NetBench 节点代理 安装脚本 v$VERSION"
echo "========================================="
echo ""

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 权限运行此脚本: sudo bash install.sh"
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$PRETTY_NAME
    elif [ -f /etc/redhat-release ]; then
        OS_ID="rhel"
        OS_NAME=$(cat /etc/redhat-release)
    else
        OS_ID="unknown"
        OS_NAME="Unknown Linux"
    fi
    info "检测到操作系统: $OS_NAME"
}

check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -ge 18 ]; then
            ok "Node.js 已安装: $(node -v)"
            return 0
        else
            warn "Node.js 版本过低: $(node -v), 需要 >= 18"
            return 1
        fi
    else
        warn "Node.js 未安装"
        return 1
    fi
}

install_nodejs_debian() {
    info "正在安装 Node.js $NODE_VERSION (Debian/Ubuntu)..."
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates gnupg unzip > /dev/null

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null

    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_VERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq nodejs > /dev/null

    check_nodejs && ok "Node.js 安装成功" || error "Node.js 安装失败"
}

install_nodejs_rhel() {
    info "正在安装 Node.js $NODE_VERSION (RHEL/CentOS/Fedora)..."
    yum install -y -q curl unzip > /dev/null 2>&1 || dnf install -y -q curl unzip > /dev/null 2>&1
    curl -fsSL https://rpm.nodesource.com/setup_$NODE_VERSION.x | bash - > /dev/null 2>&1
    yum install -y -q nodejs > /dev/null 2>&1 || dnf install -y -q nodejs > /dev/null 2>&1

    check_nodejs && ok "Node.js 安装成功" || error "Node.js 安装失败"
}

install_nodejs_alpine() {
    info "正在安装 Node.js (Alpine)..."
    apk add --quiet nodejs npm curl unzip

    check_nodejs && ok "Node.js 安装成功" || error "Node.js 安装失败"
}

install_nodejs_nvm() {
    info "使用 nvm 安装 Node.js..."
    export NVM_DIR="/opt/nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install $NODE_VERSION > /dev/null 2>&1
    nvm alias default $NODE_VERSION > /dev/null 2>&1

    ln -sf $(which node) /usr/local/bin/node 2>/dev/null || true
    ln -sf $(which npm) /usr/local/bin/npm 2>/dev/null || true

    check_nodejs && ok "Node.js 安装成功 (via nvm)" || error "Node.js 安装失败"
}

install_nodejs() {
    case $OS_ID in
        ubuntu|debian|linuxmint|pop|elementary) install_nodejs_debian ;;
        rhel|centos|fedora|amzn|rocky|alma) install_nodejs_rhel ;;
        alpine) install_nodejs_alpine ;;
        *) warn "不支持的系统: $OS_ID, 尝试使用 nvm 安装..."; install_nodejs_nvm ;;
    esac
}

install_agent() {
    info "正在安装 NetBench Agent..."

    if [ -d "$INSTALL_DIR" ]; then
        warn "检测到已有安装，正在更新..."
        systemctl stop $SERVICE_NAME 2>/dev/null || true
    fi

    mkdir -p $INSTALL_DIR
    rm -rf $TMP_DIR
    mkdir -p $TMP_DIR

    info "正在从 $DOWNLOAD_URL 下载..."
    if ! curl -fsSL -o $TMP_DIR/node-agent.zip "$DOWNLOAD_URL"; then
        error "下载失败，请检查网络连接"
    fi
    ok "下载完成"

    info "正在解压..."
    if ! unzip -qo $TMP_DIR/node-agent.zip -d $TMP_DIR; then
        error "解压失败"
    fi

    if [ -d "$TMP_DIR/node-agent" ]; then
        cp -r $TMP_DIR/node-agent/* $INSTALL_DIR/
    else
        cp -r $TMP_DIR/* $INSTALL_DIR/
    fi

    rm -rf $TMP_DIR

    cd $INSTALL_DIR

    info "正在安装依赖..."
    npm config set registry https://registry.npmmirror.com 2>/dev/null || true
    npm install --silent 2>/dev/null || npm install

    info "正在编译 TypeScript..."
    npx tsc

    chmod +x dist/index.js
    ln -sf $INSTALL_DIR/dist/index.js /usr/local/bin/netbench-agent 2>/dev/null || true

    cp $INSTALL_DIR/uninstall.sh /opt/netbench-agent/uninstall.sh 2>/dev/null || true

    ok "Agent 安装完成"
}

detect_location() {
    info "正在自动检测节点地域信息..."

    IP_DATA=$(curl -s --connect-timeout 10 'https://api.hydun.com/api/ip/index.php?source=ip9&apikey=3236faee46ebc07981794439846cfaf9' 2>/dev/null) || true

    if echo "$IP_DATA" | grep -q '"code": 200'; then
        DETECT_IP=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.ip)}catch{}})" 2>/dev/null || echo "")
        DETECT_COUNTRY=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.country)}catch{}})" 2>/dev/null || echo "CN")
        DETECT_REGION=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.region)}catch{}})" 2>/dev/null || echo "")
        DETECT_CITY=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.city)}catch{}})" 2>/dev/null || echo "")
        DETECT_ISP=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.isp)}catch{}})" 2>/dev/null || echo "")
        DETECT_LAT=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.lat)}catch{}})" 2>/dev/null || echo "0")
        DETECT_LON=$(echo "$IP_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.info.lng)}catch{}})" 2>/dev/null || echo "0")

        ok "地域检测成功: $DETECT_COUNTRY $DETECT_REGION $DETECT_CITY ($DETECT_ISP) IP: $DETECT_IP"
    else
        warn "主 API 检测失败，尝试备用..."
        FALLBACK_DATA=$(curl -s --connect-timeout 10 'http://ip-api.com/json/?lang=zh-CN' 2>/dev/null) || true

        if echo "$FALLBACK_DATA" | grep -q '"status":"success"'; then
            DETECT_IP=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).query)}catch{}})" 2>/dev/null || echo "")
            DETECT_COUNTRY=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).country)}catch{}})" 2>/dev/null || echo "Unknown")
            DETECT_CITY=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).city)}catch{}})" 2>/dev/null || echo "")
            DETECT_ISP=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).isp)}catch{}})" 2>/dev/null || echo "")
            DETECT_REGION=""
            DETECT_LAT=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).lat)}catch{}})" 2>/dev/null || echo "0")
            DETECT_LON=$(echo "$FALLBACK_DATA" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).lon)}catch{}})" 2>/dev/null || echo "0")

            ok "地域检测成功(备用): $DETECT_COUNTRY $DETECT_CITY ($DETECT_ISP)"
        else
            warn "自动检测地域全部失败，请手动输入"
            DETECT_IP=""
            DETECT_COUNTRY="Unknown"
            DETECT_REGION=""
            DETECT_CITY=""
            DETECT_ISP=""
            DETECT_LAT=0
            DETECT_LON=0
        fi
    fi
}

configure_agent() {
    IS_UPDATE=false
    if [ -f "$INSTALL_DIR/.env" ]; then
        source $INSTALL_DIR/.env 2>/dev/null || true
        if [ -n "$NETBENCH_SERVER" ] && [ -n "$NODE_NAME" ] && [ -n "$NETBENCH_TOKEN" ]; then
            info "检测到已有配置，跳过交互式配置"
            IS_UPDATE=true
        fi
    fi

    if [ "$IS_UPDATE" = false ]; then
        echo ""
        echo -e "${BLUE}=========================================${NC}"
        echo -e "${BLUE}   节点配置${NC}"
        echo -e "${BLUE}=========================================${NC}"
        echo ""

        read -p "请输入 NetBench 服务器地址 (例如: https://net.hydun.com): " SERVER_URL < /dev/tty
        SERVER_URL=${SERVER_URL%/}
        if [ -z "$SERVER_URL" ]; then
            error "服务器地址不能为空"
        fi

        read -p "请输入节点名称 (例如: 北京-电信): " NODE_NAME < /dev/tty
        if [ -z "$NODE_NAME" ]; then
            NODE_NAME="node-$(hostname)"
            warn "使用默认节点名: $NODE_NAME"
        fi

        detect_location

        if [ -z "$DETECT_CITY" ]; then
            read -p "请输入节点城市: " NODE_CITY < /dev/tty
            read -p "请输入节点国家 (默认: Unknown): " NODE_COUNTRY < /dev/tty
            NODE_COUNTRY=${NODE_COUNTRY:-Unknown}
            read -p "请输入运营商/ISP (例如: 中国电信): " NODE_ISP < /dev/tty
            NODE_REGION=""
            NODE_LAT=0
            NODE_LON=0
        else
            NODE_CITY=$DETECT_CITY
            NODE_COUNTRY=$DETECT_COUNTRY
            NODE_REGION=$DETECT_REGION
            NODE_ISP=$DETECT_ISP
            NODE_LAT=$DETECT_LAT
            NODE_LON=$DETECT_LON
        fi

        cat > $INSTALL_DIR/.env << EOF
NETBENCH_SERVER=$SERVER_URL
NODE_NAME=$NODE_NAME
NODE_CITY=$NODE_CITY
NODE_COUNTRY=$NODE_COUNTRY
NODE_REGION=$NODE_REGION
NODE_ISP=$NODE_ISP
NODE_LAT=$NODE_LAT
NODE_LON=$NODE_LON
EOF

        ok "配置已保存到 $INSTALL_DIR/.env"

        register_node "$SERVER_URL" "$NODE_NAME" "$NODE_CITY" "$NODE_COUNTRY" "$NODE_ISP" "$DETECT_IP"
    fi
}

register_node() {
    local SERVER_URL=$1
    local NAME=$2
    local CITY=$3
    local COUNTRY=$4
    local ISP=$5
    local IP=$6

    info "正在注册节点 (最多重试3次)..."

    REG_SUCCESS=false
    for i in 1 2 3; do
        REG_OUTPUT=$(node -e "
const axios = require('axios');
axios.post('$SERVER_URL/api/nodes/register', {
    name: '$NAME',
    platform: '$(uname -s | tr '[:upper:]' '[:lower:]')',
    ip: '${IP:-}',
    location: { city: '$CITY', country: '$COUNTRY', isp: '$ISP' },
    capabilities: { ping: true, http: true, speedtest: true },
}).then(r => {
    if (r.data.success) console.log(JSON.stringify(r.data.data));
    else console.log('ERROR:' + JSON.stringify(r.data.error));
}).catch(e => console.log('ERROR:' + e.message));
" 2>/dev/null) || true

        if echo "$REG_OUTPUT" | grep -q '"token"'; then
            NODE_TOKEN=$(echo "$REG_OUTPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))" 2>/dev/null)
            NODE_ID=$(echo "$REG_OUTPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))" 2>/dev/null)

            sed -i '/^NETBENCH_TOKEN=/d' $INSTALL_DIR/.env 2>/dev/null || true
            echo "NETBENCH_TOKEN=$NODE_TOKEN" >> $INSTALL_DIR/.env

            if echo "$REG_OUTPUT" | grep -q '"reRegistered":true'; then
                ok "节点重新注册成功! ID: $NODE_ID (复用原有身份)"
            else
                ok "节点注册成功! ID: $NODE_ID"
            fi
            REG_SUCCESS=true
            break
        else
            ERR_MSG=$(echo "$REG_OUTPUT" | sed 's/^ERROR://' 2>/dev/null || echo "未知错误")
            warn "注册尝试 $i/3 失败: $ERR_MSG"
            [ $i -lt 3 ] && sleep 5
        fi
    done

    if [ "$REG_SUCCESS" = false ]; then
        warn "自动注册失败，Agent 启动后将自动重试注册"
        echo "NETBENCH_TOKEN=" >> $INSTALL_DIR/.env
    fi
}

setup_systemd() {
    info "正在配置 systemd 服务..."

    source $INSTALL_DIR/.env 2>/dev/null || true

    if [ -z "$NETBENCH_SERVER" ] || [ -z "$NODE_NAME" ]; then
        warn "配置文件不完整，服务可能无法正常启动"
    fi

    cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=NetBench Node Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=-$INSTALL_DIR/.env
ExecStart=$(which node) $INSTALL_DIR/dist/index.js start -s \${NETBENCH_SERVER} -t "\${NETBENCH_TOKEN}" -n "\${NODE_NAME}"
Restart=always
RestartSec=10
StartLimitIntervalSec=0
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME > /dev/null 2>&1
    systemctl start $SERVICE_NAME

    sleep 2
    if systemctl is-active --quiet $SERVICE_NAME; then
        ok "服务已启动并设置为开机自启"
    else
        warn "服务启动中，请稍后检查日志: journalctl -u $SERVICE_NAME -f"
    fi
}

show_result() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}   安装完成!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "  安装目录:   $INSTALL_DIR"
    echo "  配置文件:   $INSTALL_DIR/.env"
    echo "  服务名称:   $SERVICE_NAME"
    echo ""
    echo "  常用命令:"
    echo "    查看状态:  systemctl status $SERVICE_NAME"
    echo "    查看日志:  journalctl -u $SERVICE_NAME -f"
    echo "    重启服务:  systemctl restart $SERVICE_NAME"
    echo "    停止服务:  systemctl stop $SERVICE_NAME"
    echo "    卸载:      bash $INSTALL_DIR/uninstall.sh"
    echo ""
    echo "  提示:"
    echo "    同名节点重新注册时会复用原有 ID 和 Token"
    echo "    如需修改服务器地址，编辑 $INSTALL_DIR/.env 后重启服务"
    echo ""
}

main() {
    check_root
    detect_os

    if ! check_nodejs; then
        install_nodejs
    fi

    install_agent
    configure_agent
    setup_systemd
    show_result
}

main
