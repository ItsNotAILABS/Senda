import { chromium } from "playwright";

const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(1200);
const body = await p.locator("body").innerText();
await p.screenshot({ path: "/workspace/screenshots/app-builder-preview-mobile.png" });
const overflow = await p.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
console.log(
  "HOME",
  JSON.stringify({
    title: await p.title(),
    senda: /Senda/.test(body),
    auro: /Auro/.test(body),
    card: /Debit card/.test(body),
    usdc: /USDC/.test(body),
    overflow,
    errors: errors.slice(0, 5),
    prefix: body.slice(0, 260).replace(/\s+/g, " "),
  }),
);
await p.getByRole("button", { name: /Debit card/ }).click();
await p.waitForTimeout(700);
const funded = await p.locator("body").innerText();
console.log("FUNDED", funded.includes("2,500"));
await p.getByRole("link", { name: "Cards" }).click();
await p.waitForTimeout(500);
const cards = await p.locator("body").innerText();
console.log("CARDS", /Virtual|Issue|Metal/.test(cards), /Mastercard/.test(cards));
await p.screenshot({ path: "/workspace/screenshots/qa-cards.png" });
await p.getByRole("link", { name: "Cover" }).click();
await p.waitForTimeout(500);
const cover = await p.locator("body").innerText();
console.log("COVER", /Phone|Travel|Life|Load/.test(cover));
await p.getByRole("link", { name: "Invest" }).click();
await p.waitForTimeout(1800);
const inv = await p.locator("body").innerText();
console.log("INVEST", /KALSHI|Insure|Jupiter|Solana/.test(inv), /POLYMARKET/.test(inv));
const d = await b.newPage({ viewport: { width: 1280, height: 800 } });
await d.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await d.waitForTimeout(800);
await d.screenshot({ path: "/workspace/screenshots/app-builder-preview.png" });
await b.close();
