// Agenda (calendario + lo hecho) y enlaces/redes · coordinadores crean y editan desde aquí mismo
import { sb, h, vaciar, aviso, errMsg, fecha, modal, textoRico } from "./comun.js";

export const TIPOS_EV = { reunion: "👥 Reunión", evento: "🎤 Evento", campana: "📣 Campaña", redes: "📱 Redes", otro: "📌 Otro" };
const CATS = { redes: "📱 Redes sociales", grupos: "💬 Grupos", documentos: "📄 Documentos", otros: "🔗 Otros" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const aLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dia = (d) => d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
const gcal = (e) => {
  const f = (iso) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const fin = e.fin || new Date(new Date(e.inicio).getTime() + 3600e3).toISOString();
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.titulo) +
    "&dates=" + f(e.inicio) + "/" + f(fin) + "&details=" + encodeURIComponent((e.descripcion || "") + (e.enlace ? "\n" + e.enlace : "")) +
    "&location=" + encodeURIComponent(e.lugar || e.enlace || "");
};

export async function agenda(V, s) {
  const coord = ["coordinador", "admin"].includes(s.rol);
  vaciar(V, h("p", { class: "vacio" }, "Cargando…"));
  const [{ data: evs }, { data: mios }, { data: conteo }, { data: enl }] = await Promise.all([
    sb.from("int_eventos").select("*").order("inicio"),
    sb.from("int_asistencias").select("evento_id").eq("user_id", s.user.id),
    sb.rpc("int_conteo_asistencia"),
    sb.from("int_enlaces").select("*").order("orden").order("created_at")
  ]);
  const voy = new Set((mios || []).map(x => x.evento_id));
  const N = Object.fromEntries((conteo || []).map(x => [x.evento_id, x.n]));
  const ahora = new Date();
  let mes = new Date(ahora.getFullYear(), ahora.getMonth(), 1), sel = null;
  const recargar = () => agenda(V, s);

  const tarjeta = (e) => {
    const pasado = new Date(e.fin || e.inicio) < ahora;
    return h("article", { class: "tarjeta" + (e.realizado ? " hecho" : "") },
      h("div", { class: "meta" }, h("span", { class: "chip" }, TIPOS_EV[e.tipo]),
        e.realizado ? h("span", { class: "chip verde" }, "✔ Realizado") : null,
        h("b", {}, fecha(e.inicio)), N[e.id] ? h("span", {}, `${N[e.id]} van`) : null),
      h("h3", { style: "margin-top:8px" }, e.titulo),
      e.lugar ? h("p", { class: "ayuda" }, "📍 " + e.lugar) : null,
      e.descripcion ? textoRico(e.descripcion) : null,
      e.realizado && e.resumen ? h("div", { class: "aviso-caja" }, h("b", {}, "Lo que se hizo: "), textoRico(e.resumen)) : null,
      h("div", { class: "acciones" },
        e.enlace ? h("a", { class: "btn peq", href: e.enlace, target: "_blank", rel: "noopener noreferrer" }, "Entrar ↗") : null,
        !pasado ? (voy.has(e.id)
          ? h("button", { class: "btn sec peq", onclick: async () => { await sb.from("int_asistencias").delete().eq("evento_id", e.id).eq("user_id", s.user.id); recargar(); } }, "✔ Voy (cancelar)")
          : h("button", { class: "btn sec peq", onclick: async () => { const { error } = await sb.from("int_asistencias").insert({ evento_id: e.id }); error ? aviso(errMsg(error), "error") : recargar(); } }, "🙋 Voy")) : null,
        !pasado ? h("a", { class: "btn sec peq", href: gcal(e), target: "_blank", rel: "noopener" }, "📅 A mi calendario") : null,
        coord ? h("button", { class: "btn sec peq", onclick: () => editar(e) }, pasado && !e.realizado ? "✔ Marcar hecho" : "✏️") : null,
        coord && N[e.id] ? h("button", { class: "btn sec peq", onclick: () => asistentes(e) }, "👥") : null));
  };

  const cal = h("div"), lista = h("div");
  const pintar = () => {
    const y = mes.getFullYear(), m = mes.getMonth();
    const porDia = {};
    for (const e of evs || []) (porDia[dia(new Date(e.inicio))] ||= []).push(e);
    const desfase = (new Date(y, m, 1).getDay() + 6) % 7, total = new Date(y, m + 1, 0).getDate();
    const celdas = [];
    for (let i = 0; i < desfase; i++) celdas.push(h("div"));
    for (let d = 1; d <= total; d++) {
      const f = new Date(y, m, d), xs = porDia[dia(f)] || [];
      celdas.push(h("button", { class: "dia" + (dia(f) === dia(ahora) ? " hoy" : "") + (sel && dia(f) === dia(sel) ? " sel" : "") + (xs.length ? " con" : ""),
        onclick: () => { sel = sel && dia(sel) === dia(f) ? null : f; pintar(); } }, String(d), xs.length ? h("i", {}, xs.length) : null));
    }
    vaciar(cal, h("div", { class: "cal" },
      h("div", { class: "cal-cab" },
        h("button", { class: "btn-icono", "aria-label": "Mes anterior", onclick: () => { mes = new Date(y, m - 1, 1); sel = null; pintar(); } }, "‹"),
        h("b", {}, MESES[m] + " " + y),
        h("button", { class: "btn-icono", "aria-label": "Mes siguiente", onclick: () => { mes = new Date(y, m + 1, 1); sel = null; pintar(); } }, "›")),
      h("div", { class: "cal-grid" }, ["L", "M", "M", "J", "V", "S", "D"].map(x => h("span", {}, x)), celdas)));
    if (sel) {
      const xs = porDia[dia(sel)] || [];
      return vaciar(lista, h("h3", {}, fecha(sel.toISOString(), false)),
        xs.length ? h("div", { class: "grid" }, xs.map(tarjeta)) : h("p", { class: "vacio" }, "Nada programado este día."));
    }
    const prox = (evs || []).filter(e => new Date(e.fin || e.inicio) >= ahora);
    const hechos = (evs || []).filter(e => new Date(e.fin || e.inicio) < ahora).reverse();
    vaciar(lista,
      h("h3", {}, "Próximo"), prox.length ? h("div", { class: "grid" }, prox.slice(0, 12).map(tarjeta)) : h("p", { class: "vacio" }, "No hay nada programado."),
      hechos.length ? [h("h3", { style: "margin-top:24px" }, "Lo que hemos hecho"), h("div", { class: "grid" }, hechos.slice(0, 20).map(tarjeta))] : null);
  };

  const enlaces = h("div", { class: "enlaces" },
    (enl || []).length ? Object.entries(CATS).map(([k, t]) => {
      const xs = enl.filter(x => x.categoria === k);
      return xs.length ? h("div", {}, h("p", { class: "ayuda" }, t), h("div", { class: "acciones" }, xs.map(x => h("span", { class: "enlace" },
        h("a", { href: x.url, target: "_blank", rel: "noopener noreferrer" }, x.titulo),
        coord ? h("button", { class: "btn-icono", title: "Quitar", onclick: async () => { if (confirm("¿Quitar " + x.titulo + "?")) { await sb.from("int_enlaces").delete().eq("id", x.id); recargar(); } } }, "✕") : null)))) : null;
    }) : h("p", { class: "ayuda" }, "Aún no hay enlaces."));

  vaciar(V,
    h("div", { class: "seccion-cab" }, h("h2", {}, "Agenda"), coord ? h("button", { class: "btn ambar", onclick: () => editar() }, "＋ Agregar a la agenda") : null),
    h("div", { class: "agenda" }, h("div", {}, cal), h("div", {}, lista)),
    h("div", { class: "seccion-cab", style: "margin-top:28px" }, h("h2", {}, "Enlaces y redes"), coord ? h("button", { class: "btn sec", onclick: nuevoEnlace }, "＋ Enlace") : null),
    enlaces);
  pintar();

  function editar(e = {}) {
    const f = {
      titulo: h("input", { maxlength: 160, value: e.titulo || "", placeholder: "Ej. Reunión de coordinadores de Europa" }),
      tipo: h("select", {}, Object.entries(TIPOS_EV).map(([k, v]) => h("option", { value: k, selected: k === (e.tipo || "reunion") }, v))),
      inicio: h("input", { type: "datetime-local", value: aLocal(e.inicio) }),
      fin: h("input", { type: "datetime-local", value: aLocal(e.fin) }),
      lugar: h("input", { maxlength: 200, value: e.lugar || "", placeholder: "Dirección o 'Virtual'" }),
      enlace: h("input", { type: "url", value: e.enlace || "", placeholder: "https://meet.google.com/…" }),
      descripcion: h("textarea", { maxlength: 4000 }, e.descripcion || ""),
      realizado: h("input", { type: "checkbox", checked: e.realizado }),
      resumen: h("textarea", { maxlength: 4000, placeholder: "Qué se hizo, acuerdos, cuántos asistieron…" }, e.resumen || "")
    };
    const cerrar = modal(e.id ? "Editar" : "Agregar a la agenda", h("div", {},
      h("label", {}, "Título"), f.titulo,
      h("div", { class: "fila" }, h("div", {}, h("label", {}, "Tipo"), f.tipo), h("div", {}, h("label", {}, "Lugar"), f.lugar)),
      h("div", { class: "fila" }, h("div", {}, h("label", {}, "Empieza"), f.inicio), h("div", {}, h("label", {}, "Termina (opcional)"), f.fin)),
      h("label", {}, "Enlace (reunión virtual, transmisión, publicación…)"), f.enlace,
      h("label", {}, "Detalles"), f.descripcion,
      h("label", { class: "check" }, f.realizado, " Ya se realizó"),
      h("label", {}, "Lo que se hizo"), f.resumen), [
      e.id ? h("button", { class: "btn sec", onclick: async () => { if (!confirm("¿Eliminar?")) return; await sb.from("int_eventos").delete().eq("id", e.id); cerrar(); recargar(); } }, "🗑 Eliminar") : null,
      h("button", { class: "btn", onclick: async () => {
        if (!f.titulo.value.trim() || !f.inicio.value) return aviso("Pon título y fecha.", "error");
        const d = { titulo: f.titulo.value.trim(), tipo: f.tipo.value, inicio: new Date(f.inicio.value).toISOString(),
          fin: f.fin.value ? new Date(f.fin.value).toISOString() : null, lugar: f.lugar.value.trim() || null,
          enlace: f.enlace.value.trim() || null, descripcion: f.descripcion.value.trim() || null,
          realizado: f.realizado.checked, resumen: f.resumen.value.trim() || null };
        const { error } = e.id ? await sb.from("int_eventos").update(d).eq("id", e.id) : await sb.from("int_eventos").insert(d);
        if (error) return aviso(/enlace/.test(error.message) ? "El enlace debe empezar por https://" : errMsg(error), "error");
        cerrar(); aviso("Guardado"); recargar();
      } }, "Guardar")].filter(Boolean));
  }

  function nuevoEnlace() {
    const t = h("input", { maxlength: 120, placeholder: "Ej. Instagram Avancemos" }), u = h("input", { type: "url", placeholder: "https://…" });
    const c = h("select", {}, Object.entries(CATS).map(([k, v]) => h("option", { value: k }, v)));
    const cerrar = modal("Nuevo enlace", h("div", {}, h("label", {}, "Nombre"), t, h("label", {}, "Dirección"), u, h("label", {}, "Categoría"), c), [
      h("button", { class: "btn", onclick: async () => {
        const { error } = await sb.from("int_enlaces").insert({ titulo: t.value.trim(), url: u.value.trim(), categoria: c.value });
        if (error) return aviso("Revisa el nombre y que el enlace empiece por https://", "error");
        cerrar(); recargar();
      } }, "Guardar")]);
  }

  async function asistentes(e) {
    const { data } = await sb.rpc("int_asistentes", { p_evento: e.id });
    modal("Van a: " + e.titulo, h("div", {}, (data || []).map(a => h("p", {}, a.nombre, a.telefono ? h("span", { class: "ayuda" }, " · " + a.telefono) : null))));
  }
}
