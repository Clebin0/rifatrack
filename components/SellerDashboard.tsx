"use client";
import Loading from "@/app/loading";
import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useUI } from "./ui/UIProvider";
import SellerCampaignCard from "./SellerCampaignCard";
import Input from "./ui/Input";
import { LogOut, RefreshCw, Target, Ticket, Users, WalletCards } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureMfa } from "@/lib/mfa-browser";

type Campaign = {
  id: string;
  name: string;
  slug: string;
  status: string;
  price_cents: number;
  total_numbers: number;
  goal: number;
  active: boolean;
  sold_numbers: number;
  revenue_cents: number;
  created_at: string;
};
type Order = {
  id: string;
  public_token: string;
  buyer_name: string;
  buyer_phone: string;
  status: string;
  amount_cents: number;
  payment_reference: string;
  created_at: string;
  provider_paid_at: string | null;
  campaign_name: string;
  campaign_slug: string;
  numbers: number[];
};
type Data = {
  seller: { id: string; name: string; code: string; team: string; whatsapp: string; email: string };
  summary: { sold_numbers: number; revenue_cents: number; pending_orders: number; buyers: number };
  campaigns: Campaign[];
  orders: Order[];
};
const money = (v: number) => "R$ " + (v / 100).toFixed(2).replace(".", ",");

