import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SmartAnnotate AI — Active Learning Auto Annotation Platform",
  description:
    "Platform anotasi berbasis AI. Anotasi 5-10 gambar, YOLO otomatis labeli sisanya. Human-in-the-loop active learning untuk dataset yang lebih akurat 70-95% lebih cepat.",
  keywords: "annotation, YOLO, active learning, computer vision, auto-labeling, dataset",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
