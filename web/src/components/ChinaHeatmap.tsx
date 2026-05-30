import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, ToggleButtonGroup,
  ToggleButton, LinearProgress, useTheme
} from '@mui/material';
import chinaGeoJSON from '../data/chinaGeoJson';
import type { MapNodeData } from './MapView';

interface RegionStats {
  name: string;
  fastestNode?: string;
  fastestValue?: number;
  slowestNode?: string;
  slowestValue?: number;
  avgValue: number;
  nodeCount: number;
}

const CHINA_CENTER: [number, number] = [35.8617, 104.1954];
const CHINA_ZOOM = 4;

const PROVINCE_TO_REGION: Record<string, string> = {
  '北京': '华北地区', '天津': '华北地区', '河北': '华北地区', '山西': '华北地区', '内蒙古': '华北地区',
  '辽宁': '东北地区', '吉林': '东北地区', '黑龙江': '东北地区',
  '上海': '华东地区', '江苏': '华东地区', '浙江': '华东地区', '安徽': '华东地区',
  '福建': '华东地区', '江西': '华东地区', '山东': '华东地区',
  '河南': '华中地区', '湖北': '华中地区', '湖南': '华中地区',
  '广东': '华南地区', '广西': '华南地区', '海南': '华南地区', '香港': '华南地区', '澳门': '华南地区',
  '重庆': '西南地区', '四川': '西南地区', '贵州': '西南地区', '云南': '西南地区', '西藏': '西南地区',
  '陕西': '西北地区', '甘肃': '西北地区', '青海': '西北地区', '宁夏': '西北地区', '新疆': '西北地区',
  '台湾': '港澳台',
};

function getLatencyColor(value: number): string {
  if (value <= 0) return '#e0e0e0';
  if (value < 50) return '#22c55e';
  if (value < 100) return '#84cc16';
  if (value < 200) return '#eab308';
  if (value < 500) return '#f97316';
  return '#ef4444';
}

function getLatencyColorHex(value: number): string {
  if (value <= 0) return '#e8e8e8';
  if (value < 50) return '#4ade80';
  if (value < 100) return '#a3e635';
  if (value < 200) return '#facc15';
  if (value < 500) return '#fb923c';
  return '#f87171';
}

function formatValue(value: number): string {
  if (value < 1000) return `${value.toFixed(0)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(2)}s`;
  return `${(value / 60000).toFixed(1)}min`;
}

export interface ChinaHeatmapProps {
  nodes: MapNodeData[];
  testType?: 'ping' | 'http';
}

