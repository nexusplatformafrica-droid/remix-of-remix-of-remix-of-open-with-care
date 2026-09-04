import { avatarColor } from "@/lib/aviator/game";

export function Avatar({
  username,
  seed,
  size = 22,
}: {
  username: string;
  seed: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold uppercase text-foreground/90"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: avatarColor(seed || username),
      }}
      aria-hidden="true"
    >
      {username.slice(0, 1)}
    </span>
  );
}