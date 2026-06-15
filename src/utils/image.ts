import Taro from '@tarojs/taro';

export const tempFileToBase64 = async (tempFilePath: string): Promise<string> => {
  try {
    if (typeof wx !== 'undefined') {
      const fs = wx.getFileSystemManager();
      return new Promise((resolve, reject) => {
        fs.readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64 = `data:image/jpeg;base64,${res.data}`;
            resolve(base64);
          },
          fail: (err) => {
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
