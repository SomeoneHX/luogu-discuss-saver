import UserInlineLink from "../../../user-inline-link";

import type { UserEntry } from "../../../../lib/entries";

/** 移植自原版 magic-link/user/direct.tsx：链接文字无信息量时直接渲染用户外显。 */
export default function UserMagicLinkDirect({ userInfo }: { userInfo: UserEntry }) {
  return (
    <span className="relative top-1 -mt-1 inline-block">
      <UserInlineLink user={{ ...userInfo, id: userInfo.uid }} compact />
    </span>
  );
}
