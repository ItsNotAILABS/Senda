"""The same 92 bytes the native treasury stores. A zero fund is not an instruction."""

MAGIC = b"SENDATRY"
LEN = 92


def pack(bump, spend_open, authority, funded, fund_count, last_funder):
    if len(authority) != 32 or len(last_funder) != 32:
        raise ValueError("a funder is 32 bytes")
    if funded < 0 or fund_count < 0:
        raise ValueError("a fund does not go backwards")
    body = bytearray(LEN)
    body[:8] = MAGIC
    body[8] = 1
    body[9] = bump
    body[10] = 1 if spend_open else 0
    body[12:44] = authority
    body[44:52] = int(funded).to_bytes(8, "little")
    body[52:60] = int(fund_count).to_bytes(8, "little")
    body[60:92] = last_funder
    return bytes(body)


def unpack(data):
    if len(data) < LEN or data[:8] != MAGIC or data[8] != 1:
        return None
    return {
        "bump": data[9],
        "spend_open": data[10] == 1,
        "authority": data[12:44],
        "funded": int.from_bytes(data[44:52], "little"),
        "fund_count": int.from_bytes(data[52:60], "little"),
        "last_funder": data[60:92],
    }


def fund_data(lamports):
    if lamports <= 0:
        return None
    return bytes([1]) + int(lamports).to_bytes(8, "little")
