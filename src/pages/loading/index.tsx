import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { Category, PrecoolStatus, Batch } from '@/types';
import QuickCategory from '@/components/QuickCategory';
import BatchCard from '@/components/BatchCard';
import StatCard from '@/components/StatCard';
import { getNowStr } from '@/utils/date';
import styles from './index.module.scss';

const LoadingPage: React.FC = () => {
  const {
    transports,
    categories,
    currentTransportId,
    setCurrentTransport,
    addTransport,
    addBatch,
    updateTransport,
  } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [basketCount, setBasketCount] = useState<string>('');
  const [plot, setPlot] = useState<string>('');
  const [base, setBase] = useState<string>('');
  const [cooperative, setCooperative] = useState<string>('');
  const [targetMarket, setTargetMarket] = useState<string>('');
  const [precoolStatus, setPrecoolStatus] = useState<PrecoolStatus>('not_started');
  const [pressureRisk, setPressureRisk] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setPressureRisk(category.pressureRisk);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') {
        return;
      }

      let targetKey: string | null = null;
      if (e.key >= '1' && e.key <= '9') {
        targetKey = e.key;
      } else if (e.key === '0') {
        targetKey = '0';
      }

      if (targetKey) {
        e.preventDefault();
        const found = categories.find(c => c.shortKey === targetKey);
        if (found) {
          handleCategorySelect(found);
          Taro.vibrateShort({ type: 'light' });
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [categories]);

  const currentTransport = useMemo(() => {
    return transports.find(t => t.id === currentTransportId);
  }, [transports, currentTransportId]);

  const loadingTransports = useMemo(() => {
    return transports.filter(t => t.status === 'loading');
  }, [transports]);

  const sortedBatches = useMemo(() => {
    if (!currentTransport) return [];
    return [...currentTransport.batches].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [currentTransport]);

  const handleAddBatch = () => {
    if (!selectedCategory) {
      Taro.showToast({ title: '请选择品类', icon: 'none' });
      return;
    }
    if (!basketCount || parseInt(basketCount) <= 0) {
      Taro.showToast({ title: '请输入筐数', icon: 'none' });
      return;
    }

    let transportId = currentTransportId;
    if (!transportId) {
      const newTransport = addTransport({
        fromBase: base,
        toMarket: targetMarket,
        route: base && targetMarket ? `${base}-${targetMarket}` : '',
      });
      transportId = newTransport.id;
      setCurrentTransport(transportId);
    }

    const batch: Partial<Batch> = {
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      cooperative,
      base,
      plot,
      basketCount: parseInt(basketCount),
      targetMarket,
      precoolStatus,
      pressureRisk,
      notes,
      loadTime: getNowStr(),
    };

    addBatch(transportId, batch);

    setBasketCount('');
    setPlot('');
    setNotes('');
    setPrecoolStatus('not_started');
    setPressureRisk(selectedCategory.pressureRisk);

    Taro.vibrateShort({ type: 'light' });
    Taro.showToast({ title: '添加成功', icon: 'success' });
  };

  const handleStartTransport = () => {
    if (!currentTransport || currentTransport.batches.length === 0) {
      Taro.showToast({ title: '请先添加批次', icon: 'none' });
      return;
    }

    Taro.showModal({
      title: '确认出发',
      content: `共 ${currentTransport.totalBaskets} 筐，${currentTransport.batches.length} 个批次，确认开始运输？`,
      success: (res) => {
        if (res.confirm) {
          updateTransport(currentTransport.id, { status: 'in_transit', departureTime: getNowStr() });
          setCurrentTransport(null);
          Taro.switchTab({ url: '/pages/transport/index' });
        }
      },
    });
  };

  const handleBatchClick = (batchId: string) => {
    Taro.navigateTo({
      url: `/pages/batch-detail/index?id=${batchId}&transportId=${currentTransportId}`,
    });
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.headerTitle}>装车管理</Text>
          <Text className={styles.headerSubtitle}>
            {currentTransport ? `当前运输: ${currentTransport.transportNo}` : '开始新的装车任务'}
          </Text>
        </View>

        <View className={styles.statGrid}>
          <StatCard
            title="待装批次"
            value={sortedBatches.length}
            unit="个"
            icon="📦"
            color="blue"
          />
          <StatCard
            title="总筐数"
            value={currentTransport?.totalBaskets || 0}
            unit="筐"
            icon="🧺"
            color="green"
          />
        </View>

        {loadingTransports.length > 1 && (
          <View className={styles.sectionTitle}>
            <Text>切换装车单</Text>
          </View>
        )}

        <QuickCategory
          categories={categories}
          selectedId={selectedCategory?.id}
          onSelect={handleCategorySelect}
        />

        <View className={styles.formCard}>
          <Text className={styles.formTitle}>批次信息录入</Text>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>合作社</Text>
            <Input
              className={styles.formInput}
              placeholder="请输入合作社"
              value={cooperative}
              onInput={(e) => setCooperative(e.detail.value)}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>基地</Text>
            <Input
              className={styles.formInput}
              placeholder="请输入基地名称"
              value={base}
              onInput={(e) => setBase(e.detail.value)}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>地块</Text>
            <Input
              className={styles.formInput}
              placeholder="如：A区-3号棚"
              value={plot}
              onInput={(e) => setPlot(e.detail.value)}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>筐数</Text>
            <Input
              className={styles.formInput}
              type="number"
              placeholder="请输入筐数"
              value={basketCount}
              onInput={(e) => setBasketCount(e.detail.value)}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>目标市场</Text>
            <Input
              className={styles.formInput}
              placeholder="请输入目标市场"
              value={targetMarket}
              onInput={(e) => setTargetMarket(e.detail.value)}
            />
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>预冷状态</Text>
            <View className={styles.precoolOptions}>
              <View
                className={classNames(styles.precoolOption, styles.notStarted, { [styles.active]: precoolStatus === 'not_started' })}
                onClick={() => setPrecoolStatus('not_started')}
              >
                未预冷
              </View>
              <View
                className={classNames(styles.precoolOption, styles.cooling, { [styles.active]: precoolStatus === 'cooling' })}
                onClick={() => setPrecoolStatus('cooling')}
              >
                预冷中
              </View>
              <View
                className={classNames(styles.precoolOption, { [styles.active]: precoolStatus === 'completed' })}
                onClick={() => setPrecoolStatus('completed')}
              >
                已预冷
              </View>
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>压筐风险</Text>
            <View className={styles.riskToggle}>
              <View
                className={classNames(styles.toggleBtn, { [styles.active]: pressureRisk })}
                onClick={() => setPressureRisk(!pressureRisk)}
              >
                <Text className={styles.toggleIcon}>⚠️</Text>
                <Text className={styles.toggleText}>{pressureRisk ? '有风险' : '无风险'}</Text>
              </View>
            </View>
          </View>

          <View className={styles.formRow}>
            <Text className={styles.formLabel}>备注</Text>
            <Input
              className={styles.formInput}
              placeholder="选填，如：一级果、小心轻放"
              value={notes}
              onInput={(e) => setNotes(e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.batchList}>
          <View className={styles.batchListHeader}>
            <Text className={styles.sectionTitle}>装载顺序</Text>
            <Text className={styles.batchCount}>
              共<span className={styles.count}>{sortedBatches.length}</span>批次
            </Text>
          </View>

          {sortedBatches.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📭</Text>
              <Text className={styles.emptyText}>暂无批次，请先添加</Text>
            </View>
          ) : (
            sortedBatches.map((batch, index) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                orderIndex={index}
                onClick={() => handleBatchClick(batch.id)}
              />
            ))
          )}
        </View>
      </View>

      <View className={styles.bottomBar}>
        <View className={styles.totalInfo}>
          <Text className={styles.totalLabel}>合计</Text>
          <Text className={styles.totalValue}>
            {currentTransport?.totalBaskets || 0}
            <Text className={styles.unit}>筐</Text>
          </Text>
        </View>
        <View
          className={styles.addBtn}
          onClick={handleAddBatch}
        >
          + 添加
        </View>
        <View
          className={classNames(styles.startBtn, { [styles.disabled]: !currentTransport || currentTransport.batches.length === 0 })}
          onClick={handleStartTransport}
        >
          开始运输
        </View>
      </View>
    </ScrollView>
  );
};

export default LoadingPage;
