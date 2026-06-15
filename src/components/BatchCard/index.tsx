import React from 'react';
import { View, Text } from '@tarojs/components';
import classNames from 'classnames';
import { Batch, PrecoolStatus } from '@/types';
import { formatTime } from '@/utils/date';
import styles from './index.module.scss';

interface BatchCardProps {
  batch: Batch;
  orderIndex?: number;
  onClick?: () => void;
  showOrder?: boolean;
}

const precoolStatusMap: Record<PrecoolStatus, { text: string; className: string }> = {
  not_started: { text: '未预冷', className: 'statusGray' },
  cooling: { text: '预冷中', className: 'statusOrange' },
  completed: { text: '已预冷', className: 'statusGreen' },
};

const BatchCard: React.FC<BatchCardProps> = ({
  batch,
  orderIndex,
  onClick,
  showOrder = true,
}) => {
  const precoolInfo = precoolStatusMap[batch.precoolStatus];
  const displayOrder = orderIndex !== undefined ? orderIndex + 1 : batch.orderIndex + 1;

  return (
    <View className={styles.batchCard} onClick={onClick}>
      {showOrder && (
        <View className={styles.orderBadge}>
          <Text className={styles.orderText}>{displayOrder}</Text>
        </View>
      )}

      <View className={styles.cardHeader}>
        <View className={styles.categoryInfo}>
          <Text className={styles.categoryIcon}>{getCategoryIcon(batch.categoryName)}</Text>
          <Text className={styles.categoryName}>{batch.categoryName}</Text>
        </View>
        <View className={classNames(styles.statusTag, styles[precoolInfo.className])}>
          {precoolInfo.text}
        </View>
      </View>

      <View className={styles.cardBody}>
        <View className={styles.infoRow}>
          <Text className={styles.label}>批次号</Text>
          <Text className={styles.value}>{batch.batchNo}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>基地</Text>
          <Text className={styles.value}>{batch.base}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>地块</Text>
          <Text className={styles.value}>{batch.plot}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>目标市场</Text>
          <Text className={styles.value}>{batch.targetMarket}</Text>
        </View>
      </View>

      <View className={styles.cardFooter}>
        <View className={styles.basketInfo}>
          <Text className={styles.basketCount}>{batch.basketCount}</Text>
          <Text className={styles.basketUnit}>筐</Text>
        </View>
        <View className={styles.timeInfo}>
          <Text className={styles.timeLabel}>上车时间</Text>
          <Text className={styles.timeValue}>{formatTime(batch.loadTime)}</Text>
        </View>
      </View>

      {batch.pressureRisk && (
        <View className={styles.riskTag}>
          <Text className={styles.riskIcon}>⚠️</Text>
          <Text className={styles.riskText}>压筐风险</Text>
        </View>
      )}

      {batch.notes && (
        <View className={styles.notes}>
          <Text className={styles.notesText}>{batch.notes}</Text>
        </View>
      )}
    </View>
  );
};

function getCategoryIcon(name: string): string {
  const iconMap: Record<string, string> = {
    '西红柿': '🍅',
    '黄瓜': '🥒',
    '生菜': '🥬',
    '胡萝卜': '🥕',
    '白菜': '🥗',
    '青椒': '🫑',
    '茄子': '🍆',
    '土豆': '🥔',
    '菠菜': '🌿',
    '芹菜': '🥦',
  };
  return iconMap[name] || '🥬';
}

export default BatchCard;
