import { LogoMark } from "./icons";

export function LogoBadge({ size = 28 }: { size?: number }) {
  return (
    <span
      className="bg-accent text-bg flex shrink-0 items-center justify-center rounded-md"
      style={{ width: size, height: size }}
    >
      <LogoMark size={Math.round(size * 0.57)} />
    </span>
  );
}
