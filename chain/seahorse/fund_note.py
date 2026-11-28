# Seahorse surface over the same rule. A note records a fund. It does not open draw.
# The lamports move in the native program, instruction 1.

from seahorse.prelude import *

declare_id("Ffn59migb5ED6szzphrgkrcdX1f8418ujB5JFcpJR2bk")


class FundNote(Account):
    funded: u64
    count: u64
    spend_open: u8


@instruction
def note_fund(payer: Signer, note: Empty[FundNote], amount: u64):
    assert amount > 0, "A fund of zero lamports is rejected."
    note = note.init(payer=payer, seeds=["note", payer])
    note.funded = amount
    note.count = 1
    note.spend_open = 0


@instruction
def note_more(payer: Signer, note: FundNote, amount: u64):
    assert amount > 0, "A fund of zero lamports is rejected."
    assert note.spend_open == 0, "Draw stays closed on this note."
    note.funded += amount
    note.count += 1
