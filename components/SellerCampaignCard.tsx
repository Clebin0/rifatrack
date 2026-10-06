"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useUI } from "./ui/UIProvider";
type Campaign = {
  name: string;
  slug: string;
  goal: number;
  sold_numbers: number;
  status: string;
};
export default function SellerCampaignCard({
  campaign,
  code,
  onCopy,
  onDownload,
}: {
  campaign: Campaign;
  code: string;
  onCopy: () => Promise<void>;
  onDownload: () => Promise<void>;
}) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const { toast } = useUI();
  const pct = campaign.goal
    ? Math.min(100, Math.round((campaign.sold_numbers / campaign.goal) * 100))
    : 0;
  useEffect(() => {
    let active = true;
    const url = `${location.origin}/campanha/${campaign.slug}?vendedor=${encodeURIComponent(code)}`;
    setLink(url);
    QRCode.toDataURL(url, { width: 240, margin: 2 })
      .then((src) => {
        if (active) setQr(src);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [campaign.slug, code]);
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: campaign.name,
          text: "Conheça esta campanha",
          url: link,
        });
      else await onCopy();
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast("Não foi possível compartilhar. Use Copiar link.");
    }
  }
  return (
    <Card>
      <h3 className="text-xl font-bold">{campaign.name}</h3>
      <p className="text-sm ui-muted mt-2">
        {campaign.sold_numbers} números pagos
        {campaign.goal ? ` · meta de ${campaign.goal}` : " · sem meta definida"}
      </p>
      {campaign.goal > 0 && (
        <>
          <progress
            className="w-full h-3 mt-4 accent-emerald-500"
            value={campaign.sold_numbers}
            max={campaign.goal}
            aria-label="Progresso da meta"
          />
          <p className="text-xs ui-muted mt-1">{pct}% da meta</p>
        </>
      )}
      <div className="flex items-center gap-4 my-5">
        {qr && (
          <Image
            src={qr}
            alt={`QR Code do seu link de ${campaign.name}`}
            width={112}
            height={112}
            unoptimized
            className="rounded-xl"
          />
        )}
        <p className="text-sm ui-muted">
          Este link e QR atribuem os pedidos ao seu código. Mostre o QR ou
          compartilhe pelo celular.
        </p>
      </div>
      <label className="sr-only" htmlFor={`seller-link-${campaign.slug}`}>
        Seu link da campanha
      </label>
      <input
        id={`seller-link-${campaign.slug}`}
        className="ui-input text-xs"
        value={link}
        readOnly
        onFocus={(e) => e.target.select()}
      />
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button onClick={share}>Compartilhar</Button>
        <Button
          variant="secondary"
          onClick={() =>
            void onCopy().catch(() =>
              toast("Não foi possível copiar. Selecione o link acima."),
            )
          }
        >
          Copiar link
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void onDownload().catch(() =>
              toast("Não foi possível baixar o QR."),
            )
          }
        >
          Baixar QR
        </Button>
        <a
          href={link || undefined}
          className="ui-button ui-button-secondary"
          target="_blank"
          rel="noreferrer"
        >
          Ver campanha
        </a>
      </div>
    </Card>
  );
}
