export default function LanguageFlag({ countryCode }) {
  const common = { width: 24, height: 16, viewBox: "0 0 30 20", className: "shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/20", "aria-hidden": true };

  switch (countryCode) {
    case "GB":
      return <svg {...common}><rect width="30" height="20" fill="#18316d" /><path d="M0 0 30 20M30 0 0 20" stroke="white" strokeWidth="5" /><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2" /><path d="M15 0v20M0 10h30" stroke="white" strokeWidth="7" /><path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.5" /></svg>;
    case "ES":
      return <svg {...common}><rect width="30" height="20" fill="#aa151b" /><rect y="5" width="30" height="10" fill="#f1bf00" /><circle cx="9" cy="10" r="2" fill="#aa151b" /></svg>;
    case "FR":
      return <svg {...common}><rect width="10" height="20" fill="#002395" /><rect x="10" width="10" height="20" fill="white" /><rect x="20" width="10" height="20" fill="#ed2939" /></svg>;
    case "DE":
      return <svg {...common}><rect width="30" height="6.67" fill="#111" /><rect y="6.67" width="30" height="6.66" fill="#d00" /><rect y="13.33" width="30" height="6.67" fill="#ffce00" /></svg>;
    case "PT":
      return <svg {...common}><rect width="12" height="20" fill="#046a38" /><rect x="12" width="18" height="20" fill="#da291c" /><circle cx="12" cy="10" r="3" fill="#ffcd00" /></svg>;
    case "IT":
      return <svg {...common}><rect width="10" height="20" fill="#009246" /><rect x="10" width="10" height="20" fill="white" /><rect x="20" width="10" height="20" fill="#ce2b37" /></svg>;
    case "NL":
      return <svg {...common}><rect width="30" height="6.67" fill="#ae1c28" /><rect y="6.67" width="30" height="6.66" fill="white" /><rect y="13.33" width="30" height="6.67" fill="#21468b" /></svg>;
    case "CN":
      return <svg {...common}><rect width="30" height="20" fill="#de2910" /><path d="m7 3 1.2 3.5H12L9 8.7l1.2 3.5L7 10l-3.2 2.2L5 8.7 2 6.5h3.8Z" fill="#ffde00" /><circle cx="14" cy="4" r=".8" fill="#ffde00" /><circle cx="16" cy="7" r=".8" fill="#ffde00" /><circle cx="16" cy="11" r=".8" fill="#ffde00" /><circle cx="14" cy="14" r=".8" fill="#ffde00" /></svg>;
    case "SA":
      return <svg {...common}><rect width="30" height="20" fill="#006c35" /><path d="M6 13h15m-2-2 2 2-2 2" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 7h17" stroke="white" strokeWidth="1.1" strokeDasharray="1 1" /></svg>;
    case "IN":
      return <svg {...common}><rect width="30" height="6.67" fill="#ff9933" /><rect y="6.67" width="30" height="6.66" fill="white" /><rect y="13.33" width="30" height="6.67" fill="#138808" /><circle cx="15" cy="10" r="2.1" fill="none" stroke="#000080" strokeWidth=".8" /><circle cx="15" cy="10" r=".5" fill="#000080" /></svg>;
    case "JP":
      return <svg {...common}><rect width="30" height="20" fill="white" /><circle cx="15" cy="10" r="5" fill="#bc002d" /></svg>;
    case "KR":
      return <svg {...common}><rect width="30" height="20" fill="white" /><path d="M15 6a4 4 0 0 0 0 8 2 2 0 0 1 0-4 2 2 0 0 0 0-4" fill="#cd2e3a" /><path d="M15 10a4 4 0 0 0 0 8 4 4 0 0 0 0-8" fill="#0047a0" transform="translate(0 -4)" /><path d="M5 4h5M4 6h6M20 14h5M20 16h6" stroke="#111" strokeWidth="1" /></svg>;
    case "RU":
      return <svg {...common}><rect width="30" height="6.67" fill="white" /><rect y="6.67" width="30" height="6.66" fill="#0039a6" /><rect y="13.33" width="30" height="6.67" fill="#d52b1e" /></svg>;
    case "TR":
      return <svg {...common}><rect width="30" height="20" fill="#e30a17" /><circle cx="12" cy="10" r="5" fill="white" /><circle cx="14" cy="9" r="4" fill="#e30a17" /><path d="m19 6 1.1 2.4 2.6.3-1.9 1.7.5 2.6-2.3-1.3-2.3 1.3.5-2.6-1.9-1.7 2.6-.3Z" fill="white" /></svg>;
    default:
      return <span className="inline-flex h-4 w-6 shrink-0 items-center justify-center rounded-[3px] bg-slate-600 text-[8px] font-bold text-white" aria-hidden="true">{countryCode}</span>;
  }
}
