import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime, formatTime, formatDate } from '@/utils/date';
import { isPhotoValid, chooseImageAsBase64 } from '@/utils/image';
import {
  TransportStatus, TempHumidityRecord, CoolerRecord,
  SealRecord, PressureRiskRecord, ArrivalRecord
} from '@/types';
import styles from './index.module.scss';

type RecordTabType = 'temp' | 'cooler' | 'seal' | 'pressure' | 'loss';

const TransportDetailPage: React.FC = () => {
  const router = useRouter();
  const { transports, updateSealRecord } = useAppStore();
  const [activeTab, setActiveTab] = useState<RecordTabType>('temp');

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
      {arrivalRecords.length === 0 ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📋</Text>
          <Text className={styles.emptyText}>暂无损耗核对记录</Text>
        </View>
      ) : (
        arrivalRecords.map((record: ArrivalRecord) => (
          <View key={record.id} className={styles.lossRecordCard}>
            <View className={styles.lossRecordHeader}>
              <Text className={styles.lossCategory}>{record.categoryName}</Text>
              <Text className={classNames(styles.lossRateTag, styles[getLossLevel(record.lossRate)])}>
                损耗 {record.lossRate}%
              </Text>
            </View>
            <View className={styles.lossRow}>
              <View className={styles.lossCell}>
                <Text className={styles.lossLabel}>装车</Text>
                <Text className={styles.lossValue}>{record.originalBaskets}筐</Text>
              </View>
              <View className={styles.lossCell}>
                <Text className={styles.lossLabel}>到站</Text>
                <Text className={styles.lossValue}>{record.arrivalBaskets}筐</Text>
              </View>
              <View className={styles.lossCell}>
                <Text className={styles.lossLabel}>损耗</Text>
                <Text className={classNames(styles.lossValue, record.lossBaskets > 0 ? styles.lossBad : '')}>
                  {record.lossBaskets}筐
                </Text>
              </View>
              <View className={styles.lossCell}>
                <Text className={styles.lossLabel}>品质</Text>
                <Text className={classNames(styles.lossValue, styles[getQualityLevel(record.qualityScore)])}>
                  {record.qualityScore}分
                </Text>
              </View>
            </View>
            {record.notes && (
              <View className={styles.lossNotes}>备注：{record.notes}</View>
            )}
          </View>
        ))
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
      </View>
    </ScrollView>
  );
};

export default TransportDetailPage;
