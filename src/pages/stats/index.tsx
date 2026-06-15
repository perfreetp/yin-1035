import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDate } from '@/utils/date';
import { Transport, Batch, ArrivalRecord, PressureRiskRecord } from '@/types';
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

interface BatchWithTransport {
  transport: Transport;
  batch: Batch;
  arrivalRecord?: ArrivalRecord;
  riskRecords: PressureRiskRecord[];
  routeName: string;
}

const StatsPage: React.FC = () => {
  const { transports, cooperatives } = useAppStore();
  const [activeTab, setActiveTab] = useState<StatTabType>('cooperative');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedCoop, setSelectedCoop] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBatchListModal, setShowBatchListModal] = useState(false);
  const [batchListFilter, setBatchListFilter] = useState<'high_loss' | 'low_quality' | 'has_risk' | null>(null);

  const allBatches = useMemo((): BatchWithTransport[] => {
    const list: BatchWithTransport[] = [];
    transports
      .filter(t => t.status === 'arrived')
      .forEach(transport => {
        const routeName = transport.route || `${transport.fromBase}-${transport.toMarket}`;
        transport.batches.forEach(batch => {
          const arrivalRecord = (transport.arrivalRecords || []).find(r => r.batchId === batch.id);
          const riskRecords = (transport.pressureRiskRecords || []).filter(
            r => r.batchId === batch.id || r.categoryName === batch.categoryName
          );
          list.push({
            transport,
            batch,
            arrivalRecord,
            riskRecords,
            routeName,
          });
        });
      });
    return list.sort((a, b) => {
      const ta = new Date(a.transport.arrivalTime || a.transport.createdAt).getTime();
      const tb = new Date(b.transport.arrivalTime || b.transport.createdAt).getTime();
      return tb - ta;
    });
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

  const filteredBatches = useMemo(() => {
    let list = [...allBatches];

    if (startDate) {
      const start = new Date(startDate).getTime();
      list = list.filter(b => {
        const t = new Date(b.transport.arrivalTime || b.transport.createdAt).getTime();
        return t >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endTs = end.getTime();
      list = list.filter(b => {
        const t = new Date(b.transport.arrivalTime || b.transport.createdAt).getTime();
        return t <= endTs;
      });
    }

    if (selectedRoute) {
      list = list.filter(b => b.routeName === selectedRoute);
    }

    if (selectedCoop) {
      list = list.filter(b => b.batch.cooperative === selectedCoop);
    }

    return list;
  }, [allBatches, startDate, endDate, selectedRoute, selectedCoop]);

  const uniqueTransportIds = useMemo(() => {
    return new Set(filteredBatches.map(b => b.transport.id));
  }, [filteredBatches]);

  const overallStats = useMemo(() => {
    const totalBaskets = filteredBatches.reduce((sum, b) => sum + b.batch.basketCount, 0);
    const totalLossBaskets = filteredBatches.reduce((sum, b) => sum + (b.arrivalRecord?.lossBaskets || 0), 0);
    const avgLossRate = totalBaskets > 0
      ? (((totalLossBaskets / totalBaskets) * 100).toFixed(2))
      : '0';
    const scoredBatches = filteredBatches.filter(b => b.arrivalRecord && b.arrivalRecord.qualityScore > 0);
    const avgQuality = scoredBatches.length > 0
      ? ((scoredBatches.reduce((sum, b) => sum + (b.arrivalRecord!.qualityScore), 0) / scoredBatches.length).toFixed(1))
      : '0';
    return {
      total: uniqueTransportIds.size,
      totalBatches: filteredBatches.length,
      totalBaskets,
      avgLossRate,
      avgQuality,
    };
  }, [filteredBatches, uniqueTransportIds]);

  const byCooperative = useMemo((): RankItem[] => {
    interface AggData {
      basketCount: number;
      transportSet: Set<string>;
      lossBasketSum: number;
      qualitySum: number;
      scoredCount: number;
    }
    const map = new Map<string, AggData>();

    filteredBatches.forEach(({ batch, transport, arrivalRecord }) => {
      const coopName = batch.cooperative || '未知合作社';
      if (!map.has(coopName)) {
        map.set(coopName, {
          basketCount: 0,
          transportSet: new Set<string>(),
          lossBasketSum: 0,
          qualitySum: 0,
          scoredCount: 0,
        });
      }
      const agg = map.get(coopName)!;
      agg.basketCount += batch.basketCount;
      agg.transportSet.add(transport.id);
      if (arrivalRecord) {
        agg.lossBasketSum += arrivalRecord.lossBaskets;
        if (arrivalRecord.qualityScore > 0) {
          agg.qualitySum += arrivalRecord.qualityScore;
          agg.scoredCount += 1;
        }
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const avgLoss = data.basketCount > 0
          ? parseFloat(((data.lossBasketSum / data.basketCount) * 100).toFixed(1))
          : 0;
        const avgQuality = data.scoredCount > 0
          ? parseFloat((data.qualitySum / data.scoredCount).toFixed(0))
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
  }, [filteredBatches]);

  const byBase = useMemo((): RankItem[] => {
    interface AggData {
      basketCount: number;
      transportSet: Set<string>;
      lossBasketSum: number;
      qualitySum: number;
      scoredCount: number;
    }
    const map = new Map<string, AggData>();

    filteredBatches.forEach(({ batch, transport, arrivalRecord }) => {
      const baseName = batch.base || transport.fromBase || '未知基地';
      if (!map.has(baseName)) {
        map.set(baseName, {
          basketCount: 0,
          transportSet: new Set<string>(),
          lossBasketSum: 0,
          qualitySum: 0,
          scoredCount: 0,
        });
      }
      const agg = map.get(baseName)!;
      agg.basketCount += batch.basketCount;
      agg.transportSet.add(transport.id);
      if (arrivalRecord) {
        agg.lossBasketSum += arrivalRecord.lossBaskets;
        if (arrivalRecord.qualityScore > 0) {
          agg.qualitySum += arrivalRecord.qualityScore;
          agg.scoredCount += 1;
        }
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const avgLoss = data.basketCount > 0
          ? parseFloat(((data.lossBasketSum / data.basketCount) * 100).toFixed(1))
          : 0;
        const avgQuality = data.scoredCount > 0
          ? parseFloat((data.qualitySum / data.scoredCount).toFixed(0))
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
  }, [filteredBatches]);

  const byRoute = useMemo((): RankItem[] => {
    interface AggData {
      basketCount: number;
      transportSet: Set<string>;
      lossBasketSum: number;
      qualitySum: number;
      scoredCount: number;
    }
    const map = new Map<string, AggData>();

    filteredBatches.forEach(({ transport, batch, arrivalRecord, routeName }) => {
      if (!map.has(routeName)) {
        map.set(routeName, {
          basketCount: 0,
          transportSet: new Set<string>(),
          lossBasketSum: 0,
          qualitySum: 0,
          scoredCount: 0,
        });
      }
      const agg = map.get(routeName)!;
      agg.basketCount += batch.basketCount;
      agg.transportSet.add(transport.id);
      if (arrivalRecord) {
        agg.lossBasketSum += arrivalRecord.lossBaskets;
        if (arrivalRecord.qualityScore > 0) {
          agg.qualitySum += arrivalRecord.qualityScore;
          agg.scoredCount += 1;
        }
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const avgLoss = data.basketCount > 0
          ? parseFloat(((data.lossBasketSum / data.basketCount) * 100).toFixed(1))
          : 0;
        const avgQuality = data.scoredCount > 0
          ? parseFloat((data.qualitySum / data.scoredCount).toFixed(0))
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
  }, [filteredBatches]);

  const abnormalStats = useMemo(() => {
    let highLossCount = 0;
    let lowQualityCount = 0;
    let hasRiskCount = 0;
    const abnormalSet = new Set<string>();

    filteredBatches.forEach(item => {
      const { batch, arrivalRecord, riskRecords } = item;
      let isAbnormal = false;

      if (arrivalRecord && batch.basketCount > 0) {
        const lossRate = (arrivalRecord.lossBaskets / batch.basketCount) * 100;
        if (lossRate >= 5) {
          highLossCount++;
          isAbnormal = true;
        }
      }

      if (arrivalRecord && arrivalRecord.qualityScore > 0 && arrivalRecord.qualityScore < 75) {
        lowQualityCount++;
        isAbnormal = true;
      }

      if (riskRecords.length > 0 || batch.pressureRisk) {
        hasRiskCount++;
        isAbnormal = true;
      }

      if (isAbnormal) {
        abnormalSet.add(batch.id);
      }
    });

    return {
      total: filteredBatches.length,
      abnormalCount: abnormalSet.size,
      highLossCount,
      lowQualityCount,
      hasRiskCount,
    };
  }, [filteredBatches]);

  const filteredAbnormalBatches = useMemo(() => {
    if (!batchListFilter) return filteredBatches;

    return filteredBatches.filter(item => {
      const { batch, arrivalRecord, riskRecords } = item;

      if (batchListFilter === 'high_loss') {
        if (!arrivalRecord || batch.basketCount === 0) return false;
        const lossRate = (arrivalRecord.lossBaskets / batch.basketCount) * 100;
        return lossRate >= 5;
      }

      if (batchListFilter === 'low_quality') {
        return arrivalRecord && arrivalRecord.qualityScore > 0 && arrivalRecord.qualityScore < 75;
      }

      if (batchListFilter === 'has_risk') {
        return riskRecords.length > 0 || batch.pressureRisk;
      }

      return false;
    });
  }, [filteredBatches, batchListFilter]);

  const trendData = useMemo(() => {
    const transportMap = new Map<string, {
      date: string;
      baskets: number;
      lossBaskets: number;
      qualitySum: number;
      scoredCount: number;
    }>();

    filteredBatches.forEach(({ transport, batch, arrivalRecord }) => {
      const tid = transport.id;
      const dateStr = formatDate(transport.arrivalTime || transport.createdAt, 'MM/DD');
      if (!transportMap.has(tid)) {
        transportMap.set(tid, {
          date: dateStr,
          baskets: 0,
          lossBaskets: 0,
          qualitySum: 0,
          scoredCount: 0,
        });
      }
      const agg = transportMap.get(tid)!;
      agg.baskets += batch.basketCount;
      if (arrivalRecord) {
        agg.lossBaskets += arrivalRecord.lossBaskets;
        if (arrivalRecord.qualityScore > 0) {
          agg.qualitySum += arrivalRecord.qualityScore;
          agg.scoredCount += 1;
        }
      }
    });

    const transportsArr = Array.from(transportMap.entries())
      .map(([tid, data]) => ({ tid, ...data }))
      .slice(0, 10)
      .reverse();

    const maxLoss = Math.max(...transportsArr.map(t => t.baskets > 0 ? (t.lossBaskets / t.baskets) * 100 : 0), 5);

    return transportsArr.map(t => {
      const lossRate = t.baskets > 0 ? (t.lossBaskets / t.baskets) * 100 : 0;
      const quality = t.scoredCount > 0 ? t.qualitySum / t.scoredCount : 0;
      return {
        date: t.date,
        score: parseFloat(quality.toFixed(0)),
        lossRate: parseFloat(lossRate.toFixed(1)),
        scoreHeight: `${(quality / 100) * 100}%`,
        lossHeight: `${(lossRate / maxLoss) * 100}%`,
      };
    });
  }, [filteredBatches]);

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

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedRoute(null);
    setSelectedCoop(null);
  };

  const dateRangeLabel = useMemo(() => {
    if (startDate && endDate) return `${startDate.slice(5)}~${endDate.slice(5)}`;
    if (startDate) return `${startDate.slice(5)}起`;
    if (endDate) return `至${endDate.slice(5)}`;
    return '全部';
  }, [startDate, endDate]);

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        <View className={styles.header}>
          <Text className={styles.headerTitle}>统计分析</Text>
          <Text className={styles.headerSubtitle}>
            共 {overallStats.total} 趟 · {overallStats.totalBatches} 批次 · {overallStats.totalBaskets} 筐
          </Text>
        </View>

        <View className={styles.filterBar} onClick={() => setShowFilterModal(true)}>
          <View className={styles.filterItem}>
            <Text className={styles.filterLabel}>日期</Text>
            <Text className={styles.filterValue}>{dateRangeLabel}</Text>
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
            title="运输趟次"
            value={overallStats.total}
            unit="趟"
            icon="🚚"
            color="blue"
          />
          <StatCard
            title="运输筐数"
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

        <View className={styles.card}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>⚠️ 异常原因分布</Text>
            <Text className={styles.sectionSubtitle}>
              共 {abnormalStats.total} 批 · 异常 {abnormalStats.abnormalCount} 批
            </Text>
          </View>
          {abnormalStats.total === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📊</Text>
              <Text className={styles.emptyText}>暂无统计数据</Text>
            </View>
          ) : (
            <View className={styles.abnormalBreakdown}>
              <View
                className={classNames(styles.abnormalItem, styles.abnormalDanger)}
                onClick={() => {
                  setBatchListFilter('high_loss');
                  setShowBatchListModal(true);
                }}
              >
                <View className={styles.abnormalItemTop}>
                  <Text className={styles.abnormalItemIcon}>📉</Text>
                  <Text className={styles.abnormalItemCount}>{abnormalStats.highLossCount}</Text>
                </View>
                <Text className={styles.abnormalItemLabel}>高损耗</Text>
                <View className={styles.abnormalItemBar}>
                  <View
                    className={styles.abnormalItemBarFill}
                    style={{ width: `${abnormalStats.total > 0 ? (abnormalStats.highLossCount / abnormalStats.total) * 100 : 0}%` }}
                  />
                </View>
              </View>

              <View
                className={classNames(styles.abnormalItem, styles.abnormalWarn)}
                onClick={() => {
                  setBatchListFilter('low_quality');
                  setShowBatchListModal(true);
                }}
              >
                <View className={styles.abnormalItemTop}>
                  <Text className={styles.abnormalItemIcon}>⭐</Text>
                  <Text className={styles.abnormalItemCount}>{abnormalStats.lowQualityCount}</Text>
                </View>
                <Text className={styles.abnormalItemLabel}>品质偏低</Text>
                <View className={styles.abnormalItemBar}>
                  <View
                    className={styles.abnormalItemBarFill}
                    style={{ width: `${abnormalStats.total > 0 ? (abnormalStats.lowQualityCount / abnormalStats.total) * 100 : 0}%` }}
                  />
                </View>
              </View>

              <View
                className={classNames(styles.abnormalItem, styles.abnormalRisk)}
                onClick={() => {
                  setBatchListFilter('has_risk');
                  setShowBatchListModal(true);
                }}
              >
                <View className={styles.abnormalItemTop}>
                  <Text className={styles.abnormalItemIcon}>⚠️</Text>
                  <Text className={styles.abnormalItemCount}>{abnormalStats.hasRiskCount}</Text>
                </View>
                <Text className={styles.abnormalItemLabel}>压筐风险</Text>
                <View className={styles.abnormalItemBar}>
                  <View
                    className={styles.abnormalItemBarFill}
                    style={{ width: `${abnormalStats.total > 0 ? (abnormalStats.hasRiskCount / abnormalStats.total) * 100 : 0}%` }}
                  />
                </View>
              </View>
            </View>
          )}
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
            <Text>品质与损耗趋势</Text>
            <Text style={{ fontSize: '24rpx', color: '#94a3b8' }}>最近{trendData.length}趟</Text>
          </View>

          {trendData.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📈</Text>
              <Text className={styles.emptyText}>暂无趋势数据</Text>
            </View>
          ) : (
            <>
              <View className={styles.dualChart}>
                <View className={styles.chartBars}>
                  {trendData.map((item, index) => (
                    <View key={`score-${index}`} className={styles.chartBar}>
                      <View className={styles.barTrack}>
                        <View
                          className={classNames(styles.barFill, styles.scoreBar, item.score >= 90 ? 'low' : item.score >= 70 ? 'medium' : 'high')}
                          style={{ height: item.scoreHeight }}
                        >
                          <Text className={styles.barValue}>{item.score}</Text>
                        </View>
                      </View>
                      <Text className={styles.barLabel}>{item.date}</Text>
                    </View>
                  ))}
                </View>
                <View className={styles.chartBars}>
                  {trendData.map((item, index) => (
                    <View key={`loss-${index}`} className={styles.chartBar}>
                      <View className={styles.barTrack}>
                        <View
                          className={classNames(styles.barFill, styles.lossBar, item.lossRate >= 5 ? 'high' : item.lossRate >= 2 ? 'medium' : 'low')}
                          style={{ height: item.lossHeight }}
                        >
                          <Text className={styles.barValue}>{item.lossRate}%</Text>
                        </View>
                      </View>
                      <Text className={styles.barLabel}>&nbsp;</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className={styles.chartLegend}>
                <View className={styles.legendItem}>
                  <View className={classNames(styles.legendDot, 'score')} />
                  <Text>品质分（左轴，越高越好）</Text>
                </View>
                <View className={styles.legendItem}>
                  <View className={classNames(styles.legendDot, 'loss')} />
                  <Text>损耗率（右轴，越低越好）</Text>
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
                  onClick={handleResetFilters}
                >
                  重置
                </Text>
              </View>

              <ScrollView scrollY className={styles.filterContent}>
                <View className={styles.filterSection}>
                  <Text className={styles.filterSectionTitle}>起止日期</Text>
                  <View className={styles.dateRangeRow}>
                    <Picker
                      mode="date"
                      value={startDate}
                      onChange={e => setStartDate(e.detail.value)}
                    >
                      <View className={styles.datePicker}>
                        <Text className={styles.datePickerLabel}>开始</Text>
                        <Text className={styles.datePickerValue}>
                          {startDate || '选择日期'}
                        </Text>
                      </View>
                    </Picker>
                    <Text className={styles.dateSeparator}>至</Text>
                    <Picker
                      mode="date"
                      value={endDate}
                      onChange={e => setEndDate(e.detail.value)}
                    >
                      <View className={styles.datePicker}>
                        <Text className={styles.datePickerLabel}>结束</Text>
                        <Text className={styles.datePickerValue}>
                          {endDate || '选择日期'}
                        </Text>
                      </View>
                    </Picker>
                  </View>
                </View>

                <View className={styles.filterSection}>
                  <Text className={styles.filterSectionTitle}>快捷选择</Text>
                  <View className={styles.filterOptionRow}>
                    {[
                      { label: '近7天', days: 7 },
                      { label: '近30天', days: 30 },
                      { label: '全部', days: -1 },
                    ].map(opt => (
                      <View
                        key={opt.label}
                        className={styles.filterOption}
                        onClick={() => {
                          if (opt.days < 0) {
                            setStartDate('');
                            setEndDate('');
                          } else {
                            const today = new Date();
                            const start = new Date();
                            start.setDate(today.getDate() - (opt.days - 1));
                            setStartDate(formatDate(start, 'YYYY-MM-DD'));
                            setEndDate(formatDate(today, 'YYYY-MM-DD'));
                          }
                        }}
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

        {showBatchListModal && (
          <View
            className="modal-mask"
            onClick={() => {
              setShowBatchListModal(false);
              setBatchListFilter(null);
            }}
            style={{ alignItems: 'flex-end' }}
          >
            <View
              className={styles.batchListSheet}
              onClick={e => e.stopPropagation()}
            >
              <View className={styles.batchListHeader}>
                <View>
                  <Text className="modal-title">
                    {batchListFilter === 'high_loss' && '📉 高损耗批次'}
                    {batchListFilter === 'low_quality' && '⭐ 品质偏低批次'}
                    {batchListFilter === 'has_risk' && '⚠️ 压筐风险批次'}
                  </Text>
                  <Text style={{ fontSize: '24rpx', color: '#64748b', marginTop: '8rpx' }}>
                    共 {filteredAbnormalBatches.length} 批
                  </Text>
                </View>
                <Text
                  style={{ fontSize: '40rpx', color: '#94a3b8' }}
                  onClick={() => {
                    setShowBatchListModal(false);
                    setBatchListFilter(null);
                  }}
                >
                  ✕
                </Text>
              </View>

              <ScrollView scrollY className={styles.batchListContent}>
                {filteredAbnormalBatches.length === 0 ? (
                  <View className={styles.emptyState}>
                    <Text className={styles.emptyIcon}>📋</Text>
                    <Text className={styles.emptyText}>暂无相关批次</Text>
                  </View>
                ) : (
                  filteredAbnormalBatches.map(item => (
                    <View
                      key={item.batch.id}
                      className={styles.batchListItem}
                      onClick={() => {
                        setShowBatchListModal(false);
                        setBatchListFilter(null);
                        Taro.navigateTo({
                          url: `/pages/transport-detail/index?id=${item.transport.id}`,
                        });
                      }}
                    >
                      <View className={styles.batchListItemTop}>
                        <Text className={styles.batchListBatchNo}>{item.batch.batchNo}</Text>
                        <Text className={styles.batchListCategory}>{item.batch.categoryName}</Text>
                      </View>
                      <View className={styles.batchListItemMid}>
                        <Text className={styles.batchListInfo}>
                          {item.batch.cooperative} · {item.batch.base}
                        </Text>
                        <Text className={styles.batchListRoute}>{item.routeName}</Text>
                      </View>
                      <View className={styles.batchListItemBottom}>
                        <Text className={styles.batchListBaskets}>
                          {item.batch.basketCount}筐
                        </Text>
                        {batchListFilter === 'high_loss' && item.arrivalRecord && (
                          <Text className={classNames(styles.batchListMetric, 'danger')}>
                            损耗 {item.arrivalRecord.lossRate.toFixed(1)}%
                          </Text>
                        )}
                        {batchListFilter === 'low_quality' && item.arrivalRecord && (
                          <Text className={classNames(styles.batchListMetric, 'warn')}>
                            品质 {item.arrivalRecord.qualityScore}分
                          </Text>
                        )}
                        {batchListFilter === 'has_risk' && (
                          <Text className={classNames(styles.batchListMetric, 'risk')}>
                            {item.riskRecords.length} 条风险记录
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <View className="modal-actions">
                <View
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowBatchListModal(false);
                    setBatchListFilter(null);
                  }}
                >
                  关闭
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default StatsPage;
