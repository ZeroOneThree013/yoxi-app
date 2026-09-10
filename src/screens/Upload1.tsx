import { useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ScreenScroll, TopBar } from '../components/ui';

export default function Upload1() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const reader = new FileReader();
    reader.onload = () => {
      navigate('/places/upload/extract', {
        state: { imageDataUrl: reader.result as string, fileName },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <TopBar title="新增收藏地點" back="/places" />
      <ScreenScroll>
        <p className="mb-3.5 mt-2 text-[12.5px] text-muted">
          上傳來自 IG／FB／Google Maps 的截圖，AI 會自動幫你辨識地點資訊。
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mb-4 w-full rounded-[18px] border-[1.5px] border-dashed border-line bg-card px-4 py-8 text-center"
        >
          <div className="mb-2 text-[30px]">🖼️</div>
          <p className="text-[13px] font-bold">點擊上傳截圖</p>
          <p className="mt-1 text-[11px] text-[#9A9184]">
            支援 IG 限動、貼文、Google Maps 分享畫面
          </p>
        </button>

        <Button variant="ghost" onClick={() => inputRef.current?.click()}>
          或從相簿選取截圖
        </Button>
      </ScreenScroll>
    </>
  );
}
