"""SPL Token Transfer of USDC, plus the memo Solana Pay can match."""

USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


def usd_to_atoms(usd: float) -> int:
    if not isinstance(usd, (int, float)) or usd != usd or usd <= 0:
        raise ValueError("amount")
    atoms = int(round(float(usd) * 1_000_000))
    if atoms <= 0:
        raise ValueError("amount")
    return atoms


def transfer(atoms: int) -> bytes:
    if not isinstance(atoms, int) or atoms <= 0 or atoms >= 2**64:
        raise ValueError("amount")
    return bytes([3]) + atoms.to_bytes(8, "little")


def memo(usd: float, reference: str) -> str:
    return f"Senda USDC {float(usd):.2f} ref={reference}"
