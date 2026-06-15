import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { Transport, ArrivalRecord, PressureRiskRecord } from '@/types';
import { formatDate, formatTime } from '@/utils/date';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

type TabType = 'arrived' | 'all';

const ArrivalPage: React.FC = () => {
  const { transports, batchUpdateArrivalRecords } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('arrived');
  const [showLossModal, setShowLossModal] = useState(false);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [lossRecords, setLossRecords] = useState<Array<{
    batchId: string;
    batchNo: string;
    categoryName: string;
    originalBaskets: number;
    arrivalBaskets: string;
    lossBaskets: string;
    qualityScore: string;
    notes: string;
  }>>([]);

  const arrivedTransports = useMemo(() => {
    return transports.filter(t => t.status === 'arrived');
  }, [transports]);

  const displayTransports = useMemo(() => {
    if (activeTab === 'arrived') {
      return arrivedTransports;
    }
    return transports;
  }, [transports, activeTab, arrivedTransports]);

  const stats = useMemo(() => {
    const total = arrivedTransports.length;
    const totalBaskets = arrivedTransports.reduce((sum, t) => sum + t.totalBaskets, 0);
    const verifiedTransports = arrivedTransports.filter(
      t => t.arrivalRecords && t.arrivalRecords.length > 0
    );
    const verifiedCount = verifiedTransports.length;
    const avgLossRate = verifiedCount > 0
      ? (verifiedTransports.reduce((sum, t) => sum + (t.lossRate || 0), 0) / verifiedCount).toFixed(1)
      : '--';
    const avgQuality = verifiedCount > 0
      ? (verifiedTransports.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / verifiedCount).toFixed(0)
      : '--';
    return { total, totalBaskets, avgLossRate, avgQuality, verifiedCount };
  }, [arrivedTransports]);

  const getQualityLevel = (score?: number): 'good' | 'normal' | 'bad' => {
    if (!score) return 'normal';
    if (score >= 90) return 'good';
    if (score >= 70) return 'normal';
    return 'bad';
  };

  const getLossLevel = (rate?: number): 'good' | 'normal' | 'bad' => {
    if (rate === undefined) return 'normal';
    if (rate <= 2) return 'good';
    if (rate <= 5) return 'normal';
    return 'bad';
  };

  const selectedTransport = useMemo(() => {
    if (!selectedTransportId) return null;
    return transports.find(t => t.id === selectedTransportId) || null;
  }, [transports, selectedTransportId]);

  const sortedPressureRiskRecords = useMemo(() => {
    if (!selectedTransport) return [];
    return [...(selectedTransport.pressureRiskRecords || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [selectedTransport]);

  const handleOpenLossCheck = (transport: Transport) => {
    setSelectedTransportId(transport.id);
    initLossRecords(transport);
    setShowLossModal(true);
  };

  const initLossRecords = (transport: Transport) => {
    const existingRecords = transport.arrivalRecords || [];
    const records = transport.batches.map(batch => {
      const existing = existingRecords.find(r => r.batchId === batch.id);
      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        categoryName: batch.categoryName,
        originalBaskets: batch.basketCount,
        arrivalBaskets: existing ? existing.arrivalBaskets.toString() : batch.basketCount.toString(),
        lossBaskets: existing ? existing.lossBaskets.toString() : '0',
        qualityScore: existing ? existing.qualityScore.toString() : '100',
        notes: existing?.notes || '',
      };
    });
    setLossRecords(records);
  };

  const handleLossRecordChange = (index: number, field: string, value: string) => {
    setLossRecords(prev => {
      const updated = [...prev];
      const rec = { ...updated[index], [field]: value };
      if (field === 'arrivalBaskets') {
        const arrival = parseInt(value) || 0;
        rec.lossBaskets = Math.max(0, rec.originalBaskets - arrival).toString();
      }
      if (field === 'lossBaskets') {
        const loss = parseInt(value) || 0;
        rec.arrivalBaskets = Math.max(0, rec.originalBaskets - loss).toString();
      }
      updated[index] = rec;
      return updated;
    });
  };

  const handleSaveLossRecords = () => {
    if (!selectedTransportId) return;
    const records: Partial<ArrivalRecord>[] = lossRecords.map(r => {
      const arrival = parseInt(r.arrivalBaskets) || 0;
      const loss = parseInt(r.lossBaskets) || 0;
      const lossRate = r.originalBaskets > 0
        ? parseFloat(((loss / r.originalBaskets) * 100).toFixed(1))
        : 0;
      return {
        batchId: r.batchId,
        batchNo: r.batchNo,
        categoryName: r.categoryName,
        originalBaskets: r.originalBaskets,
        arrivalBaskets: arrival,
        lossBaskets: loss,
        lossRate,
        qualityScore: parseInt(r.qualityScore) || 100,
        notes: r.notes || undefined,
      };
    });
    batchUpdateArrivalRecords(selectedTransportId, records);
    setShowLossModal(false);
    Taro.showToast({ title: '保存成功', icon: 'success' });
  };

  const handleViewDetail = (transport: Transport) => {
    Taro.navigateTo({
      url: `/pages/transport-detail/index?id=${transport.id}`,
    });
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      loading: '装货中',
      in_transit: '运输中',
      arrived: '已到站',
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string): string => {
    return status === 'arrived' ? 'statusArrived' : 'statusInTransit';
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.statGrid}>
          <StatCard
            title="已到站车次"
            value={stats.total}
            unit="趟"
            icon="✅"
            color="green"
          />
          <StatCard
            title="总筐数"
            value={stats.totalBaskets}
            unit="筐"
            icon="🧺"
            color="blue"
          />
          <StatCard
            title="平均损耗率"
            value={stats.avgLossRate}
            unit="%"
            icon="📉"
            color="orange"
          />
          <StatCard
            title="平均品质分"
            value={stats.avgQuality}
            unit="分"
            icon="⭐"
            color="green"
          />
        </View>

        <View className={styles.tabBar}>
          <View
            className={classNames(styles.tabItem, { [styles.active]: activeTab === 'arrived' })}
            onClick={() => setActiveTab('arrived')}
          >
            已到站
          </View>
          <View
            className={classNames(styles.tabItem, { [styles.active]: activeTab === 'all' })}
            onClick={() => setActiveTab('all')}
          >
            全部记录
          </View>
        </View>

        <View className={styles.transportList}>
          {displayTransports.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📋</Text>
              <Text className={styles.emptyTitle}>暂无记录</Text>
              <Text className={styles.emptyDesc}>完成运输后在这里查看历史记录</Text>
            </View>
          ) : (
            displayTransports.map((transport: Transport) => (
              <View
                key={transport.id}
                className={styles.transportCard}
                onClick={() => handleOpenLossCheck(transport)}
              >
                <View className={styles.transportCardHeader}>
                  <Text className={styles.transportNo}>{transport.transportNo}</Text>
                  <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                    {transport.status === 'arrived' &&
                      transport.arrivalRecords &&
                      transport.arrivalRecords.length > 0 && (
                        <View className={styles.verifiedBadge}>✅ 已核对</View>
                      )}
                    {transport.status === 'arrived' &&
                      (!transport.arrivalRecords || transport.arrivalRecords.length === 0) && (
                        <View className={styles.unverifiedBadge}>📝 待核对</View>
                      )}
                    <View className={classNames(styles.statusBadge, styles[getStatusClass(transport.status)])}>
                      {getStatusText(transport.status)}
                    </View>
                  </View>
                </View>

                <View className={styles.transportRoute}>
                  <Text className={styles.routeFrom}>{transport.fromBase || '未知起点'}</Text>
                  <Text className={styles.routeArrow}>→</Text>
                  <Text className={styles.routeTo}>{transport.toMarket || '未知终点'}</Text>
                </View>

                <View className={styles.transportInfo}>
                  <View className={styles.infoItem}>
                    <Text className={styles.label}>筐数:</Text>
                    <Text className={styles.value}>{transport.totalBaskets}筐</Text>
                  </View>
                  <View className={styles.infoItem}>
                    <Text className={styles.label}>批次:</Text>
                    <Text className={styles.value}>{transport.batches.length}个</Text>
                  </View>
                  {transport.arrivalTime && (
                    <View className={styles.infoItem}>
                      <Text className={styles.label}>到站:</Text>
                      <Text className={styles.value}>{formatDate(transport.arrivalTime)}</Text>
                    </View>
                  )}
                </View>

                {transport.status === 'arrived' && (
                  <View className={styles.qualitySection}>
                    <View className={styles.qualityRow}>
                      <Text className={styles.qualityLabel}>品质评分</Text>
                      <View className={styles.qualityBar}>
                        <View
                          className={classNames(styles.qualityBarFill, styles[getQualityLevel(transport.qualityScore)])}
                          style={{ width: `${transport.qualityScore || 0}%` }}
                        />
                      </View>
                      <Text className={classNames(styles.qualityValue, styles[getQualityLevel(transport.qualityScore)])}>
                        {transport.qualityScore || '--'}分
                      </Text>
                    </View>
                    <View className={styles.qualityRow}>
                      <Text className={styles.qualityLabel}>损耗率</Text>
                      <View className={styles.qualityBar}>
                        <View
                          className={classNames(styles.qualityBarFill, styles[getLossLevel(transport.lossRate)])}
                          style={{ width: `${Math.min((transport.lossRate || 0) * 10, 100)}%` }}
                        />
                      </View>
                      <Text className={classNames(styles.qualityValue, styles[getLossLevel(transport.lossRate)])}>
                        {transport.lossRate !== undefined ? `${transport.lossRate}%` : '--'}
                      </Text>
                    </View>
                  </View>
                )}

                <View className={styles.detailLink} onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetail(transport);
                }}>
                  查看详情 →
                </View>
              </View>
            ))
          )}
        </View>

        {showLossModal && selectedTransport && (
          <View
            className="modal-mask"
            onClick={() => setShowLossModal(false)}
            style={{ alignItems: 'flex-end' }}
          >
            <View
              className={styles.lossSheet}
              onClick={e => e.stopPropagation()}
            >
              <View className={styles.lossSheetHeader}>
                <Text className="modal-title">损耗核对</Text>
                <Text style={{ fontSize: '26rpx', color: '#94a3b8' }}>
                  {selectedTransport.transportNo}
                </Text>
              </View>
              <ScrollView scrollY className={styles.lossList}>
                {sortedPressureRiskRecords.length > 0 && (
                  <View className={styles.riskTipBar}>
                    <Text className={styles.riskTipIcon}>⚠️</Text>
                    <Text className={styles.riskTipText}>
                      运输中有 {sortedPressureRiskRecords.length} 条压筐风险记录，请重点核对
                    </Text>
                  </View>
                )}
                {lossRecords.map((rec, index) => {
                  const batchRisks = sortedPressureRiskRecords.filter(
                    r => r.batchId === rec.batchId || (!r.batchId && r.categoryName === rec.categoryName)
                  );
                  return (
                    <View key={rec.batchId} className={styles.lossItem}>
                      <View className={styles.lossItemHeader}>
                        <Text className={styles.lossCategoryName}>{rec.categoryName}</Text>
                        <Text className={styles.lossBatchNo}>{rec.batchNo}</Text>
                      </View>
                      {batchRisks.length > 0 && (
                        <View className={styles.riskBadgeRow}>
                          {batchRisks.map(risk => (
                            <View key={risk.id} className={styles.riskBadge}>
                              <Text className={styles.riskBadgeIcon}>
                                {risk.position === 'top' ? '🔝' : '⬇️'}
                              </Text>
                              <Text className={styles.riskBadgeText}>
                                {risk.position === 'top' ? '顶层' : '底层'}压筐风险
                              </Text>
                              {risk.notes && (
                                <Text className={styles.riskBadgeNote}>{risk.notes}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={{ display: 'flex', gap: '12rpx', marginBottom: '12rpx' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>装车筐数</Text>
                          <Text style={{ fontSize: '28rpx', fontWeight: '600', color: '#0f172a' }}>
                            {rec.originalBaskets}筐
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>到站筐数</Text>
                          <Input
                            className="form-input"
                            type="number"
                            value={rec.arrivalBaskets}
                            onInput={(e) => handleLossRecordChange(index, 'arrivalBaskets', e.detail.value)}
                            style={{ fontSize: '28rpx', fontWeight: '600' }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>损耗筐数</Text>
                          <Input
                            className="form-input"
                            type="number"
                            value={rec.lossBaskets}
                            onInput={(e) => handleLossRecordChange(index, 'lossBaskets', e.detail.value)}
                            style={{ fontSize: '28rpx', fontWeight: '600', color: parseInt(rec.lossBaskets) > 0 ? '#ef4444' : '#0f172a' }}
                          />
                        </View>
                      </View>
                      <View style={{ display: 'flex', gap: '12rpx' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>品质分</Text>
                          <Input
                            className="form-input"
                            type="number"
                            value={rec.qualityScore}
                            onInput={(e) => handleLossRecordChange(index, 'qualityScore', e.detail.value)}
                            style={{ fontSize: '28rpx', fontWeight: '600' }}
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>备注</Text>
                          <Input
                            className="form-input"
                            value={rec.notes}
                            onInput={(e) => handleLossRecordChange(index, 'notes', e.detail.value)}
                            placeholder="选填"
                            style={{ fontSize: '26rpx' }}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View className="modal-actions">
                <View className="modal-btn cancel" onClick={() => setShowLossModal(false)}>取消</View>
                <View
                  className="modal-btn confirm"
                  onClick={handleSaveLossRecords}
                >
                  保存核对
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default ArrivalPage;
