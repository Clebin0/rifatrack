import "./globals.css";
import { connection } from "next/server";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "RifaTrack", template: "%s | RifaTrack" },
  description: "Gestão profissional de campanhas, vendedores, números e pagamentos.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://rifatrack.vercel.app"),
  openGraph: {
    title: "RifaTrack",
    description: "Campanhas, vendedores e acompanhamento de pedidos.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary", title: "RifaTrack" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
