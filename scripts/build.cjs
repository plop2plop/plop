/* Plop product refresh.
   Reads each shop's public Shopify product list (shops.json) and writes products.js for the page.
   Runs daily on GitHub Actions; needs Node 18 or newer and nothing else.

   Rules it follows:
   - One gentle pass per day: one request per page of 250 products, a second apart.
   - A shop whose prices aren't in AUD is skipped, so Plop never shows the wrong currency.
   - If a shop can't be read today, yesterday's products for that shop are kept. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "products.js");
const SHOPS = JSON.parse(fs.readFileSync(path.join(ROOT, "shops.json"), "utf8")).shops;
const UA = "Mozilla/5.0 (compatible; Plop personal product search)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(url + " returned HTTP " + res.status);
  return res.json();
}

/* Turn one Shopify product into the small record the page uses. */
function trim(shop, pr) {
  const vs = pr.variants || [];
  const prices = vs.map((v) => parseFloat(v.price)).filter((x) => !isNaN(x));
  const was = vs.map((v) => parseFloat(v.compare_at_price)).filter((x) => !isNaN(x) && x > 0);
  const img = pr.images && pr.images[0] ? pr.images[0].src : null;
  if (!img || !prices.length) return null;
  const tags = (Array.isArray(pr.tags) ? pr.tags : String(pr.tags || "").split(",")).map((x) => String(x).trim()).filter(Boolean);
  const tagText = tags.map((x) => x.toLowerCase()).join("|") + "|" + String(pr.product_type || "").toLowerCase();
  // Gender from the shop's own tags or type: unisex, mens, otherwise womens (these are womenswear-led shops).
  const isMens = /(^|[|\s-])mens?([|\s-]|$)|men's|gender:\s*men/.test(tagText);
  const isWomens = /womens?|women's/.test(tagText);
  const g = /unisex/.test(tagText) || (isMens && isWomens) ? "u" : isMens ? "m" : "w";
  const price = Math.min(...prices);
  const wasMax = was.length ? Math.max(...was) : 0;
  return {
    s: shop.name,
    t: pr.title,
    u: "https://" + shop.host + "/products/" + pr.handle,
    i: img,
    g,
    p: price,
    w: wasMax > price ? wasMax : 0,
    c: String(pr.product_type || "").trim(),
    v: pr.vendor || "",
    d: String(pr.published_at || pr.created_at || "").slice(0, 10),
    k: tags.slice(0, 12).join(" "),
  };
}

async function readShop(shop) {
  let currency = null;
  try { currency = (await getJSON("https://" + shop.host + "/cart.js")).currency; } catch (e) { /* not fatal */ }
  if (currency && currency !== "AUD") throw new Error("prices are in " + currency + ", not AUD");
  const items = [];
  for (let page = 1; page <= 40; page++) {
    const data = await getJSON("https://" + shop.host + "/products.json?limit=250&page=" + page);
    if (!data.products || !data.products.length) break;
    for (const pr of data.products) { const it = trim(shop, pr); if (it) items.push(it); }
    await sleep(1000);
  }
  if (!items.length) throw new Error("no products found");
  return items;
}

function readPrevious() {
  try {
    const src = fs.readFileSync(OUT, "utf8");
    const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    return JSON.parse(json).products || [];
  } catch (e) { return []; }
}

async function main() {
  const previous = readPrevious();
  const products = [];
  const report = [];
  for (const shop of SHOPS) {
    try {
      const items = await readShop(shop);
      products.push(...items);
      report.push("✓ " + shop.name + ": " + items.length + " products");
    } catch (e) {
      const kept = previous.filter((p) => p.s === shop.name);
      products.push(...kept);
      report.push("✗ " + shop.name + ": " + e.message + " (kept " + kept.length + " from last time)");
    }
  }
  const now = new Date();
  const date = now.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" });
  const iso = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const js = "/* Built by scripts/build.cjs from each shop's public Shopify product list. Do not edit by hand. */\n"
    + "window.PLOP = " + JSON.stringify({ date, iso, products }) + ";\n";
  fs.writeFileSync(OUT, js);
  console.log(report.join("\n"));
  console.log("Total: " + products.length + " products, updated " + date);
}

main().catch((e) => { console.error(e); process.exit(1); });
