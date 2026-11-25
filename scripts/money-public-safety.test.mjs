import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
test("public send route calls only real wallet-signed friend payment UI",()=>{
 const route=read("src/routes/payments/index.tsx");
 const ui=read("src/components/friends-money-desk.tsx");
 assert.match(route,/FriendsMoneyDesk/);
 assert.match(ui,/payUsdc\(\{owner:wallet,to:quote\.to,usd:quote\.usd/);
 assert.doesNotMatch(ui,/w\.send\(/);
});
test("request path creates a Solana Pay URI, not a synthetic receive",()=>{
 const page=read("src/routes/payments/request.tsx");
 const ui=read("src/components/money-rail-view.tsx");
 assert.match(page,/MoneyRailView mode="request"/);
 assert.match(ui,/usdcPayLink\(/);
 assert.doesNotMatch(ui,/w\.receive\(/);
});
test("legacy fake settlements cannot be called by public build",()=>{
 const source=read("src/lib/wallet.ts");
 for(const name of ["addMoney","withdraw","sendTo","convert","issueCard","issueCheckout","spendCard","payCover","addPayCard","addMaskedCard","addPayBank","replaceCard","setCardLimit","issueNearby"])
   assert.match(source,new RegExp("export function "+name+"\\([\\s\\S]{0,280}?if \\(!allowPaperLedger\\(\\)\\) return paperError\\(\\);"),name);
 assert.match(source,/if\(!allowPaperLedger\(\)\)return \{bank:"Not connected",routing:"",account:""\};/);
 const hook=read("src/lib/use-wallet.ts");
 assert.match(hook,/if \(!canUsePaperLedger\(\)\) return \{ok:false as const,error:UNSETTLED_PAYMENT_MESSAGE\};/);
});
test("Bridge account creation authenticates and proves wallet ownership",()=>{
 const server=read("src/lib/receive-account.ts"),client=read("src/components/account-details.tsx");
 assert.match(server,/\.middleware\(\[authMiddleware\]\)/);
 assert.match(server,/BRIDGE_ALLOWED_USER_ID/);
 assert.match(server,/context\.userId/);
 assert.match(server,/crypto\.subtle\.verify/);
 assert.match(client,/signMessage\(message,"utf8"\)/);
});
