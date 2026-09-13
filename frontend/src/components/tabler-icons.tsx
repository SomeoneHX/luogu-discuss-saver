import * as React from "react";

function TablerIcon({
  paths,
  className,
  viewBox = "0 0 24 24",
}: {
  paths: React.ReactNode;
  className?: string;
  viewBox?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths}
    </svg>
  );
}

/** Tabler rosette-discount-check（洛谷 CCF 等级图标，原版同款） */
export function IconRosetteDiscountCheck({
  className,
}: {
  className?: string;
}) {
  return (
    <TablerIcon
      className={className}
      paths={
        <>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" />
          <path d="M9 12l2 2l4 -4" />
        </>
      }
    />
  );
}

/** Tabler balloon（洛谷 XCPC 等级图标，原版同款） */
export function IconBalloon({ className }: { className?: string }) {
  return (
    <TablerIcon
      className={className}
      paths={
        <>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M14 8a2 2 0 0 0 -2 -2" />
          <path d="M6 8a6 6 0 1 1 12 0c0 4.97 -2.686 9 -6 9s-6 -4.03 -6 -9" />
          <path d="M12 17v1a2 2 0 0 1 -2 2h-3a2 2 0 0 0 -2 2" />
        </>
      }
    />
  );
}
