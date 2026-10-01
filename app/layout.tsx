import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "RifaTrack", template: "%s | RifaTrack" },
  description: "Gestão profissional de campanhas, vendedores, números e pagamentos.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
