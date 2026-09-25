use crate::pay::usd_to_atoms;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CoverKind {
    Drop = 0,
    Life = 1,
}

/// Terms that ride in the memo of the premium transfer.
/// Strike, cover, and premium are USDC atoms. `until` is a unix second.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CoverTerms {
    pub kind: CoverKind,
    pub symbol: String,
    pub strike_atoms: u64,
    pub cover_atoms: u64,
    pub premium_atoms: u64,
    pub until: u64,
}

impl CoverTerms {
    pub fn drop(symbol: &str, strike_usd: f64, cover_usd: f64, premium_usd: f64, until: u64) -> Result<Self, &'static str> {
        Self::new(CoverKind::Drop, symbol, strike_usd, cover_usd, premium_usd, until)
    }

    pub fn new(
        kind: CoverKind,
        symbol: &str,
        strike_usd: f64,
        cover_usd: f64,
        premium_usd: f64,
        until: u64,
    ) -> Result<Self, &'static str> {
        let symbol = symbol.trim().to_uppercase();
        if symbol.is_empty() || symbol.len() > 12 || !symbol.bytes().all(|b| b.is_ascii_alphanumeric()) {
            return Err("symbol");
        }
        Ok(Self {
            kind,
            symbol,
            strike_atoms: usd_to_atoms(strike_usd)?,
            cover_atoms: usd_to_atoms(cover_usd)?,
            premium_atoms: usd_to_atoms(premium_usd)?,
            until,
        })
    }

    pub fn memo(&self) -> String {
        format!(
            "Senda cover {} {} strike={} cover={} premium={} until={}",
            match self.kind {
                CoverKind::Drop => "drop",
                CoverKind::Life => "life",
            },
            self.symbol,
            self.strike_atoms,
            self.cover_atoms,
            self.premium_atoms,
            self.until,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_ten_percent_drop_is_a_memo_not_a_policy() {
        let terms = CoverTerms::drop("OPENAI", 12.5, 100.0, 4.0, 1_700_000_000).unwrap();
        assert_eq!(terms.strike_atoms, 12_500_000);
        assert_eq!(terms.premium_atoms, 4_000_000);
        assert_eq!(
            terms.memo(),
            "Senda cover drop OPENAI strike=12500000 cover=100000000 premium=4000000 until=1700000000"
        );
    }
}
