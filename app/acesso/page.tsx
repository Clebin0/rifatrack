import AccountAccess from "@/components/AccountAccess";
import PublicHeader from "@/components/PublicHeader";

export const metadata = {
  title: "Entrar ou criar conta",
  robots: { index: false, follow: false },
};

export default function AccountAccessPage() {
  return (
    <>
      <PublicHeader />
      <main className="max-w-7xl mx-auto px-5 sm:px-7 py-10 sm:py-16">
        <div className="max-w-xl mx-auto">
          <AccountAccess />
        </div>
      </main>
    </>
  );
}
