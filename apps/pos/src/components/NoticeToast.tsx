export function NoticeToast({ text }: { text: string }) {
  return (
    <div className="fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full bg-spoto-green px-5 py-2 text-sm font-heading font-bold text-[#101010] shadow-lg">
      🔔 {text}
    </div>
  );
}
