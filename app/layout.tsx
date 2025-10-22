export const metadata = {
  title: "Fluid Compute Coalescing MVP",
  description: "Demonstrates request coalescing atop Vercel Functions."
};

import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
