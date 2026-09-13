import type { ForumInfo } from "../lib/api";

export function ForumDisplay({ forum }: { forum: ForumInfo | null }) {
  if (!forum) return "未知板块";
  if (!forum.problem) return forum.name;
  return (
    <>
      <span className={`me-1 font-semibold text-luogu-problem-${String(forum.problem.difficulty ?? 0)}`}>
        {forum.problem.pid}
      </span>
      {forum.problem.title}
    </>
  );
}

export function ForumDisplayShort({ forum }: { forum: ForumInfo | null }) {
  if (!forum) return "未知板块";
  if (!forum.problem) return forum.name;
  return (
    <span className={`text-luogu-problem-${String(forum.problem.difficulty ?? 0)}`}>
      {forum.problem.pid}
    </span>
  );
}
