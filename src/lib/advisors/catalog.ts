/**
 * Shipped traders. This file is the update.
 * Bump `version` inside a file when the rule changes.
 * User files are not in this module, and a bump does not rewrite them.
 */

import { parseAdvisor } from "@/lib/advisors/parse";
import type { AdvisorSpec } from "@/lib/advisors/types";

export const CATALOG = 1;

const FILES: { id: string; source: string }[] = [
  {
    id: "ship:discount",
    source: `version 1
title Discount
line Names at least 2% under the mark. Equal dollars. You sign each.
mode book
side buy
premium <= -0.02
take 4
split equal
rank premium`,
  },
  {
    id: "ship:trim",
    source: `version 1
title Trim the rich
line Names at least 2% over the mark. A sell only works if the wallet holds the token.
mode book
side sell
premium >= 0.02
take 4
split equal
rank premium`,
  },
  {
    id: "ship:depth",
    source: `version 1
title Depth
line The discount names with at least $25,000 in the pool. Thin pools are left out.
mode book
side buy
premium <= -0.02
liquidity >= 25000
take 4
split equal
rank premium`,
  },
  {
    id: "ship:claim",
    source: `version 1
title Cheaper claim
line Same name, two tokens. Buys the one further under its own mark, after the fee band. They are not the same claim.
mode wrap
side buy
take 4
split equal`,
  },
  {
    id: "ship:fade",
    source: `version 1
title Fade the day
line The worst 24h print. One buy. Not a promise it turns.
mode day-worst
side buy
change <= -1%
take 1
split one
rank change`,
  },
  {
    id: "ship:follow",
    source: `version 1
title Follow the day
line The best 24h print. One buy. You still sign.
mode day-best
side buy
change >= 1%
take 1
split one
rank change`,
  },
];

function compile(file: { id: string; source: string }): AdvisorSpec {
  const parsed = parseAdvisor(file.source, file.id, "shipped");
  if (!parsed.ok) throw new Error(`${file.id}: ${parsed.error}`);
  return parsed.spec;
}

export const SHIPPED: AdvisorSpec[] = FILES.map(compile);

export function shippedFile(id: string): AdvisorSpec | undefined {
  return SHIPPED.find((row) => row.id === id);
}
