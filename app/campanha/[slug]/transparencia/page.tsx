import TransparencyClient from "@/components/TransparencyClient";
export default async function TransparencyPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <TransparencyClient slug={slug}/>}
