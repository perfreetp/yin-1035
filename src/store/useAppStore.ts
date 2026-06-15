import { create } from 'zustand';
import {
  Transport, Batch, Category, Market, Cooperative, Base,
  TempHumidityRecord, CoolerRecord, SealRecord,
  PressureRiskRecord, ArrivalRecord
} from '@/types';
import { storage } from '@/utils/storage';
import { generateId, generateBatchNo, generateTransportNo, getNowStr } from '@/utils/date';

interface AppState {
  transports: Transport[];
  categories: Category[];
  markets: Market[];
  cooperatives: Cooperative[];
  bases: Base[];
  currentTransportId: string | null;

  initData: () => void;

  setCurrentTransport: (id: string | null) => void;
  getCurrentTransport: () => Transport | undefined;

  addTransport: (transport: Partial<Transport>) => Transport;
  updateTransport: (id: string, updates: Partial<Transport>) => void;
  deleteTransport: (id: string) => void;

  addBatch: (transportId: string, batch: Partial<Batch>) => Batch;
  updateBatch: (transportId: string, batchId: string, updates: Partial<Batch>) => void;
  deleteBatch: (transportId: string, batchId: string) => void;

  addTempHumidity: (transportId: string, record: Partial<TempHumidityRecord>) => TempHumidityRecord;
  addCoolerRecord: (transportId: string, record: Partial<CoolerRecord>) => CoolerRecord;
  addSealRecord: (transportId: string, record: Partial<SealRecord>) => SealRecord;
  updateSealRecord: (transportId: string, sealId: string, updates: Partial<SealRecord>) => void;
  addPressureRiskRecord: (transportId: string, record: Partial<PressureRiskRecord>) => PressureRiskRecord;
  addArrivalRecord: (transportId: string, record: Partial<ArrivalRecord>) => ArrivalRecord;
  batchUpdateArrivalRecords: (transportId: string, records: Partial<ArrivalRecord>[]) => void;

  updateTransportStatus: (id: string, status: Transport['status']) => void;

  reorderBatches: (transportId: string, batchIds: string[]) => void;
  recalculateTransportLoss: (transportId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  transports: [],
  categories: [],
  markets: [],
  cooperatives: [],
  bases: [],
  currentTransportId: null,

  setCurrentTransport: (id) => {
    storage.setCurrentTransportId(id);
    set({ currentTransportId: id });
  },

  getCurrentTransport: () => {
    const { transports, currentTransportId } = get();
    return transports.find(t => t.id === currentTransportId);
  },

  addTransport: (transport) => {
    const newTransport: Transport = {
      id: generateId(),
      transportNo: generateTransportNo(),
      status: 'loading',
      driverName: '',
      plateNo: '',
      route: '',
      fromBase: '',
      toMarket: '',
      batches: [],
      totalBaskets: 0,
      coolerRecords: [],
      tempHumidityRecords: [],
      sealRecords: [],
      pressureRiskRecords: [],
      arrivalRecords: [],
      notes: '',
      createdAt: getNowStr(),
      ...transport,
    };

    const transports = [newTransport, ...get().transports];
    storage.setTransports(transports);
    set({ transports });
    console.log('[Store] addTransport:', newTransport.transportNo);
    return newTransport;
  },

  updateTransport: (id, updates) => {
    const transports = get().transports.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    storage.setTransports(transports);
    set({ transports });
  },

  deleteTransport: (id) => {
    const transports = get().transports.filter(t => t.id !== id);
    storage.setTransports(transports);
    set({ transports });

    if (get().currentTransportId === id) {
      get().setCurrentTransport(null);
    }
  },

  addBatch: (transportId, batch) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newBatch: Batch = {
      id: generateId(),
      batchNo: generateBatchNo(),
      categoryId: '',
      categoryName: '',
      cooperative: '',
      base: '',
      plot: '',
      basketCount: 0,
      targetMarket: '',
      precoolStatus: 'not_started',
      loadTime: getNowStr(),
      orderIndex: transport.batches.length,
      pressureRisk: false,
      notes: '',
      createdAt: getNowStr(),
      ...batch,
    };

    const updatedBatches = [...transport.batches, newBatch];
    const totalBaskets = updatedBatches.reduce((sum, b) => sum + b.basketCount, 0);

    get().updateTransport(transportId, {
      batches: updatedBatches,
      totalBaskets,
    });

    console.log('[Store] addBatch:', newBatch.batchNo);
    return newBatch;
  },

