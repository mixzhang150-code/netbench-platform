import React from 'react';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import CloudIcon from '@mui/icons-material/Cloud';
import PublicIcon from '@mui/icons-material/Public';

export type OperatorType = 'telecom' | 'unicom' | 'mobile' | 'cloud' | 'overseas' | 'other';

export interface NodeDisplayInfo {
  displayName: string;
  location: string;
  operator: OperatorType;
  operatorLabel: string;
  operatorIcon: React.ReactNode;
  sortKey: number;
  sequence?: number;
}

const TELECOM_KEYWORDS = ['电信', 'ctcc', 'chinatel', 'china telecom'];
const UNICOM_KEYWORDS = ['联通', 'cucc', 'unicom', 'china unicom'];
const MOBILE_KEYWORDS = ['移动', 'cmcc', 'chinamobile', 'china mobile'];
const CLOUD_KEYWORDS = ['腾讯云', '阿里云', '华为云', '百度云', '京东云', 'UCloud', '青云', '金山云', '天翼云', 'CDN', 'Cloudflare'];
const OVERSEAS_KEYWORDS = [
  // 亚洲
  '日本', '韩国', '新加坡', '香港', '台湾', '澳门',
  '泰国', '越南', '马来西亚', '印度尼西亚', '菲律宾', '柬埔寨',
  '老挝', '缅甸', '孟加拉', '印度', '巴基斯坦', '斯里兰卡',
  '尼泊尔', '马尔代夫', '阿联酋', '沙特', '卡塔尔', '科威特',
  '以色列', '土耳其', '伊朗', '伊拉克', '哈萨克斯坦', '乌兹别克斯坦',
  
  // 欧洲
  '英国', '德国', '法国', '意大利', '西班牙', '葡萄牙',
  '荷兰', '比利时', '瑞士', '奥地利', '瑞典', '挪威',
  '丹麦', '芬兰', '波兰', '捷克', '匈牙利', '希腊',
  '爱尔兰', '卢森堡', '马耳他', '塞浦路斯', '俄罗斯', '乌克兰',
  
  // 美洲
  '美国', '加拿大', '巴西', '墨西哥', '阿根廷', '智利',
  '哥伦比亚', '秘鲁', '委内瑞拉', '厄瓜多尔', '古巴', '巴拿马',
  
  // 大洋洲
  '澳洲', '澳大利亚', '新西兰', '斐济', '巴布亚新几内亚',
  
  // 非洲
  '南非', '埃及', '尼日利亚', '肯尼亚', '摩洛哥', '阿尔及利亚',
  '突尼斯', '加纳', '坦桑尼亚', '埃塞俄比亚', '肯尼亚',
  
  // 城市名
  '凤凰城', '洛杉矶', '旧金山', '纽约', '西雅图', '芝加哥',
  '达拉斯', '迈阿密', '休斯顿', '波士顿', '华盛顿', '亚特兰大',
  '伦敦', '曼彻斯特', '伯明翰', '利物浦', '爱丁堡', '格拉斯哥',
  '巴黎', '里昂', '马赛', '尼斯', '柏林', '法兰克福',
  '慕尼黑', '汉堡', '科隆', '东京', '大阪', '名古屋',
  '横滨', '神户', '福冈', '首尔', '釜山', '仁川',
  '新加坡', '悉尼', '墨尔本', '布里斯班', '珀斯', '奥克兰',
  '多伦多', '温哥华', '蒙特利尔', '渥太华', '迪拜', '阿布扎比',
  '孟买', '新德里', '班加罗尔', '曼谷', '吉隆坡', '雅加达',
  
  // 英文关键词
  'London', 'Paris', 'Berlin', 'Tokyo', 'Seoul', 'Singapore',
  'Sydney', 'Melbourne', 'Toronto', 'Vancouver', 'Dubai', 'AbuDhabi',
  'Amazon', 'AWS', 'Azure', 'GCP', 'OVH', 'Linode', 'Vultr',
  'DigitalOcean', 'Cloudflare', 'Heroku', 'Netlify', 'Firebase',
  
  // 特殊地区
  '南极洲',
];
const OVERSEAS_REGEX = /\b(usa|uk|jp|kr|sg|au|gb|de|fr|it|es|pt|nl|be|ch|at|se|no|dk|fi|pl|cz|hu|gr|ie|lu|mt|cy|ru|ua|ca|br|mx|ar|cl|co|pe|ve|ec|cu|pa|nz|fj|pg|za|eg|ng|ke|ma|dz|tn|gh|tz|et|my|id|ph|th|vn|bd|pk|lk|np|mv|ae|sa|qa|kw|il|tr|ir|iq|kz|uz)\b/i;

