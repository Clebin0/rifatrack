"use client";
import Button from "@/components/ui/Button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-xl mx-auto px-5 py-20">
      <h1 className="text-3xl font-bold">Não conseguimos carregar esta página</h1>
      <p className="ui-muted my-5">
        Tente novamente. Se você já tem um pedido, guarde o link e confira o status antes de fazer
        outra reserva.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
      <a className="ml-5 underline" href="/">
        Ir para campanhas
      </a>
    </main>
  );
}
