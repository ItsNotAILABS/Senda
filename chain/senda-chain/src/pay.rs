pub const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
pub const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/// USDC has 6 decimals. One dollar is 1_000_000 atoms.
pub fn usd_to_atoms(usd: f64) -> Result<u64, &'static str> {
    if !usd.is_finite() || usd <= 0.0 {
        return Err("amount");
    }
    let atoms = (usd * 1_000_000.0).round();
    if atoms > u64::MAX as f64 {
        return Err("amount");
    }
    Ok(atoms as u64)
}

/// SPL Token Transfer. Discriminator 3, then the amount, little-endian.
pub fn transfer(atoms: u64) -> [u8; 9] {
    let mut data = [0u8; 9];
    data[0] = 3;
    data[1..].copy_from_slice(&atoms.to_le_bytes());
    data
}

pub fn memo(usd: f64, reference: &str) -> String {
    format!("Senda USDC {:.2} ref={reference}", usd)
}

pub struct Pay {
    pub atoms: u64,
    pub data: [u8; 9],
    pub memo: String,
}

impl Pay {
    pub fn new(usd: f64, reference: &str) -> Result<Self, &'static str> {
        let atoms = usd_to_atoms(usd)?;
        Ok(Self {
            atoms,
            data: transfer(atoms),
            memo: memo(usd, reference),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_dollar_is_the_transfer_the_wallet_signs() {
        let pay = Pay::new(1.0, "ref11111111111111111111111111111111").unwrap();
        assert_eq!(pay.atoms, 1_000_000);
        assert_eq!(pay.data, [3, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]);
        assert_eq!(
            pay.memo,
            "Senda USDC 1.00 ref=ref11111111111111111111111111111111"
        );
    }

    #[test]
    fn rejects_a_zero_payment() {
        assert!(Pay::new(0.0, "ref").is_err());
    }
}
