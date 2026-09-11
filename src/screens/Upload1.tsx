import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ScreenScroll, TopBar } from '../components/ui';
import { compressImageDataUrl, readFileAsDataUrl } from '../lib/image';

export default function Upload1() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.replace(/\.[^/.]+$/, '');

    setError(null);
    setPreparing(true);
    try {
      const raw = await readFileAsDataUrl(file);
      // 先壓縮再送出去辨識，避免原始截圖太大讓辨識請求炸掉（見 lib/image.ts）
      const imageDataUrl = await compressImageDataUrl(raw);
      navigate('/places/upload/extract', { state: { imageDataUrl, fileName } });
    } catch {
      setPreparing(false);
      setError('圖片讀取失敗，請換一張截圖再試一次');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <TopBar title="新增收藏地點" back="/places" />
      <ScreenScroll>
        <p className="mb-3.5 mt-2 text-[12.5px] text-muted">
          上傳來自 IG／FB／Google Maps 的截圖，AI 會自動幫你辨識地點資訊。
        </p>

        {error && (
          <p className="mb-3 rounded-lg bg-[#F9DED5] px-3 py-2 text-[11.5px] text-red-deep">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e)}
        />

        <button
          type="button"
          disabled={preparing}
          onClick={() => inputRef.current?.click()}
          className="mb-4 w-full rounded-[18px] border-[1.5px] border-dashed border-line bg-card px-4 py-8 text-center disabled:opacity-60"
        >
          <div className="mb-2 text-[30px]">🖼️</div>
          <p className="text-[13px] font-bold">
            {preparing ? '處理圖片中…' : '點擊上傳截圖'}
          </p>
          <p className="mt-1 text-[11px] text-[#9A9184]">
            支援 IG 限動、貼文、Google Maps 分享畫面
          </p>
        </button>

        <Button
          variant="ghost"
          disabled={preparing}
          onClick={() => inputRef.current?.click()}
        >
          或從相簿選取截圖
        </Button>
      </ScreenScroll>
    </>
  );
}