  updateBatch: (transportId, batchId, updates) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) return;

    const batches = transport.batches.map(b =>
      b.id === batchId ? { ...b, ...updates } : b
    );
    const totalBaskets = batches.reduce((sum, b) => sum + b.basketCount, 0);

    get().updateTransport(transportId, { batches, totalBaskets });
  },

  deleteBatch: (transportId, batchId) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) return;

    const batches = transport.batches.filter(b => b.id !== batchId);
    const totalBaskets = batches.reduce((sum, b) => sum + b.basketCount, 0);

    get().updateTransport(transportId, { batches, totalBaskets });
  },

  addTempHumidity: (transportId, record) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newRecord: TempHumidityRecord = {
      id: generateId(),
      transportId,
      timestamp: getNowStr(),
      temperature: 0,
      humidity: 0,
      ...record,
    };

    const tempHumidityRecords = [...transport.tempHumidityRecords, newRecord];
    get().updateTransport(transportId, { tempHumidityRecords });
    console.log('[Store] addTempHumidity:', newRecord.temperature, '°C');
    return newRecord;
  },

  addCoolerRecord: (transportId, record) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newRecord: CoolerRecord = {
      id: generateId(),
      transportId,
      action: 'start',
      timestamp: getNowStr(),
      ...record,
    };

    const coolerRecords = [...transport.coolerRecords, newRecord];
    get().updateTransport(transportId, { coolerRecords });
    console.log('[Store] addCoolerRecord:', newRecord.action);
    return newRecord;
  },

  addSealRecord: (transportId, record) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newRecord: SealRecord = {
      id: generateId(),
      transportId,
      sealNo: '',
      timestamp: getNowStr(),
      ...record,
    };

    const sealRecords = [...transport.sealRecords, newRecord];
    get().updateTransport(transportId, { sealRecords });
    console.log('[Store] addSealRecord:', newRecord.sealNo);
    return newRecord;
  },

  updateSealRecord: (transportId, sealId, updates) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) return;

    const sealRecords = transport.sealRecords.map(r =>
      r.id === sealId ? { ...r, ...updates } : r
    );
    get().updateTransport(transportId, { sealRecords });
    console.log('[Store] updateSealRecord:', sealId);
  },

  updateTransportStatus: (id, status) => {
    const updates: Partial<Transport> = { status };
    if (status === 'in_transit') {
      updates.departureTime = getNowStr();
    } else if (status === 'arrived') {
      updates.arrivalTime = getNowStr();
    }
    get().updateTransport(id, updates);
  },

  reorderBatches: (transportId, batchIds) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) return;

    const batches = batchIds.map((id, index) => {
      const batch = transport.batches.find(b => b.id === id);
      return batch ? { ...batch, orderIndex: index } : null;
    }).filter(Boolean) as Batch[];

    get().updateTransport(transportId, { batches });
  },

  addPressureRiskRecord: (transportId, record) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newRecord: PressureRiskRecord = {
      id: generateId(),
      transportId,
      position: 'top',
      timestamp: getNowStr(),
      ...record,
    };

    const pressureRiskRecords = [...(transport.pressureRiskRecords || []), newRecord];
    get().updateTransport(transportId, { pressureRiskRecords });
    console.log('[Store] addPressureRiskRecord:', newRecord.position);
    return newRecord;
  },

  addArrivalRecord: (transportId, record) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const newRecord: ArrivalRecord = {
      id: generateId(),
      transportId,
      batchId: '',
      originalBaskets: 0,
      arrivalBaskets: 0,
      lossBaskets: 0,
      lossRate: 0,
      qualityScore: 100,
      createdAt: getNowStr(),
      ...record,
    };

    const arrivalRecords = [...(transport.arrivalRecords || []), newRecord];
    get().updateTransport(transportId, { arrivalRecords });
    get().recalculateTransportLoss(transportId);
    console.log('[Store] addArrivalRecord, batch:', newRecord.batchId);
    return newRecord;
  },

  batchUpdateArrivalRecords: (transportId, records) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport) throw new Error('Transport not found');

    const existingRecords = transport.arrivalRecords || [];
    const updatedRecords = records.map(r => {
      const existing = existingRecords.find(e => e.batchId === r.batchId);
      if (existing) {
        return { ...existing, ...r };
      }
      return {
        id: generateId(),
        transportId,
        batchId: '',
        originalBaskets: 0,
        arrivalBaskets: 0,
        lossBaskets: 0,
        lossRate: 0,
        qualityScore: 100,
        createdAt: getNowStr(),
        ...r,
      } as ArrivalRecord;
    });

    get().updateTransport(transportId, { arrivalRecords: updatedRecords });
    get().recalculateTransportLoss(transportId);
    console.log('[Store] batchUpdateArrivalRecords, count:', updatedRecords.length);
  },

  recalculateTransportLoss: (transportId) => {
    const transport = get().transports.find(t => t.id === transportId);
    if (!transport || !transport.arrivalRecords || transport.arrivalRecords.length === 0) {
      return;
    }

    const records = transport.arrivalRecords;
    const totalOriginal = records.reduce((s, r) => s + (r.originalBaskets || 0), 0);
    const totalArrival = records.reduce((s, r) => s + (r.arrivalBaskets || 0), 0);
    const totalLoss = totalOriginal - totalArrival;
    const lossRate = totalOriginal > 0 ? parseFloat(((totalLoss / totalOriginal) * 100).toFixed(1)) : 0;
    const avgQuality = records.length > 0
      ? parseFloat((records.reduce((s, r) => s + (r.qualityScore || 0), 0) / records.length).toFixed(0))
      : undefined;

    get().updateTransport(transportId, {
      lossRate,
      qualityScore: avgQuality,
    });
  },

  initData: () => {
    console.log('[Store] initData');
    const rawTransports = storage.getTransports();
    const transports = rawTransports.map(t => ({
      ...t,
      pressureRiskRecords: t.pressureRiskRecords ?? [],
      arrivalRecords: t.arrivalRecords ?? [],
    })) as Transport[];
    const categories = storage.getCategories();
    const markets = storage.getMarkets();
    const cooperatives = storage.getCooperatives();
    const bases = storage.getBases();
    const currentTransportId = storage.getCurrentTransportId();

    set({
      transports,
      categories,
      markets,
      cooperatives,
      bases,
      currentTransportId,
    });

    console.log('[Store] initData complete, transports:', transports.length);
  },
}));
