import { Link } from "../App";
import type { AuthorInfo } from "../lib/api";
import { ccfLevelToColor, cn, getLuoguAvatar, xcpcLevelToColor } from "../lib/utils";
import { IconBalloon, IconRosetteDiscountCheck } from "./tabler-icons";

function colorOf(user: AuthorInfo): string {
  return (user.color ?? "gray").toLowerCase();
}

function displayBadgeOf(user: AuthorInfo): string | null {
  const color = colorOf(user);
  return (
    user.badge ||
    (color === "purple" ? "管理员" : color === "cheater" ? "作弊者" : null)
  );
}

export default function UserInlineLink({
  user,
  avatar = true,
  compact = false,
  className,
  link = true,
  nameColorOverride,
}: {
  user: AuthorInfo | null;
  avatar?: boolean;
  compact?: boolean;
  className?: string;
  /** 原版 UserInlineDisplay（纯展示）与 UserInlineLink（带链接）的区分 */
  link?: boolean;
  /** 覆盖名字颜色（原版用于 markdown 里的普通用户链接，固定 indigo） */
  nameColorOverride?: string;
}) {
  if (!user) {
    return <span className="text-foreground">匿名用户</span>;
  }
  const displayBadge = displayBadgeOf(user);
  const content = (
    <>
      {avatar ? (
        <img
          src={getLuoguAvatar(user.id)}
          alt={user.name}
          loading="lazy"
          className={cn("rounded-full bg-muted object-cover", compact ? "mx-0.5 size-5" : "size-6")}
        />
      ) : null}
      <span
        className={cn(
          "text-base font-medium",
          avatar ? (compact ? "ms-1" : "ms-1.5") : "ms-0.75",
          nameColorOverride ?? `text-luogu-${colorOf(user)}`,
        )}
      >
        {user.name}
      </span>
      {displayBadge ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-inverse",
            `bg-luogu-${colorOf(user)}`,
            "me-0.75",
          )}
        >
          {displayBadge}
        </span>
      ) : null}
      {typeof user.ccfLevel === "number" && user.ccfLevel !== 0 ? (
        <IconRosetteDiscountCheck
          className={cn(
            "size-5",
            compact && "-ms-0.25",
            user.xcpcLevel !== 0 ? "-me-0.25" : "me-0.5",
            `text-luogu-${ccfLevelToColor(user.ccfLevel)}`,
          )}
        />
      ) : null}
      {typeof user.xcpcLevel === "number" && user.xcpcLevel !== 0 ? (
        <IconBalloon
          className={cn(
            "relative top-0.25 me-0.25 size-4.5",
            compact && "-ms-0.25",
            `text-luogu-${xcpcLevelToColor(user.xcpcLevel)}`,
          )}
        />
      ) : null}
    </>
  );
  if (link) {
    return (
      <Link
        href={`/u/${String(user.id)}`}
        className={cn(
          "inline-flex items-center rounded-full transition-colors duration-200 hover:bg-primary/10",
          className,
        )}
      >
        {content}
      </Link>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center rounded-full", className)}
    >
      {content}
    </span>
  );
}
