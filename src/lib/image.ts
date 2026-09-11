/** 讀取 File 成 data URL */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
}

interface CompressOptions {
  maxDim?: number;
  quality?: number;
}

/**
 * 把截圖壓縮成適合送去辨識 API 的大小：等比縮到最長邊 ≤ maxDim、轉成 JPEG。
 * 避免原始截圖太大導致 GAS 執行時間或 Gemini API 請求大小限制炸掉
 * （後端 gas/Code.gs 也有一層防呆，這裡是第一道防線）。
 */
export function compressImageDataUrl(
  dataUrl: string,
  { maxDim = 1280, quality = 0.82 }: CompressOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= 0 || height <= 0) {
        resolve(dataUrl);
        return;
      }
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('圖片解碼失敗'));
    img.src = dataUrl;
  });
}
