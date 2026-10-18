// Utilidades compartidas · Avancemos Internacional
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "avancemos-int" }
});

export const CONTINENTES = ["Norteamérica", "Centroamérica y Caribe", "Sudamérica", "Europa", "África", "Asia", "Oceanía"];
export const NIVELES = { global: "Coordinación global", continente: "Continente", pais: "País", ciudad: "Ciudad", sector: "Sector" };
export const TIPOS_PUB = { anuncio: "📢 Anuncio", acuerdo: "🤝 Acuerdo", acta: "📝 Acta", tarea: "✅ Tarea", recurso: "📎 Recurso" };

// Crea elementos sin innerHTML (los datos de usuarios siempre van como texto)
export function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const vaciar = (e, ...hijos) => { e.replaceChildren(...hijos.flat().filter(Boolean)); return e; };

export function aviso(msg, tipo = "ok") {
  const t = h("div", { class: `toast toast-${tipo}`, role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add("ver"), 10);
  setTimeout(() => { t.classList.remove("ver"); setTimeout(() => t.remove(), 300); }, 3800);
}
export const errMsg = (e) => (e && (e.message || e.error_description)) || "Ocurrió un error. Intenta de nuevo.";

export function fecha(iso, conHora = true) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", conHora
    ? { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

let _paises;
export async function paises() {
  if (!_paises) _paises = await (await fetch(new URL("../data/paises.json", import.meta.url))).json();
  return _paises;
}
export async function nombrePais(id) { return (await paises()).find(p => p.id === id)?.n || ""; }

export async function selectorPais(sel, valor) {
  const ps = await paises();
  vaciar(sel, h("option", { value: "" }, "Selecciona tu país"),
    CONTINENTES.map(c => h("optgroup", { label: c }, ps.filter(p => p.c === c).map(p => h("option", { value: p.id, selected: p.id === valor }, p.n)))));
}

// Sesión + membresía. Devuelve {user, miembro, rol} o redirige a index
export async function sesion({ exigir = true } = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { if (exigir) location.href = "index.html"; return null; }
  const [{ data: miembro }, { data: rol }] = await Promise.all([
    sb.from("int_miembros").select("*").eq("user_id", session.user.id).maybeSingle(),
    sb.rpc("int_mi_rol")
  ]);
  return { user: session.user, miembro, rol };
}

export async function salir() { await sb.auth.signOut(); location.href = "index.html"; }

export function modal(titulo, contenido, acciones = []) {
  const cerrar = () => fondo.remove();
  const fondo = h("div", { class: "modal-fondo", onclick: (e) => { if (e.target === fondo) cerrar(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true" },
      h("div", { class: "modal-cab" }, h("h3", {}, titulo), h("button", { class: "btn-icono", "aria-label": "Cerrar", onclick: cerrar }, "✕")),
      h("div", { class: "modal-cuerpo" }, contenido),
      acciones.length ? h("div", { class: "modal-pie" }, acciones) : null));
  document.body.append(fondo);
  return cerrar;
}

// Texto con saltos de línea y enlaces https clicables, sin innerHTML
export function textoRico(txt) {
  const cont = h("div", { class: "texto-rico" });
  for (const linea of String(txt || "").split("\n")) {
    const p = h("p");
    for (const parte of linea.split(/(https:\/\/[^\s]+)/g)) {
      if (/^https:\/\//.test(parte)) p.append(h("a", { href: parte, target: "_blank", rel: "noopener noreferrer" }, parte));
      else if (parte) p.append(parte);
    }
    cont.append(p);
  }
  return cont;
}

export const iniciales = (n) => String(n || "?").split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("");
