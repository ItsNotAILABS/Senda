import { useCallback, useEffect, useMemo, useState } from "react";
import { getFx, rate } from "@/lib/wallet-fx";
import {
  FALLBACK_USD,
  addMoney,
  addPayApple,
  addPayBank,
  addPayCard,
  addMaskedCard,
  addPayApp,
  fundMasked,
  sealIssued,
  addPayUsdc,
  upsertContact,
  buyCover,
  payCover,
  playStake,
  playWin,
  claimNearby,
  convert,
  createSenda,
  investCredit,
  investDebit,
  investFromVault,
  issueCard,
  issueCheckout,
  issueNearby,
  isWeekend,
  linkChain,
  unlinkChain,
  loadWallet,
  openCurrency,
  openVault,
  receiveFrom,
  saveWallet,
  sendTo,
  setTag,
  spendCard,
  terminateCard,
  replaceCard,
  setCardLimit,
  toggleFreeze,
  totalUsd,
  vaultIn,
  vaultOut,
  withdraw,
  releaseToWallet,
  type CardKind,
  type Ccy,
  type Contact,
  type FundSource,
  type Wallet,
} from "@/lib/wallet";
import { decodeNote } from "@/lib/nearby";

export function useWallet() {
  const blank: Wallet = {
    tag: "@you",
    balances: { USD: 0, EUR: 0, GBP: 0, MXN: 0, USDC: 0, SOL: 0 },
    opened: ["USD"],
    pockets: [],
    vaults: [],
    senda: null,
    links: [],
    notes: [],
    cards: [],
    methods: [],
    contacts: [],
    txs: [],
    policies: [],
    cardAuths: [],
  };
  const [w, setW] = useState<Wallet>(blank);
  const [usdPer, setUsdPer] = useState(FALLBACK_USD);
  const [ready, setReady] = useState(false);
  const weekend = isWeekend();

  useEffect(() => {
    setW(loadWallet());
    setReady(true);
    getFx()
      .then(setUsdPer)
      .catch(() => {
        /* fallback */
      });
    const id = window.setInterval(() => {
      getFx()
        .then(setUsdPer)
        .catch(() => {
          /* keep */
        });
    }, 45_000);
    return () => window.clearInterval(id);
  }, []);

  const commit = useCallback((next: Wallet | { error: string }): { ok: boolean; error?: string } => {
    if ("error" in next) return { ok: false, error: next.error };
    setW(next);
    saveWallet(next);
    return { ok: true };
  }, []);

  const usd = totalUsd(w, usdPer);

  const actions = useMemo(
    () => ({
      add: (amount: number, ccy: Ccy = "USD", source: FundSource = "bank") =>
        commit(addMoney(w, amount, ccy, source)),
      setTag: (tag: string) => commit(setTag(w, tag)),
      addCard: (pan: string, expiry: string, cvv: string, nameOn: string) =>
        commit(addPayCard(w, pan, expiry, cvv, nameOn)),
      addMasked: (last4: string, expiry: string, nameOn: string, token: string) =>
        commit(addMaskedCard(w, last4, expiry, nameOn, token)),
      addApp: (kind: "cashapp" | "chime" | "venmo", handle: string) => commit(addPayApp(w, kind, handle)),
      fundMasked: (amount: number, token: string) => commit(fundMasked(w, amount, token)),
      sealIssued: (id: string) => commit(sealIssued(w, id)),
      addBank: (bank: string, routing: string, account: string) =>
        commit(addPayBank(w, bank, routing, account)),
      addApple: () => {
        const next = addPayApple(w);
        setW(next);
        saveWallet(next);
        return { ok: true as const };
      },
      addUsdc: () => {
        const next = addPayUsdc(w);
        setW(next);
        saveWallet(next);
        return { ok: true as const };
      },
      withdraw: (amount: number, ccy: Ccy = "USD") => commit(withdraw(w, amount, ccy)),
      release: (amount: number, label: string) => commit(releaseToWallet(w, amount, label)),
      send: (amount: number, ccy: Ccy, contact: Contact, note: string) => {
        const { wallet } = upsertContact(w, contact.name, contact.tag);
        const amountUsd = amount * (usdPer[ccy] || 0);
        return commit(sendTo(wallet, amount, ccy, contact, note, amountUsd, weekend));
      },
      remember: (name: string, tag: string) => {
        const { wallet, contact } = upsertContact(w, name, tag);
        setW(wallet);
        saveWallet(wallet);
        return contact;
      },
      receive: (amount: number, ccy: Ccy, from: string, note: string) => {
        const next = receiveFrom(w, amount, ccy, from, note);
        setW(next);
        saveWallet(next);
        return { ok: true as const };
      },
      convert: (from: Ccy, to: Ccy, amount: number) => {
        const r = rate(from, to, usdPer);
        const amountUsd = amount * (usdPer[from] || 0);
        return commit(convert(w, from, to, amount, r, amountUsd, weekend));
      },
      cardSpend: (amount: number, merchant: string, cardId?: string, mcc?: string) =>
        commit(spendCard(w, amount, merchant, cardId, mcc)),
      freeze: (cardId: string) => {
        const next = toggleFreeze(w, cardId);
        setW(next);
        saveWallet(next);
      },
      terminate: (cardId: string) => {
        const next = terminateCard(w, cardId);
        setW(next);
        saveWallet(next);
      },
      replace: (cardId: string) => commit(replaceCard(w, cardId)),
      setLimit: (cardId: string, n: number) => commit(setCardLimit(w, cardId, n)),
      issue: (kind: CardKind, nameOn?: string, dailyLimit?: number) =>
        commit(issueCard(w, kind, nameOn, dailyLimit)),
      issueCheckout: (cap: number, merchant: string, nameOn?: string) => {
        const r = issueCheckout(w, cap, merchant, nameOn);
        if ("error" in r) return { ok: false as const, error: r.error };
        setW(r.wallet);
        saveWallet(r.wallet);
        return { ok: true as const, reveal: r.reveal };
      },
      cover: (plan: { id: string; title: string; premium: number; cover: number; term: string }) =>
        commit(buyCover(w, plan)),
      payCover: (amount: number, title: string) => commit(payCover(w, amount, title)),
      playStake: (amount: number, note: string) => commit(playStake(w, amount, note)),
      playWin: (amount: number, note: string) => {
        const next = playWin(w, amount, note);
        setW(next);
        saveWallet(next);
        return { ok: true as const };
      },
      investOut: (amount: number, name: string) => commit(investDebit(w, amount, name)),
      investFromVault: (vaultId: string, amount: number, name: string) =>
        commit(investFromVault(w, vaultId, amount, name)),
      investIn: (amount: number, name: string) => {
        const next = investCredit(w, amount, name);
        setW(next);
        saveWallet(next);
        return { ok: true as const };
      },
      createWallet: () => commit(createSenda(w)),
      linkChain: (address: string, label: string, kind: "phantom" | "solana" | "evm") =>
        commit(linkChain(w, address, label, kind)),
      unlink: (address: string) => {
        const next = unlinkChain(w, address);
        setW(next);
        saveWallet(next);
      },
      openVault: (name: string, ccy: Ccy = "USD") => commit(openVault(w, name, ccy)),
      openCurrency: (ccy: Ccy) => commit(openCurrency(w, ccy)),
      vaultIn: (id: string, amount: number) => commit(vaultIn(w, id, amount)),
      vaultOut: (id: string, amount: number) => commit(vaultOut(w, id, amount)),
      nearbySend: (amount: number, ccy: Ccy) => {
        const r = issueNearby(w, amount, ccy);
        if ("error" in r) return { ok: false as const, error: r.error };
        setW(r.wallet);
        saveWallet(r.wallet);
        return { ok: true as const, note: r.note };
      },
      nearbyClaim: (raw: string) => {
        const p = decodeNote(raw);
        if ("error" in p) return { ok: false as const, error: p.error };
        return commit(claimNearby(w, p));
      },
    }),
    [commit, usdPer, w, weekend],
  );

  return { w, usd, usdPer, weekend, ready, ...actions };
}
