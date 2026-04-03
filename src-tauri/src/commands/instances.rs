use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub last_played: Option<i64>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct InstancePatch {
    pub name: Option<String>,
    pub last_played: Option<i64>,
    pub icon: Option<String>,
}

#[command]
pub async fn list_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instances_dir = app_data.join("instances");

    if !instances_dir.exists() {
        return Ok(vec![]);
    }

    let mut instances = Vec::new();
    if let Ok(entries) = fs::read_dir(instances_dir) {
        for entry in entries.flatten() {
            let json_path = entry.path().join("instance.json");
            if json_path.exists() {
                if let Ok(content) = fs::read_to_string(json_path) {
                    if let Ok(instance) = serde_json::from_str::<Instance>(&content) {
                        instances.push(instance);
                    }
                }
            }
        }
    }

    Ok(instances)
}

#[command]
pub async fn create_instance(
    app: AppHandle,
    name: String,
    version: String,
    loader: String,
) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let id = sanitize_folder_name(&name);
    let instance_dir = app_data.join("instances").join(&id);

    let final_id = if instance_dir.exists() {
        let mut counter = 1;
        loop {
            let new_id = format!("{}-{}", id, counter);
            if !app_data.join("instances").join(&new_id).exists() {
                break new_id;
            }
            counter += 1;
        }
    } else {
        id
    };

    let instance_dir = app_data.join("instances").join(&final_id);
    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    for dir in &["mods", "config", "saves", "resourcepacks", "screenshots"] {
        fs::create_dir_all(instance_dir.join(dir)).ok();
    }

    let instance = Instance {
        id: final_id.clone(),
        name,
        version,
        loader,
        last_played: None,
        icon: None,
    };

    let json_path = instance_dir.join("instance.json");
    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => c,
            _ => '-',
        })
        .collect::<String>()
        .to_lowercase()
}

