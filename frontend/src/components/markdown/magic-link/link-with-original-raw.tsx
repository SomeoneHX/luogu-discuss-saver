import * as React from "react";
import {
  autoUpdate,
  FloatingPortal,
  shift,
  size,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";

import { cn } from "../../../lib/utils";

/** 移植自原版 magic-link/link-with-original-raw.tsx（hover 悬浮卡底座）。 */
export default function LinkWithOriginalRaw({
  preview,
  originalRaw,
  className,
  outerClassName,
  singleLine = false,
}: {
  preview: React.ReactNode;
  originalRaw: React.ReactNode;
  className?: string;
  outerClassName?: string;
  singleLine?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    middleware: [
      shift({ padding: 16 }),
      size({
        padding: 16,
        apply({ availableWidth, elements }) {
          const maxWidth = Math.min(560, availableWidth);
          const minWidth = Math.min(340, availableWidth);
          Object.assign(elements.floating.style, {
            maxWidth: `${String(maxWidth)}px`,
            minWidth: singleLine ? undefined : `${String(minWidth)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, restMs: 50 });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <span className={cn("relative", outerClassName)}>
        <span
          ref={refs.setReference}
          {...getReferenceProps({ className: cn("inline-block", className) })}
        >
          {originalRaw}
        </span>
      </span>

      <FloatingPortal>
        <div
          // eslint-disable-next-line react-hooks/refs
          ref={refs.setFloating}
          {...getFloatingProps({
            className: cn(
              "pointer-events-none z-50 mt-1 flex w-max rounded-2xl bg-background/60",
              "overflow-hidden",
              "shadow-lg ring-1 ring-border",
              "transition-opacity duration-120",
              open ? "opacity-100" : "opacity-0",
              singleLine
                ? "p-0.75 inline-flex items-center gap-1 backdrop-blur-xs"
                : "p-5 flex-col backdrop-blur-sm",
            ),
            style: floatingStyles,
          })}
        >
          {preview}
        </div>
      </FloatingPortal>
    </>
  );
}
