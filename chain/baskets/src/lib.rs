//! Baskets. One account is one recipe.
//!
//! Instruction Open is tag 0, a 16-byte name, a leg count, then each leg as
//! a 32-byte mint and a little-endian weight in basis points. Weights sum to
//! 10_000. The account stores the recipe. It does not hold tokens and it does
//! not pay yield.
//!
//! Account, 291 bytes: state, bump, name, count, then up to eight legs.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

const ACCOUNT: usize = 19 + 8 * 34;

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (name, legs) = parse_open(data)?;
    let accounts = &mut accounts.iter();
    let payer = next_account_info(accounts)?;
    let basket = next_account_info(accounts)?;
    let system = next_account_info(accounts)?;
    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if system.key != &system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    let (expected, bump) = Pubkey::find_program_address(&[b"basket", payer.key.as_ref(), &name], program_id);
    if basket.key != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    if basket.data_len() > 0 && basket.try_borrow_data()?[0] == 1 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    if basket.data_is_empty() {
        let rent = Rent::get()?.minimum_balance(ACCOUNT);
        invoke_signed(
            &system_instruction::create_account(payer.key, basket.key, rent, ACCOUNT as u64, program_id),
            &[payer.clone(), basket.clone(), system.clone()],
            &[&[b"basket", payer.key.as_ref(), &name, &[bump]]],
        )?;
    }
    if basket.data_len() < ACCOUNT {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let mut body = basket.try_borrow_mut_data()?;
    body.fill(0);
    body[0] = 1;
    body[1] = bump;
    body[2..18].copy_from_slice(&name);
    body[18] = legs as u8;
    let width = legs * 34;
    body[19..19 + width].copy_from_slice(&data[18..18 + width]);
    Ok(())
}

/// Name and leg count. Rejects a bad weight, a zero mint, or a repeated mint.
pub fn parse_open(data: &[u8]) -> Result<([u8; 16], usize), ProgramError> {
    if data.first() != Some(&0) || data.len() < 18 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut name = [0u8; 16];
    name.copy_from_slice(&data[1..17]);
    if !name_ok(&name) {
        return Err(ProgramError::InvalidInstructionData);
    }
    let legs = data[17] as usize;
    if !(2..=8).contains(&legs) || data.len() != 18 + legs * 34 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut sum: u32 = 0;
    let mut seen = [[0u8; 32]; 8];
    for i in 0..legs {
        let at = 18 + i * 34;
        let mint = &data[at..at + 32];
        if mint.iter().all(|b| *b == 0) {
            return Err(ProgramError::InvalidInstructionData);
        }
        for prev in &seen[..i] {
            if prev == mint {
                return Err(ProgramError::InvalidInstructionData);
            }
        }
        seen[i].copy_from_slice(mint);
        let bps = u16::from_le_bytes([data[at + 32], data[at + 33]]) as u32;
        if bps == 0 || bps > 10_000 {
            return Err(ProgramError::InvalidInstructionData);
        }
        sum += bps;
    }
    if sum != 10_000 {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok((name, legs))
}

fn name_ok(name: &[u8; 16]) -> bool {
    let Some(end) = name.iter().rposition(|b| *b != 0).map(|i| i + 1) else {
        return false;
    };
    if end < 2 {
        return false;
    }
    name[..end].iter().all(|b| b.is_ascii_alphanumeric() || *b == b' ')
}

#[cfg(test)]
mod tests {
    use super::parse_open;

    fn decode(text: &str) -> Vec<u8> {
        (0..text.len()).step_by(2).map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap()).collect()
    }

    #[test]
    fn the_python_encoder_is_the_instruction() {
        let raw = decode("004361727279000000000000000000000002069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f000000000018813c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d618813");
        let (name, legs) = parse_open(&raw).unwrap();
        assert_eq!(&name[..5], b"Carry");
        assert_eq!(legs, 2);
    }

    #[test]
    fn a_short_weight_is_rejected() {
        let mut raw = decode("004361727279000000000000000000000002069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f000000000018813c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d618813");
        let n = raw.len();
        raw[n - 1] = 0;
        raw[n - 2] = 1;
        assert!(parse_open(&raw).is_err());
    }
}
