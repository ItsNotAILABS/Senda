/// How far the print sits from the mark. Negative means the print is cheap.
pub fn premium(last: f64, mark: f64) -> Option<f64> {
    if !last.is_finite() || !mark.is_finite() || mark <= 0.0 || last <= 0.0 {
        return None;
    }
    Some((last - mark) / mark)
}

#[derive(Clone, Debug)]
pub struct Name {
    pub symbol: String,
    pub mint: String,
    pub last: f64,
    pub mark: f64,
}

impl Name {
    pub fn premium(&self) -> Option<f64> {
        premium(self.last, self.mark)
    }
}

pub fn cheapest(names: &[Name], n: usize) -> Vec<&Name> {
    let mut rows: Vec<&Name> = names.iter().filter(|name| name.premium().is_some()).collect();
    rows.sort_by(|a, b| {
        a.premium()
            .unwrap_or(0.0)
            .partial_cmp(&b.premium().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    rows.truncate(n);
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cheap_print_sorts_first() {
        let book = [
            Name { symbol: "OPENAI".into(), mint: "a".into(), last: 11.0, mark: 10.0 },
            Name { symbol: "ANDURIL".into(), mint: "b".into(), last: 8.0, mark: 10.0 },
        ];
        let cheap = cheapest(&book, 1);
        assert_eq!(cheap[0].symbol, "ANDURIL");
        assert!((cheap[0].premium().unwrap() - -0.2).abs() < 1e-9);
    }
}
