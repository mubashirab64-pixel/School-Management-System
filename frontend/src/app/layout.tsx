import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";

export const metadata: Metadata = {
  title: "Newton AMS",
  description: "Advanced Management System",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning={true}>
        <Toaster position="top-right" richColors />
        <OfflineIndicator />
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
