import UserInlineLink from "../../../user-inline-link";

import type { UserEntry } from "../../../../lib/entries";
import LinkWithOriginalRaw from "../link-with-original-raw";

/** 移植自原版 magic-link/user/with-original.tsx：链接文字 + 悬浮用户卡。 */
export default function UserMagicLinkWithOriginal({
  userInfo,
  children,
}: {
  userInfo: UserEntry;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginalRaw
      originalRaw={
        <UserInlineLink
          user={{
            ...userInfo,
            name: children as string,
            id: userInfo.uid,
          }}
          compact
          nameColorOverride="text-indigo-500"
          className="rounded-full transition-colors duration-200 hover:bg-primary/10"
        />
      }
      preview={
        <UserInlineLink user={{ ...userInfo, id: userInfo.uid }} compact link={false} />
      }
      className="relative top-1.5 mx-0 -mt-1 inline-block overflow-hidden rounded-full leading-0"
      outerClassName="rounded-full"
      singleLine
    />
  );
}
