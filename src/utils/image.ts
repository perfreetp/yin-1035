import Taro from '@tarojs/taro';

declare const wx: any;

export const tempFileToBase64 = async (tempFilePath: string): Promise<string> => {
  try {
    if (typeof Taro.getEnv !== 'undefined' && (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || typeof (globalThis as any).wx !== 'undefined')) {
      const fs = (Taro as any).getFileSystemManager
        ? (Taro as any).getFileSystemManager()
        : wx.getFileSystemManager();
      return new Promise((resolve, reject) => {
        fs.readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res: any) => {
            const base64 = `data:image/jpeg;base64,${res.data}`;
            resolve(base64);
          },
          fail: (err: any) => {
            console.error('[image] readFile fail:', err);
            reject(err);
          },
        });
      });
    } else {
      return tempFilePath;
    }
  } catch (e) {
    console.error('[image] tempFileToBase64 error:', e);
    return tempFilePath;
  }
};

export const isPhotoValid = (photoUrl?: string): boolean => {
  if (!photoUrl) return false;
  if (photoUrl.startsWith('data:image')) return true;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return true;
  if (photoUrl.startsWith('/') || photoUrl.startsWith('file://')) return false;
  if (photoUrl.includes('tmp/') || photoUrl.includes('_temp')) return false;
  return true;
};

export const chooseImageAsBase64 = async (sourceType: ('album' | 'camera')[] = ['album', 'camera']): Promise<string> => {
  const res = await Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType,
  });
  if (!res.tempFilePaths || res.tempFilePaths.length === 0) {
    throw new Error('未选择照片');
  }
  const tempPath = res.tempFilePaths[0];
  const base64 = await tempFileToBase64(tempPath);
  return base64;
};
