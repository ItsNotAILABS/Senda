//! Native treasury. The account is the API.
//!
//! Any program can read these 92 bytes. Any signer can fund it.
//! Draw moves lamports only when byte 10 is 1. Init writes 0.
//!
//! 0..8    SENDATRY
//! 8       version 1
//! 9       bump
//! 10      spend_open
//! 11      reserved
//! 12..44  authority
//! 44..52  funded lamports, little-endian
//! 52..60  fund count
//! 60..92  last funder

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    declare_id,
    entrypoint,
    entrypoint::ProgramResult,
    program::invoke,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};

declare_id!("DeJVhSszpHrwHonu78hnYxrQxcr6ZEuYgwZmzYQYXpwy");
entrypoint!(process_instruction);

pub const MAGIC: &[u8; 8] = b"SENDATRY";
pub const LEN: usize = 92;
pub const CLOSED: u32 = 0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Treasury {
    pub bump: u8,
    pub spend_open: bool,
    pub authority: Pubkey,
    pub funded: u64,
    pub fund_count: u64,
    pub last_funder: Pubkey,
}

pub fn seeds(authority: &Pubkey) -> [&[u8]; 2] {
    [b"treasury", authority.as_ref()]
}

/// Same check as asm/amount_gate.s. Zero does not fund.
pub fn amount_allowed(amount: u64) -> bool {
    amount > 0
}

pub fn pack(row: &Treasury) -> [u8; LEN] {
    let mut out = [0u8; LEN];
    out[..8].copy_from_slice(MAGIC);
    out[8] = 1;
    out[9] = row.bump;
    out[10] = u8::from(row.spend_open);
    out[12..44].copy_from_slice(row.authority.as_ref());
    out[44..52].copy_from_slice(&row.funded.to_le_bytes());
    out[52..60].copy_from_slice(&row.fund_count.to_le_bytes());
    out[60..92].copy_from_slice(row.last_funder.as_ref());
    out
}

