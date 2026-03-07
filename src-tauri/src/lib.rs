use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS models (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    api_key TEXT NOT NULL,
                    base_url TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    mode TEXT NOT NULL DEFAULT 'single',
                    models TEXT NOT NULL DEFAULT '[]',
                    root_message_id TEXT,
                    active_path_ids TEXT NOT NULL DEFAULT '[]',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    parent_id TEXT,
                    role TEXT NOT NULL,
                    model_id TEXT,
                    content TEXT NOT NULL,
                    children TEXT NOT NULL DEFAULT '[]',
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_system_prompt_to_conversations",
            sql: "ALTER TABLE conversations ADD COLUMN system_prompt TEXT DEFAULT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_model_instructions_to_conversations",
            sql: "ALTER TABLE conversations ADD COLUMN model_instructions TEXT DEFAULT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_attachments_to_messages",
            sql: "ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT NULL;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:llmchat.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
