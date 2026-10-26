use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, State};

pub struct FileWatcherState {
    pub watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

#[derive(serde::Serialize)]
pub struct FileContent {
    content: String,
    last_modified: Option<u64>,
}

#[derive(serde::Serialize)]
pub struct FileTreeNode {
    r#type: String,
    name: String,
    path: String,
    file_id: String,
    children: Option<Vec<FileTreeNode>>,
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileTreeNode>, String> {
    fn is_markdown(name: &str) -> bool {
        let lowered = name.to_lowercase();
        lowered.ends_with(".md")
            || lowered.ends_with(".markdown")
            || lowered.ends_with(".mkd")
            || lowered.ends_with(".mdx")
            || lowered.ends_with(".txt")
    }

    fn visit(dir: &Path) -> Result<Vec<FileTreeNode>, String> {
        let mut entries = vec![];
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            if path.is_dir() {
                let children = visit(&path)?;
                if !children.is_empty() {
                    entries.push(FileTreeNode {
                        r#type: "dir".to_string(),
                        name,
                        path: path.to_string_lossy().to_string(),
                        file_id: path.to_string_lossy().to_string(),
                        children: Some(children),
                    });
                }
            } else if is_markdown(&name) {
                entries.push(FileTreeNode {
                    r#type: "file".to_string(),
                    name,
                    path: path.to_string_lossy().to_string(),
                    file_id: path.to_string_lossy().to_string(),
                    children: None,
                });
            }
        }
        entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(entries)
    }

    visit(Path::new(&path))
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileContent, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let last_modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    Ok(FileContent {
        content,
        last_modified,
    })
}

#[tauri::command]
pub fn file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub fn watch_file(
    path: String,
    state: State<'_ , FileWatcherState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    if watchers.contains_key(&path) {
        return Ok(());
    }

    let app_clone = app.clone();
    let path_clone = path.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                if event.kind.is_modify() || event.kind.is_create() {
                    app_clone.emit("file:changed", path_clone.clone()).ok();
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    watchers.insert(path, watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(path: String, state: State<'_ , FileWatcherState>) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.remove(&path);
    Ok(())
}
