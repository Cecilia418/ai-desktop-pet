use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

const DATABASE_FILE_NAME: &str = "pet.db";
const CURRENT_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedStats {
    pub hunger: f64,
    pub mood: f64,
    pub energy: f64,
    pub intimacy: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
pub struct PersistedPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedPetState {
    pub stats: PersistedStats,
    pub last_runtime_timestamp: i64,
    pub last_activity: String,
    pub position: Option<PersistedPosition>,
}

pub fn load_pet_state(app: AppHandle) -> Result<Option<PersistedPetState>, String> {
    let mut connection = open_connection(&app)?;
    migrate(&mut connection).map_err(database_error)?;

    let state = connection
        .query_row(
            "SELECT hunger, mood, energy, intimacy, last_runtime_timestamp, last_activity,
                    position_x, position_y
             FROM pet_state
             WHERE id = 1",
            [],
            |row| {
                let x: Option<f64> = row.get(6)?;
                let y: Option<f64> = row.get(7)?;
                Ok(PersistedPetState {
                    stats: PersistedStats {
                        hunger: row.get(0)?,
                        mood: row.get(1)?,
                        energy: row.get(2)?,
                        intimacy: row.get(3)?,
                    },
                    last_runtime_timestamp: row.get(4)?,
                    last_activity: row.get(5)?,
                    position: x.zip(y).map(|(x, y)| PersistedPosition { x, y }),
                })
            },
        )
        .optional()
        .map_err(database_error)?;

    state
        .map(|value| {
            validate_state(&value)?;
            Ok(value)
        })
        .transpose()
        .map_err(|error: String| error)
}

pub fn save_pet_state(app: AppHandle, state: PersistedPetState) -> Result<(), String> {
    validate_state(&state)?;
    let mut connection = open_connection(&app)?;
    migrate(&mut connection).map_err(database_error)?;

    let transaction = connection.transaction().map_err(database_error)?;
    transaction
        .execute(
            "INSERT INTO pet_state (
                id, hunger, mood, energy, intimacy, last_runtime_timestamp,
                last_activity, position_x, position_y, updated_at
             ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
                hunger = excluded.hunger,
                mood = excluded.mood,
                energy = excluded.energy,
                intimacy = excluded.intimacy,
                last_runtime_timestamp = excluded.last_runtime_timestamp,
                last_activity = excluded.last_activity,
                position_x = excluded.position_x,
                position_y = excluded.position_y,
                updated_at = excluded.updated_at",
            params![
                state.stats.hunger,
                state.stats.mood,
                state.stats.energy,
                state.stats.intimacy,
                state.last_runtime_timestamp,
                state.last_activity,
                state.position.as_ref().map(|position| position.x),
                state.position.as_ref().map(|position| position.y),
                current_timestamp(),
            ],
        )
        .map_err(database_error)?;
    transaction.commit().map_err(database_error)
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("cannot resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("cannot create app data directory: {error}"))?;
    let path = app_data_dir.join(DATABASE_FILE_NAME);
    Connection::open(path).map_err(database_error)
}

fn migrate(connection: &mut Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );",
    )?;

    let current_version: i64 = connection.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if current_version < CURRENT_SCHEMA_VERSION {
        let transaction = connection.transaction()?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS pet_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                hunger REAL NOT NULL,
                mood REAL NOT NULL,
                energy REAL NOT NULL,
                intimacy REAL NOT NULL,
                last_runtime_timestamp INTEGER NOT NULL,
                last_activity TEXT NOT NULL,
                position_x REAL,
                position_y REAL,
                updated_at INTEGER NOT NULL
            );
            INSERT INTO schema_migrations(version, applied_at)
            VALUES (1, strftime('%s', 'now'));
            ",
        )?;
        transaction.commit()?;
    }

    Ok(())
}

fn validate_state(state: &PersistedPetState) -> Result<(), String> {
    let stats = [
        ("hunger", state.stats.hunger),
        ("mood", state.stats.mood),
        ("energy", state.stats.energy),
        ("intimacy", state.stats.intimacy),
    ];
    for (name, value) in stats {
        if !value.is_finite() || !(0.0..=100.0).contains(&value) {
            return Err(format!("invalid persisted stat: {name}"));
        }
    }

    if state.last_runtime_timestamp <= 0 {
        return Err("invalid persisted runtime timestamp".to_string());
    }
    if !matches!(
        state.last_activity.as_str(),
        "IDLE" | "WALKING" | "SLEEPING"
    ) {
        return Err("invalid persisted activity".to_string());
    }
    if let Some(position) = &state.position {
        if !position.x.is_finite() || !position.y.is_finite() {
            return Err("invalid persisted position".to_string());
        }
    }
    Ok(())
}

fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn database_error(error: rusqlite::Error) -> String {
    format!("sqlite persistence error: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_state() -> PersistedPetState {
        PersistedPetState {
            stats: PersistedStats {
                hunger: 82.0,
                mood: 85.0,
                energy: 78.0,
                intimacy: 60.0,
            },
            last_runtime_timestamp: 1_700_000_000_000,
            last_activity: "IDLE".to_string(),
            position: Some(PersistedPosition { x: 100.0, y: 200.0 }),
        }
    }

    #[test]
    fn migration_is_idempotent_and_creates_pet_state() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut connection).expect("first migration");
        migrate(&mut connection).expect("second migration");

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration version");
        expect_table(&connection, "pet_state");
        assert_eq!(version, CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn validation_rejects_invalid_or_secret_like_values() {
        let mut state = sample_state();
        state.stats.mood = f64::NAN;
        assert!(validate_state(&state).is_err());

        let mut state = sample_state();
        state.last_activity = "CHAT".to_string();
        assert!(validate_state(&state).is_err());
    }

    fn expect_table(connection: &Connection, name: &str) {
        let exists: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [name],
                |row| row.get(0),
            )
            .expect("table lookup");
        assert_eq!(exists, 1);
    }
}
