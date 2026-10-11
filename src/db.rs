use std::str::FromStr;

use chrono::{DateTime, SecondsFormat, Utc};

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
};

pub const DEFAULT_DATABASE_URL: &str = "sqlite://data/time-series.db?mode=rwc";

/// Opens the SQLite pool (creating the file and its directory if needed)
/// and applies pending migrations.
pub async fn connect(url: &str) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(url)?
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal);

    // SQLite creates the file but not missing parent directories.
    if let Some(dir) = options.get_filename().parent()
        && !dir.as_os_str().is_empty()
    {
        std::fs::create_dir_all(dir)?;
    }

    let pool = SqlitePool::connect_with(options).await?;
    sqlx::migrate!().run(&pool).await?;
    Ok(pool)
}

/// Formats a timestamp the way we store it: RFC 3339 UTC with a `Z` suffix
/// and whole seconds, so stored values all share one shape and sort as text.
pub fn timestamp(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Secs, true)
}
