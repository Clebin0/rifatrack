"use client";
import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin(){
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    const sb=supabaseBrowser();
    if(mode==="login"){
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error) setMessage("E-mail ou senha inválidos.");
      else location.href="/admin";
    }else{
      const {data,error}=await sb.auth.signUp({email,password});
      if(error) setMessage(error.message);
      else if(data.session) location.href="/admin";
      else setMessage("Conta criada. Confirme o e-mail recebido e depois entre no painel.");
    }
    setLoading(false);
  }

  return <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
    <div className="w-full max-w-md">
      <a href="/" className="font-black text-xl">Rifa<span className="text-emerald-400">Track</span></a>
      <section className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-800 grid place-items-center text-emerald-400"><ShieldCheck/></div>
        <h1 className="text-3xl font-black mt-5">{mode==="login"?"Área administrativa":"Criar acesso"}</h1>
        <p className="text-zinc-500 text-sm mt-2">O cadastro não concede privilégios automaticamente. O primeiro administrador precisa validar o código de implantação.</p>
        <form onSubmit={submit} className="space-y-3 mt-6">
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"/>
          <input type="password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha (mínimo 12 caracteres)" className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"/>
          <button disabled={loading} className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black disabled:opacity-50">{loading?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}</button>
        </form>
        {message&&<p className="text-sm text-zinc-300 mt-4">{message}</p>}
        <button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("")}} className="text-sm text-emerald-400 mt-5">{mode==="login"?"Primeiro acesso? Criar conta":"Já possui conta? Entrar"}</button>
      </section>
    </div>
  </main>
}
