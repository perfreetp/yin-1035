import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime, formatTime, formatDate } from '@/utils/date';
import { isPhotoValid, chooseImageAsBase64 } from '@/utils/image';
import {
  TransportStatus, TempHumidityRecord, CoolerRecord,
  SealRecord, PressureRiskRecord, ArrivalRecord, Batch
} from '@/types';
import styles from './index.module.scss';

type RecordTabType = 'temp' | 'cooler' | 'seal' | 'pressure' | 'loss';

interface LossRecordForm {
  batchId: string;
  batchNo: string;
  categoryName: string;
  originalBaskets: number;
  arrivalBaskets: string;
  lossBaskets: string;
  qualityScore: string;
  notes: string;
}

const TransportDetailPage: React.FC = () => {
  const router = useRouter();
  const { transports, updateSealRecord, batchUpdateArrivalRecords } = useAppStore();
  const [activeTab, setActiveTab] = useState<RecordTabType>('temp');
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossRecords, setLossRecords] = useState<LossRecordForm[]>([]);

  const transportId = router.params.id;

  const transport = useMemo(() => {
    if (!transportId) return null;
    return transports.find(t => t.id === transportId) || null;
  }, [transports, transportId]);

  const sortedBatches = useMemo(() => {
    if (!transport) return [];
    return [...transport.batches].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [transport]);

  const sortedTempRecords = useMemo(() => {
    if (!transport) return [];
    return [...transport.tempHumidityRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transport]);

  const sortedCoolerRecords = useMemo(() => {
    if (!transport) return [];
    return [...transport.coolerRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transport]);

  const sortedSealRecords = useMemo(() => {
    if (!transport) return [];
    return [...transport.sealRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transport]);

  const sortedPressureRecords = useMemo(() => {
    if (!transport) return [];
    return [...(transport.pressureRiskRecords || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transport]);

  const arrivalRecords = useMemo(() => {
    return transport?.arrivalRecords || [];
  }, [transport]);

  const getStatusText = (status: TransportStatus): string => {
    const statusMap: Record<TransportStatus, string> = {
      loading: '装货中',
      in_transit: '运输中',
      arrived: '已到站',
    };
    return statusMap[status];
  };

  const getStatusClass = (status: TransportStatus): string => {
    const classMap: Record<TransportStatus, string> = {
      loading: 'loading',
      in_transit: 'inTransit',
      arrived: 'arrived',
    };
    return classMap[status];
  };

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

  const handleBatchClick = (batchId: string) => {
    Taro.navigateTo({
      url: `/pages/batch-detail/index?id=${batchId}&transportId=${transportId}`,
    });
  };

  const handlePreviewImage = (url: string) => {
    Taro.previewImage({ urls: [url], current: url });
  };

  const initLossRecords = () => {
    if (!transport) return;
    const records = sortedBatches.map(batch => {
      const existing = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        categoryName: batch.categoryName,
        originalBaskets: batch.basketCount,
        arrivalBaskets: existing ? String(existing.arrivalBaskets) : String(batch.basketCount),
        lossBaskets: existing ? String(existing.lossBaskets) : '0',
        qualityScore: existing ? String(existing.qualityScore) : '100',
        notes: existing?.notes || '',
      };
    });
    setLossRecords(records);
  };

  const handleLossRecordChange = (index: number, field: keyof LossRecordForm, value: string) => {
    setLossRecords(prev => {
      const updated = [...prev];
      const rec = { ...updated[index], [field]: value };

      if (field === 'arrivalBaskets') {
        const arrival = parseInt(value) || 0;
        rec.lossBaskets = String(Math.max(0, rec.originalBaskets - arrival));
      } else if (field === 'lossBaskets') {
        const loss = parseInt(value) || 0;
        rec.arrivalBaskets = String(Math.max(0, rec.originalBaskets - loss));
      }

      updated[index] = rec;
      return updated;
    });
  };

  const handleSaveLossRecords = () => {
    if (!transportId || !transport) return;

    for (let i = 0; i < lossRecords.length; i++) {
      const rec = lossRecords[i];
      const arrival = parseInt(rec.arrivalBaskets) || 0;
      const loss = parseInt(rec.lossBaskets) || 0;
      const quality = parseInt(rec.qualityScore) || 0;

      if (arrival + loss !== rec.originalBaskets) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：到站+损耗 ≠ 装车筐数`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
      if (arrival > rec.originalBaskets) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：到站筐数不能超过装车筐数`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
      if (quality < 0 || quality > 100) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：品质分应在 0-100 之间`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
    }

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
    batchUpdateArrivalRecords(transportId, records);
    setShowLossModal(false);
    Taro.showToast({ title: '保存成功', icon: 'success' });
  };

  const handleRetakeSealPhoto = async (sealId: string) => {
    try {
      const base64 = await chooseImageAsBase64(['album', 'camera']);
      updateSealRecord(transportId!, sealId, { photoUrl: base64 });
      Taro.showToast({ title: '补拍成功', icon: 'success' });
    } catch (e) {
      console.error('[TransportDetail] retakeSealPhoto error:', e);
    }
  };

  if (!transport) {
    return (
      <ScrollView scrollY className={styles.page}>
        <View className={styles.content}>
          <View style={{ textAlign: 'center', padding: '100rpx 0' }}>
            <Text style={{ fontSize: '64rpx' }}>🚚</Text>
            <Text style={{ display: 'block', marginTop: '24rpx', color: '#64748b' }}>
              运输记录不存在
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const renderTempRecords = () => (
    <View className={styles.recordList}>
      {sortedTempRecords.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🌡️</Text>
          <Text className={styles.emptyText}>暂无温湿度记录</Text>
        </View>
      ) : (
        sortedTempRecords.map((record: TempHumidityRecord) => (
          <View key={record.id} className={styles.recordItem}>
            <View className={classNames(styles.recordIcon, styles.temp)}>🌡️</View>
            <View className={styles.recordContent}>
              <Text className={styles.recordMain}>
                {record.temperature}°C / {record.humidity}%
              </Text>
              {record.location && (
                <Text className={styles.recordSub}>{record.location}</Text>
              )}
            </View>
            <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderCoolerRecords = () => (
    <View className={styles.recordList}>
      {sortedCoolerRecords.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>❄️</Text>
          <Text className={styles.emptyText}>暂无保温机记录</Text>
        </View>
      ) : (
        sortedCoolerRecords.map((record: CoolerRecord) => (
          <View key={record.id} className={styles.recordItem}>
            <View className={classNames(styles.recordIcon, styles.cooler)}>
              {record.action === 'start' ? '▶️' : '⏸️'}
            </View>
            <View className={styles.recordContent}>
              <Text className={styles.recordMain}>
                {record.action === 'start' ? '启动制冷' : '停止制冷'}
              </Text>
              {record.temperature !== undefined && (
                <Text className={styles.recordSub}>温度 {record.temperature}°C</Text>
              )}
            </View>
            <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderSealRecords = () => (
    <View className={styles.recordList}>
      {sortedSealRecords.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🔒</Text>
          <Text className={styles.emptyText}>暂无封签记录</Text>
        </View>
      ) : (
        sortedSealRecords.map((record: SealRecord) => (
          <View key={record.id} className={styles.recordItem}>
            {record.photoUrl && isPhotoValid(record.photoUrl) ? (
              <Image
                className={styles.sealThumb}
                src={record.photoUrl}
                mode="aspectFill"
                onClick={() => handlePreviewImage(record.photoUrl!)}
              />
            ) : record.photoUrl ? (
              <View className={styles.sealThumbInvalid} onClick={() => handleRetakeSealPhoto(record.id)}>
                <Text style={{ fontSize: '40rpx' }}>🖼️</Text>
                <Text style={{ fontSize: '22rpx', color: '#f59e0b', marginTop: '8rpx' }}>照片失效</Text>
                <Text style={{ fontSize: '20rpx', color: '#94a3b8', marginTop: '4rpx' }}>点击补拍</Text>
              </View>
            ) : (
              <View className={styles.sealThumbInvalid} onClick={() => handleRetakeSealPhoto(record.id)}>
                <Text style={{ fontSize: '40rpx' }}>📷</Text>
                <Text style={{ fontSize: '22rpx', color: '#94a3b8', marginTop: '8rpx' }}>未拍照</Text>
                <Text style={{ fontSize: '20rpx', color: '#94a3b8', marginTop: '4rpx' }}>点击补拍</Text>
              </View>
            )}
            <View className={classNames(styles.recordIcon, styles.seal)}>🔒</View>
            <View className={styles.recordContent}>
              <Text className={styles.recordMain}>{record.sealNo}</Text>
              {record.notes && (
                <Text className={styles.recordSub}>{record.notes}</Text>
              )}
              {record.photoUrl && isPhotoValid(record.photoUrl) ? (
                <Text className={styles.recordSub}>📷 含照片（点击查看）</Text>
              ) : record.photoUrl ? (
                <Text className={classNames(styles.recordSub, styles.warn)}>⚠️ 照片已失效，点击补拍</Text>
              ) : (
                <Text className={classNames(styles.recordSub, styles.warn)}>⚠️ 未拍照片，点击补拍</Text>
              )}
            </View>
            <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderPressureRecords = () => (
    <View className={styles.recordList}>
      {sortedPressureRecords.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>⚠️</Text>
          <Text className={styles.emptyText}>暂无压筐风险记录</Text>
        </View>
      ) : (
        sortedPressureRecords.map((record: PressureRiskRecord) => (
          <View key={record.id} className={styles.recordItem}>
            <View className={classNames(styles.recordIcon, styles.pressure)}>
              {record.position === 'top' ? '🔝' : '⬇️'}
            </View>
            <View className={styles.recordContent}>
              <Text className={styles.recordMain}>
                {record.position === 'top' ? '顶层压筐风险' : '底层压筐风险'}
              </Text>
              {record.categoryName && (
                <Text className={styles.recordSub}>涉及品类：{record.categoryName}</Text>
              )}
              {record.notes && (
                <Text className={styles.recordSub}>备注：{record.notes}</Text>
              )}
            </View>
            <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderLossRecords = () => (
    <View className={styles.recordList}>
      {sortedBatches.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📋</Text>
          <Text className={styles.emptyText}>暂无批次数据</Text>
        </View>
      ) : (
        sortedBatches.map((batch, index) => {
          const arrivalRecord = arrivalRecords.find(r => r.batchId === batch.id);
          const hasRecord = !!arrivalRecord;
          return (
            <View key={batch.id} className={styles.batchLossCard}>
              <View className={styles.batchLossHeader}>
                <View className={styles.batchLossTitle}>
                  <Text className={styles.batchLossNo}>{batch.batchNo}</Text>
                  <Text className={styles.batchLossCategory}>{batch.categoryName}</Text>
                  {hasRecord && arrivalRecord && arrivalRecord.lossBaskets > 0 && (
                    <Text className={classNames(styles.lossRateTag, styles[getLossLevel(arrivalRecord.lossRate)])}>
                      损耗 {arrivalRecord.lossRate}%
                    </Text>
                  )}
                </View>
                <View
                  className={styles.editBtn}
                  onClick={() => {
                    initLossRecords();
                    setShowLossModal(true);
                  }}
                >
                  {hasRecord ? '修改' : '补录'}
                </View>
              </View>

              <View className={styles.batchLossSection}>
                <Text className={styles.batchLossSectionTitle}>🌱 装车信息</Text>
                <View className={styles.batchInfoGrid}>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>合作社</Text>
                    <Text className={styles.batchInfoValue}>{batch.cooperative || '--'}</Text>
                  </View>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>基地</Text>
                    <Text className={styles.batchInfoValue}>{batch.base || '--'}</Text>
                  </View>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>地块</Text>
                    <Text className={styles.batchInfoValue}>{batch.plot || '--'}</Text>
                  </View>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>预冷</Text>
                    <Text className={styles.batchInfoValue}>
                      {batch.precoolStatus === 'completed' ? '❄️ 已完成' :
                        batch.precoolStatus === 'cooling' ? '🧊 预冷中' : '🌡️ 未预冷'}
                    </Text>
                  </View>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>装车筐数</Text>
                    <Text className={styles.batchInfoValue}>{batch.basketCount}筐</Text>
                  </View>
                  <View className={styles.batchInfoItem}>
                    <Text className={styles.batchInfoLabel}>装载顺序</Text>
                    <Text className={styles.batchInfoValue}>第 {index + 1} 批</Text>
                  </View>
                </View>
                {batch.loadTime && (
                  <View className={styles.batchInfoFull}>
                    <Text className={styles.batchInfoLabel}>上车时间</Text>
                    <Text className={styles.batchInfoValue}>
                      {formatDate(batch.loadTime)} {formatTime(batch.loadTime)}
                    </Text>
                  </View>
                )}
              </View>

              <View className={styles.batchLossSection}>
                <Text className={styles.batchLossSectionTitle}>✅ 到站核对</Text>
                {!hasRecord ? (
                  <View className={styles.noRecordHint}>
                    <Text style={{ color: '#94a3b8', fontSize: '24rpx' }}>尚未核对</Text>
                    <Text style={{ color: '#0ea5e9', fontSize: '24rpx' }}>点右上角「补录」</Text>
                  </View>
                ) : (
                  <>
                    <View className={styles.lossRow}>
                      <View className={styles.lossCell}>
                        <Text className={styles.lossLabel}>到站</Text>
                        <Text className={styles.lossValue}>{arrivalRecord!.arrivalBaskets}筐</Text>
                      </View>
                      <View className={styles.lossCell}>
                        <Text className={styles.lossLabel}>损耗</Text>
                        <Text className={classNames(styles.lossValue, arrivalRecord!.lossBaskets > 0 ? styles.lossBad : '')}>
                          {arrivalRecord!.lossBaskets}筐
                        </Text>
                      </View>
                      <View className={styles.lossCell}>
                        <Text className={styles.lossLabel}>损耗率</Text>
                        <Text className={classNames(styles.lossValue, styles[getLossLevel(arrivalRecord!.lossRate)])}>
                          {arrivalRecord!.lossRate}%
                        </Text>
                      </View>
                      <View className={styles.lossCell}>
                        <Text className={styles.lossLabel}>品质</Text>
                        <Text className={classNames(styles.lossValue, styles[getQualityLevel(arrivalRecord!.qualityScore)])}>
                          {arrivalRecord!.qualityScore}分
                        </Text>
                      </View>
                    </View>
                    {arrivalRecord!.notes && (
                      <View className={styles.lossNotes}>备注：{arrivalRecord!.notes}</View>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.transportNo}>{transport.transportNo}</Text>
          <View className={classNames(styles.statusBadge, styles[getStatusClass(transport.status)])}>
            {getStatusText(transport.status)}
          </View>

          <View className={styles.routeRow}>
            <Text className={styles.routePoint}>{transport.fromBase || '待装货'}</Text>
            <Text className={styles.routeArrow}>→</Text>
            <Text className={styles.routePoint}>{transport.toMarket || '未设置'}</Text>
          </View>

          <View className={styles.statsRow}>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{transport.totalBaskets}</Text>
              <Text className={styles.statLabel}>筐</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{transport.batches.length}</Text>
              <Text className={styles.statLabel}>批次</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{transport.tempHumidityRecords.length}</Text>
              <Text className={styles.statLabel}>温检</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{sortedPressureRecords.length}</Text>
              <Text className={styles.statLabel}>风险</Text>
            </View>
          </View>

          <View className={styles.timeInfo}>
            {transport.departureTime && (
              <View className={styles.timeItem}>
                🚀 {formatDateTime(transport.departureTime)}
              </View>
            )}
            {transport.arrivalTime && (
              <View className={styles.timeItem}>
                📍 {formatDateTime(transport.arrivalTime)}
              </View>
            )}
          </View>
        </View>

        {transport.status === 'arrived' && (
          <View className={styles.section}>
            <View className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>
                <Text className={styles.icon}>⭐</Text>
                品质评分
              </Text>
            </View>
            <View className={classNames(styles.card, styles.qualitySection)}>
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
              {arrivalRecords.length > 0 && (
                <View style={{ marginTop: '16rpx' }}>
                  <Text style={{ fontSize: '24rpx', color: '#94a3b8' }}>
                    按 {arrivalRecords.length} 个批次核对计算
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.icon}>📦</Text>
              批次列表
            </Text>
            <Text className={styles.sectionMore}>{sortedBatches.length} 个批次</Text>
          </View>
          <View className={styles.batchList}>
            {sortedBatches.map((batch, index) => (
              <View
                key={batch.id}
                className={styles.batchItem}
                onClick={() => handleBatchClick(batch.id)}
              >
                <View className={styles.orderIndex}>{index + 1}</View>
                <View className={styles.batchInfo}>
                  <Text className={styles.categoryName}>{batch.categoryName}</Text>
                  <View className={styles.batchMeta}>
                    <Text>{batch.base || '未知基地'}</Text>
                    <Text>{batch.precoolStatus === 'completed' ? '已预冷' : '未预冷'}</Text>
                    {batch.pressureRisk && <Text style={{ color: '#ef4444' }}>⚠️压筐风险</Text>}
                  </View>
                  {batch.cooperative && (
                    <View className={styles.batchMeta}>
                      <Text style={{ color: '#64748b' }}>合作社：{batch.cooperative}</Text>
                    </View>
                  )}
                </View>
                <View className={styles.basketCount}>
                  {batch.basketCount}
                  <Text className={styles.unit}>筐</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.icon}>📊</Text>
              运输记录
            </Text>
          </View>

          <View className={styles.recordTabs}>
            <View
              className={classNames(styles.recordTab, { [styles.active]: activeTab === 'temp' })}
              onClick={() => setActiveTab('temp')}
            >
              温湿度
            </View>
            <View
              className={classNames(styles.recordTab, { [styles.active]: activeTab === 'cooler' })}
              onClick={() => setActiveTab('cooler')}
            >
              保温机
            </View>
            <View
              className={classNames(styles.recordTab, { [styles.active]: activeTab === 'seal' })}
              onClick={() => setActiveTab('seal')}
            >
              封签
            </View>
            <View
              className={classNames(styles.recordTab, { [styles.active]: activeTab === 'pressure' })}
              onClick={() => setActiveTab('pressure')}
            >
              压筐
            </View>
            <View
              className={classNames(styles.recordTab, { [styles.active]: activeTab === 'loss' })}
              onClick={() => setActiveTab('loss')}
            >
              损耗
            </View>
          </View>

          {activeTab === 'temp' && renderTempRecords()}
          {activeTab === 'cooler' && renderCoolerRecords()}
          {activeTab === 'seal' && renderSealRecords()}
          {activeTab === 'pressure' && renderPressureRecords()}
          {activeTab === 'loss' && renderLossRecords()}
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.icon}>ℹ️</Text>
              基本信息
            </Text>
          </View>
          <View className={styles.card}>
            <View className={styles.infoGrid}>
              <View className={styles.infoItem}>
                <Text className={styles.label}>司机</Text>
                <Text className={styles.value}>{transport.driverName || '--'}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.label}>车牌号</Text>
                <Text className={styles.value}>{transport.plateNo || '--'}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.label}>线路</Text>
                <Text className={styles.value}>{transport.route || '--'}</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.label}>创建时间</Text>
                <Text className={styles.value}>{formatDate(transport.createdAt)}</Text>
              </View>
            </View>
            {transport.notes && (
              <View style={{ marginTop: '20rpx', paddingTop: '20rpx', borderTop: '1rpx solid #f1f5f9' }}>
                <Text style={{ fontSize: '24rpx', color: '#94a3b8', marginBottom: '8rpx' }}>备注</Text>
                <Text style={{ fontSize: '28rpx', color: '#475569' }}>{transport.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {showLossModal && (
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
                <View>
                  <Text className="modal-title">按批次核对</Text>
                  <Text style={{ fontSize: '24rpx', color: '#64748b', marginTop: '8rpx' }}>
                    共 {lossRecords.length} 批，{transport?.totalBaskets || 0} 筐
                  </Text>
                </View>
                <Text
                  style={{ fontSize: '26rpx', color: '#0ea5e9' }}
                  onClick={() => initLossRecords()}
                >
                  重置
                </Text>
              </View>

              <ScrollView scrollY className={styles.lossList}>
                {lossRecords.map((rec, index) => (
                  <View key={rec.batchId} className={styles.lossItem}>
                    <View className={styles.lossItemHeader}>
                      <Text className={styles.lossItemNo}>{index + 1}.</Text>
                      <Text className={styles.lossItemName}>{rec.categoryName}</Text>
                      <Text className={styles.lossItemBatchNo}>{rec.batchNo}</Text>
                    </View>
                    <View className={styles.lossInputRow}>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>装车筐数</Text>
                        <Text className={styles.lossInputValue}>{rec.originalBaskets}筐</Text>
                      </View>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>到站筐数</Text>
                        <Input
                          type="number"
                          value={rec.arrivalBaskets}
                          onInput={(e) => handleLossRecordChange(index, 'arrivalBaskets', e.detail.value)}
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>损耗筐数</Text>
                        <Input
                          type="number"
                          value={rec.lossBaskets}
                          onInput={(e) => handleLossRecordChange(index, 'lossBaskets', e.detail.value)}
                          className={classNames('form-input', styles.lossInput, { [styles.lossInputDanger]: parseInt(rec.lossBaskets) > 0 })}
                        />
                      </View>
                    </View>
                    <View className={styles.lossInputRow}>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>品质分</Text>
                        <Input
                          type="number"
                          value={rec.qualityScore}
                          onInput={(e) => handleLossRecordChange(index, 'qualityScore', e.detail.value)}
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text className={styles.lossInputLabel}>备注</Text>
                        <Input
                          value={rec.notes}
                          onInput={(e) => handleLossRecordChange(index, 'notes', e.detail.value)}
                          placeholder="选填"
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View className="modal-actions">
                <View className="modal-btn cancel" onClick={() => setShowLossModal(false)}>取消</View>
                <View className="modal-btn confirm" onClick={handleSaveLossRecords}>保存</View>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default TransportDetailPage;
