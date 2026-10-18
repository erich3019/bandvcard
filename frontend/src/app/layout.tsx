import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bandvcard",
  description: "Digitale Visitenkartenverwaltung",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets data-theme before the first paint, hence the hydration warning switch.
    <html lang="de-CH" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider attribute="data-theme" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
