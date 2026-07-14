use serde_json::Value;
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

pub fn normalize_text(text: &str) -> String {
    text.nfkc()
        .collect::<String>()
        .trim()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn normalize_sentence_text(text: &str) -> String {
    normalize_text(text).to_lowercase()
}

pub fn build_canonical_key(language: &str, value: &str) -> String {
    format!(
        "{}:{}",
        normalize_sentence_text(language),
        normalize_sentence_text(value)
    )
}

pub fn hash_json_value(value: &Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(stable_stringify(value).as_bytes());
    format!("{:x}", hasher.finalize())
}

fn stable_stringify(value: &Value) -> String {
    match value {
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(stable_stringify)
                .collect::<Vec<_>>()
                .join(",")
        ),
        Value::Object(map) => {
            let mut entries = map.iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            format!(
                "{{{}}}",
                entries
                    .into_iter()
                    .map(|(key, entry)| format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap(),
                        stable_stringify(entry)
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        _ => serde_json::to_string(value).unwrap(),
    }
}
