import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDate } from '@/utils/date';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

type StatTabType = 'cooperative' | 'base' | 'route';
type DateRangeType = '7d' | '30d' | 'all';

interface RankItem {
  name: string;
  count: number;
  baskets: number;
  lossRate: number;
  qualityScore: number;
}

const StatsPage: React.FC = () => {
  const { transports, cooperatives } = useAppStore();
  const [activeTab, setActiveTab] = useState<StatTabType>('cooperative');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedCoop, setSelectedCoop] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const arrivedTransports = useMemo(() => {
    return transports.filter(t => t.status === 'arrived');
  }, [transports]);

  const allRoutes = useMemo(() => {
    const routes = new Set<string>();
    transports.forEach(t => {
      const routeName = t.route || `${t.fromBase}-${t.toMarket}`;
      if (routeName && routeName !== '-') {
        routes.add(routeName);
      }
    });
    return Array.from(routes).sort();
  }, [transports]);

  const filteredTransports = useMemo(() => {
    let list = [...arrivedTransports];

    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(t => {
        const dateStr = t.arrivalTime || t.createdAt;
        return new Date(dateStr).getTime() >= cutoff.getTime();
      });
    }

    if (selectedRoute) {
      list = list.filter(t => {
        const routeName = t.route || `${t.fromBase}-${t.toMarket}`;
        return routeName === selectedRoute;
      });
    }

    if (selectedCoop) {
      list = list.filter(t => {
        return t.batches.some(b => b.cooperative === selectedCoop);
      });
    }

    return list;
  }, [arrivedTransports, dateRange, selectedRoute, selectedCoop]);

  const overallStats = useMemo(() => {
    const total = filteredTransports.length;
    const totalBaskets = filteredTransports.reduce((sum, t) => sum + t.totalBaskets, 0);
    const avgLossRate = total > 0
      ? (filteredTransports.reduce((sum, t) => sum + (t.lossRate || 0), 0) / total).toFixed(2)
      : '0';
    const avgQuality = total > 0
      ? (filteredTransports.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / total).toFixed(1)
      : '0';
    return { total, totalBaskets, avgLossRate, avgQuality };
  }, [filteredTransports]);

  const byCooperative = useMemo((): RankItem[] => {
    interface AggData {
      basketCount: number;
      transportSet: Set<string>;
      lossBasketSum: number;
      qualitySum: number;
      batchCount: number;
    }
    const map = new Map<string, AggData>();

    filteredTransports.forEach(transport => {
      transport.batches.forEach(batch => {
        const coopName = batch.cooperative || '未知合作社';
        if (!map.has(coopName)) {
          map.set(coopName, {
            basketCount: 0,
            transportSet: new Set<string>(),
            lossBasketSum: 0,
            qualitySum: 0,
            batchCount: 0,
          });
        }
        const agg = map.get(coopName)!;
        agg.basketCount += batch.basketCount;
        agg.transportSet.add(transport.id);
        agg.batchCount += 1;

        const arrivalRecord = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
        if (arrivalRecord) {
          agg.lossBasketSum += arrivalRecord.lossBaskets;
          agg.qualitySum += arrivalRecord.qualityScore;
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const avgLoss = data.basketCount > 0
          ? parseFloat(((data.lossBasketSum / data.basketCount) * 100).toFixed(1))
          : 0;
        const avgQuality = data.batchCount > 0 && data.qualitySum > 0
          ? parseFloat((data.qualitySum / data.batchCount).toFixed(0))
          : 0;
        return {
          name,
          count: data.transportSet.size,
          baskets: data.basketCount,
          lossRate: avgLoss,
          qualityScore: avgQuality,
        };
      })
      .sort((a, b) => b.baskets - a.baskets);
  }, [filteredTransports]);

  const byBase = useMemo((): RankItem[] => {
    interface AggData {
      basketCount: number;
      transportSet: Set<string>;
      lossBasketSum: number;
      qualitySum: number;
      batchCount: number;
    }
    const map = new Map<string, AggData>();

    filteredTransports.forEach(transport => {
      transport.batches.forEach(batch => {
        const baseName = batch.base || transport.fromBase || '未知基地';
        if (!map.has(baseName)) {
          map.set(baseName, {
            basketCount: 0,
            transportSet: new Set<string>(),
            lossBasketSum: 0,
            qualitySum: 0,
            batchCount: 0,
          });
        }
        const agg = map.get(baseName)!;
        agg.basketCount += batch.basketCount;
        agg.transportSet.add(transport.id);
        agg.batchCount += 1;

        const arrivalRecord = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
        if (arrivalRecord) {
          agg.lossBasketSum += arrivalRecord.lossBaskets;
          agg.qualitySum += arrivalRecord.qualityScore;
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const avgLoss = data.basketCount > 0
          ? parseFloat(((data.lossBasketSum / data.basketCount) * 100).toFixed(1))
          : 0;
        const avgQuality = data.batchCount > 0 && data.qualitySum > 0
          ? parseFloat((data.qualitySum / data.batchCount).toFixed(0))
          : 0;
        return {
          name,
          count: data.transportSet.size,
          baskets: data.basketCount,
          lossRate: avgLoss,
          qualityScore: avgQuality,
        };
      })
      .sort((a, b) => b.baskets - a.baskets);
  }, [filteredTransports]);

  const byRoute = useMemo((): RankItem[] => {
    const map = new Map<string, { count: number; baskets: number; lossSum: number; scoreSum: number }>();
    filteredTransports.forEach(t => {
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
  }, [filteredTransports]);

  const qualityTrend = useMemo(() => {
    const last7 = filteredTransports.slice(0, 7).reverse();
    const maxLoss = Math.max(...last7.map(t => t.lossRate || 0), 5);
    return last7.map(t => ({
      date: formatDate(t.arrivalTime || t.createdAt, 'MM/DD'),
      score: t.qualityScore || 0,
      lossRate: t.lossRate || 0,
      scoreHeight: `${((t.qualityScore || 0) / 100) * 100}%`,
      lossHeight: `${((t.lossRate || 0) / maxLoss) * 100}%`,
    }));
  }, [filteredTransports]);

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

        <View className={styles.filterBar} onClick={() => setShowFilterModal(true)}>
          <View className={styles.filterItem}>
            <Text className={styles.filterLabel}>日期</Text>
            <Text className={styles.filterValue}>
              {dateRange === '7d' ? '近7天' : dateRange === '30d' ? '近30天' : '全部'}
            </Text>
          </View>
          <View className={styles.filterItem}>
            <Text className={styles.filterLabel}>线路</Text>
            <Text className={styles.filterValue}>
              {selectedRoute || '全部'}
            </Text>
          </View>
          <View className={styles.filterItem}>
            <Text className={styles.filterLabel}>合作社</Text>
            <Text className={styles.filterValue}>
              {selectedCoop || '全部'}
            </Text>
          </View>
          <View className={styles.filterBtn}>
            <Text>🔍 筛选</Text>
          </View>
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

        {showFilterModal && (
          <View
            className="modal-mask"
            onClick={() => setShowFilterModal(false)}
            style={{ alignItems: 'flex-end' }}
          >
            <View
              className={styles.filterSheet}
              onClick={e => e.stopPropagation()}
            >
              <View className={styles.filterSheetHeader}>
                <Text className="modal-title">筛选条件</Text>
                <Text
                  style={{ fontSize: '26rpx', color: '#0ea5e9' }}
                  onClick={() => {
                    setDateRange('all');
                    setSelectedRoute(null);
                    setSelectedCoop(null);
                  }}
                >
                  重置
                </Text>
              </View>

              <ScrollView scrollY className={styles.filterContent}>
                <View className={styles.filterSection}>
                  <Text className={styles.filterSectionTitle}>时间范围</Text>
                  <View className={styles.filterOptionRow}>
                    {[
                      { key: '7d', label: '近7天' },
                      { key: '30d', label: '近30天' },
                      { key: 'all', label: '全部' },
                    ].map(opt => (
                      <View
                        key={opt.key}
                        className={classNames(styles.filterOption, { [styles.active]: dateRange === opt.key })}
                        onClick={() => setDateRange(opt.key as DateRangeType)}
                      >
                        {opt.label}
                      </View>
                    ))}
                  </View>
                </View>

                <View className={styles.filterSection}>
                  <Text className={styles.filterSectionTitle}>线路</Text>
                  <View className={styles.filterOptionWrap}>
                    <View
                      className={classNames(styles.filterOption, { [styles.active]: !selectedRoute })}
                      onClick={() => setSelectedRoute(null)}
                    >
                      全部线路
                    </View>
                    {allRoutes.map(route => (
                      <View
                        key={route}
                        className={classNames(styles.filterOption, { [styles.active]: selectedRoute === route })}
                        onClick={() => setSelectedRoute(route)}
                      >
                        {route}
                      </View>
                    ))}
                  </View>
                </View>

                <View className={styles.filterSection}>
                  <Text className={styles.filterSectionTitle}>合作社</Text>
                  <View className={styles.filterOptionWrap}>
                    <View
                      className={classNames(styles.filterOption, { [styles.active]: !selectedCoop })}
                      onClick={() => setSelectedCoop(null)}
                    >
                      全部合作社
                    </View>
                    {cooperatives.map(coop => (
                      <View
                        key={coop.id}
                        className={classNames(styles.filterOption, { [styles.active]: selectedCoop === coop.name })}
                        onClick={() => setSelectedCoop(coop.name)}
                      >
                        {coop.name}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View className="modal-actions">
                <View className="modal-btn cancel" onClick={() => setShowFilterModal(false)}>取消</View>
                <View className="modal-btn confirm" onClick={() => setShowFilterModal(false)}>确定</View>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default StatsPage;