export default function SellerDashboard() {
  const { toast } = useUI();
  const sb = () => supabaseBrowser();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState(false);
  const [code, setCode] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (message) toast(message);
  }, [message, toast]);
  const [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    setMessage("");
    if (!(await ensureMfa("vendedor", "/vendedor"))) {
      setLoading(false);
      return;
    }
    const { data: userData } = await sb().auth.getUser();
    setAccountEmail(userData.user?.email || "");
    const { data: d, error } = await sb().rpc("seller_dashboard");
    if (error) {
      setClaim(error.message.includes("seller access required"));
      if (!error.message.includes("seller access required")) {
        setMessage(
          "Não foi possível carregar o portal. Tente novamente; seu convite não precisa ser refeito por uma falha de conexão.",
        );
      }
      setData(null);
    } else {
      setClaim(false);
      setData(d as Data);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function claimAccess(e: FormEvent) {
    e.preventDefault();
    const pastedCode = code.toUpperCase().match(/SV-[A-Z0-9_-]+/)?.[0] || code.trim().toUpperCase();
    const { error } = await sb().rpc("claim_seller_access", { p_code: pastedCode });
    if (error) {
      const detail = error.message?.includes("mfa_required")
        ? "Ative a autenticação em duas etapas antes de vincular o portal."
        : "Código inválido, expirado ou criado para outro e-mail.";
      setMessage(detail);
    } else {
      setMessage("Acesso ativado.");
      await load();
    }
  }
  function link(c: Campaign) {
    return (
      location.origin + "/campanha/" + c.slug + "?vendedor=" + encodeURIComponent(data!.seller.code)
    );
  }
  async function copy(c: Campaign) {
    await navigator.clipboard.writeText(link(c));
    setMessage("Link copiado.");
  }
  async function downloadQr(c: Campaign) {
    const src = await QRCode.toDataURL(link(c), {
      width: 900,
      margin: 3,
      errorCorrectionLevel: "H",
    });
    const a = document.createElement("a");
    a.href = src;
    a.download = ("rifatrack-" + c.slug + "-" + data!.seller.code + ".png").toLowerCase();
    a.click();
  }
  async function logout() {
    await sb().auth.signOut();
    location.href = "/vendedor/login";
  }
  const orders = useMemo(
    () =>
      data?.orders.filter((o) =>
        [o.buyer_name, o.buyer_phone, o.payment_reference, o.campaign_name]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) || [],
    [data, search],
  );
  if (loading) return <Loading />;
  if (claim)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
        <form
          onSubmit={claimAccess}
          className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6"
        >
          <h1 className="text-2xl font-black">Vincular acesso de vendedor</h1>
          <p className="text-sm text-zinc-500 mt-2">
            Cole o código individual criado pelo administrador. Você também pode colar a mensagem
            inteira do convite; o portal identifica automaticamente o trecho <b>SV-...</b>.
          </p>
          {accountEmail && (
            <p className="text-xs text-zinc-400 mt-3 rounded-xl bg-zinc-950 border border-zinc-800 p-3">
              Conta conectada: <b>{accountEmail}</b>. O convite precisa ter sido criado para este
              mesmo e-mail.
            </p>
          )}
          <Input
            label="Código de acesso do vendedor"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SV-..."
            className="w-full mt-5 bg-zinc-950 border border-zinc-700 rounded-xl p-3"
          />
          <button className="w-full mt-3 bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black">
            Ativar portal
          </button>
          {message && <p className="text-sm mt-3">{message}</p>}
          <p className="text-xs text-zinc-500 mt-4">
            Sem código? Entre no painel administrativo, abra Vendedores e use <b>Acesso</b> para
            gerar um convite para o e-mail acima.
          </p>
        </form>
      </main>
    );
  if (!data)
    return (
      <main className="min-h-screen grid place-items-center p-5">
        <section className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold">Portal do vendedor</h1>
          <p role="alert">{message || "Não foi possível carregar suas vendas."}</p>
          <button className="ui-button" onClick={load}>
            Tentar novamente
          </button>
          <button className="ui-button" onClick={logout}>
            Trocar de conta
          </button>
        </section>
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center">
          <div>
            <b className="text-xl">
              Rifa<span className="text-emerald-400">Track</span>
            </b>
            <span className="ml-3 text-sm text-zinc-500 hidden sm:inline">Portal do vendedor</span>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Atualizar vendas"
              onClick={load}
              className="p-2 bg-zinc-900 rounded-xl border border-zinc-800"
            >
              <RefreshCw size={18} />
            </button>
            <button
              aria-label="Sair do portal"
              onClick={logout}
              className="p-2 bg-zinc-900 rounded-xl border border-zinc-800"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-emerald-400 text-sm font-bold">VENDEDOR</p>
          <h1 className="text-4xl font-black mt-1">{data.seller.name}</h1>
          <p className="text-zinc-500 mt-1">
            {data.seller.code}
            {data.seller.team ? " · " + data.seller.team : ""} · {data.seller.email}
          </p>
        </div>
        {message && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">{message}</div>
        )}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            [<Ticket key="a" />, data.summary.sold_numbers, "Números pagos"],
            [<WalletCards key="b" />, money(data.summary.revenue_cents), "Arrecadado"],
            [<Target key="c" />, data.summary.pending_orders, "Pedidos pendentes"],
            [<Users key="d" />, data.summary.buyers, "Compradores"],
          ].map(([i, v, l]) => (
            <div key={String(l)} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-zinc-500">{i}</div>
              <p className="text-3xl font-black mt-4">{v}</p>
              <p className="text-zinc-500 text-sm">{l}</p>
            </div>
          ))}
        </section>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Minhas campanhas</h2>
          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            {data.campaigns.map((c) => (
              <SellerCampaignCard
                key={c.id}
                campaign={c}
                code={data.seller.code}
                onCopy={() => copy(c)}
                onDownload={() => downloadQr(c)}
              />
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Minhas vendas</h2>
              <p className="text-sm text-zinc-500">Somente pedidos atribuídos ao seu código.</p>
            </div>
            <Input
              label="Buscar pedido ou comprador"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido ou comprador"
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
            />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">Pedido</th>
                  <th>Comprador</th>
                  <th>Campanha</th>
                  <th>Números</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-zinc-800">
                    <td className="py-4 font-mono text-xs">{o.payment_reference}</td>
                    <td>
                      <b>{o.buyer_name}</b>
                      <div className="text-xs text-zinc-500">{o.buyer_phone}</div>
                    </td>
                    <td>{o.campaign_name}</td>
                    <td className="max-w-[220px]">{o.numbers.join(", ")}</td>
                    <td>{money(o.amount_cents)}</td>
                    <td>
                      <span
                        className={
                          "px-2 py-1 rounded-full text-xs " +
                          (o.status === "paid"
                            ? "bg-emerald-950 text-emerald-300"
                            : o.status === "pending"
                              ? "bg-amber-950 text-amber-300"
                              : "bg-zinc-800 text-zinc-400")
                        }
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && (
              <p className="text-sm text-zinc-500 py-8 text-center">Nenhum pedido encontrado.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
