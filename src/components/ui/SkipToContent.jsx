export default function SkipToContent({ targetId = "main-content" }) {
  return (
    <a
      href={`#${targetId}`}
      className="fixed left-3 top-3 z-[100] -translate-y-[180%] rounded-lg bg-cyan-300 px-4 py-3 text-xs font-extrabold tracking-[0.04em] text-[#07111d] transition-transform duration-150 focus:translate-y-0"
    >
      Skip to main content
    </a>
  );
}
