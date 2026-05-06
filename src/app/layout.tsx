import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vesper | Finance Command Center",
  description: "Controle financeiro de alta fidelidade com design Liquid Glass.",
};

import { AppShell } from "@/components/AppShell";
import { TransactionModalProvider } from "@/context/TransactionModalContext";
import { AccountModalProvider } from "@/context/AccountModalContext";
import { SubscriptionModalProvider } from "@/context/SubscriptionModalContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-br"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-black text-white font-sans selection:bg-violet-500/30" suppressHydrationWarning>
        <TransactionModalProvider>
          <AccountModalProvider>
            <SubscriptionModalProvider>
              <AppShell>
                {children}
              </AppShell>
            </SubscriptionModalProvider>
          </AccountModalProvider>
        </TransactionModalProvider>
      </body>
    </html>
  );
}
