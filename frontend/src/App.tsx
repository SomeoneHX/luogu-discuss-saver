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

function usePathname(): [string, (p: string) => void] {
  const [pathname, setPathname] = React.useState(window.location.pathname);
  React.useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
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
        // 目标锚点所在页面内容是异步加载的，轮询等元素出现后再滚动
        let tries = 0;
        const scrollToAnchor = (): void => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView();
          } else if (tries++ < 20) {
            setTimeout(scrollToAnchor, 150);
          }
        };
        setTimeout(scrollToAnchor, 50);
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
