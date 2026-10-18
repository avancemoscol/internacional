// Tarjeta de votación/encuesta · compartida por app.html y admin.html
import { sb, h, vaciar, aviso, errMsg, fecha } from "./comun.js";

export const abierta = (e) => !e.cerrada && (!e.cierra_en || new Date(e.cierra_en) > new Date());

export async function resultados(cont, e) {
  const { data: r, error } = await sb.rpc("int_resultados", { p_encuesta: e.id });
  if (error || !r) return vaciar(cont, h("p", { class: "ayuda" }, "No se pudieron cargar los resultados."));
  if (r.oculto) return vaciar(cont, h("p", { class: "ayuda" }, `${r.votantes} personas han votado. Los resultados se muestran ${e.resultados === "al_cerrar" ? "cuando cierre la votación" : "después de votar"}.`));
  const max = Math.max(...r.conteo);
  vaciar(cont,
    e.opciones.map((op, i) => {
      const n = r.conteo[i], pct = r.votantes ? Math.round(n * 100 / r.votantes) : 0;
      return h("div", { class: "barra-res" + (n === max && n > 0 ? " gana" : "") },
        h("div", { class: "et" }, h("span", {}, op), h("b", {}, `${pct}% · ${n}`)),
        h("div", { class: "pista" }, h("div", { class: "relleno", style: `width:${pct}%` })));
    }),
    h("p", { class: "ayuda" }, `${r.votantes} ${r.votantes === 1 ? "persona votó" : "personas votaron"}`),
    r.comentarios?.length ? h("details", {}, h("summary", {}, `Comentarios (${r.comentarios.length})`), r.comentarios.map(c => h("p", { class: "ayuda" }, "“" + c + "”"))) : null);
}

export function tarjeta(e, miVoto, { alVotar, extra, soloResultados } = {}) {
  const ab = abierta(e);
  const cuerpo = h("div");
  const card = h("article", { class: "tarjeta" },
    h("div", { class: "meta" },
      h("span", { class: "chip" + (ab ? " verde" : "") }, ab ? "Abierta" : "Cerrada"),
      h("span", { class: "chip" }, e.tipo === "votacion" ? "🗳️ Votación · 1 opción" : "📊 Encuesta · varias opciones"),
      miVoto ? h("span", { class: "chip ambar" }, "✔ Ya votaste") : null,
      e.cierra_en ? h("span", {}, (ab ? "Cierra: " : "Cerró: ") + fecha(e.cierra_en)) : null),
    h("h3", { style: "margin-top:10px" }, e.titulo),
    e.descripcion ? h("p", { class: "ayuda", style: "font-size:15px" }, e.descripcion) : null,
    cuerpo, extra || null);

  if (ab && !miVoto && !soloResultados) {
    const nombre = "v-" + e.id;
    const tipo = e.tipo === "votacion" ? "radio" : "checkbox";
    const coment = e.permite_comentario ? h("textarea", { maxlength: 500, placeholder: "Comentario (opcional)", style: "min-height:70px" }) : null;
    const btn = h("button", { class: "btn" }, "Votar");
    const prev = h("div");
    const form = h("form", {},
      e.opciones.map((op, i) => h("label", { class: "opcion" }, h("input", { type: tipo, name: nombre, value: i }), op)),
      coment, h("div", { class: "acciones" }, btn, h("button", { type: "button", class: "btn sec", onclick: () => resultados(prev, e) }, "Ver resultados")), prev);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const ops = [...form.querySelectorAll("input:checked")].map(x => +x.value);
      if (!ops.length) return aviso("Elige una opción.", "error");
      btn.disabled = true;
      const { error } = await sb.rpc("int_votar", { p_encuesta: e.id, p_opciones: ops, p_comentario: coment?.value || null });
      btn.disabled = false;
      if (error) return aviso(errMsg(error), "error");
      aviso("¡Voto registrado!");
      alVotar && alVotar();
    };
    vaciar(cuerpo, form);
  } else {
    if (miVoto) cuerpo.append(h("p", { class: "ayuda" }, "Tu voto: " + miVoto.opciones.map(i => e.opciones[i]).join(", ")));
    const res = h("div"); cuerpo.append(res); resultados(res, e);
  }
  return card;
}
