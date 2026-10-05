import CampaignPage from "../[slug]/page";
export default function LegacyCampaignPage() {
  return <CampaignPage params={Promise.resolve({ slug: "dia-das-criancas" })} />;
}
