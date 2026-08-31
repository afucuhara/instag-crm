import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instag CRM",
  description: "Gestão de clientes, produção, aprovações e financeiro para equipes de social media.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
