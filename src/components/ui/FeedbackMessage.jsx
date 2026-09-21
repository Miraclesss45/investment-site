import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const styles = {
  error: {
    icon: AlertCircle,
    container:
      "border-rose-300/20 bg-rose-400/[0.08] text-rose-100 shadow-[0_12px_30px_rgba(244,63,94,0.08)]",
    iconClass: "text-rose-300",
  },
  success: {
    icon: CheckCircle2,
    container:
      "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100 shadow-[0_12px_30px_rgba(16,185,129,0.08)]",
    iconClass: "text-emerald-300",
  },
  status: {
    icon: Info,
    container:
      "border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100 shadow-[0_12px_30px_rgba(34,211,238,0.08)]",
    iconClass: "text-cyan-300",
  },
  warning: {
    icon: AlertCircle,
    container:
      "border-amber-300/20 bg-amber-400/[0.08] text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.08)]",
    iconClass: "text-amber-300",
  },
};

export default function FeedbackMessage({
  children,
  type = "status",
  className = "",
}) {
  const variant = styles[type] || styles.status;
  const Icon = variant.icon;
  const isError = type === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 ${variant.container} ${className}`}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${variant.iconClass}`}
      />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
