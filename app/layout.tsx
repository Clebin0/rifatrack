import "./globals.css";
import { Geist } from "next/font/google";
import UIProvider from "@/components/ui/UIProvider";
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});
import { connection } from "next/server";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "RifaTrack", template: "%s | RifaTrack" },
  description:
    "Conheça campanhas e prêmios, escolha seus números e acompanhe seu pedido.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://rifatrack.vercel.app",
  ),
  openGraph: {
    title: "RifaTrack",
    description: "Prêmios, regras e acompanhamento do seu pedido.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary", title: "RifaTrack" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body>
        <a href="#page-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <UIProvider>
          <div id="page-content" tabIndex={-1}>
            {children}
          </div>
        </UIProvider>
      </body>
    </html>
  );
}