#[command]
pub async fn delete_instance(app: AppHandle, id: String) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(id);
    if instance_dir.exists() {
        fs::remove_dir_all(instance_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn duplicate_instance(app: AppHandle, id: String) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let source_dir = app_data.join("instances").join(&id);
    let new_id = Uuid::new_v4().to_string();
    let dest_dir = app_data.join("instances").join(&new_id);

    copy_dir::copy_dir(&source_dir, &dest_dir).map_err(|e| e.to_string())?;

    let json_path = dest_dir.join("instance.json");
    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    instance.id = new_id;
    instance.name = format!("{} (Copy)", instance.name);

    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

#[command]
pub async fn update_instance(
    app: AppHandle,
    id: String,
    patch: InstancePatch,
) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    let json_path = instance_dir.join("instance.json");

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(name) = patch.name {
        instance.name = name;
    }
    if let Some(lp) = patch.last_played {
        instance.last_played = Some(lp);
    }
    if let Some(icon) = patch.icon {
        instance.icon = Some(icon);
    }

    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

#[command]
pub async fn upload_instance_icon(
    app: AppHandle,
    id: String,
    icon_data: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    
    // Create icons directory if it doesn't exist
    let icons_dir = instance_dir.join("icons");
    fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;
    
    // Generate unique filename
    let icon_filename = format!("icon.{}", extension);
    let icon_path = icons_dir.join(&icon_filename);
    
    // Write the icon data to file
    fs::write(&icon_path, &icon_data).map_err(|e| e.to_string())?;
    
    // Return the full absolute path so convertFileSrc can convert it to asset:// URL
    let full_path = icon_path.to_string_lossy().to_string();
    Ok(full_path)
}

#[command]
pub async fn import_instance_from_launcher(
    app: AppHandle,
    launcher: String,
) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    
    // Detect launcher installation paths based on OS
    let launcher_path = match launcher.as_str() {
        "minecraft" => detect_minecraft_launcher_path(),
        "prism" => detect_prism_launcher_path(),
        "modrinth" => detect_modrinth_launcher_path(),
        "lunar" => detect_lunar_client_path(),
        "feather" => detect_feather_client_path(),
        "atlauncher" => detect_atlauncher_path(),
        _ => return Err(format!("Unknown launcher: {}", launcher)),
    };
    
    let launcher_path = launcher_path.ok_or_else(|| format!("Could not find {} installation", launcher))?;
    
    // Find instances in the launcher directory
    let instances = find_instances_in_directory(&launcher_path)
        .map_err(|e| format!("Failed to scan {} instances: {}", launcher, e))?;
    
    if instances.is_empty() {
        return Err(format!("No instances found in {}", launcher));
    }
    
    // Import the first found instance (in a real implementation, you'd show a picker)
    let source_instance = &instances[0];
    
    // Create new instance in Spring
    let id = Uuid::new_v4().to_string();
    let instance_dir = app_data.join("instances").join(&id);
    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;
    
    // Copy instance files
    copy_instance_files(&source_instance.path, &instance_dir)
        .map_err(|e| format!("Failed to copy instance files: {}", e))?;
    
    // Create instance metadata
    let instance = Instance {
        id: id.clone(),
        name: format!("Imported from {}", capitalize(&launcher)),
        version: source_instance.version.clone(),
        loader: source_instance.loader.clone(),
        last_played: None,
        icon: None,
    };
    
    let json_path = instance_dir.join("instance.json");
    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;
    
    Ok(instance)
}

#[command]
pub async fn import_instance_browse(app: AppHandle) -> Result<Instance, String> {
    // Open file dialog for user to select instances folder
    // This would use tauri-api dialog, but for now return an error
    Err("Browse dialog not yet implemented. Please use launcher import instead.".to_string())
}

#[command]
pub async fn browse_modpacks(source: String) -> Result<(), String> {
    match source.as_str() {
        "modrinth" => {
            // Open Modrinth modpack browser
            // This would integrate with Modrinth API
            Err("Modrinth browser not yet implemented".to_string())
        }
        "curseforge" => {
            // Open CurseForge modpack browser
            // This would integrate with CurseForge API
            Err("CurseForge browser not yet implemented".to_string())
        }
        _ => Err(format!("Unknown modpack source: {}", source)),
    }
}

#[command]
pub async fn install_modpack_file(app: AppHandle) -> Result<Instance, String> {
    // Open file picker for .zip, .mrpack, or .json files
    // This would use tauri-api dialog
    Err("File picker not yet implemented".to_string())
}

// Helper functions for detecting launcher installations
fn detect_minecraft_launcher_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA").ok()?;
        Some(std::path::PathBuf::from(localappdata).join(".minecraft"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join("Library/Application Support/minecraft"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".minecraft"))
    }
}

fn detect_prism_launcher_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").ok()?;
        Some(std::path::PathBuf::from(appdata).join("PrismLauncher"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join("Library/Application Support/PrismLauncher"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".local/share/PrismLauncher"))
    }
}

fn detect_modrinth_launcher_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").ok()?;
        Some(std::path::PathBuf::from(appdata).join("com.modrinth.theseus"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join("Library/Application Support/com.modrinth.theseus"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".var/app/com.modrinth.ModrinthApp"))
    }
}

fn detect_lunar_client_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let userprofile = std::env::var("USERPROFILE").ok()?;
        Some(std::path::PathBuf::from(userprofile).join(".lunarclient"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".lunarclient"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".lunarclient"))
    }
}

fn detect_feather_client_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA").ok()?;
        Some(std::path::PathBuf::from(localappdata).join("FeatherClient"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join("Library/Application Support/Feather"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".feather"))
    }
}