function extractLocation(name: string): string {
  const specialCities = [
    '北京', '上海', '天津', '重庆',
    '香港', '澳门', '台北',
    '南极洲',
  ];

  const overseasCities = [
    '凤凰城', '洛杉矶', '旧金山', '纽约', '西雅图', '芝加哥',
    '达拉斯', '迈阿密', '伦敦', '曼彻斯特', '伯明翰', '巴黎',
    '柏林', '法兰克福', '慕尼黑', '莫斯科', '东京', '大阪',
    '名古屋', '横滨', '首尔', '釜山', '新加坡', '悉尼',
    '墨尔本', '孟买', '新德里', '迪拜', '多伦多', '温哥华',
  ];

  const cityProvinceMap: Record<string, string> = {
    '广州': '广东', '深圳': '广东', '东莞': '广东', '佛山': '广东',
    '珠海': '广东', '惠州': '广东', '中山': '广东', '江门': '广东',
    '汕头': '广东', '湛江': '广东', '茂名': '广东', '肇庆': '广东',
    '韶关': '广东', '梅州': '广东', '清远': '广东', '阳江': '广东',
    '潮州': '广东', '揭阳': '广东', '云浮': '广东',
    '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '绍兴': '浙江',
    '嘉兴': '浙江', '湖州': '浙江', '金华': '浙江', '衢州': '浙江',
    '台州': '浙江', '丽水': '浙江', '舟山': '浙江',
    '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '常州': '江苏',
    '镇江': '江苏', '南通': '江苏', '扬州': '江苏', '泰州': '江苏',
    '盐城': '江苏', '连云港': '江苏', '徐州': '江苏', '淮安': '江苏',
    '宿迁': '江苏',
    '成都': '四川', '绵阳': '四川', '德阳': '四川', '南充': '四川',
    '宜宾': '四川', '自贡': '四川', '乐山': '四川', '泸州': '四川',
    '达州': '四川', '内江': '四川', '遂宁': '四川', '攀枝花': '四川',
    '武汉': '湖北', '襄阳': '湖北', '宜昌': '湖北', '荆州': '湖北',
    '十堰': '湖北', '黄冈': '湖北', '孝感': '湖北', '黄石': '湖北',
    '咸宁': '湖北', '恩施': '湖北',
    '西安': '陕西', '宝鸡': '陕西', '咸阳': '陕西', '渭南': '陕西',
    '延安': '陕西', '汉中': '陕西', '榆林': '陕西', '安康': '陕西',
    '铜川': '陕西', '商洛': '陕西',
    '长沙': '湖南', '株洲': '湖南', '湘潭': '湖南', '衡阳': '湖南',
    '岳阳': '湖南', '常德': '湖南', '郴州': '湖南', '邵阳': '湖南',
    '益阳': '湖南', '永州': '湖南', '怀化': '湖南', '娄底': '湖南',
    '张家界': '湖南', '湘西': '湖南',
    '郑州': '河南', '洛阳': '河南', '南阳': '河南', '新乡': '河南',
    '安阳': '河南', '焦作': '河南', '许昌': '河南', '商丘': '河南',
    '信阳': '河南', '周口': '河南', '驻马店': '河南', '开封': '河南',
    '平顶山': '河南', '濮阳': '河南', '漯河': '河南', '三门峡': '河南',
    '济南': '山东', '青岛': '山东', '烟台': '山东', '潍坊': '山东',
    '临沂': '山东', '淄博': '山东', '济宁': '山东', '泰安': '山东',
    '威海': '山东', '德州': '山东', '聊城': '山东', '滨州': '山东',
    '菏泽': '山东', '日照': '山东', '枣庄': '山东', '东营': '山东',
    '莱芜': '山东',
    '福州': '福建', '厦门': '福建', '泉州': '福建', '漳州': '福建',
    '莆田': '福建', '宁德': '福建', '龙岩': '福建', '三明': '福建',
    '南平': '福建',
    '合肥': '安徽', '芜湖': '安徽', '蚌埠': '安徽', '淮南': '安徽',
    '马鞍山': '安徽', '淮北': '安徽', '铜陵': '安徽', '安庆': '安徽',
    '黄山': '安徽', '滁州': '安徽', '阜阳': '安徽', '宿州': '安徽',
    '六安': '安徽', '亳州': '安徽', '池州': '安徽', '宣城': '安徽',
    '沈阳': '辽宁', '大连': '辽宁', '鞍山': '辽宁', '抚顺': '辽宁',
    '本溪': '辽宁', '丹东': '辽宁', '锦州': '辽宁', '营口': '辽宁',
    '阜新': '辽宁', '辽阳': '辽宁', '盘锦': '辽宁', '铁岭': '辽宁',
    '朝阳': '辽宁', '葫芦岛': '辽宁',
    '长春': '吉林', '吉林市': '吉林', '四平': '吉林', '辽源': '吉林',
    '通化': '吉林', '白山': '吉林', '松原': '吉林', '白城': '吉林',
    '延边': '吉林',
    '哈尔滨': '黑龙江', '齐齐哈尔': '黑龙江', '牡丹江': '黑龙江',
    '佳木斯': '黑龙江', '大庆': '黑龙江', '鸡西': '黑龙江',
    '双鸭山': '黑龙江', '伊春': '黑龙江', '七台河': '黑龙江',
    '鹤岗': '黑龙江', '黑河': '黑龙江', '绥化': '黑龙江',
    '石家庄': '河北', '唐山': '河北', '秦皇岛': '河北', '邯郸': '河北',
    '邢台': '河北', '保定': '河北', '张家口': '河北', '承德': '河北',
    '沧州': '河北', '廊坊': '河北', '衡水': '河北',
    '太原': '山西', '大同': '山西', '阳泉': '山西', '长治': '山西',
    '晋城': '山西', '朔州': '山西', '晋中': '山西', '运城': '山西',
    '忻州': '山西', '临汾': '山西', '吕梁': '山西',
    '南昌': '江西', '赣州': '江西', '九江': '江西', '吉安': '江西',
    '鹰潭': '江西', '宜春': '江西', '抚州': '江西', '上饶': '江西',
    '景德镇': '江西', '萍乡': '江西', '新余': '江西',
    '昆明': '云南', '曲靖': '云南', '玉溪': '云南', '保山': '云南',
    '昭通': '云南', '丽江': '云南', '普洱': '云南', '临沧': '云南',
    '贵阳': '贵州', '遵义': '贵州', '六盘水': '贵州', '安顺': '贵州',
    '毕节': '贵州', '铜仁': '贵州',
    '南宁': '广西', '柳州': '广西', '桂林': '广西', '梧州': '广西',
    '北海': '广西', '防城港': '广西', '钦州': '广西', '贵港': '广西',
    '玉林': '广西', '百色': '广西', '贺州': '广西', '河池': '广西',
    '来宾': '广西', '崇左': '广西',
    '海口': '海南', '三亚': '海南', '三沙': '海南', '儋州': '海南',
    '兰州': '甘肃', '天水': '甘肃', '白银': '甘肃', '武威': '甘肃',
    '张掖': '甘肃', '平凉': '甘肃', '酒泉': '甘肃', '庆阳': '甘肃',
    '定西': '甘肃', '陇南': '甘肃', '金昌': '甘肃', '嘉峪关': '甘肃',
    '乌鲁木齐': '新疆', '克拉玛依': '新疆', '吐鲁番': '新疆',
    '哈密': '新疆', '昌吉': '新疆', '博尔塔拉': '新疆',
    '巴音郭楞': '新疆', '阿克苏': '新疆', '克孜勒苏': '新疆',
    '喀什': '新疆', '和田': '新疆', '伊犁': '新疆', '塔城': '新疆',
    '阿勒泰': '新疆',
    '拉萨': '西藏', '日喀则': '西藏', '昌都': '西藏', '林芝': '西藏',
    '山南': '西藏', '那曲': '西藏', '阿里': '西藏',
    '呼和浩特': '内蒙古', '包头': '内蒙古', '乌海': '内蒙古',
    '赤峰': '内蒙古', '通辽': '内蒙古', '鄂尔多斯': '内蒙古',
    '呼伦贝尔': '内蒙古', '巴彦淖尔': '内蒙古', '乌兰察布': '内蒙古',
    '兴安盟': '内蒙古', '锡林郭勒': '内蒙古', '阿拉善': '内蒙古',
    '银川': '宁夏', '石嘴山': '宁夏', '吴忠': '宁夏', '固原': '宁夏',
    '中卫': '宁夏',
    '西宁': '青海', '海东': '青海', '海北': '青海', '黄南': '青海',
    '海南藏族自治州': '青海', '果洛': '青海', '玉树': '青海',
    '海西': '青海',
  };

  for (const city of specialCities) {
    if (name.includes(city)) return city;
  }

  for (const city of overseasCities) {
    if (name.includes(city)) return city;
  }

  const cityMatch = name.match(/([\u4e00-\u9fa5]{2,4})市/);
  if (cityMatch) {
    const city = cityMatch[1] + '市';
    const province = cityProvinceMap[city];
    return province ? `${province}${city}` : city;
  }

  const countryKeywords: Record<string, string> = {
    // 亚洲
    '英国': '英国', 'UK': '英国', 'United Kingdom': '英国',
    '美国': '美国', 'USA': '美国', 'United States': '美国',
    '日本': '日本', 'JP': '日本', 'Japan': '日本',
    '韩国': '韩国', 'KR': '韩国', 'Korea': '韩国',
    '新加坡': '新加坡', 'SG': 'Singapore',
    '香港': '香港', 'HK': 'Hong Kong',
    '台湾': '台湾', 'TW': 'Taiwan',
    '澳门': '澳门', 'MO': 'Macau',
    '泰国': '泰国', 'TH': 'Thailand',
    '越南': '越南', 'VN': 'Vietnam',
    '马来西亚': '马来西亚', 'MY': 'Malaysia',
    '印度尼西亚': '印度尼西亚', 'ID': 'Indonesia',
    '菲律宾': '菲律宾', 'PH': 'Philippines',
    '印度': '印度', 'IN': 'India',
    '巴基斯坦': '巴基斯坦', 'PK': 'Pakistan',
    '阿联酋': '阿联酋', 'AE': 'UAE',
    '沙特': '沙特阿拉伯', 'SA': 'Saudi Arabia',
    '以色列': '以色列', 'IL': 'Israel',
    '土耳其': '土耳其', 'TR': 'Turkey',
    
    // 欧洲
    '德国': '德国', 'DE': 'Germany',
    '法国': '法国', 'FR': 'France',
    '意大利': '意大利', 'IT': 'Italy',
    '西班牙': '西班牙', 'ES': 'Spain',
    '荷兰': '荷兰', 'NL': 'Netherlands',
    '瑞士': '瑞士', 'CH': 'Switzerland',
    '俄罗斯': '俄罗斯', 'RU': 'Russia',
    '乌克兰': '乌克兰', 'UA': 'Ukraine',
    '波兰': '波兰', 'PL': 'Poland',
    
    // 美洲
    '加拿大': '加拿大', 'CA': 'Canada',
    '巴西': '巴西', 'BR': 'Brazil',
    '墨西哥': '墨西哥', 'MX': 'Mexico',
    '阿根廷': '阿根廷', 'AR': 'Argentina',
    '智利': '智利', 'CL': 'Chile',
    
    // 大洋洲
    '澳洲': '澳大利亚', '澳大利亚': '澳大利亚', 'AU': 'Australia',
    '新西兰': '新西兰', 'NZ': 'New Zealand',
    
    // 非洲
    '南非': '南非', 'ZA': 'South Africa',
    '埃及': '埃及', 'EG': 'Egypt',
  };

  for (const [kw, country] of Object.entries(countryKeywords)) {
    if (name.toLowerCase().includes(kw.toLowerCase())) return country;
  }

  for (const kw of OVERSEAS_KEYWORDS) {
    if (name.toLowerCase().includes(kw.toLowerCase())) return kw;
  }

  return name;
}