pub fn unpack(data: &[u8]) -> Result<Treasury, ProgramError> {
    if data.len() < LEN || &data[..8] != MAGIC.as_slice() || data[8] != 1 {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut authority = [0u8; 32];
    let mut funder = [0u8; 32];
    authority.copy_from_slice(&data[12..44]);
    funder.copy_from_slice(&data[60..92]);
    Ok(Treasury {
        bump: data[9],
        spend_open: data[10] == 1,
        authority: Pubkey::new_from_array(authority),
        funded: u64::from_le_bytes(data[44..52].try_into().unwrap()),
        fund_count: u64::from_le_bytes(data[52..60].try_into().unwrap()),
        last_funder: Pubkey::new_from_array(funder),
    })
}

pub fn apply_fund(row: Treasury, amount: u64, funder: Pubkey) -> Result<Treasury, ProgramError> {
    if !amount_allowed(amount) {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(Treasury {
        funded: row.funded.checked_add(amount).ok_or(ProgramError::InvalidInstructionData)?,
        fund_count: row.fund_count.checked_add(1).ok_or(ProgramError::InvalidInstructionData)?,
        last_funder: funder,
        ..row
    })
}

pub fn apply_arm(row: Treasury, open: bool, signer: &Pubkey) -> Result<Treasury, ProgramError> {
    if signer != &row.authority {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(Treasury { spend_open: open, ..row })
}

pub fn apply_draw(row: Treasury, amount: u64, signer: &Pubkey) -> Result<Treasury, ProgramError> {
    if !row.spend_open {
        return Err(ProgramError::Custom(CLOSED));
    }
    if signer != &row.authority || !amount_allowed(amount) {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(row)
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let tag = *data.first().ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => init(program_id, accounts),
        1 => fund(program_id, accounts, data),
        2 => arm(program_id, accounts, data),
        3 => draw(program_id, accounts, data),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn init(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts = &mut accounts.iter();
    let authority = next_account_info(accounts)?;
    let treasury = next_account_info(accounts)?;
    let system = next_account_info(accounts)?;
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if system.key != &system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    let (expected, bump) = Pubkey::find_program_address(&seeds(authority.key), program_id);
    if treasury.key != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    if treasury.data_is_empty() {
        let rent = Rent::get()?.minimum_balance(LEN);
        invoke_signed(
            &system_instruction::create_account(authority.key, treasury.key, rent, LEN as u64, program_id),
            &[authority.clone(), treasury.clone(), system.clone()],
            &[&[b"treasury", authority.key.as_ref(), &[bump]]],
        )?;
    }
    if treasury.data_len() < LEN {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let row = Treasury {
        bump,
        spend_open: false,
        authority: *authority.key,
        funded: 0,
        fund_count: 0,
        last_funder: Pubkey::default(),
    };
    treasury.try_borrow_mut_data()?[..LEN].copy_from_slice(&pack(&row));
    Ok(())
}

fn fund(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 9 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount = u64::from_le_bytes(data[1..9].try_into().unwrap());
    let accounts = &mut accounts.iter();
    let funder = next_account_info(accounts)?;
    let treasury = next_account_info(accounts)?;
    let system = next_account_info(accounts)?;
    if !funder.is_signer || treasury.owner != program_id || system.key != &system_program::id() {
        return Err(ProgramError::IllegalOwner);
    }
    let mut row = unpack(&treasury.try_borrow_data()?)?;
    row = apply_fund(row, amount, *funder.key)?;
    invoke(
        &system_instruction::transfer(funder.key, treasury.key, amount),
        &[funder.clone(), treasury.clone(), system.clone()],
    )?;
    treasury.try_borrow_mut_data()?[..LEN].copy_from_slice(&pack(&row));
    Ok(())
}

fn arm(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 2 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let accounts = &mut accounts.iter();
    let authority = next_account_info(accounts)?;
    let treasury = next_account_info(accounts)?;
    if !authority.is_signer || treasury.owner != program_id {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let row = unpack(&treasury.try_borrow_data()?)?;
    let next = apply_arm(row, data[1] == 1, authority.key)?;
    treasury.try_borrow_mut_data()?[..LEN].copy_from_slice(&pack(&next));
    Ok(())
}

fn draw(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 9 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount = u64::from_le_bytes(data[1..9].try_into().unwrap());
    let accounts = &mut accounts.iter();
    let authority = next_account_info(accounts)?;
    let treasury = next_account_info(accounts)?;
    let dest = next_account_info(accounts)?;
    if !authority.is_signer || treasury.owner != program_id || !dest.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let row = unpack(&treasury.try_borrow_data()?)?;
    apply_draw(row, amount, authority.key)?;
    let (expected, bump) = Pubkey::find_program_address(&seeds(&row.authority), program_id);
    if treasury.key != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    let rent = Rent::get()?.minimum_balance(LEN);
    let have = treasury.lamports();
    if have < rent.saturating_add(amount) {
        return Err(ProgramError::InsufficientFunds);
    }
    **treasury.try_borrow_mut_lamports()? = have - amount;
    **dest.try_borrow_mut_lamports()? = dest.lamports().saturating_add(amount);
    let _ = bump;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn another_program_can_read_a_fund_and_cannot_draw() {
        let authority = Pubkey::new_unique();
        let funder = Pubkey::new_unique();
        let opened = Treasury { bump: 2, spend_open: false, authority, funded: 0, fund_count: 0, last_funder: Pubkey::default() };
        let packed = pack(&opened);
        assert_eq!(&packed[..8], b"SENDATRY");
        assert_eq!(packed[10], 0);
        let funded = apply_fund(unpack(&packed).unwrap(), 1_000, funder).unwrap();
        assert_eq!(funded.funded, 1_000);
        assert_eq!(funded.last_funder, funder);
        let body = pack(&Treasury { bump: 2, spend_open: false, authority: Pubkey::new_from_array([1u8; 32]), funded: 1_000, fund_count: 1, last_funder: Pubkey::new_from_array([2u8; 32]) });
        assert_eq!(&body[..12], &[b'S', b'E', b'N', b'D', b'A', b'T', b'R', b'Y', 1, 2, 0, 0]);
        assert_eq!(&body[44..52], &1_000u64.to_le_bytes());
        assert!(apply_draw(funded, 1, &authority).is_err());
        let armed = apply_arm(funded, true, &authority).unwrap();
        assert!(armed.spend_open);
        assert!(apply_arm(funded, true, &funder).is_err());
    }

    #[test]
    fn the_assembly_gate_rejects_zero() {
        assert!(!amount_allowed(0));
        assert!(run_gate(0) == 1);
        assert!(run_gate(5) == 0);
    }

    /// asm/amount_gate.s, one instruction per line, host interpreter.
    fn run_gate(amount: u64) -> u64 {
        let program = include_str!("../asm/amount_gate.s");
        let mut r = [0u64; 3];
        r[1] = amount;
        let mut pc = 0usize;
        let lines: Vec<&str> = program.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')).collect();
        for _ in 0..16 {
            let line = lines[pc];
            if line == "exit" {
                return r[0];
            }
            if let Some(rest) = line.strip_prefix("jeq r1, 0, +") {
                let skip: usize = rest.parse().unwrap();
                pc = if r[1] == 0 { pc + 1 + skip } else { pc + 1 };
                continue;
            }
            if line == "mov64 r0, 0" {
                r[0] = 0;
            } else if line == "mov64 r0, 1" {
                r[0] = 1;
            } else {
                panic!("unknown op {line}");
            }
            pc += 1;
        }
        panic!("gate did not exit");
    }
}
