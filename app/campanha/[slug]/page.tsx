import { Suspense } from "react";
import CampaignExperience from "@/components/CampaignExperience";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={<main className="min-h-screen grid place-items-center">Carregando...</main>}
    >
      <CampaignExperience slug={slug} />
    </Suspense>
  );
}
