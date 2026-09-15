import * as React from "react";
import { AppShell } from "./components/app-shell";
import { DiscussionPage } from "./pages/discussion";
import { HomePage } from "./pages/home";
import { ExplorePage, RecentPage } from "./pages/trending";
import { UserPage } from "./pages/user";

type Router = {
  pathname: string;
  navigate: (to: string) => void;
};

const RouterContext = React.createContext<Router | null>(null);

export function useRouter(): Router {
  const ctx = React.useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within <App>");
  return ctx;
}

/** 站内 <a>，走 History API 路由（等价于 next/link） */
export function Link({
  href,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        if (!href || href.startsWith("http") || href.startsWith("#")) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** 吸顶头部高度（含下边框）之外的留白 */
const ANCHOR_EXTRA_OFFSET = 12;

function headerOffset(): number {
  const header = document.querySelector("header");
  const height = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  return (height > 0 ? height : 64) + ANCHOR_EXTRA_OFFSET;
}

/** 滚动到锚点：目标元素可能由异步数据渲染，轮询等待出现；位置需让开吸顶栏。 */
export function scrollToAnchor(hash: string): void {
  // 容忍 `#reply-1?x=y` 这类把查询串写在 hash 后面的写法
  const id = hash.split(/[?&]/)[0] ?? hash;
  let tries = 0;
  const step = (): void => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset();
      window.scrollTo(0, Math.max(0, top));
      return;
    }
    if (tries++ < 20) setTimeout(step, 150);
  };
  setTimeout(step, 50);
}

function usePathname(): [string, (p: string) => void] {
  const [pathname, setPathname] = React.useState(window.location.pathname);
  React.useEffect(() => {
    const onPop = () => {
      setPathname(window.location.pathname);
      if (window.location.hash) scrollToAnchor(window.location.hash.slice(1));
    };
    window.addEventListener("popstate", onPop);
    // 直接带 #reply-x 打开页面时也要滚动（内容异步渲染，等元素出现）
    if (window.location.hash) scrollToAnchor(window.location.hash.slice(1));
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return [pathname, setPathname];
}

export function App() {
  const [pathname, setPathname] = usePathname();

  const navigate = React.useCallback(
    (to: string) => {
      const url = new URL(to, window.location.origin);
      const path = url.pathname;
      if (path === pathname && !url.hash) return;
      window.history.pushState(null, "", to);
      setPathname(path);
      const hash = url.hash.slice(1);
      if (hash) {
        scrollToAnchor(hash);
      } else {
        window.scrollTo(0, 0);
      }
    },
    [pathname, setPathname],
  );

  const router = React.useMemo<Router>(() => ({ pathname, navigate }), [pathname, navigate]);

  let page: React.ReactNode;
  const seg = pathname.split(/[?#]/)[0]?.split("/").filter(Boolean) ?? [];
  const discussionMatch = seg[0] === "d" && seg[1]?.match(/^(\d+)(?:@([a-z0-9]+))?$/i);
  if (discussionMatch) {
    page = (
      <DiscussionPage
        key={discussionMatch[1]}
        id={Number(discussionMatch[1])}
        snapshotToken={discussionMatch[2]}
      />
    );
  } else if (seg[0] === "u" && seg[1] && /^\d+$/.test(seg[1])) {
    page = <UserPage key={seg[1]} id={Number(seg[1])} />;
  } else if (seg[0] === "recent") {
    page = <RecentPage />;
  } else if (seg[0] === "explore") {
    page = <ExplorePage />;
  } else {
    // "/" 首页：社区精选信息流
    page = <HomePage />;
  }

  return (
    <RouterContext.Provider value={router}>
      <AppShell pathname={pathname}>{page}</AppShell>
    </RouterContext.Provider>
  );
}
