import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { Transport } from '@/types';
import { formatDate, formatDateTime } from '@/utils/date';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

type TabType = 'arrived' | 'all';

const ArrivalPage: React.FC = () => {
  const { transports } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('arrived');

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
    const avgLossRate = total > 0
      ? (arrivedTransports.reduce((sum, t) => sum + (t.lossRate || 0), 0) / total).toFixed(1)
      : '0';
    const avgQuality = total > 0
      ? (arrivedTransports.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / total).toFixed(0)
      : '0';
    return { total, totalBaskets, avgLossRate, avgQuality };
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
                onClick={() => handleViewDetail(transport)}
              >
                <View className={styles.transportCardHeader}>
                  <Text className={styles.transportNo}>{transport.transportNo}</Text>
                  <View className={classNames(styles.statusBadge, styles[getStatusClass(transport.status)])}>
                    {getStatusText(transport.status)}
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

                <View className={styles.detailLink}>
                  查看详情 →
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default ArrivalPage;
