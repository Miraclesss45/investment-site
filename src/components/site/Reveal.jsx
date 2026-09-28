import { useReveal } from "../../lib/useReveal";

export function Reveal({
  as: Component = "div",
  className = "",
  children,
  style,
  ...props
}) {
  const [revealRef, isVisible] = useReveal();

  return (
    <Component
      ref={revealRef}
      className={`transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ ...style, transitionDelay: isVisible ? "var(--reveal-delay, 0ms)" : "0ms" }}
      {...props}
    >
      {children}
    </Component>
  );
}
