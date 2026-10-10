(() => {
"use strict";
const $ = (s) => document.querySelector(s);
function el(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){ if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids) if (c != null && c !== "null" && c !== "undefined") e.append(c);
  return e;
}

/* ---- tidy the shops' own product types into one set of categories ----
   Checked in order, against the product name first, then the shop's type. */
const CATS = [
  ["Swimwear",       /\b(swim|swimwear|bikini|one piece|one-piece)\b/i],
  ["Dresses",        /\b(dress|dresses|drss|gown|pinafore)\b/i],
  ["Skirts",         /\b(skirt|skirts|skrt)\b/i],
  ["Jackets & coats",/\b(jacket|jackets|jkts?|coat|coats|blazer|vest|gilet|trench|parka)\b/i],
  ["Knitwear",       /\b(knit|knits|knitwear|cardi|cardigan|jumper|sweater|pullover|crew|turtleneck)\b/i],
  ["Shorts",         /\b(shorts|shor)\b|\bshort\b(?![\s-]*sleeve)/i],
  ["Pants",          /\b(pant|pants|jean|jeans|trouser|trousers|culotte|culottes|legging|leggings)\b/i],
  ["Tops",           /\b(top|tops|shirt|shirts|tee|tees|t-shirt|blouse|tank|cami|singlet|bodysuit|polo)\b/i],
  ["Shoes",          /\b(shoe|shoes|boot|boots|sandal|sandals|slip on|trainer|trainers|sneaker|sneakers|footwear|loafer|loafers|mule|mules|flat|flats|heel|heels|clog|clogs)\b/i],
  ["Bags",           /\b(bag|bags|tote|totes|cross body|crossbody|clutch|purse|backpack)\b/i],
  ["Accessories",    /\b(hat|hats|cap|belt|belts|scarf|scarves|sock|socks|accessories|jewellery|earring|earrings|necklace|bracelet|sunglasses|glove|gloves)\b/i],
];
const SKIP = /gift ?(card|voucher)|shoe care|fragrance|ceramic|candle|homeware|\bbook\b|beauty|administration|sold out hidden/i;
function categorise(p){
  for (const [name, re] of CATS) if (re.test(p.t)) return name;
  for (const [name, re] of CATS) if (re.test(p.c)) return name;
  return "Other";
}

/* ---- search ----
   Text is split into whole words, so "shorts" never matches "short sleeve" or "pants+shorts".
   Garment words (skirt, shorts, boots…) must be in the product's name or category;
   describing words (black, linen, midi…) can also match the shop's colour and fabric labels. */
function words(text){
  return String(text).toLowerCase()
    .replace(/t-shirt/g, "tshirt")
    .replace(/short[\s-]*sleeved?/g, "shortsleeve")
    .split(/[^a-z0-9]+/).filter(Boolean);
}
/* Shop labels: keep plain words and colour/fabric values; drop sizing, hem, sale and campaign codes. */
function labelWords(p){
  const tags = String(p.k || "").split(/\s+/);
  const keep = tags.filter(t=>!/^(size|hem|sleeve|length|fit|flag|sale|code|group|handle|location|collection|designtype|createdby|product_id|sibling|care|composer|cf-size|cf-type|sizeguidetype|displaytag)/i.test(t));
  return words(keep.join(" ") + " " + p.v);
}
const ITEMS = PRODUCTS
  .filter(p=>!SKIP.test(p.c) && !SKIP.test(p.t))
  .map(p=>{
    const cat = categorise(p);
    return {...p, cat,
      tw: new Set(words(p.t)),
      cw: new Set(words(cat + " " + p.c)),
      lw: new Set(labelWords(p)),
      img: p.i + (p.i.includes("?") ? "&" : "?") + "width=500"};
  });

const SYN = {
  pant:["pant","pants","trouser","trousers","jean","jeans"], trouser:["trouser","trousers","pant","pants"],
  jumper:["knit","jumper","sweater","cardi","cardigan"], sweater:["knit","jumper","sweater"], knitwear:["knit","knitwear"],
  sneaker:["sneaker","sneakers","trainer","trainers"], trainer:["trainer","trainers","sneaker","sneakers"],
  tee:["tee","tees","tshirt"], tshirt:["tee","tees","tshirt"],
  jacket:["jacket","jkt","jkts","coat","blazer"], coat:["coat","jacket","trench"],
  short:["short","shorts","shor"],
  grey:["grey","gray"], gray:["grey","gray"],
};
const GARMENT = new RegExp(CATS.map(c=>c[1].source).join("|"), "i");
function forms(w){
  const singular = w.endsWith("ies") ? w.slice(0,-3) + "y" : w.endsWith("es") && /(ss|sh|ch|x)es$/.test(w) ? w.slice(0,-2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0,-1) : w;
  return [...new Set([w, singular, singular + "s", ...(SYN[w] || []), ...(SYN[singular] || [])])];
}
function score(item, query){
  let total = 0;
  for (const w of query){
    const f = forms(w);
    if (f.some(x=>item.tw.has(x))) total += 3;
    else if (f.some(x=>item.cw.has(x))) total += 2;
    else if (!GARMENT.test(w) && f.some(x=>item.lw.has(x))) total += 1;
    else return 0;
  }
  return total;
}

/* ---- state ---- */
const SHOPS = [...new Set(ITEMS.map(p=>p.s))];
/* Three broad groups for filtering; the finer category still helps search ("skirt" ranks skirts first). */
const CLOTHES = ["Swimwear","Dresses","Skirts","Jackets & coats","Knitwear","Shorts","Pants","Tops"];
const GROUPS = ["Clothes","Shoes","Other"];
for (const p of ITEMS) p.group = CLOTHES.includes(p.cat) ? "Clothes" : p.cat === "Shoes" ? "Shoes" : "Other";
/* "New" is measured from the snapshot date, so an older snapshot still shows what was new then. */
const DATES = [[0,"Any time"],[7,"This week"],[30,"This month"],[90,"Last 3 months"]];
const SNAP = new Date(SNAPSHOT_ISO + "T23:59:59");
let genderOn = new Set(["w"]), groupOn = new Set(), dateDays = 0, shopOn = new Set(SHOPS), page = 1;
/* "For": womens, mens, or both. Unisex items show under either. */
const GENDERS = [["w","Womens"],["m","Mens"]];
const genderOk = (p) => !genderOn.size || p.g === "u" || genderOn.has(p.g || "w");
const daysOld = (p) => p.d ? (SNAP - new Date(p.d + "T12:00:00")) / 864e5 : Infinity;
const PAGE = 48;

/* ---- wishlist: saved in this browser, keyed by product link ----
   Each entry keeps the product as it was when saved, so it survives a newer snapshot
   and Plop can show when the price has changed since. */
const store = {
  get(k, d){ try{ const v = localStorage.getItem("plop2." + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem("plop2." + k, JSON.stringify(v)); } catch(e){} },
};
let wish = store.get("wish", {});
let wishView = false;
const byUrl = new Map(ITEMS.map(p=>[p.u, p]));
function isSaved(p){ return !!wish[p.u]; }
function toggleWish(p){
  if (wish[p.u]) delete wish[p.u];
  else wish[p.u] = {s:p.s, t:p.t, u:p.u, img:p.img, p:p.p, w:p.w, cat:p.cat, group:p.group, g:p.g, c:p.c, k:p.k, v:p.v, d:p.d, saved:Date.now()};
  store.set("wish", wish);
  updateWishCount();
}
function updateWishCount(){ $("#wishCount").textContent = String(Object.keys(wish).length); }
/* Wishlist items, using the snapshot's current price where the product is still listed. */
function wishItems(){
  return Object.values(wish).map(w=>{
    const now = byUrl.get(w.u);
    if (now) return {...now, saved:w.saved, savedPrice:w.p, gone:false};
    // No longer in the snapshot: rebuild what search and filters need from the saved copy.
    const cat = w.cat || categorise(w);
    return {...w, cat, group: w.group || (CLOTHES.includes(cat) ? "Clothes" : cat === "Shoes" ? "Shoes" : "Other"),
      tw:new Set(words(w.t)), cw:new Set(words(cat + " " + (w.c||""))), lw:new Set(labelWords(w)), savedPrice:w.p, gone:true};
  });
}

function renderFilters(){
  const chip = (label, on, onclick, count) => el("button",{type:"button",class:"chip","aria-pressed":String(on),onclick}, label, count != null ? el("small",{}, String(count)) : null);
  const refresh = () => { page = 1; renderFilters(); render(); };
  $("#genders").replaceChildren(...GENDERS.map(([k, label])=>chip(label, genderOn.has(k),
    ()=>{ genderOn.has(k) ? genderOn.delete(k) : genderOn.add(k); refresh(); }, ITEMS.filter(p=>shopOn.has(p.s) && (p.g === k || p.g === "u")).length)));
  $("#cats").replaceChildren(...GROUPS.map(g=>chip(g, groupOn.has(g),
    ()=>{ groupOn.has(g) ? groupOn.delete(g) : groupOn.add(g); refresh(); }, ITEMS.filter(p=>p.group===g && shopOn.has(p.s) && genderOk(p)).length)));
  $("#dates").replaceChildren(...DATES.map(([days, text])=>chip(text, dateDays === days, ()=>{ dateDays = days; refresh(); })));
  const active = (genderOn.size !== 1 || !genderOn.has("w") ? 1 : 0) + groupOn.size + (dateDays ? 1 : 0) + (shopOn.size !== SHOPS.length ? 1 : 0);
  $("#filterBox .sumtext").textContent = $("#filterBox").open ? "Hide filters" : "Show filters";
  $("#shops").replaceChildren(...SHOPS.map(s=>chip(s, shopOn.has(s),
    ()=>{ shopOn.has(s) ? shopOn.delete(s) : shopOn.add(s); refresh(); }, ITEMS.filter(p=>p.s===s).length)));
}
const money = (n) => { n = Number(n); return isFinite(n) ? "A$" + (Number.isInteger(n) ? n : n.toFixed(2)) : ""; };

function render(){
  const raw = $("#q").value.trim();
  const query = words(raw);
  const min = parseFloat($("#pmin").value) || 0, max = parseFloat($("#pmax").value) || Infinity;
  const sale = $("#saleOnly").checked;
  let list = wishView ? wishItems() : ITEMS.filter(p=>shopOn.has(p.s) && genderOk(p) && (!groupOn.size || groupOn.has(p.group)) && p.p >= min && p.p <= max && (!sale || p.w)
    && (!dateDays || daysOld(p) <= dateDays));
  if (query.length && !wishView) list = list.map(p=>({p, sc: score(p, query)})).filter(x=>x.sc > 0).map(x=>(x.p._sc = x.sc, x.p));
  const sort = $("#sort").value;
  list.sort((a,b)=>
    sort === "low" ? a.p - b.p :
    sort === "high" ? b.p - a.p :
    wishView ? (b.saved - a.saved) :
    sort === "new" || !query.length ? (b.d > a.d ? 1 : b.d < a.d ? -1 : 0) :
    (b._sc - a._sc) || (b.d > a.d ? 1 : -1));

  const noun = wishView ? (list.length === 1 ? " saved item" : " saved items") : (list.length === 1 ? " product" : " products");
  $("#count").replaceChildren(list.length + noun,
    wishView ? el("span",{}, " · most recently saved first") : raw ? el("span",{}, " for “" + raw + "”") : el("span",{}, " · newest first"));

  // Wishlist summary: total, and a way back.
  const bar = $("#wishBar");
  bar.hidden = !wishView;
  if (wishView){
    const total = list.reduce((n,p)=>n + p.p, 0);
    bar.replaceChildren(
      el("span",{class:"total"}, list.length ? "Total " + money(Math.round(total*100)/100) : "Nothing saved yet"),
      list.length ? el("button",{type:"button",class:"btn",onclick:(e)=>copyWishlist(list, e.currentTarget)},"Copy list") : null,
      el("button",{type:"button",class:"btn",onclick:()=>setWishView(false)},"Back to all products"));
  }

  updateWishCount();
  const shown = list.slice(0, page * PAGE);
  $("#grid").replaceChildren(...(shown.length ? shown.map(p=>{
    const heart = el("button",{type:"button",class:"heart","aria-pressed":String(isSaved(p)),
      "aria-label":(isSaved(p) ? "Remove " : "Save ") + p.t + (isSaved(p) ? " from" : " to") + " wishlist",
      onclick:()=>{ toggleWish(p); render(); }}, isSaved(p) ? "♥" : "♡");
    const changed = wishView && !p.gone && p.savedPrice !== p.p;
    return el("div",{class:"card"},
      el("div",{class:"imgwrap"},
        el("a",{class:"img",href:p.u,target:"_blank",rel:"noopener",tabindex:"-1","aria-hidden":"true"},
          el("img",{src:p.img || "",alt:"",loading:"lazy",decoding:"async",referrerpolicy:"no-referrer",onerror:(e)=>{ e.currentTarget.replaceWith(el("span",{class:"nophoto"}, p.s || "Photo unavailable")); }}),
          p.w ? el("span",{class:"badge"},"Sale") : null),
        heart),
      el("span",{class:"shop"}, p.s),
      el("a",{class:"name",href:p.u,target:"_blank",rel:"noopener"}, p.t),
      el("span",{class:"cost"}, money(p.p), p.w ? el("s",{}, money(p.w)) : null),
      changed ? el("span",{class:"note" + (p.p > p.savedPrice ? " up" : "")}, (p.p < p.savedPrice ? "Price dropped from " : "Price up from ") + money(p.savedPrice) + " when saved") : null,
      wishView && p.gone ? el("span",{class:"note"},"Not in the latest snapshot. It may have sold out.") : null);
  }) : [el("div",{class:"empty",style:"grid-column:1/-1"},
        wishView ? (Object.keys(wish).length ? "No saved items match these filters." : "Tap ♡ on any product to save it here.")
          : !shopOn.size ? "No shops selected. Pick some under Shops, or use Select all."
          : "Nothing in these shops matches. Try fewer words, another category, or search the other shops on Google below.")]));
  $("#showMore").hidden = shown.length >= list.length;
  $("#showMore").textContent = "Show more (" + (list.length - shown.length) + " left)";

  const others = ["theiconic.com.au","farfetch.com/au","theoutnet.com/en-au","asos.com/au","cos.com","zara.com","net-a-porter.com","ssense.com"];
  const gq = (raw || "clothing") + " (" + others.map(d=>"site:"+d).join(" OR ") + ")";
  $("#googleOthers").href = "https://www.google.com/search?tbm=isch&gl=au&hl=en-AU&q=" + encodeURIComponent(gq);
  $("#googleOthers").textContent = raw ? "Search “" + raw + "” on Google" : "Search them on Google";
}

function setWishView(on){
  wishView = on; page = 1;
  $("#tabAll").setAttribute("aria-selected", String(!on));
  $("#tabWish").setAttribute("aria-selected", String(on));
  $("#filters").hidden = on;
  $("#sortWrap").hidden = on;
  document.querySelector(".layout").classList.toggle("solo", on);
  render(); window.scrollTo({top:0});
}
async function copyWishlist(list, btn){
  const text = list.map(p=>p.t + " · " + p.s + " · " + money(p.p) + "\n" + p.u).join("\n\n");
  try{ await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
  catch(e){ btn.textContent = "Couldn't copy"; }
  setTimeout(()=>{ btn.textContent = "Copy list"; }, 1800);
}
$("#tabAll").addEventListener("click", ()=>setWishView(false));
$("#tabWish").addEventListener("click", ()=>setWishView(true));
$("#shopsAll").addEventListener("click", ()=>{ shopOn = new Set(SHOPS); page = 1; renderFilters(); render(); });
$("#shopsNone").addEventListener("click", ()=>{ shopOn.clear(); page = 1; renderFilters(); render(); });
updateWishCount();

let t;
$("#q").addEventListener("input", ()=>{ if (wishView) setWishView(false); clearTimeout(t); t = setTimeout(()=>{ page = 1; render(); }, 120); });
$("#form").addEventListener("submit", e=>{ e.preventDefault(); page = 1; render(); });
for (const id of ["#pmin","#pmax"]) $(id).addEventListener("input", ()=>{ page = 1; render(); });
for (const id of ["#saleOnly","#sort"]) $(id).addEventListener("change", ()=>{ page = 1; render(); });
$("#showMore").addEventListener("click", ()=>{ page++; render(); });

$("#status").replaceChildren(
  el("span",{}, ITEMS.length + " products from " + SHOPS.join(", ")),
  el("span",{}, "Updated " + SNAPSHOT_DATE + ". Check the shop for the latest price"),
  el("span",{}, "No ads · no sponsored results · you choose the order"));
if (matchMedia("(max-width:780px)").matches) $("#filterBox").removeAttribute("open");
$("#filterBox").addEventListener("toggle", ()=>renderFilters());
renderFilters(); render();
})();
