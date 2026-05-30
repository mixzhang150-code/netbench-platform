-- 赞助商展示系统表结构

CREATE TABLE IF NOT EXISTS sponsor_showcase_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page VARCHAR(50) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  title VARCHAR(200) DEFAULT '',
  style VARCHAR(20) DEFAULT 'grid',
  max_items INTEGER DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_showcase_sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  logo TEXT DEFAULT '',
  url VARCHAR(500) DEFAULT '',
  description TEXT DEFAULT '',
  position VARCHAR(20) NOT NULL DEFAULT 'top',
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_position ON sponsor_showcase_sponsors(position);
CREATE INDEX IF NOT EXISTS idx_sponsor_enabled ON sponsor_showcase_sponsors(enabled) WHERE enabled = true;

-- 初始化页面配置
INSERT INTO sponsor_showcase_configs (page, enabled, title, style, max_items) VALUES
  ('ping', false, '赞助商', 'grid', 6),
  ('http', false, '赞助商', 'grid', 6),
  ('dashboard', false, '合作伙伴', 'carousel', 8),
  ('sponsor', false, '特别感谢', 'list', 12)
ON CONFLICT (page) DO NOTHING;