function extractCloudProvider(nodeName: string): string | null {
  for (const provider of CLOUD_KEYWORDS) {
    if (nodeName.includes(provider)) return provider;
  }
  return null;
}

export function classifyNode(nodeName: string): NodeDisplayInfo {
  const lowerName = nodeName.toLowerCase();
  let operator: OperatorType = 'other';
  let operatorLabel = '其他';
  let operatorIcon: React.ReactNode = <SignalCellularAltIcon sx={{ fontSize: 16 }} />;

  const isOverseas = OVERSEAS_KEYWORDS.some(k => lowerName.includes(k.toLowerCase())) || OVERSEAS_REGEX.test(lowerName);
  const isCloud = CLOUD_KEYWORDS.some(k => nodeName.includes(k));

  if (TELECOM_KEYWORDS.some(k => lowerName.includes(k))) {
    operator = 'telecom';
    operatorLabel = '电信';
  } else if (UNICOM_KEYWORDS.some(k => lowerName.includes(k))) {
    operator = 'unicom';
    operatorLabel = '联通';
  } else if (MOBILE_KEYWORDS.some(k => lowerName.includes(k))) {
    operator = 'mobile';
    operatorLabel = '移动';
  } else if (isOverseas) {
    operator = 'overseas';
    operatorLabel = '海外';
    operatorIcon = <PublicIcon sx={{ fontSize: 16 }} />;
  } else if (isCloud) {
    operator = 'cloud';
    operatorLabel = '云服务';
    operatorIcon = <CloudIcon sx={{ fontSize: 16 }} />;
  }

  const location = extractLocation(nodeName);
  const cloudProvider = operator === 'cloud' ? extractCloudProvider(nodeName) : null;
  const displayName = cloudProvider ? `${cloudProvider} - ${location}` : location;
  const sortOrder: Record<OperatorType, number> = { telecom: 1, unicom: 2, mobile: 3, cloud: 4, overseas: 5, other: 6 };

  return {
    displayName,
    operator,
    operatorLabel,
    operatorIcon,
    location,
    sortKey: sortOrder[operator],
  };
}

