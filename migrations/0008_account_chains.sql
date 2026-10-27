-- A login can keep a Solana address and a Base address. One does not replace the other.
alter table account_address add column if not exists evm text;