export function ChinaHeatmap({ nodes, testType = 'ping' }: ChinaHeatmapProps) {
  const [viewMode, setViewMode] = useState<'china' | 'overseas'>('china');
  const theme = useTheme();

  const provinceData = useMemo(() => {
    const data: Record<string, MapNodeData[]> = {};
    nodes.forEach(node => {
      let province = '';
      
      const locationParts = node.location.split(/[,，]/);
      const locationFirst = locationParts[0]?.trim() || '';
      
      if (locationFirst && locationFirst !== 'Unknown') {
        province = locationFirst;
      }
      
      if (!province || province === 'Unknown') {
        const name = node.name;
        if (name.includes('北京') || name.includes('Beijing')) province = '北京';
        else if (name.includes('上海') || name.includes('Shanghai')) province = '上海';
        else if (name.includes('广州') || name.includes('深圳') || name.includes('东莞') || name.includes('佛山') || name.includes('珠海') || name.includes('惠州')) province = '广东';
        else if (name.includes('杭州') || name.includes('宁波') || name.includes('温州') || name.includes('绍兴')) province = '浙江';
        else if (name.includes('南京') || name.includes('苏州') || name.includes('无锡') || name.includes('常州') || name.includes('徐州')) province = '江苏';
        else if (name.includes('成都')) province = '四川';
        else if (name.includes('武汉')) province = '湖北';
        else if (name.includes('西安')) province = '陕西';
        else if (name.includes('重庆')) province = '重庆';
        else if (name.includes('天津') || name.includes('Tianjin')) province = '天津';
        else if (name.includes('香港') || name.includes('Hong Kong') || name.includes('HK')) province = '香港';
        else if (name.includes('澳门') || name.includes('Macau')) province = '澳门';
        else if (name.includes('台湾') || name.includes('Taiwan')) province = '台湾';
        else if (name.includes('阿里云') || name.includes('腾讯云') || name.includes('华为云') || name.includes('百度云') || name.includes('京东云') || name.includes('UCloud') || name.includes('青云')) {
          if (name.includes('北京')) province = '北京';
          else if (name.includes('上海')) province = '上海';
          else if (name.includes('广州') || name.includes('深圳')) province = '广东';
          else if (name.includes('杭州')) province = '浙江';
          else if (name.includes('成都')) province = '四川';
          else if (name.includes('南京') || name.includes('苏州')) province = '江苏';
          else if (name.includes('武汉')) province = '湖北';
          else if (name.includes('西安')) province = '陕西';
          else if (name.includes('重庆')) province = '重庆';
          else if (name.includes('香港')) province = '香港';
          else { 
            const cloudMatch = name.match(/(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|重庆|天津|香港)/);
            if (cloudMatch) {
              const cityMap: Record<string, string> = { '北京': '北京', '上海': '上海', '广州': '广东', '深圳': '广东', '杭州': '浙江', '南京': '江苏', '苏州': '江苏', '成都': '四川', '武汉': '湖北', '西安': '陕西', '重庆': '重庆', '天津': '天津', '香港': '香港' };
              province = cityMap[cloudMatch[1]] || '';
            }
          }
        }
      }
      
      if (province && !data[province]) data[province] = [];
      if (province) data[province].push(node);
    });
    return data;
  }, [nodes]);

  const regionStats = useMemo<RegionStats[]>(() => {
    const regionMap: Record<string, { nodes: MapNodeData[]; values: number[] }> = {};
    
    Object.entries(provinceData).forEach(([province, provNodes]) => {
      const region = PROVINCE_TO_REGION[province] || '其他地区';
      if (!regionMap[region]) regionMap[region] = { nodes: [], values: [] };
      
      provNodes.forEach(n => {
        regionMap[region].nodes.push(n);
        if (n.value !== undefined && n.status === 'completed') {
          regionMap[region].values.push(n.value);
        }
      });
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

      return {
        name,
        nodeCount: data.nodes.length,
        fastestNode,
        fastestValue: sortedValues[0],
        slowestNode,
        slowestValue: sortedValues[sortedValues.length - 1],
        avgValue,
      };
    }).sort((a, b) => a.avgValue - b.avgValue);
  }, [provinceData]);

  const totalNodes = nodes.filter(n => n.status === 'completed').length;
  const completedPercent = totalNodes > 0 ? Math.round((totalNodes / Math.max(1, nodes.length)) * 100) : 0;

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const provinceName = feature.properties.name;
    const provNodes = provinceData[provinceName] || [];
    const completedNodes = provNodes.filter(n => n.status === 'completed');
    const avgVal = completedNodes.length > 0
      ? completedNodes.reduce((sum, n) => sum + (n.value || 0), 0) / completedNodes.length
      : 0;

    const fillColor = getLatencyColor(avgVal);

    (layer as L.Path).setStyle({
      weight: 1,
      opacity: 1,
      color: '#999',
      fillOpacity: completedNodes.length > 0 ? 0.7 : 0.3,
      fillColor,
    });

    (layer as L.Path).on({
      mouseover: function () {
        (layer as L.Path).setStyle({ weight: 2, color: '#333', fillOpacity: 0.9 });
      },
      mouseout: function () {
        (layer as L.Path).setStyle({ weight: 1, opacity: 1, color: '#999', fillOpacity: completedNodes.length > 0 ? 0.7 : 0.3, fillColor });
      }
    });

    layer.bindTooltip(`
      <div style="padding: 4px; font-size: 13px;">
        <strong>${provinceName}</strong><br/>
        节点数: ${provNodes.length}<br/>
        已完成: ${completedNodes.length}<br/>
        ${completedNodes.length > 0 ? `平均延迟: ${formatValue(avgVal)}` : '暂无数据'}
      </div>
    `, { sticky: true });
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: '#ff6b00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '10px' }}>NB</Typography>
              </Box>
              <Typography variant="h6" fontWeight={700}>NetBench</Typography>
            </Box>

            <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
              <ToggleButton value="china" sx={{ fontSize: '0.75rem', px: 1.5 }}>中国地区</ToggleButton>
              <ToggleButton value="overseas" sx={{ fontSize: '0.75rem', px: 1.5 }}>海外地区</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`${totalNodes} 个节点参与测试`} size="small" variant="outlined" />
              <Box sx={{ width: 120 }}>
                <LinearProgress variant="determinate" value={completedPercent} sx={{ height: 6, borderRadius: 3 }} />
                <Typography variant="caption" sx={{ float: 'right', mt: 0.5 }}>{completedPercent}%</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
          <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <MapContainer center={CHINA_CENTER} zoom={CHINA_ZOOM} style={{ height: 480, width: '100%' }} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; 高德地图'
                url='https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
                subdomains='1234'
              />
              <GeoJSON key="china-map" data={chinaGeoJSON as any} style={{}} onEachFeature={onEachFeature as any} />
            </MapContainer>

            <Box sx={{
              position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
              bgcolor: 'rgba(255,255,255,0.95)', p: 1.5, borderRadius: 2, boxShadow: 2
            }}>
              <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>图例:</Typography>
              {[
                { color: '#4ade80', label: '<= 0.5s' },
                { color: '#a3e635', label: '0.5-1s' },
                { color: '#facc15', label: '1-3s' },
                { color: '#fb923c', label: '3-5s' },
                { color: '#f87171', label: '> 5s' },
                { color: '#e8e8e8', label: '无数据' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: item.color, border: '1px solid #ddd' }} />
                  <Typography variant="caption">{item.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <TableContainer sx={{ width: { xs: '100%', md: 420 }, maxHeight: 480, borderLeft: '1px solid', borderColor: 'divider' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>区域/运营商</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>最快</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>最慢</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>平均</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {regionStats.map(row => (
                  <TableRow key={row.name} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: row.fastestValue !== undefined ? getLatencyColorHex(row.fastestValue) : 'inherit' }}>
                        {row.fastestNode && row.fastestNode !== '-' ? `${row.fastestNode.slice(0, 6)} ${formatValue(row.fastestValue || 0)}` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: row.slowestValue !== undefined ? getLatencyColorHex(row.slowestValue) : 'inherit' }}>
                        {row.slowestNode && row.slowestNode !== '-' ? `${row.slowestNode.slice(0, 6)} ${formatValue(row.slowestValue || 0)}` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.avgValue > 0 ? formatValue(row.avgValue) : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {regionStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">暂无测试数据</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </CardContent>
    </Card>
  );
}

export default ChinaHeatmap;
