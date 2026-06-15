import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classNames from 'classnames';
import { Category } from '@/types';
import styles from './index.module.scss';

interface QuickCategoryProps {
  categories: Category[];
  selectedId?: string;
  onSelect: (category: Category) => void;
}

const QuickCategory: React.FC<QuickCategoryProps> = ({
  categories,
  selectedId,
  onSelect,
}) => {
  return (
    <View className={styles.quickCategory}>
      <View className={styles.header}>
        <Text className={styles.title}>快速选品</Text>
        <Text className={styles.hint}>数字键快速切换</Text>
      </View>
      <ScrollView scrollX className={styles.categoryScroll}>
        <View className={styles.categoryList}>
          {categories.map((category) => (
            <View
              key={category.id}
              className={classNames(styles.categoryItem, {
                [styles.active]: selectedId === category.id,
              })}
              onClick={() => onSelect(category)}
            >
              <View className={styles.iconWrapper}>
                <Text className={styles.icon}>{category.icon}</Text>
                <View className={styles.shortKey}>
                  <Text className={styles.keyText}>{category.shortKey}</Text>
                </View>
              </View>
              <Text className={styles.name}>{category.name}</Text>
              {category.pressureRisk && (
                <View className={styles.riskBadge}>
                  <Text className={styles.riskText}>易碎</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default QuickCategory;
