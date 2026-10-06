import TransparencyClient from "@/components/TransparencyClient";
import FederalTransparency from "@/components/FederalTransparency";
export default async function TransparencyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "dia-das-criancas") return <FederalTransparency />;
  return <TransparencyClient slug={slug} />;
}
