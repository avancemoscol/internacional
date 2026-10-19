// Formularios (inscripciones, censos, voluntariado…) · coordinadores crean y ven respuestas aquí mismo
import { sb, h, vaciar, aviso, errMsg, fecha, modal, textoRico, nombrePais } from "./comun.js";

const TIPOS = { corto: "Respuesta corta", largo: "Párrafo", una: "Elegir una", varias: "Elegir varias", numero: "Número", fecha: "Fecha", sino: "Sí / No" };
const abierto = (f) => !f.cerrado && (!f.cierra_en || new Date(f.cierra_en) > new Date());
const aLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export async function formularios(V, s) {
  const coord = ["coordinador", "admin"].includes(s.rol);
  vaciar(V, h("p", { class: "vacio" }, "Cargando…"));
  const [{ data: fs }, { data: mias }] = await Promise.all([
    sb.from("int_formularios").select("*").order("created_at", { ascending: false }),
    sb.from("int_respuestas").select("formulario_id, datos").eq("user_id", s.user.id)
  ]);
  const M = Object.fromEntries((mias || []).map(r => [r.formulario_id, r.datos]));
  const recargar = () => formularios(V, s);

  const tarjeta = (f) => {
    const ab = abierto(f), resp = M[f.id];
    return h("article", { class: "tarjeta" },
      h("div", { class: "meta" }, h("span", { class: "chip" + (ab ? " verde" : "") }, ab ? "Abierto" : "Cerrado"),
        resp ? h("span", { class: "chip ambar" }, "✔ Ya respondiste") : null,
        f.cierra_en ? h("span", {}, "Hasta: " + fecha(f.cierra_en)) : null),
      h("h3", { style: "margin-top:8px" }, f.titulo),
      f.descripcion ? textoRico(f.descripcion) : null,
      h("div", { class: "acciones" },
        ab && !resp ? h("button", { class: "btn", onclick: () => llenar(f) }, "Responder") : null,
        resp ? h("button", { class: "btn sec peq", onclick: () => modal("Tus respuestas", h("div", {}, f.campos.map((c, i) => h("p", {}, h("b", {}, c.etiqueta + ": "), fmt(resp[i]))))) }, "Ver mis respuestas") : null,
        coord ? h("button", { class: "btn sec peq", onclick: () => respuestas(f) }, "📊 Respuestas") : null,
        coord ? h("button", { class: "btn sec peq", onclick: async () => { await sb.from("int_formularios").update({ cerrado: ab }).eq("id", f.id); recargar(); } }, ab ? "🔒 Cerrar" : "🔓 Reabrir") : null,
        coord ? h("button", { class: "btn-icono", title: "Eliminar", onclick: async () => { if (confirm("¿Eliminar el formulario y sus respuestas?")) { await sb.from("int_formularios").delete().eq("id", f.id); recargar(); } } }, "🗑") : null));
  };

  const pend = (fs || []).filter(f => abierto(f) && !M[f.id]), resto = (fs || []).filter(f => !pend.includes(f));
  vaciar(V,
    h("div", { class: "seccion-cab" }, h("h2", {}, "Formularios"), coord ? h("button", { class: "btn ambar", onclick: crear }, "＋ Nuevo formulario") : null),
    pend.length ? [h("h3", {}, "Por responder"), h("div", { class: "grid grid-2" }, pend.map(tarjeta))] : null,
    resto.length ? [h("h3", { style: "margin-top:20px" }, pend.length ? "Otros" : "Todos"), h("div", { class: "grid grid-2" }, resto.map(tarjeta))] : null,
    !(fs || []).length ? h("p", { class: "vacio" }, "Aún no hay formularios.") : null);

  function llenar(f) {
    const ins = f.campos.map((c, i) => {
      const n = "c" + i;
      if (c.tipo === "largo") return h("textarea", { maxlength: 2000 });
      if (c.tipo === "una" || c.tipo === "varias" || c.tipo === "sino") {
        const ops = c.tipo === "sino" ? ["Sí", "No"] : c.opciones || [];
        return h("div", {}, ops.map(o => h("label", { class: "opcion" }, h("input", { type: c.tipo === "varias" ? "checkbox" : "radio", name: n, value: o }), o)));
      }
      return h("input", { type: c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "date" : "text", maxlength: 300 });
    });
    const valor = (c, el) => ["una", "sino"].includes(c.tipo) ? el.querySelector("input:checked")?.value || ""
      : c.tipo === "varias" ? [...el.querySelectorAll("input:checked")].map(x => x.value) : el.value.trim();
    const cerrar = modal(f.titulo, h("div", {}, f.campos.map((c, i) => [h("label", {}, c.etiqueta, c.requerido ? " *" : ""), ins[i]])), [
      h("button", { class: "btn", onclick: async () => {
        const datos = f.campos.map((c, i) => valor(c, ins[i]));
        const falta = f.campos.findIndex((c, i) => c.requerido && (!datos[i] || datos[i].length === 0));
        if (falta >= 0) return aviso("Falta: " + f.campos[falta].etiqueta, "error");
        const { error } = await sb.from("int_respuestas").insert({ formulario_id: f.id, datos });
        if (error) return aviso(error.code === "23505" ? "Ya habías respondido." : errMsg(error), "error");
        cerrar(); aviso("¡Gracias! Respuesta enviada."); recargar();
      } }, "Enviar")]);
  }

  function crear() {
    const titulo = h("input", { maxlength: 160, placeholder: "Ej. Voluntarios para la jornada del 15" });
    const desc = h("textarea", { maxlength: 4000, placeholder: "Para qué es (opcional)" });
    const cierra = h("input", { type: "datetime-local", value: aLocal(null) });
    const filas = h("div");
    const fila = (c = { etiqueta: "", tipo: "corto", requerido: false }) => {
      const et = h("input", { placeholder: "Pregunta", value: c.etiqueta, maxlength: 200 });
      const ops = h("input", { placeholder: "Opciones separadas por coma", hidden: !["una", "varias"].includes(c.tipo) });
      const tp = h("select", { style: "width:auto", onchange: () => { ops.hidden = !["una", "varias"].includes(tp.value); } },
        Object.entries(TIPOS).map(([k, v]) => h("option", { value: k, selected: k === c.tipo }, v)));
      const rq = h("input", { type: "checkbox", checked: c.requerido });
      const el = h("div", { class: "tarjeta", style: "padding:10px;margin-bottom:8px" }, et,
        h("div", { class: "acciones", style: "margin-top:6px" }, tp, h("label", { class: "check" }, rq, " Obligatoria"),
          h("button", { class: "btn-icono", title: "Quitar", onclick: () => el.remove() }, "✕")), ops);
      el.leer = () => ({ etiqueta: et.value.trim(), tipo: tp.value, requerido: rq.checked,
        ...(["una", "varias"].includes(tp.value) ? { opciones: ops.value.split(",").map(x => x.trim()).filter(Boolean) } : {}) });
      filas.append(el);
    };
    fila({ etiqueta: "¿En qué puedes ayudar?", tipo: "largo", requerido: true });
    const cerrar = modal("Nuevo formulario", h("div", {},
      h("label", {}, "Título"), titulo, h("label", {}, "Descripción"), desc,
      h("label", {}, "Cierra (opcional)"), cierra,
      h("p", { class: "ayuda", style: "margin-top:14px" }, "Nombre, país y WhatsApp de quien responde se guardan solos; no hace falta preguntarlos."),
      filas, h("button", { class: "btn sec peq", onclick: () => fila() }, "＋ Pregunta")), [
      h("button", { class: "btn", onclick: async () => {
        const campos = [...filas.children].map(x => x.leer()).filter(c => c.etiqueta);
        if (!titulo.value.trim() || !campos.length) return aviso("Pon título y al menos una pregunta.", "error");
        if (campos.some(c => c.opciones && c.opciones.length < 2)) return aviso("Las preguntas de elegir necesitan 2 opciones o más.", "error");
        const { error } = await sb.from("int_formularios").insert({ titulo: titulo.value.trim(), descripcion: desc.value.trim() || null, campos,
          cierra_en: cierra.value ? new Date(cierra.value).toISOString() : null });
        if (error) return aviso(errMsg(error), "error");
        cerrar(); aviso("Formulario publicado"); recargar();
      } }, "Publicar")]);
  }

  async function respuestas(f) {
    const { data } = await sb.rpc("int_respuestas_de", { p_form: f.id });
    const rs = data || [];
    const filas = await Promise.all(rs.map(async r => [r.nombre, await nombrePais(r.pais_id), r.telefono || "", ...f.campos.map((c, i) => fmt(r.datos[i]))]));
    const cab = ["Nombre", "País", "WhatsApp", ...f.campos.map(c => c.etiqueta)];
    const csv = () => {
      const q = (x) => '"' + String(x ?? "").replace(/"/g, '""') + '"';
      const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + [cab, ...filas].map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" })), download: f.titulo + ".csv" });
      a.click();
    };
    // Resumen rápido de preguntas de elegir
    const resumen = f.campos.map((c, i) => {
      if (!["una", "varias", "sino"].includes(c.tipo)) return null;
      const cnt = {};
      for (const r of rs) for (const v of [].concat(r.datos[i] || [])) cnt[v] = (cnt[v] || 0) + 1;
      return h("p", {}, h("b", {}, c.etiqueta + ": "), Object.entries(cnt).map(([k, n]) => `${k} (${n})`).join(" · ") || "—");
    });
    modal(`${f.titulo} · ${rs.length} respuestas`, h("div", {}, resumen,
      rs.length ? h("div", { class: "tabla-caja" }, h("table", { class: "tabla" }, h("thead", {}, h("tr", {}, cab.map(x => h("th", {}, x)))),
        h("tbody", {}, filas.map(r => h("tr", {}, r.map(x => h("td", {}, x))))))) : h("p", { class: "vacio" }, "Nadie ha respondido todavía.")),
      rs.length ? [h("button", { class: "btn sec", onclick: csv }, "⬇ Descargar Excel (CSV)")] : []);
  }
}

const fmt = (v) => Array.isArray(v) ? v.join(", ") : v ?? "";
