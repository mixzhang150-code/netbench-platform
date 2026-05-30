CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    version VARCHAR(20) DEFAULT '1.0.0',
    platform VARCHAR(20) NOT NULL,
    platform_details TEXT DEFAULT '',
    ip VARCHAR(45) NOT NULL,
    country VARCHAR(100) DEFAULT 'Unknown',
    region VARCHAR(100) DEFAULT 'Unknown',
    city VARCHAR(100) DEFAULT 'Unknown',
    lat DOUBLE PRECISION DEFAULT 0,
    lon DOUBLE PRECISION DEFAULT 0,
    isp VARCHAR(200) DEFAULT 'Unknown',
    cap_ping BOOLEAN DEFAULT true,
    cap_http BOOLEAN DEFAULT true,
    cap_speedtest BOOLEAN DEFAULT true,
    max_concurrent_tasks INTEGER DEFAULT 5,
    bandwidth_limit BIGINT DEFAULT 0,
    reputation_score INTEGER DEFAULT 50,
    reputation_total_tasks INTEGER DEFAULT 0,
    reputation_successful_tasks INTEGER DEFAULT 0,
    reputation_failed_tasks INTEGER DEFAULT 0,
    reputation_avg_response_time DOUBLE PRECISION DEFAULT 0,
    reputation_uptime DOUBLE PRECISION DEFAULT 100,
    reputation_last_evaluated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats_current_tasks INTEGER DEFAULT 0,
    stats_total_tasks_completed INTEGER DEFAULT 0,
    stats_total_uptime DOUBLE PRECISION DEFAULT 0,
    stats_last_test_at TIMESTAMP WITH TIME ZONE,
    token VARCHAR(500) UNIQUE NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_results (
    id VARCHAR(100) PRIMARY KEY,
    task_id VARCHAR(100),
    type VARCHAR(20) NOT NULL,
    target VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    result_data JSONB NOT NULL DEFAULT '{}',
    node_id VARCHAR(100),
    node_location VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    task_ids JSONB DEFAULT '[]',
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    condition VARCHAR(100) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    duration INTEGER DEFAULT 0,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN DEFAULT true,
    notify_channels JSONB DEFAULT '["log"]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    target VARCHAR(200),
    value DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes(owner_id);
CREATE INDEX IF NOT EXISTS idx_nodes_last_heartbeat ON nodes(last_heartbeat);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_cap_ping ON nodes(cap_ping) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_nodes_cap_http ON nodes(cap_http) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_nodes_cap_speedtest ON nodes(cap_speedtest) WHERE status = 'online';

CREATE INDEX IF NOT EXISTS idx_test_results_type ON test_results(type);
CREATE INDEX IF NOT EXISTS idx_test_results_node ON test_results(node_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created ON test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_test_results_task ON test_results(task_id);

CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged) WHERE NOT acknowledged;
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

INSERT INTO alert_rules (name, condition, threshold, duration, severity, notify_channels) VALUES
    ('服务宕机', 'service_down', 1, 0, 'critical', '["log", "redis"]'),
    ('节点离线', 'node_offline', 3, 300, 'warning', '["log", "redis"]'),
    ('高丢包率', 'high_packet_loss', 10, 60, 'warning', '["log"]'),
    ('高延迟', 'high_latency', 500, 120, 'warning', '["log"]'),
    ('信誉过低', 'low_reputation', 20, 0, 'critical', '["log", "redis"]');

INSERT INTO users (id, username, email, password_hash, role, preferences, created_at, last_login) VALUES
    (uuid_generate_v4(), 'admin', 'admin@netbench.local', '$2b$12$6AuQykDOR/6MvngwAkQLR.eqE9IrivchX.iRwpMKdaBQv6yP8EHhm', 'admin', '{"defaultPingCount":4,"defaultTimeout":5000,"defaultHttpMethod":"GET","theme":"auto","notifications":true}', NOW(), NOW());
