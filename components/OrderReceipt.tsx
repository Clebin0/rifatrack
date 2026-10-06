"use client";
import { MessageCircle, Printer, Share2 } from "lucide-react";
import type { Order } from "@/lib/order-types";
export default function OrderReceipt({
  order,
  shareOrder,
}: {
  order: Order;
  shareOrder: () => Promise<void>;
}) {
  return (
    <div className="mt-6 border-t border-zinc-800 pt-6">
      <h2 className="text-xl font-bold">Recibo digital</h2>
      <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Pedido</span>
          <b>{order.payment_reference}</b>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Comprador</span>
          <b>{order.buyer_name}</b>
        </div>
        {order.seller_name && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Vendedor</span>
            <b>{order.seller_name}</b>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Valor</span>
          <b>R$ {(order.amount_cents / 100).toFixed(2).replace(".", ",")}</b>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Números</span>
          <b className="text-right">
            {order.numbers.map((n) => String(n).padStart(3, "0")).join(", ")}
          </b>
        </div>
        {order.provider_payment_id && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Transação</span>
            <b className="font-mono text-xs break-all text-right">
              {order.provider_payment_id}
            </b>
          </div>
        )}
        {order.provider_paid_at && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Confirmado em</span>
            <b>{new Date(order.provider_paid_at).toLocaleString("pt-BR")}</b>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => window.print()}
          className="inline-flex gap-2 items-center rounded-xl bg-white text-black px-4 py-2 font-bold"
        >
          <Printer size={16} /> Imprimir / salvar PDF
        </button>
        <button
          onClick={shareOrder}
          className="inline-flex gap-2 items-center rounded-xl bg-zinc-800 px-4 py-2 font-bold"
        >
          <Share2 size={16} /> Compartilhar
        </button>
        {order.seller_whatsapp && (
          <a
            target="_blank"
            rel="noreferrer"
            href={"https://wa.me/" + order.seller_whatsapp.replace(/\D/g, "")}
            className="inline-flex gap-2 items-center rounded-xl bg-emerald-950 text-emerald-300 px-4 py-2 font-bold"
          >
            <MessageCircle size={16} /> Vendedor
          </a>
        )}
      </div>
    </div>
  );
}