export interface SortedNodeInfo<T> extends NodeDisplayInfo {
  originalIndex: number;
  originalTask: T;
}

export function buildSortedNodeList<T extends { nodeName: string }>(tasks: T[]): SortedNodeInfo<T>[] {
  const withInfo = tasks.map((task, index) => ({
    originalIndex: index,
    originalTask: task,
    info: classifyNode(task.nodeName),
  }));

  withInfo.sort((a, b) => a.info.sortKey - b.info.sortKey || a.info.location.localeCompare(b.info.location, 'zh-CN'));

  const countMap = new Map<string, number>();

  return withInfo.map(item => {
    const baseKey = `${item.info.operatorLabel}_${item.info.location}`;
    countMap.set(baseKey, (countMap.get(baseKey) || 0) + 1);
    const seq = countMap.get(baseKey)!;

    const displayName = seq > 1 ? `${item.info.location} ${seq}` : item.info.location;

    return {
      ...item.info,
      displayName,
      sequence: seq > 1 ? seq : undefined,
      originalIndex: item.originalIndex,
      originalTask: item.originalTask,
    };
  });
}

export function sortNodesByOperator<T extends { nodeName: string }>(tasks: T[]): number[] {
  return buildSortedNodeList(tasks).map(item => item.originalIndex);
}
