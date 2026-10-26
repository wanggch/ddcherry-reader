use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn prefs_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("preferences.json"))
}

fn read_prefs(app: &AppHandle) -> Result<Value, String> {
    let path = prefs_path(app)?;
    if !path.exists() {
        return Ok(json!({}));
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_prefs(app: &AppHandle, value: Value) -> Result<(), String> {
    let path = prefs_path(app)?;
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_preferences(app: AppHandle) -> Result<Value, String> {
    read_prefs(&app)
}

#[tauri::command]
pub fn get_preference(key: String, app: AppHandle) -> Result<Option<Value>, String> {
    let prefs = read_prefs(&app)?;
    Ok(prefs.get(&key).cloned())
}

#[tauri::command]
pub fn set_preference(key: String, value: Value, app: AppHandle) -> Result<(), String> {
    let mut prefs = read_prefs(&app)?;
    prefs[key] = value;
    write_prefs(&app, prefs)
}

#[tauri::command]
pub fn remove_preference(key: String, app: AppHandle) -> Result<(), String> {
    let mut prefs = read_prefs(&app)?;
    if let Some(obj) = prefs.as_object_mut() {
        obj.remove(&key);
    }
    write_prefs(&app, prefs)
}
