import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { useAppStore } from './store/useAppStore';
import { storage } from './utils/storage';
import { defaultCategories, defaultMarkets, defaultCooperatives, defaultBases, mockTransports } from './data/mockData';
import './app.scss';

function App(props) {
  const initData = useAppStore(state => state.initData);

  useEffect(() => {
    console.log('[App] init');

    if (storage.getCategories().length === 0) {
      storage.setCategories(defaultCategories);
    }
    if (storage.getMarkets().length === 0) {
      storage.setMarkets(defaultMarkets);
    }
    if (storage.getCooperatives().length === 0) {
      storage.setCooperatives(defaultCooperatives);
    }
    if (storage.getBases().length === 0) {
      storage.setBases(defaultBases);
    }
    if (storage.getTransports().length === 0) {
      storage.setTransports(mockTransports);
    }

    initData();
  }, [initData]);

  useDidShow(() => {
    console.log('[App] didShow');
    initData();
  });

  useDidHide(() => {
    console.log('[App] didHide');
  });

  return props.children;
}

export default App;
