"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
type Data = {
  campaign_name: string;
  eligible_numbers: number[];
  eligible_count: number;
  paid_list_hash: string;
  seed_commitment: string;
  drawn: boolean;
  number: number | null;
  method: string;
  seed_reveal: string | null;
  drand_round: number | null;
  drand_chain_hash: string | null;
  drand_randomness: string | null;
  drand_signature: string | null;
};
type Verification = {
  list: boolean;
  commitment: boolean;
  signature: boolean | null;
  winner: boolean | null;
  computed: number | null;
};
const panel = "mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5";
export default function TransparencyClient({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [verification, setVerification] = useState<Verification | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setVerification(null);
    setError("");
    fetch(`/api/campaigns/${encodeURIComponent(slug)}/transparency`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Transparência indisponível.");
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);
  useEffect(() => {
    let active = true;
    if (!data) return;
    (async () => {
      const { QUICKNET, sha256, verifyDrandBeacon, winningNumber } = await import("@/lib/drand");
      const list =
        data.eligible_count === data.eligible_numbers.length &&
        (await sha256(data.eligible_numbers.join(","))) === data.paid_list_hash;
      let commitment = false,
        signature: boolean | null = null,
        computed: number | null = null;
      if (data.method === "drand_quicknet_v2") {
        commitment =
          data.drand_chain_hash === QUICKNET.hash &&
          (await sha256(`${data.drand_chain_hash}:${data.drand_round}:${data.paid_list_hash}`)) ===
            data.seed_commitment;
        if (data.drawn) {
          try {
            await verifyDrandBeacon(
              {
                round: data.drand_round,
                randomness: data.drand_randomness,
                signature: data.drand_signature,
              },
              data.drand_round!,
            );
            signature = true;
            computed = await winningNumber(
              data.drand_randomness!,
              data.paid_list_hash,
              data.eligible_numbers,
            );
          } catch {
            signature = false;
          }
        }
      } else if (data.seed_reveal) {
        commitment =
          (await sha256(`${data.seed_reveal}:${data.paid_list_hash}`)) === data.seed_commitment;
        computed = await winningNumber(
          data.seed_reveal,
          data.paid_list_hash,
          data.eligible_numbers,
          1,
        );
      }
      if (active)
        setVerification({
          list,
          commitment,
          signature,
          winner: data.drawn ? computed === data.number : null,
          computed,
        });
    })().catch(() => {
      if (active) setError("Não foi possível verificar as provas.");
    });
    return () => {
      active = false;
    };
  }, [data]);
  if (loading)
    return (
      <main className="min-h-screen grid place-items-center">
        <RefreshCw aria-label="Carregando" className="animate-spin" />
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <a href={`/campanha/${slug}`} className="text-emerald-300">
          ← Voltar à campanha
        </a>
        <h1 className="text-3xl font-black mt-5">Transparência {data?.campaign_name}</h1>
        {error && (
          <p role="alert" className="text-amber-300 mt-5">
            {error}
          </p>
        )}
        {data && (
          <>
            <p className="mt-5 text-zinc-300">
              A lista de números pagos foi congelada no encerramento.{" "}
              {data.method === "drand_quicknet_v2"
                ? "Uma rodada futura da rede drand quicknet fornece a aleatoriedade. A assinatura e o resultado são verificados neste navegador."
                : "Este registro anterior utiliza compromisso e revelação de uma semente do sistema."}
            </p>
            <section className={panel}>
              <h2 className="text-xl font-bold">Resultado</h2>
              <p className="mt-3">
                {data.drawn
                  ? `Número ${String(data.number).padStart(3, "0")}`
                  : "Aguardando sorteio"}{" "}
                · {data.eligible_count} elegíveis
              </p>
              {data.drand_round && <p>Rodada fixada: {data.drand_round}</p>}
            </section>
            <section className={panel}>
              <h2 className="text-xl font-bold">Provas públicas</h2>
              {[
                ["Hash da lista", data.paid_list_hash],
                ["Compromisso", data.seed_commitment],
                ["Aleatoriedade", data.drand_randomness || data.seed_reveal],
                ["Assinatura drand", data.drand_signature],
              ].map(([label, value]) => (
                <div key={label} className="mt-4">
                  <p className="text-zinc-300 text-sm">{label}</p>
                  <code className="block break-all text-xs mt-2">
                    {value || "Aguardando publicação"}
                  </code>
                </div>
              ))}
            </section>
            <section className={panel}>
              <h2 className="text-xl font-bold">Verificação local</h2>
              {verification ? (
                <ul className="mt-3 space-y-2">
                  {[
                    ["Lista íntegra", verification.list],
                    ["Compromisso válido", verification.commitment],
                    ["Assinatura externa", verification.signature],
                    ["Resultado reproduzível", verification.winner],
                  ].map(([label, ok]) => (
                    <li
                      key={String(label)}
                      className={ok === false ? "text-rose-300" : "text-zinc-200"}
                    >
                      {label}:{" "}
                      {ok === null ? "aguardando ou não aplicável" : ok ? "validado" : "falhou"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Verificando…</p>
              )}
            </section>
            <section className={panel}>
              <h2 className="text-xl font-bold">Números elegíveis congelados</h2>
              <p className="mt-3 break-words font-mono text-sm">
                {data.eligible_numbers.map((n) => String(n).padStart(3, "0")).join(", ")}
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
