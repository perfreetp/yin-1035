import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { Transport, ArrivalRecord, PressureRiskRecord, Batch } from '@/types';
import { formatDate, formatTime } from '@/utils/date';
import { isPhotoValid } from '@/utils/image';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

type TabType = 'arrived' | 'all';

interface AbnormalBatch {
  transport: Transport;
  batch: Batch;
  arrivalRecord?: ArrivalRecord;
  riskRecords: PressureRiskRecord[];
  reasons: Array<'high_loss' | 'low_quality' | 'has_risk'>;
}

interface DetailViewState {
  transport: Transport;
  batch: Batch;
  arrivalRecord?: ArrivalRecord;
  riskRecords: PressureRiskRecord[];
}

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
  const [showAbnormalModal, setShowAbnormalModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailState, setDetailState] = useState<DetailViewState | null>(null);

  const arrivedTransports = useMemo(() => {
    return transports.filter(t => t.status === 'arrived');
  }, [transports]);

  const abnormalBatches = useMemo((): AbnormalBatch[] => {
    const list: AbnormalBatch[] = [];
    arrivedTransports.forEach(transport => {
      transport.batches.forEach(batch => {
        const arrivalRecord = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
        const riskRecords = (transport.pressureRiskRecords || []).filter(
          r => r.batchId === batch.id || r.categoryName === batch.categoryName
        );
        const reasons: AbnormalBatch['reasons'] = [];
        if (arrivalRecord) {
          const lossRate = batch.basketCount > 0 ? (arrivalRecord.lossBaskets / batch.basketCount) * 100 : 0;
          if (lossRate >= 5) reasons.push('high_loss');
          if (arrivalRecord.qualityScore > 0 && arrivalRecord.qualityScore < 75) reasons.push('low_quality');
        }
        if (riskRecords.length > 0) reasons.push('has_risk');
        if (reasons.length > 0) {
          list.push({ transport, batch, arrivalRecord, riskRecords, reasons });
        }
      });
    });
    return list.sort((a, b) => {
      const scoreA = (a.reasons.includes('high_loss') ? 3 : 0) + (a.reasons.includes('low_quality') ? 2 : 0) + (a.reasons.includes('has_risk') ? 1 : 0);
      const scoreB = (b.reasons.includes('high_loss') ? 3 : 0) + (b.reasons.includes('low_quality') ? 2 : 0) + (b.reasons.includes('has_risk') ? 1 : 0);
      return scoreB - scoreA;
    });
  }, [arrivedTransports]);

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
    return { total, totalBaskets, avgLossRate, avgQuality, verifiedCount, abnormalCount: abnormalBatches.length };
  }, [arrivedTransports, abnormalBatches]);

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

  const handleOpenBatchDetail = (ab: AbnormalBatch) => {
    setDetailState({
      transport: ab.transport,
      batch: ab.batch,
      arrivalRecord: ab.arrivalRecord,
      riskRecords: ab.riskRecords,
    });
    setShowAbnormalModal(false);
    setShowDetailModal(true);
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

  const getReasonLabel = (reason: AbnormalBatch['reasons'][number]): { label: string; icon: string; type: string } => {
    switch (reason) {
      case 'high_loss': return { label: '高损耗', icon: '📉', type: 'danger' };
      case 'low_quality': return { label: '品质偏低', icon: '⭐', type: 'warn' };
      case 'has_risk': return { label: '有压筐风险', icon: '⚠️', type: 'risk' };
    }
  };

  const handlePreviewPhoto = (url: string) => {
    Taro.previewImage({
      current: url,
      urls: [url],
    });
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

        {stats.abnormalCount > 0 && (
          <View className={styles.abnormalBanner} onClick={() => setShowAbnormalModal(true)}>
            <View className={styles.abnormalBannerLeft}>
              <Text className={styles.abnormalBannerIcon}>🚨</Text>
              <View>
                <Text className={styles.abnormalBannerTitle}>发现 {stats.abnormalCount} 批异常批次</Text>
                <Text className={styles.abnormalBannerSub}>高损耗 · 品质偏低 · 压筐风险</Text>
              </View>
            </View>
            <Text className={styles.abnormalBannerArrow}>查看详情 →</Text>
          </View>
        )}

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
            displayTransports.map((transport: Transport) => {
              const abnormalInTransport = transport.batches.filter(batch => {
                const arrivalRecord = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
                const riskRecords = (transport.pressureRiskRecords || []).filter(
                  r => r.batchId === batch.id || r.categoryName === batch.categoryName
                );
                if (arrivalRecord) {
                  const lossRate = batch.basketCount > 0 ? (arrivalRecord.lossBaskets / batch.basketCount) * 100 : 0;
                  if (lossRate >= 5 || (arrivalRecord.qualityScore > 0 && arrivalRecord.qualityScore < 75)) return true;
                }
                return riskRecords.length > 0;
              }).length;

              return (
                <View
                  key={transport.id}
                  className={styles.transportCard}
                  onClick={() => handleOpenLossCheck(transport)}
                >
                  <View className={styles.transportCardHeader}>
                    <Text className={styles.transportNo}>{transport.transportNo}</Text>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {abnormalInTransport > 0 && (
                        <View className={styles.miniAbnormalBadge}>⚠️ {abnormalInTransport}批异常</View>
                      )}
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
              );
            })
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

        {showAbnormalModal && (
          <View
            className="modal-mask"
            onClick={() => setShowAbnormalModal(false)}
            style={{ alignItems: 'flex-end' }}
          >
            <View
              className={styles.abnormalSheet}
              onClick={e => e.stopPropagation()}
            >
              <View className={styles.lossSheetHeader}>
                <Text className="modal-title">异常批次汇总</Text>
                <Text style={{ fontSize: '26rpx', color: '#94a3b8' }}>
                  共 {abnormalBatches.length} 批
                </Text>
              </View>
              <ScrollView scrollY className={styles.lossList}>
                {abnormalBatches.map(ab => {
                  const lossRate = ab.batch.basketCount > 0 && ab.arrivalRecord
                    ? ((ab.arrivalRecord.lossBaskets / ab.batch.basketCount) * 100).toFixed(1)
                    : '--';
                  return (
                    <View
                      key={`${ab.transport.id}-${ab.batch.id}`}
                      className={styles.abnormalItem}
                      onClick={() => handleOpenBatchDetail(ab)}
                    >
                      <View className={styles.abnormalItemHeader}>
                        <View>
                          <Text className={styles.abnormalCategory}>{ab.batch.categoryName}</Text>
                          <Text className={styles.abnormalMeta}>
                            {ab.transport.transportNo} · {ab.batch.batchNo}
                          </Text>
                        </View>
                        <Text style={{ fontSize: '26rpx', color: '#0ea5e9' }}>详情 →</Text>
                      </View>
                      <View className={styles.abnormalReasonRow}>
                        {ab.reasons.map(r => {
                          const reason = getReasonLabel(r);
                          return (
                            <View
                              key={r}
                              className={classNames(styles.abnormalTag, styles[`tag${reason.type}`])}
                            >
                              {reason.icon} {reason.label}
                            </View>
                          );
                        })}
                      </View>
                      <View className={styles.abnormalInfoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>装车/到站</Text>
                          <Text style={{ fontSize: '26rpx', fontWeight: '600', color: '#0f172a' }}>
                            {ab.batch.basketCount} / {ab.arrivalRecord?.arrivalBaskets ?? '--'} 筐
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>损耗率</Text>
                          <Text
                            style={{
                              fontSize: '26rpx',
                              fontWeight: '600',
                              color: lossRate !== '--' && parseFloat(lossRate) >= 5 ? '#ef4444' : '#0f172a',
                            }}
                          >
                            {lossRate}%
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: '22rpx', color: '#94a3b8' }}>品质分</Text>
                          <Text
                            style={{
                              fontSize: '26rpx',
                              fontWeight: '600',
                              color: ab.arrivalRecord && ab.arrivalRecord.qualityScore < 75 ? '#f59e0b' : '#0f172a',
                            }}
                          >
                            {ab.arrivalRecord?.qualityScore ?? '--'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View className="modal-actions">
                <View className="modal-btn confirm" onClick={() => setShowAbnormalModal(false)}>我知道了</View>
              </View>
            </View>
          </View>
        )}

        {showDetailModal && detailState && (
          <View
            className="modal-mask"
            onClick={() => setShowDetailModal(false)}
            style={{ alignItems: 'center' }}
          >
            <View
              className={styles.detailSheet}
              onClick={e => e.stopPropagation()}
            >
              <View className={styles.detailHeader}>
                <View>
                  <Text className={styles.detailTitle}>{detailState.batch.categoryName}</Text>
                  <Text className={styles.detailSubtitle}>
                    {detailState.transport.transportNo} · {detailState.batch.batchNo}
                  </Text>
                </View>
                <Text className={styles.detailClose} onClick={() => setShowDetailModal(false)}>✕</Text>
              </View>

              <ScrollView scrollY className={styles.detailContent}>
                <View className={styles.detailSection}>
                  <Text className={styles.detailSectionTitle}>📦 原始装车信息</Text>
                  <View className={styles.detailGrid}>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>合作社</Text>
                      <Text className={styles.detailGridValue}>{detailState.batch.cooperative || '--'}</Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>基地</Text>
                      <Text className={styles.detailGridValue}>{detailState.batch.base || detailState.transport.fromBase || '--'}</Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>装车筐数</Text>
                      <Text className={styles.detailGridValue}>{detailState.batch.basketCount}筐</Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>装车时间</Text>
                      <Text className={styles.detailGridValue}>{formatDate(detailState.transport.createdAt)}</Text>
                    </View>
                  </View>
                </View>

                {detailState.riskRecords.length > 0 && (
                  <View className={styles.detailSection}>
                    <Text className={styles.detailSectionTitle}>⚠️ 压筐风险记录</Text>
                    {detailState.riskRecords.map(risk => (
                      <View key={risk.id} className={styles.riskDetailCard}>
                        <View className={styles.riskDetailHeader}>
                          <View className={styles.riskDetailPos}>
                            {risk.position === 'top' ? '🔝 顶层位置' : '⬇️ 底层位置'}
                          </View>
                          <Text className={styles.riskDetailTime}>
                            {formatDate(risk.timestamp)} {formatTime(risk.timestamp)}
                          </Text>
                        </View>
                        {risk.notes && (
                          <Text className={styles.riskDetailNote}>备注：{risk.notes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View className={styles.detailSection}>
                  <Text className={styles.detailSectionTitle}>✅ 到站核对结果</Text>
                  <View className={styles.detailGrid}>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>到站筐数</Text>
                      <Text className={styles.detailGridValue}>
                        {detailState.arrivalRecord?.arrivalBaskets ?? '--'}筐
                      </Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>损耗筐数</Text>
                      <Text
                        className={styles.detailGridValue}
                        style={{ color: (detailState.arrivalRecord?.lossBaskets ?? 0) > 0 ? '#ef4444' : '#0f172a' }}
                      >
                        {detailState.arrivalRecord?.lossBaskets ?? '--'}筐
                      </Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>损耗率</Text>
                      <Text
                        className={styles.detailGridValue}
                        style={{
                          color: detailState.arrivalRecord && detailState.batch.basketCount > 0
                            ? ((detailState.arrivalRecord.lossBaskets / detailState.batch.basketCount) * 100) >= 5
                              ? '#ef4444'
                              : '#0f172a'
                            : '#0f172a',
                        }}
                      >
                        {detailState.arrivalRecord && detailState.batch.basketCount > 0
                          ? `${((detailState.arrivalRecord.lossBaskets / detailState.batch.basketCount) * 100).toFixed(1)}%`
                          : '--'}
                      </Text>
                    </View>
                    <View className={styles.detailGridItem}>
                      <Text className={styles.detailGridLabel}>品质分</Text>
                      <Text
                        className={styles.detailGridValue}
                        style={{
                          color: (detailState.arrivalRecord?.qualityScore ?? 100) < 75 ? '#f59e0b' : '#0f172a',
                        }}
                      >
                        {detailState.arrivalRecord?.qualityScore ?? '--'}分
                      </Text>
                    </View>
                  </View>
                  {detailState.arrivalRecord?.notes && (
                    <Text className={styles.detailNote}>核对备注：{detailState.arrivalRecord.notes}</Text>
                  )}
                </View>

                {detailState.transport.sealRecords && detailState.transport.sealRecords.length > 0 && (
                  <View className={styles.detailSection}>
                    <Text className={styles.detailSectionTitle}>📷 封签照片</Text>
                    <View className={styles.sealPhotoGrid}>
                      {detailState.transport.sealRecords.map(seal => (
                        <View key={seal.id} className={styles.sealPhotoItem}>
                          {isPhotoValid(seal.photoUrl) ? (
                            <Image
                              src={seal.photoUrl!}
                              mode="aspectFill"
                              className={styles.sealPhotoImg}
                              onClick={() => handlePreviewPhoto(seal.photoUrl!)}
                            />
                          ) : (
                            <View className={styles.sealPhotoMissing}>
                              <Text style={{ fontSize: '40rpx' }}>🖼️</Text>
                              <Text style={{ fontSize: '20rpx', color: '#94a3b8' }}>照片失效</Text>
                            </View>
                          )}
                          <Text className={styles.sealPhotoNo}>封签: {seal.sealNo}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View className="modal-actions">
                <View
                  className="modal-btn confirm"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenLossCheck(detailState.transport);
                  }}
                >
                  修改核对结果
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
