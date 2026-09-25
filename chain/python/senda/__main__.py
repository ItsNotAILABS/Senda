"""Print the live book, cheapest first. Nothing is signed."""

from senda.book import cheapest, load


def main() -> None:
    rows = cheapest(load(), 12)
    if not rows:
        raise SystemExit("The book did not answer.")
    for name in rows:
        gap = name.premium()
        shown = "—" if gap is None else f"{gap * 100:+.1f}%"
        print(f"{name.symbol:<12} {name.last:>10.4f}  {shown:>8}  {name.mint}")


if __name__ == "__main__":
    main()
