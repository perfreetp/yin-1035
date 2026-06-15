import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime, formatTime, getNowStr } from '@/utils/date';
import { CoolerRecord, TempHumidityRecord, SealRecord } from '@/types';
import StatCard from '@/components/StatCard';
import styles from './index.module.scss';

const TransportPage: React.FC = () => {
  const {
    transports,
    currentTransportId,
    setCurrentTransport,
    addCoolerRecord,
    addTempHumidity,
    addSealRecord,
    updateTransport,
    updateTransportStatus,
  } = useAppStore();

  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [showSealModal, setShowSealModal] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [humidityValue, setHumidityValue] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [sealNotes, setSealNotes] = useState('');

  const inTransitTransports = useMemo(() => {
    return transports.filter(t => t.status === 'in_transit');
  }, [transports]);

  const activeTransportId = selectedTransportId || currentTransportId;
  const activeTransport = useMemo(() => {
    return transports.find(t => t.id === activeTransportId);
  }, [transports, activeTransportId]);

  const latestTemp = useMemo(() => {
    if (!activeTransport || activeTransport.tempHumidityRecords.length === 0) return null;
    const records = [...activeTransport.tempHumidityRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return records[0];
  }, [activeTransport]);

  const isCoolerRunning = useMemo(() => {
    if (!activeTransport || activeTransport.coolerRecords.length === 0) return false;
    const records = [...activeTransport.coolerRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return records[0].action === 'start';
  }, [activeTransport]);

  const sortedTempRecords = useMemo(() => {
    if (!activeTransport) return [];
    return [...activeTransport.tempHumidityRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activeTransport]);

  const sortedCoolerRecords = useMemo(() => {
    if (!activeTransport) return [];
    return [...activeTransport.coolerRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activeTransport]);

  const sortedSealRecords = useMemo(() => {
    if (!activeTransport) return [];
    return [...activeTransport.sealRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activeTransport]);

  const handleToggleCooler = () => {
    if (!activeTransportId) return;

    const action: 'start' | 'stop' = isCoolerRunning ? 'stop' : 'start';
    addCoolerRecord(activeTransportId, {
      action,
      temperature: parseFloat(tempValue) || undefined,
    });

    Taro.vibrateShort({ type: 'medium' });
    Taro.showToast({
      title: action === 'start' ? '保温机已启动' : '保温机已关闭',
      icon: 'success',
    });
  };

  const handleAddTempHumidity = () => {
    if (!activeTransportId) return;
    setShowTempModal(true);
    setTempValue(latestTemp?.temperature.toString() || '5');
    setHumidityValue(latestTemp?.humidity.toString() || '85');
  };

  const handleConfirmTemp = () => {
    if (!activeTransportId) return;
    if (!tempValue) {
      Taro.showToast({ title: '请输入温度', icon: 'none' });
      return;
    }

    addTempHumidity(activeTransportId, {
      temperature: parseFloat(tempValue),
      humidity: parseFloat(humidityValue) || 0,
      location: '途中',
    });

    setShowTempModal(false);
    Taro.showToast({ title: '记录成功', icon: 'success' });
  };

  const handleAddSeal = () => {
    if (!activeTransportId) return;
    setShowSealModal(true);
    setSealNo('');
    setSealNotes('');
  };

  const handleConfirmSeal = () => {
    if (!activeTransportId) return;
    if (!sealNo) {
      Taro.showToast({ title: '请输入封签号', icon: 'none' });
      return;
    }

    addSealRecord(activeTransportId, {
      sealNo,
      notes: sealNotes,
    });

    setShowSealModal(false);
    Taro.showToast({ title: '记录成功', icon: 'success' });
  };

  const handleMarkPressureRisk = () => {
    if (!activeTransportId) return;
    Taro.showActionSheet({
      itemList: ['标记顶层压筐风险', '标记底层压筐风险', '取消标记'],
      success: (res) => {
        if (res.tapIndex < 2) {
          const riskTypes = ['顶层', '底层'];
          Taro.showToast({
            title: `已标记${riskTypes[res.tapIndex]}压筐风险`,
            icon: 'none',
          });
        }
      },
    });
  };

  const handleArrival = () => {
    if (!activeTransportId) return;

    Taro.showModal({
      title: '确认到站',
      content: `确认车辆已到达 ${activeTransport?.toMarket}？`,
      confirmText: '确认到站',
      success: (res) => {
        if (res.confirm) {
          updateTransportStatus(activeTransportId, 'arrived');
          if (currentTransportId === activeTransportId) {
            setCurrentTransport(null);
          }
          setSelectedTransportId(null);
          Taro.switchTab({ url: '/pages/arrival/index' });
        }
      },
    });
  };

  const handleSelectTransport = (id: string) => {
    setSelectedTransportId(id);
  };

  const handleGoLoading = () => {
    Taro.switchTab({ url: '/pages/loading/index' });
  };

  if (inTransitTransports.length === 0) {
    return (
      <ScrollView scrollY className={styles.page}>
        <View className={styles.content}>
          <View className={styles.noTransportState}>
            <Text className={styles.noTransportIcon}>🚚</Text>
            <Text className={styles.noTransportTitle}>暂无在途运输</Text>
            <Text className={styles.noTransportDesc}>去装车页面开始新的运输任务吧</Text>
            <View className={styles.goLoadingBtn} onClick={handleGoLoading}>
              去装车
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView scrollY className={styles.page}>
      <View className={styles.content}>
        {activeTransport && (
          <>
            <View className={styles.header}>
              <View className={styles.coolerStatus}>
                <View className={classNames(styles.coolerDot, { [styles.running]: isCoolerRunning, [styles.stopped]: !isCoolerRunning })} />
                <Text className={styles.coolerText}>
                  {isCoolerRunning ? '制冷运行中' : '制冷已关闭'}
                </Text>
              </View>
              <View className={styles.headerTop}>
                <Text className={styles.transportNo}>{activeTransport.transportNo}</Text>
                <View className={styles.statusBadge}>运输中</View>
              </View>
              <View className={styles.headerInfo}>
                <View className={styles.routeInfo}>
                  <Text className={styles.routeText}>{activeTransport.fromBase}</Text>
                  <Text className={styles.routeArrow}>→</Text>
                  <Text className={styles.routeText}>{activeTransport.toMarket}</Text>
                </View>
                <View className={styles.tempDisplay}>
                  <View className={styles.tempItem}>
                    <Text className={styles.tempLabel}>当前温度</Text>
                    <Text className={styles.tempValue}>
                      {latestTemp?.temperature ?? '--'}
                      <Text className={styles.unit}>°C</Text>
                    </Text>
                  </View>
                  <View className={styles.tempItem}>
                    <Text className={styles.tempLabel}>湿度</Text>
                    <Text className={styles.tempValue}>
                      {latestTemp?.humidity ?? '--'}
                      <Text className={styles.unit}>%</Text>
                    </Text>
                  </View>
                  <View className={styles.tempItem}>
                    <Text className={styles.tempLabel}>总筐数</Text>
                    <Text className={styles.tempValue}>
                      {activeTransport.totalBaskets}
                      <Text className={styles.unit}>筐</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className={styles.sectionTitle}>
              <View className={styles.sectionTitleLeft}>快捷操作</View>
            </View>

            <View className={styles.actionGrid}>
              <View className={styles.actionCard} onClick={handleToggleCooler}>
                <View className={classNames(styles.actionIcon, isCoolerRunning ? 'iconOrange' : 'iconGreen')}>
                  {isCoolerRunning ? '⏸️' : '❄️'}
                </View>
                <Text className={styles.actionTitle}>
                  {isCoolerRunning ? '停止制冷' : '启动制冷'}
                </Text>
                <Text className={styles.actionDesc}>
                  {isCoolerRunning ? '点击关闭保温机' : '点击开启保温机'}
                </Text>
              </View>

              <View className={styles.actionCard} onClick={handleAddTempHumidity}>
                <View className={classNames(styles.actionIcon, 'iconBlue')}>
                  🌡️
                </View>
                <Text className={styles.actionTitle}>温湿度记录</Text>
                <Text className={styles.actionDesc}>途中补录温湿度</Text>
              </View>

              <View className={styles.actionCard} onClick={handleAddSeal}>
                <View className={classNames(styles.actionIcon, 'iconOrange')}>
                  🔒
                </View>
                <Text className={styles.actionTitle}>封签记录</Text>
                <Text className={styles.actionDesc}>拍下封签号记录</Text>
              </View>

              <View className={styles.actionCard} onClick={handleMarkPressureRisk}>
                <View className={classNames(styles.actionIcon, 'iconRed')}>
                  ⚠️
                </View>
                <Text className={styles.actionTitle}>压筐风险</Text>
                <Text className={styles.actionDesc}>标记压筐风险点</Text>
              </View>
            </View>

            <View className={styles.recordCard}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordTitle}>温湿度记录</Text>
                <Text className={styles.recordCount}>共 {sortedTempRecords.length} 条</Text>
              </View>
              {sortedTempRecords.length === 0 ? (
                <View className={styles.emptyState}>
                  <Text className={styles.emptyIcon}>📊</Text>
                  <Text className={styles.emptyText}>暂无温湿度记录</Text>
                </View>
              ) : (
                <View className={styles.recordList}>
                  {sortedTempRecords.slice(0, 10).map((record: TempHumidityRecord) => (
                    <View key={record.id} className={styles.recordItem}>
                      <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
                      <View className={styles.recordContent}>
                        <Text className={styles.recordMain}>
                          {record.temperature}°C / {record.humidity}%
                        </Text>
                        {record.location && (
                          <Text className={styles.recordSub}>{record.location}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className={styles.recordCard}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordTitle}>保温机记录</Text>
                <Text className={styles.recordCount}>共 {sortedCoolerRecords.length} 条</Text>
              </View>
              {sortedCoolerRecords.length === 0 ? (
                <View className={styles.emptyState}>
                  <Text className={styles.emptyIcon}>❄️</Text>
                  <Text className={styles.emptyText}>暂无保温机记录</Text>
                </View>
              ) : (
                <View className={styles.recordList}>
                  {sortedCoolerRecords.slice(0, 10).map((record: CoolerRecord) => (
                    <View key={record.id} className={styles.recordItem}>
                      <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
                      <View className={styles.recordContent}>
                        <Text className={styles.recordMain}>
                          {record.action === 'start' ? '启动制冷' : '停止制冷'}
                        </Text>
                        {record.temperature !== undefined && (
                          <Text className={styles.recordSub}>温度 {record.temperature}°C</Text>
                        )}
                      </View>
                      <View className={classNames(styles.recordTag, record.action === 'start' ? 'tagStart' : 'tagStop')}>
                        {record.action === 'start' ? '启动' : '停止'}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className={styles.recordCard}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordTitle}>封签记录</Text>
                <Text className={styles.recordCount}>共 {sortedSealRecords.length} 条</Text>
              </View>
              {sortedSealRecords.length === 0 ? (
                <View className={styles.emptyState}>
                  <Text className={styles.emptyIcon}>🔒</Text>
                  <Text className={styles.emptyText}>暂无封签记录</Text>
                </View>
              ) : (
                <View className={styles.recordList}>
                  {sortedSealRecords.slice(0, 10).map((record: SealRecord) => (
                    <View key={record.id} className={styles.recordItem}>
                      <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
                      <View className={styles.recordContent}>
                        <Text className={styles.recordMain}>{record.sealNo}</Text>
                        {record.notes && (
                          <Text className={styles.recordSub}>{record.notes}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {inTransitTransports.length > 1 && (
          <>
            <View className={styles.sectionTitle}>
              <View className={styles.sectionTitleLeft}>在途运输列表</View>
            </View>
            <View className={styles.transportList}>
              {inTransitTransports.map(transport => (
                <View
                  key={transport.id}
                  className={classNames(styles.transportCard, { [styles.active]: transport.id === activeTransportId })}
                  onClick={() => handleSelectTransport(transport.id)}
                >
                  <View className={styles.transportCardHeader}>
                    <Text className={styles.transportNoText}>{transport.transportNo}</Text>
                    <View className={styles.inTransitBadge}>运输中</View>
                  </View>
                  <View className={styles.transportCardBody}>
                    <Text className={styles.transportRoute}>
                      {transport.fromBase} → {transport.toMarket}
                    </Text>
                    <Text className={styles.transportBaskets}>
                      {transport.totalBaskets}
                      <Text className={styles.unit}>筐</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {activeTransport && (
        <View className={styles.bottomBar}>
          <View
            className={styles.arriveBtn}
            onClick={handleArrival}
          >
            确认到站
          </View>
        </View>
      )}

      {showTempModal && (
        <View className="modal-mask" onClick={() => setShowTempModal(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">记录温湿度</Text>
            <View className="form-row">
              <Text className="form-label">温度 (°C)</Text>
              <Input
                className="form-input"
                type="digit"
                value={tempValue}
                onInput={(e) => setTempValue(e.detail.value)}
                placeholder="请输入温度"
              />
            </View>
            <View className="form-row">
              <Text className="form-label">湿度 (%)</Text>
              <Input
                className="form-input"
                type="digit"
                value={humidityValue}
                onInput={(e) => setHumidityValue(e.detail.value)}
                placeholder="请输入湿度"
              />
            </View>
            <View className="modal-actions">
              <View className="modal-btn cancel" onClick={() => setShowTempModal(false)}>取消</View>
              <View className="modal-btn confirm" onClick={handleConfirmTemp}>确认</View>
            </View>
          </View>
        </View>
      )}

      {showSealModal && (
        <View className="modal-mask" onClick={() => setShowSealModal(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">记录封签号</Text>
            <View className="form-row">
              <Text className="form-label">封签号</Text>
              <Input
                className="form-input"
                value={sealNo}
                onInput={(e) => setSealNo(e.detail.value)}
                placeholder="请输入封签号"
              />
            </View>
            <View className="form-row">
              <Text className="form-label">备注</Text>
              <Input
                className="form-input"
                value={sealNotes}
                onInput={(e) => setSealNotes(e.detail.value)}
                placeholder="选填"
              />
            </View>
            <View className="modal-actions">
              <View className="modal-btn cancel" onClick={() => setShowSealModal(false)}>取消</View>
              <View className="modal-btn confirm" onClick={handleConfirmSeal}>确认</View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default TransportPage;
