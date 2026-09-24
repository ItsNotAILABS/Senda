import { chromium } from "playwright";

const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const err = [];
p.on("pageerror", (e) => err.push(String(e.message)));
await p.goto("http://127.0.0.1:8080/invest", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(2500);
let t = await p.locator("body").innerText();
console.log("TRADE", {
  jup: /Jupiter/.test(t),
  minty: /Minty/.test(t),
  fill: /Fill on Jupiter/.test(t),
  agent: /don.t take the other side|agent/.test(t),
  quote: /USDC/.test(t) || /Quoting/.test(t),
});
await p.screenshot({ path: "/workspace/screenshots/qa-trade.png" });
await p.getByRole("button", { name: "Minty" }).click();
await p.waitForTimeout(400);
t = await p.locator("body").innerText();
console.log("MINTY", /Pump\.fun/.test(t), /Ethereum/.test(t), /route_fill/.test(t));
await p.goto("http://127.0.0.1:8080/social", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(1800);
t = await p.locator("body").innerText();
console.log("PLAY", /Fill on Jupiter/.test(t), /1.85/.test(t), /warehouse/.test(t) || /other side/.test(t));
await p.goto("http://127.0.0.1:8080/more", { waitUntil: "domcontentloaded", timeout: 20000 });
await p.waitForTimeout(600);
t = await p.locator("body").innerText();
console.log("YOU", /pain\.001/.test(t), /ISO 8583/.test(t), /SENDAUS4F/.test(t), /SD\d{2}SENDA/.test(t));
console.log("ERR", err.slice(0, 4));
await b.close();
