import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime } from '@/utils/date';
import { PrecoolStatus } from '@/types';
import styles from './index.module.scss';

const BatchDetailPage: React.FC = () => {
  const router = useRouter();
  const { transports, deleteBatch } = useAppStore();

  const batchId = router.params.id;
  const transportId = router.params.transportId;

  const batch = useMemo(() => {
    if (!transportId || !batchId) return null;
    const transport = transports.find(t => t.id === transportId);
    return transport?.batches.find(b => b.id === batchId) || null;
  }, [transports, transportId, batchId]);

  const getPrecoolStatusText = (status: PrecoolStatus): string => {
    const statusMap: Record<PrecoolStatus, string> = {
      not_started: '未预冷',
      cooling: '预冷中',
      completed: '已预冷',
    };
    return statusMap[status];
  };

  const getPrecoolStatusClass = (status: PrecoolStatus): string => {
    const classMap: Record<PrecoolStatus, string> = {
      not_started: 'notStarted',
      cooling: 'cooling',
      completed: 'completed',
    };
    return classMap[status];
  };

  const handleDelete = () => {
    if (!transportId || !batchId) return;

    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个批次吗？删除后不可恢复。',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          deleteBatch(transportId, batchId);
          Taro.showToast({ title: '删除成功', icon: 'success' });
          setTimeout(() => {
            Taro.navigateBack();
          }, 500);
        }
      },
    });
  };

  const handleEdit = () => {
    Taro.showToast({ title: '编辑功能开发中', icon: 'none' });
  };

  if (!batch) {
    return (
      <ScrollView scrollY className={styles.page}>
        <View className={styles.content}>
          <View style={{ textAlign: 'center', padding: '100rpx 0' }}>
            <Text style={{ fontSize: '64rpx' }}>📦</Text>
            <Text style={{ display: 'block', marginTop: '24rpx', color: '#64748b' }}>
              批次不存在
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.batchNo}>{batch.batchNo}</Text>
          <Text className={styles.categoryName}>{batch.categoryName}</Text>
          <View className={styles.metaRow}>
            <View className={classNames(styles.statusTag, styles[getPrecoolStatusClass(batch.precoolStatus)])}>
              {getPrecoolStatusText(batch.precoolStatus)}
            </View>
            {batch.pressureRisk && (
              <View className={styles.riskBadge}>
                ⚠️ 压筐风险
              </View>
            )}
          </View>
        </View>

        <View className={styles.card}>
          <Text className={styles.cardTitle}>
            <Text className={styles.icon}>📍</Text>
            产地信息
          </Text>
          <View className={styles.infoGrid}>
            <View className={styles.infoRow}>
              <Text className={styles.label}>合作社</Text>
              <Text className={styles.value}>{batch.cooperative || '--'}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.label}>基地</Text>
              <Text className={styles.value}>{batch.base || '--'}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.label}>地块</Text>
              <Text className={styles.value}>{batch.plot || '--'}</Text>
            </View>
          </View>
        </View>

        <View className={styles.card}>
          <Text className={styles.cardTitle}>
            <Text className={styles.icon}>📦</Text>
            装载信息
          </Text>
          <View className={styles.infoGrid}>
            <View className={styles.infoRow}>
              <Text className={styles.label}>筐数</Text>
              <Text className={styles.value}>{batch.basketCount} 筐</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.label}>目标市场</Text>
              <Text className={styles.value}>{batch.targetMarket || '--'}</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.label}>装载顺序</Text>
              <Text className={styles.value}>第 {batch.orderIndex + 1} 位</Text>
            </View>
            <View className={styles.infoRow}>
              <Text className={styles.label}>上车时间</Text>
              <Text className={styles.value}>{formatDateTime(batch.loadTime)}</Text>
            </View>
          </View>
        </View>

        {batch.notes && (
          <View className={styles.card}>
            <Text className={styles.cardTitle}>
              <Text className={styles.icon}>📝</Text>
              备注
            </Text>
            <Text style={{ fontSize: '28rpx', color: '#475569', lineHeight: 1.6 }}>
              {batch.notes}
            </Text>
          </View>
        )}

        <View className={styles.card}>
          <Text className={styles.cardTitle}>
            <Text className={styles.icon}>⏱️</Text>
            时间线
          </Text>
          <View className={styles.timeline}>
            <View className={styles.timelineItem}>
              <Text className={styles.time}>{formatDateTime(batch.createdAt)}</Text>
              <Text className={styles.content}>批次创建</Text>
            </View>
            <View className={styles.timelineItem}>
              <Text className={styles.time}>{formatDateTime(batch.loadTime)}</Text>
              <Text className={styles.content}>完成装车</Text>
            </View>
          </View>
        </View>
      </View>

      <View className={styles.actionBar}>
        <View className={classNames(styles.btn, styles.btnEdit)} onClick={handleEdit}>
          编辑
        </View>
        <View className={classNames(styles.btn, styles.btnDelete)} onClick={handleDelete}>
          删除
        </View>
      </View>
    </ScrollView>
  );
};

export default BatchDetailPage;
