import * as React from "react";
import { Home, Layers, Monitor, Moon, Sun, Telescope } from "lucide-react";
import { Link } from "../App";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { title: "首页", href: "/", icon: Home },
  { title: "探索", href: "/explore", icon: Telescope },
  { title: "最近", href: "/recent", icon: Layers },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  return (
    <div className="bg-background text-foreground">
      <DesktopSidebar pathname={pathname} />
      <div className={cn("flex min-h-svh flex-col transition-[margin-left] duration-300 ease-in-out", "md:ml-[3.8125rem]")}>
        <TopBar pathname={pathname} />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden md:flex">
      <aside className="group/sidebar pointer-events-auto flex h-full w-[3.8125rem] flex-col border-r bg-background/80 px-2 py-6 shadow-sm backdrop-blur transition-[width] duration-300 ease-in-out hover:w-56">
        <div className="flex flex-1 flex-col gap-6 overflow-hidden">
          <Link
            href="/"
            className="flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-indigo-500/85 text-[0.6rem] font-bold text-white">
              谷
            </span>
            <span className="ml-3 whitespace-nowrap text-base/1 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
              洛谷帖子保存站
            </span>
          </Link>
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center overflow-hidden rounded-full p-3 text-sm transition-colors duration-200",
                    active
                      ? "bg-indigo-500/85 text-white"
                      : "text-muted-foreground hover:bg-muted/85 hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="ml-3 whitespace-nowrap text-base/1 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}

function TopBar({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbs(pathname);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <nav className="flex items-center gap-2 text-sm font-medium">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${String(index)}`}>
              {index > 0 ? <span className="text-muted-foreground/60">/</span> : null}
              {crumb.href && index < crumbs.length - 1 ? (
                <Link href={crumb.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: "首页", href: "/" }];
  const segments = pathname.split("?")[0]?.split("/").filter(Boolean) ?? [];
  const first = segments[0];
  const second = segments[1];
  if (first === "explore") crumbs.push({ label: "探索" });
  else if (first === "recent") crumbs.push({ label: "最近" });
  else if (first === "d") {
    crumbs.push({ label: "讨论" });
    if (second) crumbs.push({ label: `#${second}` });
  } else if (first === "u") {
    crumbs.push({ label: "用户" });
    if (second) crumbs.push({ label: `@${second}`, href: `/u/${second}` });
  }
  return crumbs;
}

const THEME_MODES = [
  { value: "light", label: "浅色模式", Icon: Sun },
  { value: "dark", label: "深色模式", Icon: Moon },
  { value: "system", label: "自动模式", Icon: Monitor },
] as const;

type ThemeMode = (typeof THEME_MODES)[number]["value"];

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [setting, setSetting] = React.useState<ThemeMode>("system");

  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setSetting(stored);
  }, []);

  React.useEffect(() => {
    const apply = (mode: ThemeMode) => {
      const dark =
        mode === "dark" ||
        (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply(setting);
    if (setting === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => apply("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [setting]);

  const handleToggle = () => {
    const order = THEME_MODES.map((m) => m.value) as ThemeMode[];
    const next = order[(order.indexOf(setting) + 1) % order.length] as ThemeMode;
    setSetting(next);
    if (next === "system") {
      window.localStorage.removeItem("theme");
    } else {
      window.localStorage.setItem("theme", next);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="group flex items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-muted-foreground shadow-sm transition duration-200 hover:border-border hover:text-foreground"
      aria-label="切换主题"
    >
      {THEME_MODES.map(({ value, Icon }) => (
        <Icon
          key={value}
          className={cn(
            "size-4 transition-all",
            mounted && value === setting
              ? "text-foreground opacity-100"
              : "opacity-40 group-hover:opacity-60",
          )}
        />
      ))}
    </button>
  );
}

const SITE_LAUNCHED_AT = new Date("2026-09-13T00:00:00+08:00");
const REPO_URL = "https://github.com/SomeoneHX/luogu-discuss-saver";

/** 网站运行时长文案，每分钟刷新 */
function useUptimeText(): string {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  let seconds = Math.max(0, Math.floor((now - SITE_LAUNCHED_AT.getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);

  if (days > 0) return `已运行 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `已运行 ${hours} 小时 ${minutes} 分钟`;
  return `已运行 ${minutes} 分钟`;
}

function AppFooter() {
  const uptime = useUptimeText();
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">洛谷帖子保存站</span>
        <span>数据来自公开讨论页存档，仅供检索与回看。</span>
        <span>{uptime}</span>
        <span>
          开源：
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            SomeoneHX/luogu-discuss-saver
          </a>
          {" · "}
          <a
            href={`${REPO_URL}/blob/main/LICENSE.md`}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            AGPL-3.0
          </a>
        </span>
      </div>
    </footer>
  );
}
