import Taro from '@tarojs/taro';
import { Transport, Category, Market, Cooperative, Base } from '@/types';

const STORAGE_KEYS = {
  TRANSPORTS: 'cold_chain_transports',
  CATEGORIES: 'cold_chain_categories',
  MARKETS: 'cold_chain_markets',
  COOPERATIVES: 'cold_chain_cooperatives',
  BASES: 'cold_chain_bases',
  CURRENT_TRANSPORT_ID: 'cold_chain_current_transport',
};

export const storage = {
  // 运输记录
  getTransports(): Transport[] {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.TRANSPORTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getTransports error:', e);
      return [];
    }
  },

  setTransports(transports: Transport[]): void {
    try {
      Taro.setStorageSync(STORAGE_KEYS.TRANSPORTS, JSON.stringify(transports));
    } catch (e) {
      console.error('[Storage] setTransports error:', e);
    }
  },

  getTransportById(id: string): Transport | undefined {
    const transports = this.getTransports();
    return transports.find(t => t.id === id);
  },

  saveTransport(transport: Transport): void {
    const transports = this.getTransports();
    const index = transports.findIndex(t => t.id === transport.id);
    if (index >= 0) {
      transports[index] = transport;
    } else {
      transports.unshift(transport);
    }
    this.setTransports(transports);
  },

  // 当前运输ID
  getCurrentTransportId(): string | null {
    try {
      return Taro.getStorageSync(STORAGE_KEYS.CURRENT_TRANSPORT_ID) || null;
    } catch (e) {
      return null;
    }
  },

  setCurrentTransportId(id: string | null): void {
    try {
      if (id) {
        Taro.setStorageSync(STORAGE_KEYS.CURRENT_TRANSPORT_ID, id);
      } else {
        Taro.removeStorageSync(STORAGE_KEYS.CURRENT_TRANSPORT_ID);
      }
    } catch (e) {
      console.error('[Storage] setCurrentTransportId error:', e);
    }
  },

  // 品类
  getCategories(): Category[] {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getCategories error:', e);
      return [];
    }
  },

  setCategories(categories: Category[]): void {
    try {
      Taro.setStorageSync(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.error('[Storage] setCategories error:', e);
    }
  },

  // 市场
  getMarkets(): Market[] {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.MARKETS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getMarkets error:', e);
      return [];
    }
  },

  setMarkets(markets: Market[]): void {
    try {
      Taro.setStorageSync(STORAGE_KEYS.MARKETS, JSON.stringify(markets));
    } catch (e) {
      console.error('[Storage] setMarkets error:', e);
    }
  },

  // 合作社
  getCooperatives(): Cooperative[] {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.COOPERATIVES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getCooperatives error:', e);
      return [];
    }
  },

  setCooperatives(cooperatives: Cooperative[]): void {
    try {
      Taro.setStorageSync(STORAGE_KEYS.COOPERATIVES, JSON.stringify(cooperatives));
    } catch (e) {
      console.error('[Storage] setCooperatives error:', e);
    }
  },

  // 基地
  getBases(): Base[] {
    try {
      const data = Taro.getStorageSync(STORAGE_KEYS.BASES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getBases error:', e);
      return [];
    }
  },

  setBases(bases: Base[]): void {
    try {
      Taro.setStorageSync(STORAGE_KEYS.BASES, JSON.stringify(bases));
    } catch (e) {
      console.error('[Storage] setBases error:', e);
    }
  },

  // 清除所有数据
  clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        Taro.removeStorageSync(key);
      });
    } catch (e) {
      console.error('[Storage] clearAll error:', e);
    }
  },
};
