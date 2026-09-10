import type { Place } from '../types';
import { Tag } from './ui';

/**
 * 「想去的地方」卡片：撕票線 + 缺角圓孔（呼應車票／收集車票的產品概念，spec §5）。
 * 這個視覺只用在這裡，其他地方刻意不重複。
 */
export default function PlaceCard({
  place,
  onClick,
}: {
  place: Place;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative mb-3 flex w-full gap-4 rounded-l-[14px] rounded-r-[4px] border border-line bg-card py-3.5 pl-[18px] pr-3.5 text-left active:scale-[0.99]"
    >
      {/* 撕票線 */}
      <span className="pointer-events-none absolute bottom-2.5 top-2.5 border-l-[1.5px] border-dashed border-line" style={{ left: 86 }} />
      {/* 缺角圓孔 */}
      <span
        className="pointer-events-none absolute -top-1.5 h-3 w-3 rounded-full border border-line border-t-transparent bg-paper"
        style={{ left: 80 }}
      />

      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-teal to-[#0a3c36] text-[20px] text-white">
        {place.imageDataUrl ? (
          <img
            src={place.imageDataUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          '📍'
        )}
      </div>

      <div className="pl-1.5">
        <h4 className="mb-0.5 font-display text-[14.5px]">
          {place.region ? `${place.region}・` : ''}
          {place.name}
        </h4>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Tag>{place.category}</Tag>
          {place.region && <Tag tone="mustard">{place.region}</Tag>}
          {place.visited && <Tag tone="red">已造訪</Tag>}
        </div>
        <div className="mt-0.5 text-[11px] text-[#9A9184]">
          來源：{place.source}
        </div>
      </div>
    </button>
  );
}
