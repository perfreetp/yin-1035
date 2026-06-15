// 品类信息
export interface Category {
  id: string;
  name: string;
  shortKey: string;
  icon: string;
  defaultTemp: number;
  pressureRisk: boolean;
}

// 预冷状态
export type PrecoolStatus = 'not_started' | 'cooling' | 'completed';

// 地块批次
export interface Batch {
  id: string;
  batchNo: string;
  categoryId: string;
  categoryName: string;
  cooperative: string;
  base: string;
  plot: string;
  basketCount: number;
  targetMarket: string;
  precoolStatus: PrecoolStatus;
  loadTime: string;
  orderIndex: number;
  pressureRisk: boolean;
  notes: string;
  createdAt: string;
}

// 温湿度记录
export interface TempHumidityRecord {
  id: string;
  transportId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  location?: string;
  notes?: string;
}

// 保温机记录
export interface CoolerRecord {
  id: string;
  transportId: string;
  action: 'start' | 'stop';
  timestamp: string;
  temperature?: number;
  notes?: string;
}

// 封签记录
export interface SealRecord {
  id: string;
  transportId: string;
  sealNo: string;
  photoUrl?: string;
  timestamp: string;
  notes?: string;
}

// 压筐风险位置
export type PressureRiskPosition = 'top' | 'bottom';

// 压筐风险记录
export interface PressureRiskRecord {
  id: string;
  transportId: string;
  position: PressureRiskPosition;
  batchId?: string;
  categoryName?: string;
  notes?: string;
  timestamp: string;
}

// 运输状态
export type TransportStatus = 'loading' | 'in_transit' | 'arrived';

// 运输记录
export interface Transport {
  id: string;
  transportNo: string;
  status: TransportStatus;
  driverName: string;
  plateNo: string;
  route: string;
  fromBase: string;
  toMarket: string;
  batches: Batch[];
  totalBaskets: number;
  coolerRecords: CoolerRecord[];
  tempHumidityRecords: TempHumidityRecord[];
  sealRecords: SealRecord[];
  pressureRiskRecords: PressureRiskRecord[];
  arrivalRecords: ArrivalRecord[];
  departureTime?: string;
  arrivalTime?: string;
  lossRate?: number;
  qualityScore?: number;
  notes?: string;
  createdAt: string;
}

// 到站损耗记录（按批次核对）
export interface ArrivalRecord {
  id: string;
  transportId: string;
  batchId: string;
  batchNo?: string;
  categoryName?: string;
  originalBaskets: number;
  arrivalBaskets: number;
  lossBaskets: number;
  lossRate: number;
  qualityScore: number;
  damageType?: string;
  notes?: string;
  createdAt: string;
}

// 统计数据
export interface StatsData {
  totalTransports: number;
  totalBaskets: number;
  avgLossRate: number;
  avgQualityScore: number;
  byCooperative: Array<{ name: string; count: number; baskets: number; lossRate: number }>;
  byBase: Array<{ name: string; count: number; baskets: number; lossRate: number }>;
  byRoute: Array<{ name: string; count: number; baskets: number; lossRate: number }>;
  qualityTrend: Array<{ date: string; score: number; lossRate: number }>;
}

// 常用市场
export interface Market {
  id: string;
  name: string;
  shortKey: string;
}

// 合作社
export interface Cooperative {
  id: string;
  name: string;
  shortKey: string;
}

// 基地
export interface Base {
  id: string;
  name: string;
  cooperativeId: string;
  shortKey: string;
}
