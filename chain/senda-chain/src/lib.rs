//! Chain codec for Senda.
//!
//! A payment is an SPL Token `Transfer` of USDC (instruction 3) plus a memo.
//! A cover is the same transfer with these terms in the memo. There is no
//! Senda program and no program id. The wallet signs.

mod book;
mod cover;
mod pay;

pub use book::{cheapest, premium, Name};
pub use cover::{CoverKind, CoverTerms};
pub use pay::{memo, transfer, usd_to_atoms, Pay, TOKEN_PROGRAM, USDC_MINT};

pub const ATA_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const MEMO_PROGRAM: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
