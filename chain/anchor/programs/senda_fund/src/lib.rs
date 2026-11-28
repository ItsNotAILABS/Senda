//! Anchor callers fund the native treasury. They do not invent a second account.
//! Instruction 1 is tag 1 plus a little-endian u64. Draw is not exposed here.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke};

declare_id!("FdcRjiN8GJmibutLtubvDf8hXavsYpBe7ZAHEyV5VjLJ");

pub const TREASURY_PROGRAM: Pubkey = pubkey!("DeJVhSszpHrwHonu78hnYxrQxcr6ZEuYgwZmzYQYXpwy");

#[program]
pub mod senda_fund {
    use super::*;

    pub fn fund(ctx: Context<Fund>, amount: u64) -> Result<()> {
        require!(amount > 0, FundError::Zero);
        let mut data = vec![1u8];
        data.extend_from_slice(&amount.to_le_bytes());
        let ix = Instruction {
            program_id: TREASURY_PROGRAM,
            accounts: vec![
                AccountMeta::new(ctx.accounts.funder.key(), true),
                AccountMeta::new(ctx.accounts.treasury.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            ],
            data,
        };
        invoke(
            &ix,
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Fund<'info> {
    pub funder: Signer<'info>,
    /// CHECK: the native program checks the SENDATRY magic, the owner, and the seeds.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum FundError {
    #[msg("A fund of zero lamports is rejected.")]
    Zero,
}
