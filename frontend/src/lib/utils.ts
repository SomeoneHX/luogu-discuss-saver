export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "auto",
});

const RELATIVE_TIME_DIVISIONS: {
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(date: Date): string {
  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (Math.abs(diffInSeconds) < 10) return "刚刚";

  let duration = diffInSeconds;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "year");
}

export function formatAbsolute(date: Date): string {
  return ABSOLUTE_DATE_FORMATTER.format(date);
}

export function getLuoguAvatar(uid: number): string {
  return `https://cdn.luogu.com.cn/upload/usericon/${String(uid)}.png`;
}

export function ccfLevelToColor(level: number): string {
  if (level >= 8) return "orange";
  if (level >= 6) return "blue";
  if (level >= 3) return "green";
  return "cheater";
}

export function xcpcLevelToColor(level: number): string {
  return ccfLevelToColor(level);
}

export function truncateContent(value: string, limit = 160): string {
  const normalized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).trim()}…`;
}