fn detect_atlauncher_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let localappdata = std::env::var("LOCALAPPDATA").ok()?;
        Some(std::path::PathBuf::from(localappdata).join("ATLauncher"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join("Library/Application Support/ATLauncher"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(std::path::PathBuf::from(home).join(".local/share/ATLauncher"))
    }
}

#[derive(Debug)]
struct FoundInstance {
    path: std::path::PathBuf,
    version: String,
    loader: String,
}

fn find_instances_in_directory(path: &std::path::Path) -> Result<Vec<FoundInstance>, String> {
    let mut instances = Vec::new();
    
    // Check if the directory exists
    if !path.exists() {
        return Ok(instances);
    }
    
    // For standard Minecraft launcher, check for 'saves' folder to identify valid installations
    if path.join("saves").exists() {
        // This is a standard Minecraft profile
        instances.push(FoundInstance {
            path: path.to_path_buf(),
            version: "unknown".to_string(),
            loader: "vanilla".to_string(),
        });
    }
    
    // Check for instances subdirectories (Prism, MultiMC style)
    let instances_dir = path.join("instances");
    if instances_dir.exists() {
        if let Ok(entries) = fs::read_dir(instances_dir) {
            for entry in entries.flatten() {
                let instance_path = entry.path();
                if instance_path.is_dir() {
                    instances.push(FoundInstance {
                        path: instance_path.clone(),
                        version: detect_version_from_instance(&instance_path),
                        loader: detect_loader_from_instance(&instance_path),
                    });
                }
            }
        }
    }
    
    Ok(instances)
}

fn detect_version_from_instance(path: &std::path::Path) -> String {
    // Try to detect version from various files
    if let Ok(content) = fs::read_to_string(path.join("instance.json")) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
                return version.to_string();
            }
        }
    }
    
    // Check for version from minecraft/options.txt or other config files
    if let Ok(content) = fs::read_to_string(path.join("options.txt")) {
        for line in content.lines() {
            if line.starts_with("lastServer:") {
                return "1.20.1".to_string(); // Default fallback
            }
        }
    }
    
    "unknown".to_string()
}

fn detect_loader_from_instance(path: &std::path::Path) -> String {
    // Check for loader indicators
    if path.join("mods").exists() {
        // Check for Fabric
        if path.join(".fabric").exists() || path.join("config/fabric").exists() {
            return "fabric".to_string();
        }
        // Check for Forge
        if path.join("mods").read_dir().map(|mut d| d.any(|e| {
            e.map(|f| f.file_name().to_string_lossy().contains("forge")).unwrap_or(false)
        })).unwrap_or(false) {
            return "forge".to_string();
        }
        return "fabric".to_string(); // Default assumption if mods folder exists
    }
    
    "vanilla".to_string()
}

fn copy_instance_files(from: &std::path::Path, to: &std::path::Path) -> Result<(), String> {
    // Copy saves folder
    let saves_from = from.join("saves");
    if saves_from.exists() {
        let saves_to = to.join("saves");
        copy_dir_all(&saves_from, &saves_to)?;
    }
    
    // Copy mods folder
    let mods_from = from.join("mods");
    if mods_from.exists() {
        let mods_to = to.join("mods");
        copy_dir_all(&mods_from, &mods_to)?;
    }
    
    // Copy config folder
    let config_from = from.join("config");
    if config_from.exists() {
        let config_to = to.join("config");
        copy_dir_all(&config_from, &config_to)?;
    }
    
    // Copy resourcepacks folder
    let packs_from = from.join("resourcepacks");
    if packs_from.exists() {
        let packs_to = to.join("resourcepacks");
        copy_dir_all(&packs_from, &packs_to)?;
    }
    
    // Copy shaderpacks folder
    let shaders_from = from.join("shaderpacks");
    if shaders_from.exists() {
        let shaders_to = to.join("shaderpacks");
        copy_dir_all(&shaders_from, &shaders_to)?;
    }
    
    // Copy options.txt
    let options_from = from.join("options.txt");
    if options_from.exists() {
        fs::copy(&options_from, to.join("options.txt")).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name();
        let dest = dst.join(&file_name);
        
        if path.is_dir() {
            copy_dir_all(&path, &dest)?;
        } else {
            fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
    }
}