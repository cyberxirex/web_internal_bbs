"use client";

export default function ProfanityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl">🚫</div>
        <h3 className="text-lg font-extrabold mt-2">사용할 수 없는 언어입니다</h3>
        <p className="text-sm text-muted mt-2">부적절한 표현이 포함되어 있어요.<br />수정 후 다시 시도해 주세요.</p>
        <button onClick={onClose} className="mt-5 px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90">확인</button>
      </div>
    </div>
  );
}
