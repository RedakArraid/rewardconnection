"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateChildForm() {
  const router = useRouter(); const [message,setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); const form=e.currentTarget; const fd=new FormData(form);
    const res=await fetch("/api/parent/children",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name:fd.get("name"),email:fd.get("email"),password:fd.get("password")
    })});
    const data=await res.json(); if(!res.ok) return setMessage(data.error||"Erreur");
    form.reset(); setMessage("Compte enfant créé"); router.refresh();
  }
  return <form className="card stack" onSubmit={submit}>
    <h3>Créer un compte enfant</h3>
    <label>Prénom<input name="name" required /></label>
    <label>Email / identifiant<input name="email" type="email" required placeholder="adam@maison.local" /></label>
    <label>Mot de passe<input name="password" type="password" minLength={6} required /></label>
    <button className="secondary">Créer le compte</button>
    {message && <div className="notice">{message}</div>}
  </form>;
}
