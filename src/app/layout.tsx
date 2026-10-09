import type {
  Metadata,
} from "next";

import {
  AppHeader,
} from "@/components/app-header";

import "./globals.css";

export const metadata:
  Metadata = {
    title:
      "Frontend Deep Lab",

    description:
      "Học frontend từ tài liệu chính thức bằng tiếng Việt, giữ thuật ngữ tiếng Anh và có trợ giảng AI.",
  };

export default function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AppHeader />

        {children}
      </body>
    </html>
  );
}
