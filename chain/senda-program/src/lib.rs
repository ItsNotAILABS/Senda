//! On-chain cover. The payer signs. Rent comes from their wallet.
//! Instruction data is 45 bytes: kind, 12-byte symbol, four little-endian u64s.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

const LEN: usize = 45;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.len() != LEN {
        return Err(ProgramError::InvalidInstructionData);
    }
    if data[0] > 1 || !data[1..13].iter().all(|b| *b == 0 || b.is_ascii_alphanumeric()) {
        return Err(ProgramError::InvalidInstructionData);
    }
    let accounts = &mut accounts.iter();
    let payer = next_account_info(accounts)?;
    let cover = next_account_info(accounts)?;
    let system = next_account_info(accounts)?;
    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let (expected, bump) = Pubkey::find_program_address(&[b"cover", payer.key.as_ref(), &data[1..13]], program_id);
    if cover.key != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    let rent = Rent::get()?.minimum_balance(LEN);
    if cover.data_is_empty() {
        invoke_signed(
            &system_instruction::create_account(payer.key, cover.key, rent, LEN as u64, program_id),
            &[payer.clone(), cover.clone(), system.clone()],
            &[&[b"cover", payer.key.as_ref(), &data[1..13], &[bump]]],
        )?;
    }
    let mut body = data.to_vec();
    body.push(bump);
    cover.try_borrow_mut_data()?[..LEN].copy_from_slice(&body[..LEN]);
    Ok(())
}
