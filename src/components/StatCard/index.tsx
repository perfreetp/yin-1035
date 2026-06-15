import React from 'react';
import { View, Text } from '@tarojs/components';
import classNames from 'classnames';
import styles from './index.module.scss';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'normal';
  trendValue?: string;
  icon?: string;
  color?: 'blue' | 'green' | 'orange' | 'red';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon,
  color = 'blue',
  onClick,
}) => {
  return (
    <View
      className={classNames(styles.statCard, styles[`color${color.charAt(0).toUpperCase() + color.slice(1)}`])}
      onClick={onClick}
    >
      <View className={styles.cardHeader}>
        {icon && <Text className={styles.icon}>{icon}</Text>}
        <Text className={styles.title}>{title}</Text>
      </View>
      <View className={styles.cardBody}>
        <Text className={styles.value}>{value}</Text>
        {unit && <Text className={styles.unit}>{unit}</Text>}
      </View>
      {trend && trendValue && (
        <View className={classNames(styles.trend, styles[trend])}>
          <Text className={styles.trendIcon}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </Text>
          <Text className={styles.trendValue}>{trendValue}</Text>
        </View>
      )}
    </View>
  );
};

export default StatCard;
