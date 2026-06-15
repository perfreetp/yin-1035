import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useAppStore } from '@/store/useAppStore';
import { formatTime } from '@/utils/date';
import { isPhotoValid, chooseImageAsBase64 } from '@/utils/image';
import {
  CoolerRecord, TempHumidityRecord, SealRecord,
  PressureRiskRecord, PressureRiskPosition, ArrivalRecord, Batch
} from '@/types';
import styles from './index.module.scss';

const TransportPage: React.FC = () => {
  const {
    transports,
    currentTransportId,
    setCurrentTransport,
    addCoolerRecord,
    addTempHumidity,
    addSealRecord,
    updateSealRecord,
    addPressureRiskRecord,
    batchUpdateArrivalRecords,
    updateTransportStatus,
  } = useAppStore();

  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [showSealModal, setShowSealModal] = useState(false);
  const [showPressureModal, setShowPressureModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [humidityValue, setHumidityValue] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [sealPhoto, setSealPhoto] = useState<string>('');
  const [sealNotes, setSealNotes] = useState('');
  const [pressurePosition, setPressurePosition] = useState<PressureRiskPosition>('top');
  const [pressureBatchId, setPressureBatchId] = useState<string>('');
  const [pressureNotes, setPressureNotes] = useState<string>('');

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

  const sortedPressureRiskRecords = useMemo(() => {
    if (!activeTransport) return [];
    return [...(activeTransport.pressureRiskRecords || [])].sort(
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
    setSealPhoto('');
    setSealNotes('');
  };

  const handleChooseSealPhoto = async () => {
    try {
      const base64 = await chooseImageAsBase64(['album', 'camera']);
      setSealPhoto(base64);
      Taro.showToast({ title: '照片已选', icon: 'success' });
    } catch (e) {
      console.error('[Transport] chooseSealPhoto error:', e);
    }
  };

  const handleRetakeSealPhoto = async (sealId: string) => {
    try {
      const base64 = await chooseImageAsBase64(['album', 'camera']);
      updateSealRecord(activeTransportId!, sealId, { photoUrl: base64 });
      Taro.showToast({ title: '补拍成功', icon: 'success' });
    } catch (e) {
      console.error('[Transport] retakeSealPhoto error:', e);
    }
  };

  const handlePreviewSealPhoto = (url: string) => {
    if (!url) return;
    Taro.previewImage({
      current: url,
      urls: [url],
    });
  };

  const handleConfirmSeal = () => {
    if (!activeTransportId) return;
    if (!sealNo) {
      Taro.showToast({ title: '请输入封签号', icon: 'none' });
      return;
    }
    addSealRecord(activeTransportId, {
      sealNo,
      photoUrl: sealPhoto || undefined,
      notes: sealNotes,
    });
    setShowSealModal(false);
    Taro.showToast({ title: '记录成功', icon: 'success' });
  };

  const handleMarkPressureRisk = () => {
    if (!activeTransportId) return;
    setShowPressureModal(true);
    setPressurePosition('top');
    setPressureBatchId('');
    setPressureNotes('');
  };

  const handleConfirmPressureRisk = () => {
    if (!activeTransportId) return;
    const selectedBatch = activeTransport?.batches.find(b => b.id === pressureBatchId);
    addPressureRiskRecord(activeTransportId, {
      position: pressurePosition,
      batchId: pressureBatchId || undefined,
      categoryName: selectedBatch?.categoryName,
      notes: pressureNotes || undefined,
    });
    setShowPressureModal(false);
    Taro.showToast({ title: '已记录风险', icon: 'success' });
  };

  const handleOpenLossCheck = () => {
    if (!activeTransportId || !activeTransport) return;
    initLossRecords();
    setShowLossModal(true);
  };

  const [lossRecords, setLossRecords] = useState<Array<{
    batchId: string;
    batchNo: string;
    categoryName: string;
    originalBaskets: number;
    arrivalBaskets: string;
    lossBaskets: string;
    qualityScore: string;
    notes: string;
  }>>([]);

  const initLossRecords = () => {
    if (!activeTransport) return;
    const existingRecords = activeTransport.arrivalRecords || [];
    const records = activeTransport.batches.map(batch => {
      const existing = existingRecords.find(r => r.batchId === batch.id);
      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        categoryName: batch.categoryName,
        originalBaskets: batch.basketCount,
        arrivalBaskets: existing ? existing.arrivalBaskets.toString() : batch.basketCount.toString(),
        lossBaskets: existing ? existing.lossBaskets.toString() : '0',
        qualityScore: existing ? existing.qualityScore.toString() : '100',
        notes: existing?.notes || '',
      };
    });
    setLossRecords(records);
  };

  const handleLossRecordChange = (index: number, field: string, value: string) => {
    setLossRecords(prev => {
      const updated = [...prev];
      const rec = { ...updated[index], [field]: value };
      if (field === 'arrivalBaskets') {
        const arrival = parseInt(value) || 0;
        rec.lossBaskets = Math.max(0, rec.originalBaskets - arrival).toString();
      }
      if (field === 'lossBaskets') {
        const loss = parseInt(value) || 0;
        rec.arrivalBaskets = Math.max(0, rec.originalBaskets - loss).toString();
      }
      updated[index] = rec;
      return updated;
    });
  };

  const handleSaveLossRecords = () => {
    if (!activeTransportId || !activeTransport) return;

    for (let i = 0; i < lossRecords.length; i++) {
      const rec = lossRecords[i];
      const arrival = parseInt(rec.arrivalBaskets) || 0;
      const loss = parseInt(rec.lossBaskets) || 0;
      const quality = parseInt(rec.qualityScore) || 0;

      if (arrival + loss !== rec.originalBaskets) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：到站+损耗 ≠ 装车筐数`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
      if (arrival > rec.originalBaskets) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：到站筐数不能超过装车筐数`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
      if (quality < 0 || quality > 100) {
        Taro.showToast({
          title: `第${i + 1}批 ${rec.categoryName}：品质分应在 0-100 之间`,
          icon: 'none',
          duration: 2000,
        });
        return;
      }
    }

    const records: Partial<ArrivalRecord>[] = lossRecords.map(r => {
      const arrival = parseInt(r.arrivalBaskets) || 0;
      const loss = parseInt(r.lossBaskets) || 0;
      const lossRate = r.originalBaskets > 0
        ? parseFloat(((loss / r.originalBaskets) * 100).toFixed(1))
        : 0;
      return {
        batchId: r.batchId,
        batchNo: r.batchNo,
        categoryName: r.categoryName,
        originalBaskets: r.originalBaskets,
        arrivalBaskets: arrival,
        lossBaskets: loss,
        lossRate,
        qualityScore: parseInt(r.qualityScore) || 100,
        notes: r.notes || undefined,
      };
    });
    batchUpdateArrivalRecords(activeTransportId, records);
    setShowLossModal(false);
    Taro.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      Taro.showModal({
        title: '确认到站',
        content: `损耗已记录完成，是否确认车辆已到达 ${activeTransport.toMarket}？`,
        confirmText: '确认到站',
        cancelText: '稍后再说',
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
    }, 300);
  };

  const handleArrival = () => {
    if (!activeTransportId || !activeTransport) return;
    const hasLossRecords = activeTransport.arrivalRecords && activeTransport.arrivalRecords.length > 0;
    const content = hasLossRecords
      ? `确认车辆已到达 ${activeTransport.toMarket}？`
      : `确认车辆已到达 ${activeTransport.toMarket}？\n（建议先完成损耗核对）`;

    Taro.showModal({
      title: '确认到站',
      content,
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
                      {record.photoUrl && isPhotoValid(record.photoUrl) ? (
                        <Image
                          className={styles.sealPhoto}
                          src={record.photoUrl}
                          mode="aspectFill"
                          onClick={() => handlePreviewSealPhoto(record.photoUrl!)}
                        />
                      ) : record.photoUrl ? (
                        <View className={styles.sealPhotoInvalid} onClick={() => handleRetakeSealPhoto(record.id)}>
                          <Text className={styles.sealPhotoInvalidIcon}>🖼️</Text>
                          <Text className={styles.sealPhotoInvalidText}>照片失效</Text>
                          <Text className={styles.sealPhotoInvalidHint}>点击补拍</Text>
                        </View>
                      ) : (
                        <View className={styles.sealPhotoMissing} onClick={() => handleRetakeSealPhoto(record.id)}>
                          <Text className={styles.sealPhotoInvalidIcon}>📷</Text>
                          <Text className={styles.sealPhotoInvalidText}>未拍照</Text>
                          <Text className={styles.sealPhotoInvalidHint}>点击补拍</Text>
                        </View>
                      )}
                      <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
                      <View className={styles.recordContent}>
                        <Text className={styles.recordMain}>{record.sealNo}</Text>
                        {record.notes && (
                          <Text className={styles.recordSub}>{record.notes}</Text>
                        )}
                        {record.photoUrl && isPhotoValid(record.photoUrl) ? (
                          <Text className={styles.recordSub}>📷 已拍照片</Text>
                        ) : record.photoUrl ? (
                          <Text className={classNames(styles.recordSub, styles.warn)}>⚠️ 照片已失效，请补拍</Text>
                        ) : (
                          <Text className={classNames(styles.recordSub, styles.warn)}>⚠️ 未拍照片</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className={styles.recordCard}>
              <View className={styles.recordHeader}>
                <Text className={styles.recordTitle}>压筐风险记录</Text>
                <Text className={styles.recordCount}>共 {sortedPressureRiskRecords.length} 条</Text>
              </View>
              {sortedPressureRiskRecords.length === 0 ? (
                <View className={styles.emptyState}>
                  <Text className={styles.emptyIcon}>⚠️</Text>
                  <Text className={styles.emptyText}>暂无压筐风险记录</Text>
                </View>
              ) : (
                <View className={styles.recordList}>
                  {sortedPressureRiskRecords.slice(0, 10).map((record: PressureRiskRecord) => (
                    <View key={record.id} className={styles.recordItem}>
                      <Text className={styles.recordTime}>{formatTime(record.timestamp)}</Text>
                      <View className={styles.recordContent}>
                        <Text className={styles.recordMain}>
                          {record.position === 'top' ? '🔝 顶层压筐风险' : '⬇️ 底层压筐风险'}
                        </Text>
                        {record.categoryName && (
                          <Text className={styles.recordSub}>涉及品类：{record.categoryName}</Text>
                        )}
                        {record.notes && (
                          <Text className={styles.recordSub}>备注：{record.notes}</Text>
                        )}
                      </View>
                      <View className={classNames(styles.recordTag, 'tagRisk')}>
                        风险
                      </View>
                    </View>
                  ))}
                </View>
              )}
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
            className={styles.lossBtn}
            onClick={handleOpenLossCheck}
          >
            📋 损耗核对
          </View>
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
              <Text className="form-label">封签照片</Text>
              <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx', flexWrap: 'wrap' }}>
                <View
                  className={styles.photoPickerBtn}
                  onClick={handleChooseSealPhoto}
                >
                  {sealPhoto ? (
                    <Image
                      src={sealPhoto}
                      mode="aspectFill"
                      style={{ width: '100%', height: '100%', borderRadius: '12rpx' }}
                    />
                  ) : (
                    <Text style={{ fontSize: '48rpx', color: '#94a3b8' }}>📷</Text>
                  )}
                </View>
                <Text style={{ fontSize: '26rpx', color: '#64748b' }}>
                  {sealPhoto ? '点击更换照片' : '拍照或从相册选择'}
                </Text>
              </View>
            </View>
            <View className="form-row">
              <Text className="form-label">备注</Text>
              <Input
                className="form-input"
                value={sealNotes}
                onInput={(e) => setSealNotes(e.detail.value)}
                placeholder="选填，如：前门封签"
              />
            </View>
            <View className="modal-actions">
              <View className="modal-btn cancel" onClick={() => setShowSealModal(false)}>取消</View>
              <View className="modal-btn confirm" onClick={handleConfirmSeal}>确认</View>
            </View>
          </View>
        </View>
      )}

      {showPressureModal && (
        <View className="modal-mask" onClick={() => setShowPressureModal(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">记录压筐风险</Text>
            <View className="form-row">
              <Text className="form-label">风险位置</Text>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <View
                  className={classNames(styles.positionOption, { [styles.active]: pressurePosition === 'top' })}
                  onClick={() => setPressurePosition('top')}
                >
                  🔝 顶层
                </View>
                <View
                  className={classNames(styles.positionOption, { [styles.active]: pressurePosition === 'bottom' })}
                  onClick={() => setPressurePosition('bottom')}
                >
                  ⬇️ 底层
                </View>
              </View>
            </View>
            <View className="form-row">
              <Text className="form-label">涉及批次（选填）</Text>
              <ScrollView scrollX className={styles.batchPicker}>
                <View style={{ display: 'flex', gap: '12rpx' }}>
                  <View
                    className={classNames(styles.batchOption, { [styles.active]: pressureBatchId === '' })}
                    onClick={() => setPressureBatchId('')}
                  >
                    不指定
                  </View>
                  {activeTransport?.batches.map((batch: Batch) => (
                    <View
                      key={batch.id}
                      className={classNames(styles.batchOption, { [styles.active]: pressureBatchId === batch.id })}
                      onClick={() => setPressureBatchId(batch.id)}
                    >
                      {batch.categoryName}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View className="form-row">
              <Text className="form-label">备注</Text>
              <Input
                className="form-input"
                value={pressureNotes}
                onInput={(e) => setPressureNotes(e.detail.value)}
                placeholder="选填，如：上面压了重物"
              />
            </View>
            <View className="modal-actions">
              <View className="modal-btn cancel" onClick={() => setShowPressureModal(false)}>取消</View>
              <View className="modal-btn confirm" onClick={handleConfirmPressureRisk}>确认</View>
            </View>
          </View>
        </View>
      )}

      {showLossModal && (
        <View
          className="modal-mask"
          onClick={() => setShowLossModal(false)}
          style={{ alignItems: 'flex-end' }}
        >
          <View
            className={styles.lossSheet}
            onClick={e => e.stopPropagation()}
          >
            <View className={styles.lossSheetHeader}>
              <Text className="modal-title">损耗核对</Text>
              <Text
                style={{ fontSize: '26rpx', color: '#0ea5e9' }}
                onClick={() => initLossRecords()}
              >
                重置
              </Text>
            </View>
            <ScrollView scrollY className={styles.lossList}>
              {sortedPressureRiskRecords.length > 0 && (
                <View className={styles.riskTipBar}>
                  <Text className={styles.riskTipIcon}>⚠️</Text>
                  <Text className={styles.riskTipText}>
                    运输中有 {sortedPressureRiskRecords.length} 条压筐风险记录，请重点核对
                  </Text>
                </View>
              )}
              {lossRecords.map((rec, index) => {
                const batchRisks = sortedPressureRiskRecords.filter(
                  r => r.batchId === rec.batchId || (!r.batchId && r.categoryName === rec.categoryName)
                );
                return (
                  <View key={rec.batchId} className={styles.lossItem}>
                    <View className={styles.lossItemHeader}>
                      <Text className={styles.lossCategoryName}>{rec.categoryName}</Text>
                      <Text className={styles.lossBatchNo}>{rec.batchNo}</Text>
                    </View>
                    {batchRisks.length > 0 && (
                      <View className={styles.riskBadgeRow}>
                        {batchRisks.map(risk => (
                          <View key={risk.id} className={styles.riskBadge}>
                            <Text className={styles.riskBadgeIcon}>
                              {risk.position === 'top' ? '🔝' : '⬇️'}
                            </Text>
                            <Text className={styles.riskBadgeText}>
                              {risk.position === 'top' ? '顶层' : '底层'}压筐风险
                            </Text>
                            {risk.notes && (
                              <Text className={styles.riskBadgeNote}>{risk.notes}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    <View className={styles.lossInputRow}>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>装车筐数</Text>
                        <Text className={styles.lossInputValue}>{rec.originalBaskets}筐</Text>
                      </View>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>到站筐数</Text>
                        <Input
                          type="number"
                          value={rec.arrivalBaskets}
                          onInput={(e) => handleLossRecordChange(index, 'arrivalBaskets', e.detail.value)}
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>损耗筐数</Text>
                        <Input
                          type="number"
                          value={rec.lossBaskets}
                          onInput={(e) => handleLossRecordChange(index, 'lossBaskets', e.detail.value)}
                          className={classNames('form-input', styles.lossInput, { [styles.lossInputDanger]: parseInt(rec.lossBaskets) > 0 })}
                        />
                      </View>
                    </View>
                    <View className={styles.lossInputRow}>
                      <View className={styles.lossInputCol}>
                        <Text className={styles.lossInputLabel}>品质分</Text>
                        <Input
                          type="number"
                          value={rec.qualityScore}
                          onInput={(e) => handleLossRecordChange(index, 'qualityScore', e.detail.value)}
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text className={styles.lossInputLabel}>备注</Text>
                        <Input
                          value={rec.notes}
                          onInput={(e) => handleLossRecordChange(index, 'notes', e.detail.value)}
                          placeholder="选填"
                          className={classNames('form-input', styles.lossInput)}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View className="modal-actions">
              <View className="modal-btn cancel" onClick={() => setShowLossModal(false)}>取消</View>
              <View
                className="modal-btn confirm"
                onClick={handleSaveLossRecords}
              >
                保存核对 → 确认到站
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default TransportPage;
