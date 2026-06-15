import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { Transport } from '@/types';
import { formatDate } from '@/utils/date';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

type StatTabType = 'cooperative' | 'base' | 'route';

interface RankItem {
  name: string;
  count: number;
  baskets: number;
  lossRate: number;
  qualityScore: number;
}

const StatsPage: React.FC = () => {
  const { transports } = useAppStore();
  const [activeTab, setActiveTab] = useState<StatTabType>('cooperative');

  const arrivedTransports = useMemo(() => {
    return transports.filter(t => t.status === 'arrived');
  }, [transports]);

  const overallStats = useMemo(() => {
    const total = arrivedTransports.length;
    const totalBaskets = arrivedTransports.reduce((sum, t) => sum + t.totalBaskets, 0);
    const avgLossRate = total > 0
      ? (arrivedTransports.reduce((sum, t) => sum + (t.lossRate || 0), 0) / total).toFixed(2)
      : '0';
    const avgQuality = total > 0
      ? (arrivedTransports.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / total).toFixed(1)
      : '0';
    return { total, totalBaskets, avgLossRate, avgQuality };
  }, [arrivedTransports]);

  const byCooperative = useMemo((): RankItem[] => {
    const map = new Map<string, { count: number; baskets: number; lossSum: number; scoreSum: number }>();
    arrivedTransports.forEach(t => {
      const coopName = t.batches[0]?.cooperative || '未知';
      const existing = map.get(coopName) || { count: 0, baskets: 0, lossSum: 0, scoreSum: 0 };
      map.set(coopName, {
        count: existing.count + 1,
        baskets: existing.baskets + t.totalBaskets,
        lossSum: existing.lossSum + (t.lossRate || 0),
        scoreSum: existing.scoreSum + (t.qualityScore || 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        baskets: data.baskets,
        lossRate: data.count > 0 ? parseFloat((data.lossSum / data.count).toFixed(2)) : 0,
        qualityScore: data.count > 0 ? parseFloat((data.scoreSum / data.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.baskets - a.baskets);
  }, [arrivedTransports]);

  const byBase = useMemo((): RankItem[] => {
    const map = new Map<string, { count: number; baskets: number; lossSum: number; scoreSum: number }>();
    arrivedTransports.forEach(t => {
      const baseName = t.fromBase || '未知基地';
      const existing = map.get(baseName) || { count: 0, baskets: 0, lossSum: 0, scoreSum: 0 };
      map.set(baseName, {
        count: existing.count + 1,
        baskets: existing.baskets + t.totalBaskets,
        lossSum: existing.lossSum + (t.lossRate || 0),
        scoreSum: existing.scoreSum + (t.qualityScore || 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        baskets: data.baskets,
        lossRate: data.count > 0 ? parseFloat((data.lossSum / data.count).toFixed(2)) : 0,
        qualityScore: data.count > 0 ? parseFloat((data.scoreSum / data.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.baskets - a.baskets);
  }, [arrivedTransports]);

  const byRoute = useMemo((): RankItem[] => {
    const map = new Map<string, { count: number; baskets: number; lossSum: number; scoreSum: number }>();
    arrivedTransports.forEach(t => {
      const routeName = t.route || `${t.fromBase}-${t.toMarket}` || '未知线路';
      const existing = map.get(routeName) || { count: 0, baskets: 0, lossSum: 0, scoreSum: 0 };
      map.set(routeName, {
        count: existing.count + 1,
        baskets: existing.baskets + t.totalBaskets,
        lossSum: existing.lossSum + (t.lossRate || 0),
        scoreSum: existing.scoreSum + (t.qualityScore || 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        baskets: data.baskets,
        lossRate: data.count > 0 ? parseFloat((data.lossSum / data.count).toFixed(2)) : 0,
        qualityScore: data.count > 0 ? parseFloat((data.scoreSum / data.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.baskets - a.baskets);
  }, [arrivedTransports]);

  const qualityTrend = useMemo(() => {
    const last7 = arrivedTransports.slice(0, 7).reverse();
    const maxLoss = Math.max(...last7.map(t => t.lossRate || 0), 5);
    return last7.map(t => ({
      date: formatDate(t.arrivalTime || t.createdAt, 'MM/DD'),
      score: t.qualityScore || 0,
      lossRate: t.lossRate || 0,
      scoreHeight: `${((t.qualityScore || 0) / 100) * 100}%`,
      lossHeight: `${((t.lossRate || 0) / maxLoss) * 100}%`,
    }));
  }, [arrivedTransports]);

  const currentRankList = useMemo(() => {
    switch (activeTab) {
      case 'cooperative': return byCooperative;
      case 'base': return byBase;
      case 'route': return byRoute;
      default: return byCooperative;
    }
  }, [activeTab, byCooperative, byBase, byRoute]);

  const getRankClass = (index: number): string => {
    if (index === 0) return 'rank1';
    if (index === 1) return 'rank2';
    if (index === 2) return 'rank3';
    return 'normal';
  };

  const handleExport = () => {
    Taro.showToast({
      title: '离线导出功能',
      icon: 'none',
      duration: 2000,
    });
  };

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.headerTitle}>统计分析</Text>
          <Text className={styles.headerSubtitle}>
            共 {overallStats.total} 趟运输 · {overallStats.totalBaskets} 筐蔬菜
          </Text>
        </View>

        <View className={styles.statGrid}>
          <StatCard
            title="总运输趟次"
            value={overallStats.total}
            unit="趟"
            icon="🚚"
            color="blue"
          />
          <StatCard
            title="总运输筐数"
            value={overallStats.totalBaskets}
            unit="筐"
            icon="🧺"
            color="green"
          />
          <StatCard
            title="平均损耗率"
            value={overallStats.avgLossRate}
            unit="%"
            icon="📉"
            color="orange"
          />
          <StatCard
            title="平均品质分"
            value={overallStats.avgQuality}
            unit="分"
            icon="⭐"
            color="green"
          />
        </View>

        <View className={styles.tabBar}>
          <View
            className={classNames(styles.tabItem, { [styles.active]: activeTab === 'cooperative' })}
            onClick={() => setActiveTab('cooperative')}
          >
            合作社
          </View>
          <View
            className={classNames(styles.tabItem, { [styles.active]: activeTab === 'base' })}
            onClick={() => setActiveTab('base')}
          >
            基地
          </View>
          <View
            className={classNames(styles.tabItem, { [styles.active]: activeTab === 'route' })}
            onClick={() => setActiveTab('route')}
          >
            线路
          </View>
        </View>

        <View className={styles.card}>
          <Text className={styles.sectionTitle}>
            {activeTab === 'cooperative' ? '合作社排名' : activeTab === 'base' ? '基地排名' : '线路排名'}
          </Text>

          {currentRankList.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📊</Text>
              <Text className={styles.emptyText}>暂无统计数据</Text>
            </View>
          ) : (
            <View className={styles.rankList}>
              {currentRankList.map((item, index) => (
                <View key={item.name} className={styles.rankItem}>
                  <View className={classNames(styles.rankIndex, styles[getRankClass(index)])}>
                    {index + 1}
                  </View>
                  <View className={styles.rankInfo}>
                    <Text className={styles.rankName}>{item.name}</Text>
                    <Text className={styles.rankDetail}>
                      {item.count}趟 · {item.baskets}筐
                    </Text>
                  </View>
                  <View className={styles.rankValue}>
                    <Text className={styles.rankValueMain}>
                      {item.qualityScore.toFixed(1)}分
                    </Text>
                    <Text className={styles.rankValueSub}>
                      损耗 {item.lossRate.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className={styles.card}>
          <View className={styles.chartTitle}>
            <Text>品质趋势</Text>
            <Text style={{ fontSize: '24rpx', color: '#94a3b8' }}>最近7趟</Text>
          </View>

          {qualityTrend.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📈</Text>
              <Text className={styles.emptyText}>暂无趋势数据</Text>
            </View>
          ) : (
            <>
              <View className={styles.chartBars}>
                {qualityTrend.map((item, index) => (
                  <View key={index} className={styles.chartBar}>
                    <View
                      className={classNames(styles.barFill, item.score >= 90 ? 'low' : item.score >= 70 ? 'medium' : 'high')}
                      style={{ height: item.scoreHeight }}
                    >
                      <Text className={styles.barValue}>{item.score}</Text>
                    </View>
                    <Text className={styles.barLabel}>{item.date}</Text>
                  </View>
                ))}
              </View>

              <View className={styles.chartLegend}>
                <View className={styles.legendItem}>
                  <View className={classNames(styles.legendDot, 'score')} />
                  <Text>品质分</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View className={styles.exportSection}>
          <View className={styles.exportBtn} onClick={handleExport}>
            📤 离线导出数据
          </View>
          <Text className={styles.exportDesc}>数据保存在本地，可导出为表格</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default StatsPage;
