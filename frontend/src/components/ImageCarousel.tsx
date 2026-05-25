"use client";
import Image from "next/image";
import { useState } from "react";

// 다중 이미지 캐러셀 (좌우 화살표 · 점 인디케이터 · 카운터). 1장이면 컨트롤 없이 표시.
export default function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const n = images.length;
  if (n === 0) return null;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <div className="relative mt-5 w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl overflow-hidden bg-background select-none">
      <Image
        key={i}
        src={images[i]}
        alt={`${alt} ${i + 1}/${n}`}
        fill
        sizes="(max-width: 1024px) 100vw, 700px"
        className="object-cover"
        unoptimized
      />

      {n > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="이전 이미지"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-black/40 text-white text-lg hover:bg-black/60"
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            aria-label="다음 이미지"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-black/40 text-white text-lg hover:bg-black/60"
          >
            ›
          </button>
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs font-semibold">
            {i + 1} / {n}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, k) => (
              <button
                key={k}
                onClick={() => setI(k)}
                aria-label={`${k + 1}번째 이미지`}
                className={`w-2 h-2 rounded-full transition-colors ${k === i ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
