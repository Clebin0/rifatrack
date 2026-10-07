"use client";
import AdminPayerDetails from "./AdminPayerDetails";
import { useUI } from "@/components/ui/UIProvider";
import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Ticket,
  Users,
  WalletCards,
  Trophy,
  ShieldCheck,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureMfa, ensureSession, getMfaLevel } from "@/lib/mfa-browser";

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  total_numbers: number;
  status: "draft" | "active" | "closed";
  pix_key: string;
  pix_receiver: string;
  ends_at: string | null;
  deadline_reached: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  sold_numbers: number;
  reserved_numbers: number;
  revenue_cents: number;
  created_at: string;
  draw_number: number | null;
  drawn_at: string | null;
};
type Seller = {
  campaign_id: string;
  campaign_name: string;
  campaign_slug: string;
  id: string;
  name: string;
  code: string;
  team: string;
  whatsapp: string;
  goal: number;
  active: boolean;
  sold_numbers: number;
  revenue_cents: number;
};
type Order = {
  id: string;
  public_token: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  status: string;
  amount_cents: number;
  payment_reference: string;
  pix_txid: string;
  expires_at: string;
  created_at: string;
  campaign_name: string;
  campaign_slug: string;
  seller_name: string | null;
  proof_path: string | null;
  proof_status: "none" | "submitted" | "approved" | "rejected";
  proof_uploaded_at: string | null;
  payment_provider: string;
  provider_qr_id: string | null;
  provider_payment_id: string | null;
  provider_status: string | null;
  provider_paid_at: string | null;
  provider_net_value_cents: number | null;
  pix_transaction_id: string | null;
  numbers: number[];
};
type AdminRole = "owner" | "admin" | "financeiro" | "operador" | "auditor";
type Dashboard = {
  admin_email: string;
  admin_role: AdminRole;
  summary: {
    campaigns: number;
    active_campaigns: number;
    paid_revenue_cents: number;
    pending_orders: number;
    payment_alerts: number;
  };
  campaigns: Campaign[];
  sellers: Seller[];
  orders: Order[];
};

const money = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const input =
  "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500";
