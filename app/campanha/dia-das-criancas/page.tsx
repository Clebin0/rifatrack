import { Suspense } from "react";
import CampaignExperience from "@/components/CampaignExperience";

export default function Page() {
  return <Suspense fallback={<main className="min-h-screen grid place-items-center">Carregando...</main>}><CampaignExperience slug="dia-das-criancas"/></Suspense>;
}
