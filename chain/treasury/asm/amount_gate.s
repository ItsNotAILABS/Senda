# sBPF amount gate. r1 is the lamports. r0 is 0 to fund, 1 to reject.
# The native program calls amount_allowed. This is the same check, not a second policy.
jeq r1, 0, +2
mov64 r0, 0
exit
mov64 r0, 1
exit
