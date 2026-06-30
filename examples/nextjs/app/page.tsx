"use client";

import { Chat } from "@sparrowdesk/react-chat";

export default function Home() {
  return (
    <main className="shell">
      <h1>SparrowDesk Chat</h1>
      <p className="muted">
        Replace <code>domain</code> and <code>token</code> below with your
        SparrowDesk credentials. The launcher appears in the bottom corner.
      </p>

      <Chat domain="your-workspace.sparrowdesk.com" token="YOUR_TOKEN" />
    </main>
  );
}