const panel = "bg-zinc-900 border border-zinc-800 rounded-3xl p-5";
const toDateTimeLocal = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function AdminClient() {
  const { confirm, form, toast } = useUI();
  const getSb = () => supabaseBrowser();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [setupCode, setSetupCode] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (message) toast(message);
  }, [message, toast]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [paymentHealth, setPaymentHealth] = useState<{
    provider: string;
    environment: string;
    configured: boolean;
    automatic: boolean;
  } | null>(null);
  const [mfaReady, setMfaReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: "5.00",
    total: "400",
    pix_key: "",
    pix_receiver: "",
    ends_at: "",
  });
  const [sellerForm, setSellerForm] = useState({
    campaign_id: "",
    name: "",
    code: "",
    team: "",
    whatsapp: "",
    goal: "30",
  });
  const [edit, setEdit] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    pix_key: "",
    pix_receiver: "",
    ends_at: "",
  });

  async function load() {
    setLoading(true);
    setMessage("");
    if (!(await ensureSession("admin", "/admin"))) {
      setLoading(false);
      return;
    }
    const { data: sessionData } = await getSb().auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      fetch("/api/integrations/payment-status", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + accessToken },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(setPaymentHealth)
        .catch(() => setPaymentHealth(null));
    } else {
      setPaymentHealth(null);
    }
    setMfaReady((await getMfaLevel()) === "aal2");
    const { data: userData } = await getSb().auth.getUser();
    setSessionEmail(userData.user?.email || "");
    const { data: dashboard, error } = await getSb().rpc("admin_dashboard");
    if (error) {
      setUnauthorized(true);
      setData(null);
    } else {
      const d = dashboard as Dashboard;
      setData(d);
      setUnauthorized(false);
      if (!sellerForm.campaign_id && d.campaigns[0])
        setSellerForm((x) => ({ ...x, campaign_id: d.campaigns[0].id }));
      if (!edit.id && d.campaigns[0])
        setEdit({
          id: d.campaigns[0].id,
          name: d.campaigns[0].name,
          description: d.campaigns[0].description,
          price: (d.campaigns[0].price_cents / 100).toFixed(2),
          pix_key: d.campaigns[0].pix_key,
          pix_receiver: d.campaigns[0].pix_receiver,
          ends_at: toDateTimeLocal(d.campaigns[0].ends_at),
        });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function requireWriteMfa() {
    if (await ensureMfa("admin", "/admin")) return true;
    setLoading(false);
    return false;
  }

  async function claimAdmin(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!(await requireWriteMfa())) return;
    const first = await getSb().rpc("claim_first_admin", { p_code: setupCode });
    if (!first.error) {
      setMessage("Administrador proprietário ativado.");
      await load();
      return;
    }
    const invite = await getSb().rpc("claim_admin_invite", { p_code: setupCode });
    if (invite.error) setMessage("Código inválido, expirado ou vinculado a outro e-mail.");
    else {
      setMessage("Acesso administrativo ativado.");
      await load();
    }
  }

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_create_campaign", {
      p_name: campaignForm.name,
      p_slug: campaignForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      p_description: campaignForm.description,
      p_price_cents: Math.round(Number(campaignForm.price.replace(",", ".")) * 100),
      p_total_numbers: Number(campaignForm.total),
      p_pix_key: campaignForm.pix_key,
      p_pix_receiver: campaignForm.pix_receiver,
      p_ends_at: campaignForm.ends_at ? new Date(campaignForm.ends_at).toISOString() : undefined,
    });
    if (error) setMessage("Não foi possível criar a campanha: " + error.message);
    else {
      setCampaignForm({
        name: "",
        slug: "",
        description: "",
        price: "5.00",
        total: "400",
        pix_key: "",
        pix_receiver: "",
        ends_at: "",
      });
      setMessage("Campanha criada em rascunho.");
      await load();
    }
  }

  async function saveCampaign(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_update_campaign", {
      p_id: edit.id,
      p_name: edit.name,
      p_description: edit.description,
      p_price_cents: Math.round(Number(edit.price.replace(",", ".")) * 100),
      p_pix_key: edit.pix_key,
      p_pix_receiver: edit.pix_receiver,
      p_ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : undefined,
    });
    if (error) setMessage("Falha ao salvar campanha.");
    else {
      setMessage("Campanha atualizada.");
      await load();
    }
  }

  async function statusCampaign(id: string, status: "draft" | "active") {
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_set_campaign_status", {
      p_id: id,
      p_status: status,
    });
    if (error) {
      const msg = error.message || "";
      setMessage(
        msg.includes("deadline required")
          ? "Defina o prazo final antes de ativar a campanha."
          : msg.includes("deadline reached")
            ? "O prazo desta campanha já terminou. Ajuste a data antes de ativar."
            : "Falha ao alterar status.",
      );
    } else await load();
  }

  async function finalizeCampaign(campaign: Campaign) {
    if (!(await requireWriteMfa())) return;
    const pending =
      data?.orders.filter((o) => o.campaign_slug === campaign.slug && o.status === "pending")
        .length || 0;
    const warning =
      pending > 0
        ? "\n\nExistem " +
          pending +
          " pedido(s) pendente(s). Eles precisam expirar ou ser resolvidos antes da finalização."
        : "";
    if (
      !(await confirm(
        'Finalizar a campanha "' +
          campaign.name +
          '"?\n\nIsso encerra definitivamente novas vendas, congela os números pagos e prepara a campanha para o sorteio.' +
          warning,
      ))
    )
      return;
    const { error } = await getSb().rpc("admin_set_campaign_status", {
      p_id: campaign.id,
      p_status: "closed",
    });
    if (error) {
      const msg = error.message || "";
      setMessage(
        msg.includes("pending orders exist")
          ? "Ainda existem pedidos pendentes. Aguarde a expiração ou resolva-os antes de finalizar."
          : "Não foi possível finalizar a campanha: " + msg,
      );
    } else {
      setMessage(
        "Campanha finalizada. As vendas foram encerradas e a lista de números pagos foi congelada.",
      );
      await load();
    }
  }

  async function drawCampaign(id: string, name: string) {
    if (!(await requireWriteMfa())) return;
    if (
      !(await confirm(
        `Sortear agora a campanha "${name}"? O resultado ficará registrado e não poderá ser refeito.`,
      ))
    )
      return;
    const { data: session } = await getSb().auth.getSession();
    const response = await fetch("/api/admin/draw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (session.session?.access_token || ""),
      },
      body: JSON.stringify({ campaignId: id }),
    }).catch(() => null);
    if (!response) {
      setMessage("Não foi possível conectar ao serviço do sorteio. Tente novamente.");
      return;
    }
    const result = await response.json();
    const error = response.ok ? null : { message: result.error || "Sorteio indisponível" };
    if (error) {
      setMessage("Não foi possível realizar o sorteio: " + error.message);
      return;
    }
    const number = (result as { number?: number } | null)?.number;
    setMessage(
      number ? "Número sorteado: " + String(number).padStart(3, "0") : "Sorteio concluído.",
    );
    await load();
  }

  async function createSeller(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_create_seller_v2", {
      p_campaign_id: sellerForm.campaign_id,
      p_name: sellerForm.name,
      p_code: sellerForm.code,
      p_team: sellerForm.team,
      p_goal: Number(sellerForm.goal),
      p_whatsapp: sellerForm.whatsapp,
    });
    if (error) setMessage("Não foi possível cadastrar o vendedor: " + error.message);
    else {
      setSellerForm((x) => ({ ...x, name: "", code: "", team: "", whatsapp: "", goal: "30" }));
      setMessage("Vendedor cadastrado.");
      await load();
    }
  }

  async function editSeller(s: Seller) {
    if (!(await requireWriteMfa())) return;
    const fields = await form("Editar vendedor", [
      { key: "name", label: "Nome do vendedor", value: s.name, required: true },
      { key: "team", label: "Equipe / grupo", value: s.team || "" },
      { key: "whatsapp", label: "WhatsApp", type: "tel", value: s.whatsapp || "" },
    ]);
    if (!fields) return;
    const { name, team, whatsapp } = fields;
    const { error } = await getSb().rpc("admin_update_seller", {
      p_seller_id: s.id,
      p_name: name,
      p_team: team || "",
      p_whatsapp: whatsapp || "",
    });
    if (error) setMessage("Não foi possível atualizar o vendedor.");
    else {
      setMessage("Vendedor atualizado.");
      await load();
    }
  }

  async function inviteSeller(s: Seller) {
    if (!(await requireWriteMfa())) return;
    const fields = await form("Convidar vendedor", [
      { key: "email", label: "E-mail de acesso ao portal", type: "email", required: true },
    ]);
    if (!fields) return;
    const email = fields.email;
    const { data: invite, error } = await getSb().rpc("admin_create_seller_invite", {
      p_seller_id: s.id,
      p_email: email.trim(),
    });
    if (error) {
      setMessage("Não foi possível gerar o acesso: " + error.message);
      return;
    }
    const info = invite as { code: string; expires_at: string; email: string };
    const text = `Acesso RifaTrack para ${s.name}\nPortal: ${location.origin}/vendedor/login\nE-mail: ${info.email}\nCódigo: ${info.code}\nExpira: ${new Date(info.expires_at).toLocaleString("pt-BR")}`;
    await navigator.clipboard.writeText(text);
    setMessage("Convite criado e copiado. O código é de uso único.");
  }

  async function duplicateCampaign(campaign: Campaign) {
    if (!(await requireWriteMfa())) return;
    const fields = await form("Duplicar campanha", [
      {
        key: "name",
        label: "Nome da nova campanha",
        value: campaign.name + " - cópia",
        required: true,
      },
      {
        key: "slug",
        label: "Endereço da nova campanha",
        value: campaign.slug + "-copia",
        required: true,
      },
    ]);
    if (!fields) return;
    const { name, slug } = fields;
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { error } = await getSb().rpc("admin_duplicate_campaign", {
      p_id: campaign.id,
      p_name: name,
      p_slug: clean,
    });
    if (error) setMessage("Não foi possível duplicar: " + error.message);
    else {
      setMessage("Campanha duplicada em rascunho.");
      await load();
    }
  }

  async function importSellers(file: File) {
    if (!(await requireWriteMfa())) return;
    const text = await file.text();
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2) {
      setMessage("CSV sem dados.");
      return;
    }
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map((x) => x.trim().toLowerCase().replace(/"/g, ""));
    const value = (parts: string[], name: string) => {
      const i = headers.indexOf(name);
      return i >= 0 ? (parts[i] || "").replace(/^"|"$/g, "").trim() : "";
    };
    const rows = lines
      .slice(1, 501)
      .map((line) => {
        const parts = line.split(sep);
        return {
          name: value(parts, "nome") || value(parts, "name"),
          code: value(parts, "codigo") || value(parts, "code"),
          team: value(parts, "equipe") || value(parts, "team"),
          whatsapp: value(parts, "whatsapp") || value(parts, "telefone"),
          goal: Number(value(parts, "meta") || value(parts, "goal") || 30),
        };
      })
      .filter((x) => x.name && x.code);
    if (!rows.length) {
      setMessage("Use colunas nome;codigo;equipe;whatsapp;meta.");
      return;
    }
    const campaignId = sellerForm.campaign_id || data?.campaigns[0]?.id;
    if (!campaignId) return;
    const { data: count, error } = await getSb().rpc("admin_bulk_sellers", {
      p_campaign_id: campaignId,
      p_rows: rows,
    });
    if (error) setMessage("Falha na importação: " + error.message);
    else {
      setMessage(String(count) + " vendedores importados/atualizados.");
      await load();
    }
  }

  async function toggleSeller(s: Seller) {
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_set_seller_active", {
      p_campaign_id: s.campaign_id,
      p_seller_id: s.id,
      p_active: !s.active,
    });
    if (error) setMessage("Falha ao alterar vendedor.");
    else await load();
  }

  async function orderStatus(id: string, status: "paid" | "cancelled") {
    if (!(await requireWriteMfa())) return;
    if (status === "paid" && !(await confirm("Confirmar recebimento do pagamento deste pedido?")))
      return;
    const { error } = await getSb().rpc("admin_set_order_status", {
      p_order_id: id,
      p_status: status,
    });
    if (error) setMessage("Não foi possível alterar o pedido. A reserva pode ter expirado.");
    else await load();
  }

  async function openProof(o: Order) {
    if (!o.proof_path) return;
    const { data, error } = await getSb()
      .storage.from("payment-proofs")
      .createSignedUrl(o.proof_path, 120);
    if (error || !data?.signedUrl) {
      setMessage("Não foi possível abrir o comprovante.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function setProofStatus(o: Order, status: "approved" | "rejected") {
    if (!(await requireWriteMfa())) return;
    const { error } = await getSb().rpc("admin_set_proof_status", {
      p_order_id: o.id,
      p_status: status,
    });
    if (error) setMessage("Não foi possível atualizar o comprovante.");
    else await load();
  }

  function sellerLink(s: Seller) {
    return (
      location.origin + "/campanha/" + s.campaign_slug + "?vendedor=" + encodeURIComponent(s.code)
    );
  }
  async function copyLink(s: Seller) {
    await navigator.clipboard.writeText(sellerLink(s));
    setMessage("Link copiado.");
  }
  async function qr(s: Seller) {
    const url = await QRCode.toDataURL(sellerLink(s), {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "H",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = ("qrcode-" + s.code + ".png").toLowerCase();
    a.click();
  }

  async function exportOrders() {
    if (!data) return;
    const columns = [
      "Pedido",
      "Campanha",
      "Comprador",
      "Telefone",
      "Email",
      "Vendedor",
      "Status",
      "Meio",
      "AsaasPaymentId",
      "PixTransactionId",
      "StatusProvedor",
      "Comprovante",
      "Valor",
      "Liquido",
      "Numeros",
      "PagoEm",
      "Criado",
    ];
    const escapeCsv = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const rows = filtered.map((o) => [
      o.payment_reference,
      o.campaign_name,
      o.buyer_name,
      o.buyer_phone,
      o.buyer_email,
      o.seller_name || "Direto",
      o.status,
      o.payment_provider,
      o.provider_payment_id || "",
      o.pix_transaction_id || "",
      o.provider_status || "",
      o.proof_status,
      money(o.amount_cents),
      o.provider_net_value_cents == null ? "" : money(o.provider_net_value_cents),
      o.numbers.join(", "),
      o.provider_paid_at ? new Date(o.provider_paid_at).toLocaleString("pt-BR") : "",
      new Date(o.created_at).toLocaleString("pt-BR"),
    ]);
    const csv =
      "\uFEFF" + [columns, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rifatrack-pedidos.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await getSb().auth.signOut();
    location.href = "/admin/login";
  }
  const filtered = useMemo(
    () =>
      data?.orders.filter((o) => {
        const text = [
          o.buyer_name,
          o.buyer_phone,
          o.buyer_email,
          o.payment_reference,
          o.seller_name || "",
          o.provider_payment_id || "",
        ]
          .join(" ")
          .toLowerCase();
        return (
          text.includes(search.toLowerCase()) &&
          (!statusFilter || o.status === statusFilter) &&
          (!campaignFilter || o.campaign_slug === campaignFilter) &&
          (!sellerFilter || (o.seller_name || "Direto") === sellerFilter)
        );
      }) || [],
    [data, search, statusFilter, campaignFilter, sellerFilter],
  );

  if (loading)
    return (
      <main className="min-h-screen grid place-items-center">
        <RefreshCw className="animate-spin" />
      </main>
    );
  if (unauthorized)
    return (
      <main className="min-h-screen grid place-items-center p-5">
        <form onSubmit={claimAdmin} className={panel + " w-full max-w-md"}>
          <h1 className="text-2xl font-black">Conta sem acesso administrativo</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Você está autenticado como{" "}
            <b className="text-zinc-200">{sessionEmail || "outra conta"}</b>, mas esse e-mail não
            possui perfil administrativo ativo.
          </p>
          <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">
            O código de implantação inicial já foi utilizado. Use este campo apenas se você recebeu
            um convite administrativo válido do proprietário.
          </div>
          <input
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            placeholder="Código de convite administrativo"
            className={input + " mt-5"}
          />
          <button className="w-full mt-3 p-3 rounded-xl bg-emerald-400 text-emerald-950 font-black">
            Ativar com convite
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full mt-2 p-3 rounded-xl bg-zinc-800 text-zinc-200 font-bold"
          >
            Sair e entrar com outro e-mail
          </button>
          {message && <p className="text-sm mt-3">{message}</p>}
        </form>
      </main>
    );
  if (!data) return null;

  function pickEdit(id: string) {
    const c = data!.campaigns.find((x) => x.id === id);
    if (c)
      setEdit({
        id: c.id,
        name: c.name,
        description: c.description,
        price: (c.price_cents / 100).toFixed(2),
        pix_key: c.pix_key,
        pix_receiver: c.pix_receiver,
        ends_at: toDateTimeLocal(c.ends_at),
      });
  }
  const role = data.admin_role;
  const canCampaignWrite = role === "owner" || role === "admin";
  const canOperate = role === "owner" || role === "admin" || role === "operador";
  const canDraw = role === "owner" || role === "admin";
  const canFinanceWrite = ["owner", "admin", "financeiro"].includes(role);
  const canAudit = ["owner", "admin", "auditor"].includes(role);
  const isOwner = role === "owner";
  const canFinanceRead =
    role === "owner" || role === "admin" || role === "financeiro" || role === "auditor";

  return (
    <main className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-20">
        <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center gap-3">
          <div>
            <span className="font-black text-xl">
              Rifa<span className="text-emerald-400">Track</span>
            </span>
            <span className="text-zinc-600 text-sm ml-3 hidden sm:inline">
              {data.admin_email} · {data.admin_role}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={load} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <RefreshCw size={18} />
            </button>
            <button onClick={logout} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-emerald-400 text-sm font-semibold">PAINEL ADMINISTRATIVO</p>
          <h1 className="text-4xl font-black mt-1">Visão geral</h1>
        </div>
        {message && (
          <div className="border border-zinc-700 bg-zinc-900 rounded-xl p-3 text-sm">{message}</div>
        )}
        {paymentHealth && (
          <div
            className={
              "rounded-2xl border p-4 text-sm " +
              (paymentHealth.automatic
                ? "border-emerald-800 bg-emerald-950/30"
                : "border-amber-800 bg-amber-950/20")
            }
          >
            <b>Pagamentos:</b>{" "}
            {paymentHealth.automatic ? "Pix automático ativo" : "Pix manual ativo"} · provedor{" "}
            {paymentHealth.provider}
            {paymentHealth.provider === "asaas" ? " · " + paymentHealth.environment : ""}
            {!paymentHealth.configured && (
              <span className="text-amber-300"> · integração incompleta</span>
            )}
          </div>
        )}
        {!mfaReady && (
          <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-100">
            <b>MFA pendente.</b> O painel pode ser consultado normalmente. Para ações
            administrativas,{" "}
            <a href="/admin/seguranca?return=%2Fadmin" className="underline font-bold">
              configure o autenticador
            </a>
            .
          </div>
        )}
        <div className="md:hidden grid grid-cols-2 gap-2">
          {canCampaignWrite && (
            <a
              href="/admin/nova-campanha"
              className="rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-900 p-3 text-sm font-bold"
            >
              Nova campanha
            </a>
          )}
          <a
            href="/admin/pedidos"
            className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
          >
            Pedidos
          </a>
          {canFinanceWrite && (
            <a
              href="/admin/vendas-manuais"
              className="rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-900 p-3 text-sm"
            >
              Vendas manuais
            </a>
          )}
          {canFinanceRead && (
            <a
              href="/admin/financeiro"
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
            >
              Financeiro
            </a>
          )}
          {canAudit && (
            <a
              href="/admin/auditoria"
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
            >
              Auditoria
            </a>
          )}
          <a
            href="/admin/notificacoes"
            className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
          >
            Notificações
          </a>
          {canOperate && (
            <a
              href="/admin/qrs"
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
            >
              QR Codes
            </a>
          )}
          {isOwner && (
            <a
              href="/admin/equipe"
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
            >
              Equipe
            </a>
          )}
          {isOwner && (
            <a
              href="/admin/backup"
              className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
            >
              Backup
            </a>
          )}
          <a
            href="/admin/seguranca"
            className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm"
          >
            Segurança / MFA
          </a>
        </div>

        <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            ["Receita confirmada", money(data.summary.paid_revenue_cents), <WalletCards key="a" />],
            ["Pedidos pendentes", String(data.summary.pending_orders), <Ticket key="b" />],
            ["Campanhas ativas", String(data.summary.active_campaigns), <RefreshCw key="c" />],
            ["Vendedores", String(data.sellers.filter((s) => s.active).length), <Users key="d" />],
            ["Alertas financeiros", String(data.summary.payment_alerts), <ShieldCheck key="e" />],
          ].map(([label, value, icon]) => (
            <div key={String(label)} className={panel}>
              <div className="text-zinc-500">{icon}</div>
              <p className="text-zinc-500 text-sm mt-4">{label}</p>
              <p className="text-3xl font-black mt-1">{value}</p>
            </div>
          ))}
        </section>

        {canCampaignWrite && (
          <section className="grid xl:grid-cols-2 gap-5">
            <form onSubmit={createCampaign} className={panel + " space-y-3"}>
              <h2 className="text-xl font-black flex gap-2 items-center">
                <Plus size={20} /> Nova campanha
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Nome"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className={input}
                />
                <input
                  required
                  placeholder="slug-exemplo"
                  value={campaignForm.slug}
                  onChange={(e) => setCampaignForm({ ...campaignForm, slug: e.target.value })}
                  className={input}
                />
              </div>
              <textarea
                placeholder="Descrição"
                value={campaignForm.description}
                onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                className={input}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Preço"
                  value={campaignForm.price}
                  onChange={(e) => setCampaignForm({ ...campaignForm, price: e.target.value })}
                  className={input}
                />
                <input
                  required
                  type="number"
                  min="1"
                  max="100000"
                  placeholder="Quantidade de números"
                  value={campaignForm.total}
                  onChange={(e) => setCampaignForm({ ...campaignForm, total: e.target.value })}
                  className={input}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  placeholder="Chave Pix"
                  value={campaignForm.pix_key}
                  onChange={(e) => setCampaignForm({ ...campaignForm, pix_key: e.target.value })}
                  className={input}
                />
                <input
                  placeholder="Recebedor Pix"
                  value={campaignForm.pix_receiver}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, pix_receiver: e.target.value })
                  }
                  className={input}
                />
              </div>
              <label className="block">
                <span className="text-xs text-zinc-500">Prazo final da campanha</span>
                <input
                  required
                  type="datetime-local"
                  value={campaignForm.ends_at}
                  onChange={(e) => setCampaignForm({ ...campaignForm, ends_at: e.target.value })}
                  className={input + " mt-1"}
                />
              </label>
              <button className="bg-white text-black rounded-xl px-4 py-3 font-bold">
                Criar campanha
              </button>
            </form>

            <form onSubmit={saveCampaign} className={panel + " space-y-3"}>
              <h2 className="text-xl font-black">Configurar campanha</h2>
              <select value={edit.id} onChange={(e) => pickEdit(e.target.value)} className={input}>
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className={input}
              />
              <textarea
                placeholder="Descrição"
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                className={input}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={edit.price}
                  onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                  className={input}
                />
                <input
                  placeholder="Chave Pix"
                  value={edit.pix_key}
                  onChange={(e) => setEdit({ ...edit, pix_key: e.target.value })}
                  className={input}
                />
              </div>
              <input
                placeholder="Recebedor Pix"
                value={edit.pix_receiver}
                onChange={(e) => setEdit({ ...edit, pix_receiver: e.target.value })}
                className={input}
              />
              <label className="block">
                <span className="text-xs text-zinc-500">Prazo final da campanha</span>
                <input
                  required
                  type="datetime-local"
                  value={edit.ends_at}
                  onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })}
                  className={input + " mt-1"}
                />
              </label>
              <button className="bg-emerald-400 text-emerald-950 rounded-xl px-4 py-3 font-black">
                Salvar configurações
              </button>
            </form>
          </section>
        )}

        <section className={panel}>
          <h2 className="text-xl font-black mb-4">Campanhas</h2>
          <div className="grid lg:grid-cols-2 gap-3">
            {data.campaigns.map((c) => (
              <div key={c.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <p className="text-xs text-zinc-500">
                      /{c.slug} · {c.status}
                    </p>
                  </div>
                  <strong>{money(c.revenue_cents)}</strong>
                </div>
                <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: Math.round((c.sold_numbers / c.total_numbers) * 100) + "%" }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {c.sold_numbers} pagos · {c.reserved_numbers} reservados · {c.total_numbers} total
                </p>
                <p
                  className={
                    "text-xs mt-2 " +
                    (c.deadline_reached && !c.finalized_at ? "text-amber-300" : "text-zinc-500")
                  }
                >
                  Prazo: {c.ends_at ? new Date(c.ends_at).toLocaleString("pt-BR") : "não definido"}
                  {c.finalized_at
                    ? " · finalizada em " + new Date(c.finalized_at).toLocaleString("pt-BR")
                    : c.deadline_reached
                      ? " · prazo encerrado, aguardando finalização"
                      : ""}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {canOperate &&
                    c.status !== "active" &&
                    !c.finalized_at &&
                    !c.deadline_reached && (
                      <button
                        onClick={() => statusCampaign(c.id, "active")}
                        className="px-3 py-2 bg-emerald-950 text-emerald-300 rounded-lg text-sm"
                      >
                        Ativar
                      </button>
                    )}
                  {canOperate &&
                    !c.finalized_at &&
                    (c.status === "active" || c.deadline_reached) && (
                      <button
                        onClick={() => finalizeCampaign(c)}
                        className="px-3 py-2 bg-rose-950 text-rose-300 rounded-lg text-sm font-bold"
                      >
                        Finalizar campanha
                      </button>
                    )}
                  {canDraw && c.finalized_at && c.sold_numbers > 0 && !c.draw_number && (
                    <button
                      onClick={() => drawCampaign(c.id, c.name)}
                      className="px-3 py-2 bg-amber-950 text-amber-300 rounded-lg text-sm inline-flex items-center gap-1"
                    >
                      <Trophy size={14} /> Sortear
                    </button>
                  )}
                  {c.draw_number && (
                    <span className="px-3 py-2 bg-amber-950 text-amber-300 rounded-lg text-sm inline-flex items-center gap-1">
                      <Trophy size={14} /> Sorteado: {String(c.draw_number).padStart(3, "0")}
                    </span>
                  )}
                  {canCampaignWrite && !c.finalized_at && (
                    <button
                      onClick={() => pickEdit(c.id)}
                      className="px-3 py-2 bg-zinc-800 rounded-lg text-sm"
                    >
                      Editar acima
                    </button>
                  )}
                  {canOperate && (
                    <button
                      onClick={() => duplicateCampaign(c)}
                      className="px-3 py-2 bg-zinc-800 rounded-lg text-sm"
                    >
                      Duplicar
                    </button>
                  )}
                  <a
                    target="_blank"
                    href={"/campanha/" + c.slug}
                    className="px-3 py-2 bg-zinc-800 rounded-lg text-sm"
                  >
                    Abrir página
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {canOperate && (
          <section className="grid xl:grid-cols-[360px_1fr] gap-5">
            <form onSubmit={createSeller} className={panel + " h-fit space-y-3"}>
              <h2 className="text-xl font-black">Adicionar vendedor</h2>
              <select
                required
                value={sellerForm.campaign_id}
                onChange={(e) => setSellerForm({ ...sellerForm, campaign_id: e.target.value })}
                className={input}
              >
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Nome"
                value={sellerForm.name}
                onChange={(e) => setSellerForm({ ...sellerForm, name: e.target.value })}
                className={input}
              />
              <input
                required
                placeholder="Código (ex: JOAO)"
                value={sellerForm.code}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, code: e.target.value.toUpperCase() })
                }
                className={input}
              />
              <input
                placeholder="Equipe / grupo"
                value={sellerForm.team}
                onChange={(e) => setSellerForm({ ...sellerForm, team: e.target.value })}
                className={input}
              />
              <input
                placeholder="WhatsApp do vendedor"
                value={sellerForm.whatsapp}
                onChange={(e) => setSellerForm({ ...sellerForm, whatsapp: e.target.value })}
                className={input}
              />
              <input
                required
                type="number"
                min="0"
                placeholder="Meta de números"
                value={sellerForm.goal}
                onChange={(e) => setSellerForm({ ...sellerForm, goal: e.target.value })}
                className={input}
              />
              <button className="bg-white text-black rounded-xl px-4 py-3 font-bold">
                Cadastrar
              </button>
              <label className="block text-center cursor-pointer bg-zinc-800 rounded-xl px-4 py-3 font-bold text-sm">
                Importar CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importSellers(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-zinc-500">CSV: nome;codigo;equipe;whatsapp;meta</p>
            </form>

            <div className={panel}>
              <h2 className="text-xl font-black mb-4">Vendedores e links</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-zinc-500 text-left">
                    <tr>
                      <th className="pb-3">Vendedor</th>
                      <th>Campanha</th>
                      <th>Vendas</th>
                      <th>Meta</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sellers.map((s) => (
                      <tr key={s.campaign_id + s.id} className="border-t border-zinc-800">
                        <td className="py-4">
                          <b>{s.name}</b>
                          <div className="text-xs text-zinc-500">
                            {s.code} · {s.team || "Sem equipe"}
                            {s.whatsapp ? " · " + s.whatsapp : ""}
                          </div>
                        </td>
                        <td>{s.campaign_name}</td>
                        <td>{s.sold_numbers}</td>
                        <td>{s.goal}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyLink(s)}
                              className="px-2 py-1 bg-zinc-800 rounded"
                            >
                              Link
                            </button>
                            <button onClick={() => qr(s)} className="px-2 py-1 bg-zinc-800 rounded">
                              QR
                            </button>
                            <button
                              onClick={() => editSeller(s)}
                              className="px-2 py-1 bg-zinc-800 rounded"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => inviteSeller(s)}
                              className="px-2 py-1 bg-indigo-950 text-indigo-300 rounded"
                            >
                              Acesso
                            </button>
                            <button
                              onClick={() => toggleSeller(s)}
                              className={
                                "px-2 py-1 rounded " +
                                (s.active
                                  ? "bg-emerald-950 text-emerald-300"
                                  : "bg-rose-950 text-rose-300")
                              }
                            >
                              {s.active ? "Ativo" : "Inativo"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section className={panel}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <div>
                <h2 className="text-xl font-black">Pedidos</h2>
                <p className="text-sm text-zinc-500">
                  {filtered.length} exibidos · últimos 250 carregados
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pedido..."
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
                />
                <button
                  onClick={exportOrders}
                  className="px-3 py-2 rounded-xl bg-zinc-800 flex gap-2 items-center"
                >
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
              >
                <option value="">Todos os status</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="expired">Expirado</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
              >
                <option value="">Todas as campanhas</option>
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
              >
                <option value="">Todos os vendedores</option>
                <option value="Direto">Direto</option>
                {Array.from(new Set(data.sellers.map((s) => s.name))).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">Pedido</th>
                  <th>Comprador</th>
                  <th>Campanha</th>
                  <th>Vendedor</th>
                  <th>Números</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Transação</th>
                  <th>Comprovante</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t border-zinc-800">
                    <td className="py-4 font-mono">
                      {o.payment_reference}
                      <AdminPayerDetails orderId={o.id} />
                    </td>
                    <td>
                      <b>{o.buyer_name}</b>
                      <div className="text-xs text-zinc-500">
                        {o.buyer_phone}
                        {o.buyer_email ? " · " + o.buyer_email : ""}
                      </div>
                    </td>
                    <td>{o.campaign_name}</td>
                    <td>
                      <b>{o.seller_name || "Direto"}</b>
                    </td>
                    <td className="max-w-[180px] truncate">{o.numbers.join(", ")}</td>
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
                    <td>
                      <div className="text-xs">
                        <div>{o.payment_provider}</div>
                        {o.provider_payment_id && (
                          <div
                            className="font-mono text-zinc-500 max-w-[160px] truncate"
                            title={o.provider_payment_id}
                          >
                            {o.provider_payment_id}
                          </div>
                        )}
                        {o.provider_status && (
                          <div className="text-zinc-500">{o.provider_status}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      {o.proof_path ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openProof(o)}
                            className="px-2 py-1 bg-zinc-800 rounded"
                          >
                            Abrir
                          </button>
                          {canFinanceWrite && o.proof_status !== "approved" && (
                            <button
                              onClick={() => setProofStatus(o, "approved")}
                              className="px-2 py-1 bg-emerald-950 text-emerald-300 rounded"
                            >
                              Aprovar
                            </button>
                          )}
                          {canFinanceWrite && o.proof_status !== "rejected" && (
                            <button
                              onClick={() => setProofStatus(o, "rejected")}
                              className="px-2 py-1 bg-rose-950 text-rose-300 rounded"
                            >
                              Rejeitar
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td>
                      {canFinanceWrite && o.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => orderStatus(o.id, "paid")}
                            className="px-2 py-1 bg-emerald-950 text-emerald-300 rounded"
                          >
                            Pago
                          </button>
                          <button
                            onClick={() => orderStatus(o.id, "cancelled")}
                            className="px-2 py-1 bg-rose-950 text-rose-300 rounded"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
