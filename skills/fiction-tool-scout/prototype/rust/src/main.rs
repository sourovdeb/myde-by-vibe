//! fiction-scout: std-only port of engine.js. Tool lines on stdin -> ranking JSON.
use std::cmp::Ordering;
use std::io::Read;

const W: [f64; 10] = [10.0, 9.0, 8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.0];
const WORDS: f64 = 80_000.0;

#[derive(Debug, Clone)]
pub struct Tool { pub name: String, pub sourced: bool, pub import: bool, pub export_bible: bool, pub hard_filter: bool, pub usd_per_1k: f64, pub r: [char; 10] }

#[derive(Debug, Clone)]
pub struct Eval { pub name: String, pub score: f64, pub cost: f64, pub deal: Vec<&'static str>, pub unverified: usize, pub disq: bool }

fn val(c: char) -> f64 { match c { 'F' => 1.0, 'P' => 0.5, _ => 0.0 } }
fn yes(s: &str) -> bool { matches!(s.trim().to_lowercase().as_str(), "1" | "y" | "yes" | "true") }
fn round(x: f64, k: f64) -> f64 { (x * k).round() / k }

pub fn parse(text: &str) -> Result<Vec<Tool>, String> {
    let mut out = Vec::new();
    for (n, raw) in text.lines().enumerate() {
        let l = raw.trim();
        if l.is_empty() || l.starts_with('#') { continue; }
        let at = format!("line {}: ", n + 1);
        let f: Vec<&str> = l.split('|').collect();
        if f.len() != 7 { return Err(at + "need 7 fields"); }
        let name = f[0].trim();
        if name.is_empty() { return Err(at + "empty name"); }
        let cost: f64 = match f[5].trim().parse() { Ok(c) => c, Err(_) => return Err(at + "bad cost") };
        if !cost.is_finite() || cost < 0.0 { return Err(at + "bad cost"); }
        let parts: Vec<&str> = f[6].split(',').collect();
        if parts.len() != 10 { return Err(at + "need 10 statuses F/P/M/U"); }
        let mut r = ['?'; 10];
        for (i, p) in parts.iter().enumerate() {
            let c: Vec<char> = p.trim().to_uppercase().chars().collect();
            if c.len() != 1 || !"FPMU".contains(c[0]) { return Err(at + "need 10 statuses F/P/M/U"); }
            r[i] = c[0];
        }
        out.push(Tool { name: name.to_string(), sourced: yes(f[1]), import: yes(f[2]), export_bible: yes(f[3]), hard_filter: yes(f[4]), usd_per_1k: cost, r });
    }
    Ok(out)
}

pub fn evaluate(t: &Tool, budget: f64) -> Eval {
    let raw: f64 = t.r.iter().enumerate().map(|(i, c)| W[i] * val(*c)).sum();
    let cost = round(t.usd_per_1k * WORDS / 1000.0, 100.0);
    let mut deal: Vec<&'static str> = Vec::new();
    if !t.sourced { deal.push("unsourced"); }
    if !t.import { deal.push("no import"); }
    if !t.export_bible { deal.push("export drops bible"); }
    if t.hard_filter { deal.push("hard content filter"); }
    if cost > budget { deal.push("cost scales badly"); }
    Eval { name: t.name.clone(), score: round(raw / 55.0 * 100.0, 10.0), cost, deal, unverified: t.r.iter().filter(|&&c| c == 'U').count(), disq: !t.sourced }
}

pub fn rank(tools: &[Tool], budget: f64) -> Vec<Eval> {
    let mut e: Vec<Eval> = tools.iter().map(|t| evaluate(t, budget)).collect();
    e.sort_by(|a, b| a.disq.cmp(&b.disq)
        .then(b.score.partial_cmp(&a.score).unwrap_or(Ordering::Equal))
        .then(a.name.cmp(&b.name)));
    e
}

pub fn recommend(r: &[Eval]) -> Option<(String, bool)> {
    let ok: Vec<&Eval> = r.iter().filter(|x| !x.disq).collect();
    if let Some(c) = ok.iter().find(|x| x.deal.is_empty()) { return Some((c.name.clone(), false)); }
    ok.first().map(|x| (x.name.clone(), true))
}

fn esc(s: &str) -> String { s.replace('\\', "\\\\").replace('"', "\\\"") }

pub fn json(r: &[Eval], budget: f64) -> String {
    let rows: Vec<String> = r.iter().enumerate().map(|(i, x)| {
        let d: Vec<String> = x.deal.iter().map(|d| format!("\"{}\"", d)).collect();
        format!("{{\"rank\":{},\"name\":\"{}\",\"score\":{},\"cost_80k\":{},\"deal_breakers\":[{}],\"unverified\":{}}}", i + 1, esc(&x.name), x.score, x.cost, d.join(","), x.unverified)
    }).collect();
    let rec = match recommend(r) { Some((n, c)) => format!("{{\"name\":\"{}\",\"caution\":{}}}", esc(&n), c), None => "null".to_string() };
    format!("{{\"budget\":{},\"ranking\":[{}],\"recommendation\":{}}}", budget, rows.join(","), rec)
}

fn main() {
    let a: Vec<String> = std::env::args().skip(1).collect();
    let mut budget: f64 = 300.0;
    let mut i = 0;
    while i < a.len() {
        if a[i] == "--budget" { i += 1; budget = a.get(i).and_then(|s| s.parse::<f64>().ok()).unwrap_or(-1.0); }
        i += 1;
    }
    if !(budget >= 0.0) { eprintln!("error: bad budget"); std::process::exit(1); }
    let mut s = String::new();
    let _ = std::io::stdin().read_to_string(&mut s);
    match parse(&s) {
        Ok(t) => println!("{}", json(&rank(&t, budget), budget)),
        Err(e) => { eprintln!("error: {}", e); std::process::exit(1); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const DEMO: &str = "A|y|y|n|n|0.60|F,F,P,F,F,F,F,F,P,F\nB|y|y|y|n|0.45|F,F,F,F,P,P,P,P,F,F\nC|y|n|y|y|0.10|F,P,M,P,M,P,M,U,M,F\nD|n|y|y|n|0.20|F,F,F,F,F,F,F,F,F,F";
    fn one(l: &str) -> Tool { parse(l).unwrap().remove(0) }
    #[test] fn parses_four() { assert_eq!(parse(DEMO).unwrap().len(), 4); }
    #[test] fn rejects_six_fields() { assert!(parse("a|y|y|y|n|1").is_err()); }
    #[test] fn rejects_bad_status() { assert!(parse("a|y|y|y|n|1|F,F,F,F,F,F,F,F,F,X").is_err()); }
    #[test] fn rejects_negative_cost() { assert!(parse("a|y|y|y|n|-1|F,F,F,F,F,F,F,F,F,F").is_err()); }
    #[test] fn all_full_is_100() { assert_eq!(evaluate(&one("a|y|y|y|n|1|F,F,F,F,F,F,F,F,F,F"), 300.0).score, 100.0); }
    #[test] fn req1_only() { assert_eq!(evaluate(&one("a|y|y|y|n|1|F,M,M,M,M,M,M,M,M,M"), 300.0).score, 18.2); }
    #[test] fn cost_and_budget_flag() {
        let t = one("a|y|y|y|n|0.60|F,F,F,F,F,F,F,F,F,F");
        assert_eq!(evaluate(&t, 48.0).cost, 48.0);
        assert!(evaluate(&t, 48.0).deal.is_empty());
        assert_eq!(evaluate(&t, 47.0).deal, vec!["cost scales badly"]);
    }
    #[test] fn unsourced_sorts_last() { assert_eq!(rank(&parse(DEMO).unwrap(), 300.0)[3].name, "D"); }
    #[test] fn recommends_clean_b() { assert_eq!(recommend(&rank(&parse(DEMO).unwrap(), 300.0)), Some(("B".to_string(), false))); }
    #[test] fn caution_when_all_flagged() { assert_eq!(recommend(&rank(&parse(DEMO).unwrap(), 30.0)), Some(("A".to_string(), true))); }
    #[test] fn none_when_all_unsourced() { assert_eq!(recommend(&rank(&parse("a|n|y|y|n|1|F,F,F,F,F,F,F,F,F,F").unwrap(), 300.0)), None); }
}
