// Organigrama (árbol) y mapa mundial · compartido por app.html y admin.html
import { h, vaciar, paises, CONTINENTES, NIVELES, iniciales } from "./comun.js";

const D3 = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const TOPO = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";

export function lugar(c, ps) {
  const pais = ps.find(p => p.id === c.pais_id)?.n;
  return [c.sector, c.ciudad, pais, c.nivel === "continente" ? c.continente : null].filter(Boolean).join(" · ");
}

// Árbol de cargos según padre_id; los sin padre quedan como raíces
export async function arbol(cont, cargos, { alClic } = {}) {
  const ps = await paises();
  const raices = cargos.filter(c => !c.padre_id || !cargos.some(p => p.id === c.padre_id));
  const nodo = (c) => h("li", {},
    h("div", { class: "nodo", style: alClic ? "cursor:pointer" : "", onclick: alClic ? () => alClic(c) : null },
      h("div", { class: "avatar" + (c.nombre ? "" : " vacante") }, c.nombre ? iniciales(c.nombre) : "?"),
      h("div", {},
        h("div", { class: "t" }, c.titulo),
        h("div", { class: "s" }, c.nombre || "Vacante", " — ", NIVELES[c.nivel], lugar(c, ps) ? " · " + lugar(c, ps) : ""),
        c.telefono ? h("div", { class: "s" }, h("a", { href: "https://wa.me/" + c.telefono.replace(/\D/g, ""), target: "_blank", rel: "noopener" }, "WhatsApp " + c.telefono)) : null)),
    (() => { const hs = cargos.filter(x => x.padre_id === c.id); return hs.length ? h("ul", {}, hs.map(nodo)) : null; })());
  if (!cargos.length) return vaciar(cont, h("p", { class: "vacio" }, "Todavía no hay cargos en el organigrama."));
  vaciar(cont, h("ul", { class: "arbol" }, raices.map(nodo)));
}

// Mapa: países coloreados por miembros activos; borde ámbar donde hay coordinador
export async function mapa(cont, info, { alPais } = {}) {
  const [d3, topojson, ps, mundo] = await Promise.all([
    import(D3), import(TOPO), paises(), fetch(new URL("../data/mundo-110m.json", import.meta.url)).then(r => r.json())
  ]);
  const porNum = Object.fromEntries(ps.filter(p => p.num).map(p => [String(+p.num), p]));
  const conCargo = new Set(info.cargos.filter(c => c.pais_id && c.user_id).map(c => c.pais_id));
  const max = Math.max(1, ...Object.values(info.por_pais || {}));
  const color = d3.scaleSequential([0, Math.log1p(max)], t => d3.interpolate("#9FE3D9", "#0B7A6E")(t));
  const geo = topojson.feature(mundo, mundo.objects.countries);
  geo.features = geo.features.filter(f => f.properties.name !== "Antarctica");
  const W = 960, H = 470;
  const proy = d3.geoNaturalEarth1().fitSize([W, H], geo);
  const ruta = d3.geoPath(proy);
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Mapa de miembros por país");
  const tip = h("div", { class: "chip", style: "position:absolute;left:12px;top:12px;pointer-events:none;background:var(--superficie);box-shadow:var(--sombra);display:none" });
  svg.selectAll("path").data(geo.features).join("path")
    .attr("d", ruta)
    .attr("class", f => "pais" + (porNum[String(+f.id)] && info.por_pais[porNum[String(+f.id)].id] ? " con" : ""))
    .style("fill", f => { const p = porNum[String(+f.id)]; const n = p && info.por_pais[p.id]; return n ? color(Math.log1p(n)) : null; })
    .style("stroke", f => { const p = porNum[String(+f.id)]; return p && conCargo.has(p.id) ? "#E8A33D" : null; })
    .style("stroke-width", f => { const p = porNum[String(+f.id)]; return p && conCargo.has(p.id) ? 1.6 : null; })
    .on("mousemove", (ev, f) => { const p = porNum[String(+f.id)]; if (!p) return; tip.style.display = ""; tip.textContent = `${p.n}: ${info.por_pais[p.id] || 0} miembros`; })
    .on("mouseleave", () => { tip.style.display = "none"; })
    .on("click", (ev, f) => { const p = porNum[String(+f.id)]; if (p && alPais) alPais(p); });
  // Países pequeños (sin forma en 110m) con miembros: punto
  const conForma = new Set(geo.features.map(f => String(+f.id)));
  svg.selectAll("circle").data(ps.filter(p => info.por_pais[p.id] && !conForma.has(String(+p.num)))).join("circle")
    .attr("cx", p => proy([p.ll[1], p.ll[0]])[0]).attr("cy", p => proy([p.ll[1], p.ll[0]])[1]).attr("r", 4)
    .attr("fill", "#0B7A6E").attr("stroke", p => conCargo.has(p.id) ? "#E8A33D" : "#fff").style("cursor", "pointer")
    .on("click", (ev, p) => alPais && alPais(p));
  vaciar(cont, h("div", { class: "mapa-caja" }, svg.node(), tip,
    h("div", { class: "leyenda" },
      h("span", {}, h("i", { style: "background:#9FE3D9" }), "Pocos miembros"),
      h("span", {}, h("i", { style: "background:#0B7A6E" }), "Más miembros"),
      h("span", {}, h("i", { style: "background:transparent;border:2px solid #E8A33D" }), "Con coordinador"))));
}

// Resumen por continente
export async function resumenContinentes(cont, info) {
  const ps = await paises();
  const por = Object.fromEntries(CONTINENTES.map(c => [c, { miembros: 0, paises: 0, coord: [] }]));
  for (const [id, n] of Object.entries(info.por_pais || {})) { const p = ps.find(x => x.id === id); if (p) { por[p.c].miembros += n; por[p.c].paises++; } }
  for (const c of info.cargos) {
    const cont_ = c.continente || ps.find(p => p.id === c.pais_id)?.c;
    if (cont_ && por[cont_] && c.nombre && ["continente"].includes(c.nivel)) por[cont_].coord.push(c.nombre);
  }
  vaciar(cont, h("div", { class: "grid grid-3" }, CONTINENTES.map(c => h("div", { class: "stat" },
    h("span", {}, c), h("b", {}, por[c].miembros),
    h("span", {}, `${por[c].paises} ${por[c].paises === 1 ? "país" : "países"} · `, por[c].coord.length ? "Coord.: " + por[c].coord.join(", ") : "sin coordinador")))));
}
