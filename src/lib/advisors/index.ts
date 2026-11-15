/**
 * Advisor module map.
 *
 * catalog.ts   shipped files. This is what an update changes.
 * parse.ts     the file language. No eval.
 * engine.ts    one spec, the live book, a list of orders.
 * user-book.ts this browser's files and apps. Catalog writes never land here.
 *
 * A desk imports this barrel. It does not reimplement a rule.
 */

export { CATALOG, SHIPPED, shippedFile } from "@/lib/advisors/catalog";
export { runAdvisor } from "@/lib/advisors/engine";
export { NEW_TRADER, parseAdvisor } from "@/lib/advisors/parse";
export { ackCatalog, createUserSource, dropApp, dropUserFile, listApps, listUserFiles, pullCatalog, saveApp, saveSealedSource, sealUserFile, unlockUserFile, userFileLock, userSpecs, writeUserSource } from "@/lib/advisors/user-book";
export type { AdvisorApp, AdvisorOrder, AdvisorRun, AdvisorSpec, CatalogUpdate } from "@/lib/advisors/types";
