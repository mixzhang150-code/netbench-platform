import { useMemo, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useTheme, Tabs, Tab
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import PublicIcon from '@mui/icons-material/Public';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export interface MapNodeData {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  status: 'completed' | 'failed' | 'running' | 'pending' | 'timeout';
  value?: number;
  valueType?: 'latency' | 'responseTime' | 'packetLoss';
  details?: Record<string, unknown>;
  sponsor?: string;
}

interface MapViewProps {
  nodes: MapNodeData[];
  height?: number;
  testType?: 'ping' | 'http';
}

const PROVINCE_TO_REGION: Record<string, string> = {
  '北京': '华北地区', '天津': '华北地区', '河北': '华北地区', '山西': '华北地区', '内蒙古': '华北地区',
  '辽宁': '东北地区', '吉林': '东北地区', '黑龙江': '东北地区',
  '上海': '华东地区', '江苏': '华东地区', '浙江': '华东地区', '安徽': '华东地区',
  '福建': '华东地区', '江西': '华东地区', '山东': '华东地区',
  '河南': '华中地区', '湖北': '华中地区', '湖南': '华中地区',
  '广东': '华南地区', '广西': '华南地区', '海南': '华南地区', '香港': '港澳台', '澳门': '港澳台', '台湾': '港澳台',
  '重庆': '西南地区', '四川': '西南地区', '贵州': '西南地区', '云南': '西南地区', '西藏': '西南地区',
  '陕西': '西北地区', '甘肃': '西北地区', '青海': '西北地区', '宁夏': '西北地区', '新疆': '西北地区',
};

const COUNTRY_TO_REGION: Record<string, string> = {
  '北美洲': '北美洲',
  '美国': '北美洲', 'USA': '北美洲', 'United States': '北美洲', '美利坚合众国': '北美洲',
  '加拿大': '北美洲', 'Canada': '北美洲',
  '墨西哥': '北美洲', 'Mexico': '北美洲',

  '南美洲': '南美洲',
  '巴西': '南美洲', 'Brazil': '南美洲',
  '阿根廷': '南美洲', 'Argentina': '南美洲',
  '智利': '南美洲', 'Chile': '南美洲',
  '秘鲁': '南美洲', 'Peru': '南美洲',
  '哥伦比亚': '南美洲', 'Colombia': '南美洲',
  '委内瑞拉': '南美洲', 'Venezuela': '南美洲',

  '欧洲': '欧洲',
  '英国': '欧洲', 'UK': '欧洲', 'United Kingdom': '欧洲', '英格兰': '欧洲',
  '德国': '欧洲', 'Germany': '欧洲',
  '法国': '欧洲', 'France': '欧洲',
  '俄罗斯': '欧洲', 'Russia': '欧洲',
  '意大利': '欧洲', 'Italy': '欧洲',
  '西班牙': '欧洲', 'Spain': '欧洲',
  '荷兰': '欧洲', 'Netherlands': '欧洲',
  '瑞士': '欧洲', 'Switzerland': '欧洲',
  '瑞典': '欧洲', 'Sweden': '欧洲',
  '挪威': '欧洲', 'Norway': '欧洲',
  '丹麦': '欧洲', 'Denmark': '欧洲',
  '芬兰': '欧洲', 'Finland': '欧洲',
  '波兰': '欧洲', 'Poland': '欧洲',
  '土耳其': '欧洲', 'Turkey': '欧洲',
  '乌克兰': '欧洲', 'Ukraine': '欧洲',
  '奥地利': '欧洲', 'Austria': '欧洲',
  '比利时': '欧洲', 'Belgium': '欧洲',
  '爱尔兰': '欧洲', 'Ireland': '欧洲',
  '葡萄牙': '欧洲', 'Portugal': '欧洲',
  '希腊': '欧洲', 'Greece': '欧洲',
  '捷克': '欧洲', 'Czech': '欧洲',
  '匈牙利': '欧洲', 'Hungary': '欧洲',
  '罗马尼亚': '欧洲', 'Romania': '欧洲',

  '东亚': '东亚',
  '日本': '东亚', 'Japan': '东亚',
  '韩国': '东亚', 'Korea': '东亚', '南韩': '东亚', '大韩民国': '东亚',
  '朝鲜': '东亚', 'North Korea': '东亚',

  '东南亚': '东南亚',
  '新加坡': '东南亚', 'Singapore': '东南亚',
  '泰国': '东南亚', 'Thailand': '东南亚',
  '越南': '东南亚', 'Vietnam': '东南亚',
  '马来西亚': '东南亚', 'Malaysia': '东南亚',
  '印度尼西亚': '东南亚', 'Indonesia': '东南亚',
  '菲律宾': '东南亚', 'Philippines': '东南亚',
  '缅甸': '东南亚', 'Myanmar': '东南亚',
  '柬埔寨': '东南亚', 'Cambodia': '东南亚',
  '老挝': '东南亚', 'Laos': '东南亚',
  '文莱': '东南亚', 'Brunei': '东南亚',

  '南亚': '南亚',
  '印度': '南亚', 'India': '南亚',
  '巴基斯坦': '南亚', 'Pakistan': '南亚',
  '孟加拉': '南亚', 'Bangladesh': '南亚',
  '斯里兰卡': '南亚', 'Sri Lanka': '南亚',
  '尼泊尔': '南亚', 'Nepal': '南亚',

  '大洋洲': '大洋洲',
  '澳大利亚': '大洋洲', 'Australia': '大洋洲',
  '新西兰': '大洋洲', 'New Zealand': '大洋洲',

  '中东': '中东地区',
  '沙特阿拉伯': '中东地区', 'Saudi Arabia': '中东地区',
  '阿联酋': '中东地区', 'UAE': '中东地区', '迪拜': '中东地区',
  '以色列': '中东地区', 'Israel': '中东地区',
  '伊朗': '中东地区', 'Iran': '中东地区',
  '伊拉克': '中东地区', 'Iraq': '中东地区',
  '科威特': '中东地区', 'Kuwait': '中东地区',
  '卡塔尔': '中东地区', 'Qatar': '中东地区',
  '阿曼': '中东地区', 'Oman': '中东地区',
  '约旦': '中东地区', 'Jordan': '中东地区',
  '黎巴嫩': '中东地区', 'Lebanon': '中东地区',

  '非洲': '非洲',
  '南非': '非洲', 'South Africa': '非洲',
  '埃及': '非洲', 'Egypt': '非洲',
  '尼日利亚': '非洲', 'Nigeria': '非洲',
  '肯尼亚': '非洲', 'Kenya': '非洲',
  '摩洛哥': '非洲', 'Morocco': '非洲',

  '南极洲': '南极洲',
  'Antarctica': '南极洲',
};

const OVERSEAS_CITY_TO_COUNTRY: Record<string, string> = {
  '凤凰城': '美国', '洛杉矶': '美国', '旧金山': '美国', '纽约': '美国', '西雅图': '美国',
  '芝加哥': '美国', '休斯顿': '美国', '迈阿密': '美国', '波士顿': '美国', '达拉斯': '美国',
  '亚特兰大': '美国', '费城': '美国', '硅谷': '美国',
  '多伦多': '加拿大', '温哥华': '加拿大', '蒙特利尔': '加拿大',
  '墨西哥城': '墨西哥',
  '圣保罗': '巴西', '里约热内卢': '巴西', '布宜诺斯艾利斯': '阿根廷',
  '伦敦': '英国', '曼彻斯特': '英国', '伯明翰': '英国', '爱丁堡': '英国',
  '巴黎': '法国', '马赛': '法国', '里昂': '法国',
  '柏林': '德国', '慕尼黑': '德国', '法兰克福': '德国', '汉堡': '德国',
  '莫斯科': '俄罗斯', '圣彼得堡': '俄罗斯',
  '罗马': '意大利', '米兰': '意大利',
  '马德里': '西班牙', '巴塞罗那': '西班牙',
  '阿姆斯特丹': '荷兰',
  '东京': '日本', '大阪': '日本', '京都': '日本', '名古屋': '日本', '横滨': '日本',
  '首尔': '韩国', '釜山': '韩国',
  '新加坡': '新加坡',
  '曼谷': '泰国', '清迈': '泰国',
  '胡志明市': '越南', '河内': '越南',
  '吉隆坡': '马来西亚', '槟城': '马来西亚',
  '雅加达': '印度尼西亚', '巴厘岛': '印度尼西亚',
  '马尼拉': '菲律宾',
  '孟买': '印度', '新德里': '印度', '班加罗尔': '印度',
  '悉尼': '澳大利亚', '墨尔本': '澳大利亚', '布里斯班': '澳大利亚', '珀斯': '澳大利亚',
  '奥克兰': '新西兰',
  '迪拜': '阿联酋', '阿布扎比': '阿联酋',
  '特拉维夫': '以色列',
  '开罗': '埃及',
  '约翰内斯堡': '南非', '开普敦': '南非',
};

const CITY_TO_PROVINCE: Record<string, string> = {
  '广州': '广东', '深圳': '广东', '东莞': '广东', '佛山': '广东', '珠海': '广东', '惠州': '广东', '中山': '广东', '汕头': '广东', '江门': '广东', '湛江': '广东', '肇庆': '广东', '茂名': '广东',
  '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '绍兴': '浙江', '嘉兴': '浙江', '台州': '浙江', '金华': '浙江', '湖州': '浙江',
  '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '常州': '江苏', '徐州': '江苏', '镇江': '江苏', '扬州': '江苏', '南通': '江苏', '连云港': '江苏', '泰州': '江苏',
  '成都': '四川', '绵阳': '四川', '德阳': '四川', '宜宾': '四川', '泸州': '四川', '南充': '四川',
  '武汉': '湖北', '宜昌': '湖北', '襄阳': '湖北', '十堰': '湖北', '荆州': '湖北', '黄石': '湖北',
  '西安': '陕西', '咸阳': '陕西', '宝鸡': '陕西',
  '长沙': '湖南', '株洲': '湖南', '岳阳': '湖南', '湘潭': '湖南', '衡阳': '湖南',
  '郑州': '河南', '洛阳': '河南', '开封': '河南', '南阳': '河南',
  '济南': '山东', '青岛': '山东', '烟台': '山东', '威海': '山东', '潍坊': '山东', '淄博': '山东',
  '福州': '福建', '厦门': '福建', '泉州': '福建', '漳州': '福建',
  '合肥': '安徽', '芜湖': '安徽', '蚌埠': '安徽', '安庆': '安徽',
  '沈阳': '辽宁', '大连': '辽宁', '鞍山': '辽宁', '抚顺': '辽宁', '本溪': '辽宁',
  '长春': '吉林', '吉林市': '吉林', '四平': '吉林', '通化': '吉林',
  '哈尔滨': '黑龙江', '大庆': '黑龙江', '齐齐哈尔': '黑龙江',
  '石家庄': '河北', '唐山': '河北', '保定': '河北', '秦皇岛': '河北', '邯郸': '河北',
  '太原': '山西', '大同': '山西', '临汾': '山西', '运城': '山西',
  '南昌': '江西', '赣州': '江西', '吉安': '江西', '九江': '江西', '上饶': '江西',
  '昆明': '云南', '大理': '云南', '丽江': '云南',
  '贵阳': '贵州', '遵义': '贵州',
  '南宁': '广西', '桂林': '广西', '柳州': '广西',
  '乌鲁木齐': '新疆', '喀什': '新疆', '伊犁': '新疆',
  '兰州': '甘肃', '天水': '甘肃',
  '西宁': '青海',
  '银川': '宁夏',
  '海口': '海南', '三亚': '海南',
  '香港': '香港', '澳门': '澳门', '台北': '台湾', '高雄': '台湾',
};

function getRegion(node: MapNodeData): string {
  const combined = `${node.name} ${node.location}`.toLowerCase();

  for (const [country, region] of Object.entries(COUNTRY_TO_REGION)) {
    if (combined.includes(country.toLowerCase())) {
      return region;
    }
  }

  for (const [city, country] of Object.entries(OVERSEAS_CITY_TO_COUNTRY)) {
    if (node.name.includes(city) || node.location.includes(city)) {
      const region = COUNTRY_TO_REGION[country];
      if (region) return region;
    }
  }

  let province = '';

  const locationParts = node.location.split(/[,，]/);
  const locationFirst = locationParts[0]?.trim() || '';
  if (locationFirst && locationFirst !== 'Unknown') {
    for (const [prov] of Object.entries(PROVINCE_TO_REGION)) {
      if (locationFirst.includes(prov) || prov.includes(locationFirst)) {
        province = prov;
        break;
      }
    }
  }

  if (!province) {
    for (const [city, prov] of Object.entries(CITY_TO_PROVINCE)) {
      if (node.name.includes(city)) {
        province = prov;
        break;
      }
    }
  }

  if (!province) {
    const directProvinceKeywords: Record<string, string> = {
      '北京': '北京', '上海': '上海', '天津': '天津', '重庆': '重庆',
      '河北': '河北', '山西': '山西', '内蒙古': '内蒙古',
      '辽宁': '辽宁', '吉林': '吉林', '黑龙江': '黑龙江',
      '江苏': '江苏', '浙江': '浙江', '安徽': '安徽', '福建': '福建', '江西': '江西', '山东': '山东',
      '河南': '河南', '湖北': '湖北', '湖南': '湖南', '广东': '广东', '广西': '广西', '海南': '海南',
      '四川': '四川', '贵州': '贵州', '云南': '云南', '西藏': '西藏',
      '陕西': '陕西', '甘肃': '甘肃', '青海': '青海', '宁夏': '宁夏', '新疆': '新疆',
    };

    for (const [keyword, prov] of Object.entries(directProvinceKeywords)) {
      if (node.name.includes(keyword)) { province = prov; break; }
    }
  }

  if (!province) {
    const cloudProviders = ['阿里云', '腾讯云', '华为云', '百度云', '京东云', 'UCloud', '青云'];
    if (cloudProviders.some(p => node.name.includes(p))) {
      const cloudCityMatch = node.name.match(/(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|重庆|天津|香港|青岛|济南|郑州|长沙|福州|厦门|合肥|沈阳|长春|哈尔滨|石家庄|太原|南昌|昆明|南宁|乌鲁木齐)/);
      if (cloudCityMatch) {
        const cloudCityMap: Record<string, string> = {
          '北京': '北京', '上海': '上海', '广州': '广东', '深圳': '广东', '杭州': '浙江', '南京': '江苏', '苏州': '江苏',
          '成都': '四川', '武汉': '湖北', '西安': '陕西', '重庆': '重庆', '天津': '天津', '香港': '香港',
          '青岛': '山东', '济南': '山东', '郑州': '河南', '长沙': '湖南', '福州': '福建', '厦门': '福建',
          '合肥': '安徽', '沈阳': '辽宁', '长春': '吉林', '哈尔滨': '黑龙江', '石家庄': '河北',
          '太原': '山西', '南昌': '江西', '昆明': '云南', '南宁': '广西', '乌鲁木齐': '新疆'
        };
        province = cloudCityMap[cloudCityMatch[1]] || '';
      }
    }
  }

  if (province && PROVINCE_TO_REGION[province]) {
    return PROVINCE_TO_REGION[province];
  }

  return '其他地区';
}

function getProvince(node: MapNodeData): string {
  const locationParts = node.location.split(/[,，]/);
  let province = locationParts[0]?.trim() || '';

  if (!province || province === 'Unknown') {
    const name = node.name;

    const provinceKeywords: Record<string, string> = {
      '北京': '北京', '上海': '上海', '天津': '天津', '重庆': '重庆',
      '河北': '河北', '山西': '山西', '内蒙古': '内蒙古',
      '辽宁': '辽宁', '吉林': '吉林', '黑龙江': '黑龙江',
      '江苏': '江苏', '浙江': '浙江', '安徽': '安徽', '福建': '福建', '江西': '江西', '山东': '山东',
      '河南': '河南', '湖北': '湖北', '湖南': '湖南', '广东': '广东', '广西': '广西', '海南': '海南',
      '四川': '四川', '贵州': '贵州', '云南': '云南', '西藏': '西藏',
      '陕西': '陕西', '甘肃': '甘肃', '青海': '青海', '宁夏': '宁夏', '新疆': '新疆',
      '香港': '香港', '澳门': '澳门', '台湾': '台湾',
    };

    for (const [keyword, prov] of Object.entries(provinceKeywords)) {
      if (name.includes(keyword)) { province = prov; break; }
    }

    if (!province) {
      for (const [city, prov] of Object.entries(CITY_TO_PROVINCE)) {
        if (name.includes(city)) { province = prov; break; }
      }
    }

    if (!province) {
      const cloudProviders = ['阿里云', '腾讯云', '华为云', '百度云', '京东云', 'UCloud', '青云'];
      if (cloudProviders.some(p => name.includes(p))) {
        const cloudCityMatch = name.match(/(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|重庆|天津|香港|青岛|济南|郑州|长沙|福州|厦门|合肥|沈阳|长春|哈尔滨|石家庄|太原|南昌|昆明|南宁|乌鲁木齐)/);
        if (cloudCityMatch) {
          const cloudCityMap: Record<string, string> = {
            '北京': '北京', '上海': '上海', '广州': '广东', '深圳': '广东', '杭州': '浙江', '南京': '江苏', '苏州': '江苏',
            '成都': '四川', '武汉': '湖北', '西安': '陕西', '重庆': '重庆', '天津': '天津', '香港': '香港',
            '青岛': '山东', '济南': '山东', '郑州': '河南', '长沙': '湖南', '福州': '福建', '厦门': '福建',
            '合肥': '安徽', '沈阳': '辽宁', '长春': '吉林', '哈尔滨': '黑龙江', '石家庄': '河北',
            '太原': '山西', '南昌': '江西', '昆明': '云南', '南宁': '广西', '乌鲁木齐': '新疆'
          };
          province = cloudCityMap[cloudCityMatch[1]] || '';
        }
      }
    }
  }

  return province;
}

interface RegionStatItem {
  name: string;
  fastestNode?: string;
  fastestValue?: number;
  slowestNode?: string;
  slowestValue?: number;
  avgValue: number;
  nodeCount: number;
  sponsors: string[];
}

function getLatencyColorHex(value: number, testType?: string): string {
  if (value <= 0) return '#e8e8e8';
  if (testType === 'http') {
    if (value < 200) return '#4ade80';
    if (value < 500) return '#a3e635';
    if (value < 1000) return '#facc15';
    if (value < 3000) return '#fb923c';
    return '#f87171';
  }
  if (value < 50) return '#4ade80';
  if (value < 100) return '#a3e635';
  if (value < 200) return '#facc15';
  if (value < 500) return '#fb923c';
  return '#f87171';
}

function formatRegionValue(value: number): string {
  if (value < 1000) return `${value.toFixed(0)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(2)}s`;
  return `${(value / 60000).toFixed(1)}min`;
}

function RegionTable({ title, icon, data, testType }: { title: string; icon: React.ReactNode; data: RegionStatItem[]; testType?: string }) {
  if (data.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        <Chip label={`${data.length} 个区域`} size="small" variant="outlined" color="primary" sx={{ height: 22, fontSize: '0.75rem' }} />
      </Box>
      <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>区域</TableCell>
              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>最快</TableCell>
              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>最慢</TableCell>
              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>平均</TableCell>
              <TableCell align="center" sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>节点数</TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.85rem' }}>赞助商</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(row => (
              <TableRow key={row.name} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: row.fastestValue !== undefined ? getLatencyColorHex(row.fastestValue, testType) : 'inherit' }}>
                    {row.fastestNode && row.fastestNode !== '-' ? `${row.fastestNode.slice(0, 12)} ${formatRegionValue(row.fastestValue || 0)}` : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: row.slowestValue !== undefined ? getLatencyColorHex(row.slowestValue, testType) : 'inherit' }}>
                    {row.slowestNode && row.slowestNode !== '-' ? `${row.slowestNode.slice(0, 12)} ${formatRegionValue(row.slowestValue || 0)}` : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: row.avgValue > 0 ? getLatencyColorHex(row.avgValue, testType) : 'inherit' }}>
                    {row.avgValue > 0 ? formatRegionValue(row.avgValue) : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={row.nodeCount} size="small" color="primary" variant="outlined" sx={{ height: 22, minWidth: 30, fontSize: '0.75rem' }} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {row.sponsors.length > 0 ? row.sponsors.map(s => (
                      <Chip key={s} label={s} size="small" variant="outlined" color="secondary" sx={{ height: 22, fontSize: '0.7rem' }} />
                    )) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export function MapView({ nodes, testType = 'ping' }: MapViewProps) {
  const theme = useTheme();

  const stats = useMemo(() => {
    const completed = nodes.filter(n => n.status === 'completed').length;
    const failed = nodes.filter(n => n.status === 'failed' || n.status === 'timeout').length;
    const running = nodes.filter(n => n.status === 'running' || n.status === 'pending').length;
    const totalNodes = nodes.length;
    const avgValue = nodes
      .filter(n => n.status === 'completed' && n.value !== undefined)
      .reduce((sum, n) => sum + (n.value || 0), 0) / 
      Math.max(1, nodes.filter(n => n.status === 'completed' && n.value !== undefined).length);
    return { totalNodes, completed, failed, running, avgValue };
  }, [nodes]);

  const regionStats = useMemo<RegionStatItem[]>(() => {
    const regionMap: Record<string, { nodes: MapNodeData[]; values: number[]; sponsors: Set<string> }> = {};

    nodes.forEach(node => {
      const regionName = getRegion(node);

      if (!regionMap[regionName]) regionMap[regionName] = { nodes: [], values: [], sponsors: new Set() };
      regionMap[regionName].nodes.push(node);
      if (node.value !== undefined && node.status === 'completed') {
        regionMap[regionName].values.push(node.value);
      }
      if (node.sponsor) {
        regionMap[regionName].sponsors.add(node.sponsor);
      }
    });

    return Object.entries(regionMap).map(([name, data]) => {
      const sortedValues = [...data.values].sort((a, b) => a - b);
      const fastestNode = sortedValues.length > 0
        ? data.nodes.find(n => n.value === sortedValues[0])?.name || '-'
        : '-';
      const slowestNode = sortedValues.length > 0
        ? data.nodes.find(n => n.value === sortedValues[sortedValues.length - 1])?.name || '-'
        : '-';
      const avgValue = sortedValues.length > 0
        ? sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length
        : 0;

      return { name, nodeCount: data.nodes.length, fastestNode, fastestValue: sortedValues[0], slowestNode, slowestValue: sortedValues[sortedValues.length - 1], avgValue, sponsors: [...data.sponsors] };
    }).sort((a, b) => {
      const regionOrder = ['华东地区', '华南地区', '华北地区', '华中地区', '东北地区', '西南地区', '西北地区', '港澳台', '东亚', '东南亚', '南亚', '北美洲', '南美洲', '欧洲', '中东地区', '非洲', '大洋洲', '南极洲', '其他地区'];
      const orderA = regionOrder.indexOf(a.name);
      const orderB = regionOrder.indexOf(b.name);
      if (orderA !== -1 && orderB !== -1) return orderA - orderB;
      if (orderA !== -1) return -1;
      if (orderB !== -1) return 1;
      return a.avgValue - b.avgValue;
    });
  }, [nodes]);

  const domesticRegions = useMemo(() => {
    const chinaRegions = ['华东地区', '华南地区', '华北地区', '华中地区', '东北地区', '西南地区', '西北地区', '港澳台'];
    return regionStats.filter(r => chinaRegions.includes(r.name));
  }, [regionStats]);

  const overseasRegions = useMemo(() => {
    const chinaRegions = ['华东地区', '华南地区', '华北地区', '华中地区', '东北地区', '西南地区', '西北地区', '港澳台'];
    return regionStats.filter(r => !chinaRegions.includes(r.name));
  }, [regionStats]);

  const globalAvgValue = stats.avgValue > 0 ? formatRegionValue(stats.avgValue) : '-';

  const [activeTab, setActiveTab] = useState<'domestic' | 'overseas' | 'all'>('all');

  const getDisplayData = () => {
    if (activeTab === 'domestic') return domesticRegions;
    if (activeTab === 'overseas') return overseasRegions;
    return regionStats;
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            <BarChartIcon sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.2rem' }} />
            测试结果概览
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {[
              { label: `总节点 ${stats.totalNodes}`, color: 'primary' as const },
              { label: `成功 ${stats.completed}`, color: 'success' as const },
              { label: `失败 ${stats.failed}`, color: 'error' as const },
              { label: `测试中 ${stats.running}`, color: 'warning' as const },
            ].map(s => (
              <Chip key={s.label} label={s.label} size="small" color={s.color} variant="outlined" />
            ))}

            {globalAvgValue !== '-' && (
              <Chip
                icon={<BarChartIcon />}
                label={`平均 ${globalAvgValue}`}
                size="small"
                variant="filled"
                color="primary"
              />
            )}
          </Box>
        </Box>

        {regionStats.length > 0 ? (
          <>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                value="all"
                icon={<BarChartIcon sx={{ fontSize: '1rem' }} />}
                iconPosition="start"
                label={`全部 (${regionStats.length})`}
                sx={{ textTransform: 'none', minHeight: 40 }}
              />
              <Tab
                value="domestic"
                icon={<LocationOnIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />}
                iconPosition="start"
                label={`国内 (${domesticRegions.length})`}
                sx={{ textTransform: 'none', minHeight: 40 }}
                disabled={domesticRegions.length === 0}
              />
              <Tab
                value="overseas"
                icon={<PublicIcon sx={{ fontSize: '1rem', color: 'secondary.main' }} />}
                iconPosition="start"
                label={`海外 (${overseasRegions.length})`}
                sx={{ textTransform: 'none', minHeight: 40 }}
                disabled={overseasRegions.length === 0}
              />
            </Tabs>

            <RegionTable
              title={activeTab === 'domestic' ? '国内区域' : activeTab === 'overseas' ? '海外区域' : '全部区域'}
              icon={activeTab === 'domestic'
                ? <LocationOnIcon sx={{ color: 'primary.main', fontSize: '1.3rem' }} />
                : activeTab === 'overseas'
                  ? <PublicIcon sx={{ color: 'secondary.main', fontSize: '1.3rem' }} />
                  : <BarChartIcon sx={{ color: 'info.main', fontSize: '1.3rem' }} />
              }
              data={getDisplayData()}
              testType={testType}
            />

            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">颜色标准:</Typography>
              {(testType === 'http' ? [
                { color: '#4ade80', label: '< 200ms 极快' },
                { color: '#a3e635', label: '< 500ms 良好' },
                { color: '#facc15', label: '< 1s 一般' },
                { color: '#fb923c', label: '< 3s 较慢' },
                { color: '#f87171', label: '> 3s 很慢' },
              ] : [
                { color: '#4ade80', label: '< 50ms 极快' },
                { color: '#a3e635', label: '< 100ms 良好' },
                { color: '#facc15', label: '< 200ms 一般' },
                { color: '#fb923c', label: '< 500ms 较慢' },
                { color: '#f87171', label: '> 500ms 很慢' },
              ]).map(item => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                  <Typography variant="caption">{item.label}</Typography>
                </Box>
              ))}
            </Box>
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <BarChartIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography variant="body2">暂无测试数据</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default MapView;
