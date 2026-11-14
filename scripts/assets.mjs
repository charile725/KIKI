import { mkdir, writeFile } from "node:fs/promises";
import { catalog } from "../shared/catalog.ts";
await mkdir("public/products", { recursive: true });
const shortSleeve =
  "M177 104 L130 121 L69 239 L117 268 L154 196 L143 449 Q250 472 357 449 L346 196 L383 268 L431 239 L370 121 L323 104 Q303 133 250 135 Q197 133 177 104Z";
for (const p of catalog) {
  const torso =
    p.id === "essential-tee"
      ? shortSleeve
      : "M177 104 L130 121 L69 390 L117 403 L154 196 L143 449 Q250 472 357 449 L346 196 L383 403 L431 390 L370 121 L323 104 Q303 133 250 135 Q197 133 177 104Z";
  const blazer = /blazer|jacket/.test(p.id);
  const knit = /knit|sculpt/.test(p.id);
  const body = `<path d="${torso}" fill="url(#cloth)" stroke="#000" stroke-opacity=".14" stroke-width="2"/>`;
  const detail = blazer
    ? '<path d="M208 112L187 195L223 218L250 320L277 218L313 195L292 112M250 320V451" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/><path d="M177 310L220 315M280 315L323 310" stroke="#000" stroke-opacity=".3" stroke-width="5"/><circle cx="261" cy="350" r="4" fill="#423e37"/><circle cx="261" cy="390" r="4" fill="#423e37"/>'
    : /shirt|cardigan/.test(p.id)
      ? '<path d="M220 119L199 156L236 184L250 146L264 184L301 156L280 119M250 150V457" stroke="#000" stroke-opacity=".23" fill="none" stroke-width="3"/>'
      : '<path d="M179 108Q250 165 321 108" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="8"/>';
  const buttons = /shirt|cardigan/.test(p.id)
    ? [210, 253, 296, 339, 382, 425]
        .map(
          (y) =>
            `<circle cx="258" cy="${y}" r="3" fill="#ffffff" fill-opacity=".65"/>`,
        )
        .join("")
    : "";
  const stripes =
    p.id === "stripe-knit"
      ? [190, 225, 260, 295, 330, 365, 400, 435]
          .map(
            (y) =>
              `<path d="M120 ${y}H380" stroke="#343d3a" stroke-width="9"/>`,
          )
          .join("")
      : "";
  const hoodie = /hoodie/.test(p.id)
    ? '<path d="M183 117Q161 27 250 37Q339 27 317 117L281 150Q250 105 219 150Z" fill="url(#cloth)" stroke="#000" stroke-opacity=".18" stroke-width="2"/><path d="M201 352L178 410H322L299 352Z" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="3"/><path d="M228 149V214M272 149V214" stroke="#d5e1e3" stroke-width="3"/>'
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="540" viewBox="0 0 500 540"><defs><linearGradient id="cloth" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="${p.color_hex}"/><stop offset=".45" stop-color="${p.color_hex}"/><stop offset="1" stop-color="#343b36" stop-opacity=".65"/></linearGradient><pattern id="rib" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M1 0V5" stroke="#000" stroke-opacity=".08"/></pattern><clipPath id="body"><path d="${torso}"/></clipPath></defs>${body}<g clip-path="url(#body)">${stripes}${knit ? '<rect width="500" height="540" fill="url(#rib)"/>' : ""}</g>${detail}${buttons}${hoodie}<path d="M155 202L163 434M345 202L337 434M183 180L192 307M317 180L308 307" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="4"/></svg>`;
  await writeFile(`public${p.image}`, svg);
}
await writeFile(
  "public/favicon.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#242b23"/><text x="15" y="46" fill="#d6e7a0" font-size="47" font-family="Arial" font-weight="700">k</text></svg>',
);
const q = (value) => "'" + value.replaceAll("'", "''") + "'";
const rows = catalog.map(
  (p) =>
    `(${[p.id, p.name, p.subtitle, p.category].map(q).join(",")},${p.price},${[p.image, p.color, p.color_hex].map(q).join(",")},${q(JSON.stringify(p.colors))}::jsonb,${q(p.fit)},${q(JSON.stringify(p.sizes))}::jsonb,ARRAY[${p.tags.map(q).join(",")}],${q(p.description)},${q(p.material)})`,
);
await writeFile(
  "supabase/migrations/202611140002_demo_catalog.sql",
  `-- 展示商品 fixtures，非真實商店庫存；不覆蓋既有商品。由 scripts/assets.mjs 產出。\ninsert into public.kiki_products(id,name,subtitle,category,price,image,color,color_hex,colors,fit,sizes,tags,description,material) values\n${rows.join(",\n")}\non conflict(id) do nothing;\n`,
);
