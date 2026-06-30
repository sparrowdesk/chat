# Next.js example

Minimal SparrowDesk chat widget integration with the Next.js App Router.

```bash
pnpm install
pnpm --filter example-nextjs dev
# open http://localhost:3000
```

Set your credentials in `app/page.tsx`:

```tsx
"use client";
import { Chat } from "@sparrowdesk/react-chat";

export default function Home() {
  return <Chat domain="your-workspace.sparrowdesk.com" token="YOUR_TOKEN" />;
}
```

Notes:

- `<Chat>` must live in a Client Component (`"use client"`), since the widget
  runs in the browser.
- For controlling the widget from anywhere (open/close, set fields/tags) or
  using a custom launcher, wrap your tree in `SparrowDeskProvider` and call
  `useSparrowDesk()` — see the root [`README.md`](../../README.md).
