export interface BrandInfo {
  id: string;
  name: string;
  price: string;
  traffic: string;
  route: string;
  protocol: string;
  established: string;
  rating: string;
}

export const brandGridData: BrandInfo[] = [
  { id: 'breezenet', name: '微风网络 Breezenet', price: '¥8/月 （年付折算月）', traffic: '200GB', route: 'BGP中转', protocol: 'VLESS', established: '2022年', rating: '9.5' },
  { id: 'feimao', name: '飞猫', price: '¥7/月 （年付折算月）', traffic: '150GB', route: 'IEPL专线', protocol: 'VLESS', established: '2023年', rating: '9.8' },
  { id: 'muguang', name: '暮光网络', price: '¥9/月 （年付折算月）', traffic: '150GB', route: 'CN2 GIA', protocol: 'VLESS', established: '2021年', rating: '9.2' },
  { id: 'wuyou', name: '无忧', price: '¥19/月', traffic: '100GB', route: 'CN2 GIA', protocol: 'VLESS', established: '2021年', rating: '8.9' },
  { id: 'lingmao', name: '灵猫', price: '¥25/月', traffic: '150GB', route: 'BGP中转', protocol: '公开资料未标明', established: '2020年', rating: '9.0' },
  { id: 'shanyue', name: '闪跃 FlashLeap', price: '¥24/月', traffic: '150GB', route: 'IEPL专线', protocol: 'VLESS', established: '2022年', rating: '9.1' },
  { id: 'feiwei', name: 'Firefly机场', price: '¥25/月', traffic: '150GB', route: '直连', protocol: 'VLESS', established: '2023年', rating: '8.6' },
  { id: 'kuajie', name: '跨界', price: '¥20/月', traffic: '120GB', route: 'BGP中转', protocol: 'VLESS', established: '2021年', rating: '8.8' },
  { id: 'xingdaomeng', name: '星岛梦', price: '¥25/月', traffic: '150GB', route: 'BGP中转', protocol: '公开资料未标明', established: '2024年', rating: '8.8' },
  { id: 'guangsu', name: '光速云', price: '¥23/月', traffic: '148GB', route: 'IEPL专线', protocol: 'VLESS', established: '2020年', rating: '9.0' },
  { id: 'weitu', name: '唯兔云', price: '¥19.9/月', traffic: '150GB', route: '直连', protocol: 'VLESS', established: '2023年', rating: '8.5' },
  { id: 'u1s1', name: 'U1S1', price: '¥20/月', traffic: '120GB', route: 'BGP中转', protocol: 'VLESS', established: '2022年', rating: '8.9' },
  { id: 'jilian', name: '极连云', price: '¥18/月', traffic: '100GB', route: 'IEPL专线', protocol: '公开资料未标明', established: '2021年', rating: '9.1' },
  { id: 'quanqiu', name: '全球云', price: '¥20/月', traffic: '120GB', route: 'CN2 GIA', protocol: 'VLESS', established: '2020年', rating: '8.7' },
  { id: 'guangnian', name: '光年梯', price: '¥18/月', traffic: '110GB', route: 'BGP中转', protocol: 'VLESS', established: '2023年', rating: '9.0' },
  { id: 'sogo', name: 'Sogo云', price: '¥25/月', traffic: '150GB', route: '直连', protocol: 'VLESS', established: '2022年', rating: '8.6' },
  { id: 'yuzhou', name: '宇宙云', price: '¥25/月', traffic: '160GB', route: 'IEPL专线', protocol: 'VLESS', established: '2019年', rating: '9.4' },
  { id: 'ermao', name: '二猫云', price: '¥20/月', traffic: '130GB', route: 'BGP中转', protocol: 'VLESS', established: '2024年', rating: '8.4' },
  { id: 'yifan', name: '一翻云', price: '¥20/月', traffic: '150GB', route: 'CN2 GIA', protocol: 'VLESS', established: '2021年', rating: '8.8' },
  { id: 'bianyuan', name: '边缘节点', price: '¥22/月', traffic: '120GB', route: 'IEPL专线', protocol: 'VLESS', established: '2020年', rating: '9.2' },
  { id: 'kexin', name: '可信云', price: '¥15/月', traffic: '60GB', route: '直连', protocol: 'VLESS', established: '2023年', rating: '8.5' },
  { id: 'sujie', name: '速界 SuJie', price: '¥15/月', traffic: '50GB', route: 'BGP中转', protocol: 'VLESS', established: '2022年', rating: '8.7' },
  { id: 'kuaili', name: '快狸 KuaiLi', price: '¥15/月', traffic: '50GB', route: 'IEPL专线', protocol: 'VLESS', established: '2019年', rating: '9.3' },
  { id: 'feiv', name: '飞V', price: '¥25/月', traffic: '150GB', route: 'IEPL专线', protocol: 'VLESS', established: '2020年', rating: '9.2' },
  { id: 'tizi', name: '梯子云 LadderCloud', price: '¥25/月', traffic: '125GB', route: '直连', protocol: 'VLESS', established: '2024年', rating: '8.3' },
  { id: 'langwang', name: '浪网 WaveNet', price: '¥30/月', traffic: '150GB', route: 'IEPL专线', protocol: 'VLESS', established: '2019年', rating: '9.5' },
  { id: 'lingdong', name: '灵动云', price: '¥20/月', traffic: '100GB', route: 'BGP中转', protocol: 'VLESS', established: '2022年', rating: '8.7' },
  { id: 'yinxingren', name: '隐形人', price: '¥24/月', traffic: '144GB', route: 'CN2 GIA', protocol: 'VLESS', established: '2021年', rating: '9.0' }
];
