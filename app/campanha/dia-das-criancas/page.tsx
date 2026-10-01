import {Suspense} from "react";import CampaignClient from "./CampaignClient";
export default function Page(){return <Suspense fallback={<main className="min-h-screen p-6">Carregando campanha...</main>}><CampaignClient/></Suspense>}
