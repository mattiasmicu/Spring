use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::fs;
use zip::ZipArchive;

#[derive(Debug, Serialize, Clone)]
pub struct LaunchLog {
    pub line: String,
    pub level: String,
}

#[command]
pub async fn launch_instance(
    app: AppHandle,
    id: String,
    java_path: String,
    ram_mb: u32,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    
    // Read instance.json to get version
    let instance_json = fs::read_to_string(instance_dir.join("instance.json")).map_err(|e| e.to_string())?;
    let instance: serde_json::Value = serde_json::from_str(&instance_json).map_err(|e| e.to_string())?;
    let version_id = instance["version"].as_str().ok_or("No version in instance.json")?;

    // Check if there's a loader version ID (for modded instances)
    let effective_version_id = if let Some(loader_version_id) = instance.get("loader_version_id").and_then(|v| v.as_str()) {
        emit_log(&app, "info", format!("Using mod loader version: {}", loader_version_id));
        loader_version_id
    } else {
        version_id
    };

    // Read version info to get libraries - use MINECRAFT version for libraries, not loader version
    let minecraft_version_json_path = app_data.join("versions").join(version_id).join(format!("{}.json", version_id));
    if !minecraft_version_json_path.exists() {
        return Err("Minecraft version JSON missing. Please download version first.".to_string());
    }
    let version_json = fs::read_to_string(&minecraft_version_json_path).map_err(|e| e.to_string())?;
    let version_info: serde_json::Value = serde_json::from_str(&version_json).map_err(|e| e.to_string())?;

    // Build Classpath
    let mut classpath = Vec::new();
    let libs_dir = app_data.join("libraries");
    if let Some(libraries) = version_info["libraries"].as_array() {
        for lib in libraries {
            // Add main artifact
            if let Some(name) = lib["name"].as_str() {
                let lib_path = libs_dir.join(get_lib_path(name));
                if lib_path.exists() {
                    classpath.push(lib_path.to_string_lossy().to_string());
                }
            }
            
            // Add classifier JARs (natives) to classpath
            if let Some(downloads) = lib.get("downloads") {
                if let Some(classifiers) = downloads.get("classifiers") {
                    if let Some(classifiers_obj) = classifiers.as_object() {
                        for (classifier_name, classifier_info) in classifiers_obj {
                            // Only add natives for current OS
                            let should_include = if cfg!(target_os = "macos") {
                                classifier_name.contains("macos") || classifier_name.contains("osx")
                            } else if cfg!(target_os = "windows") {
                                classifier_name.contains("windows")
                            } else if cfg!(target_os = "linux") {
                                classifier_name.contains("linux")
                            } else {
                                false
                            };
                            
                            if should_include {
                                if let Some(path) = classifier_info.get("path").and_then(|p| p.as_str()) {
                                    let classifier_path = libs_dir.join(path);
                                    if classifier_path.exists() {
                                        classpath.push(classifier_path.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let client_jar = app_data.join("versions").join(version_id).join(format!("{}.jar", version_id));
    classpath.push(client_jar.to_string_lossy().to_string());

    let classpath_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let full_classpath = classpath.join(classpath_sep);

    // Extract native libraries
    let natives_path = libs_dir.join("natives");
    fs::create_dir_all(&natives_path).map_err(|e| e.to_string())?;
    
    let mut natives_extracted = 0;
    let mut libraries_with_natives = 0;
    
    if let Some(libraries) = version_info["libraries"].as_array() {
        for lib in libraries {
            libraries_with_natives += 1;
            
            // Debug: Print library structure
            if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                if name.contains("lwjgl") || name.contains("glfw") {
                    emit_log(&app, "debug", format!("Checking library: {}", name));
                    emit_log(&app, "debug", format!("Has downloads: {}", lib.get("downloads").is_some()));
                    
                    // LWJGL libraries have natives embedded in main JAR, not separate classifier JARs
                    if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                        if let Some(artifact_path) = artifact.get("path").and_then(|p| p.as_str()) {
                            let artifact_jar_path = libs_dir.join(artifact_path);
                            emit_log(&app, "debug", format!("Main artifact JAR path: {}", artifact_jar_path.to_string_lossy()));
                            emit_log(&app, "debug", format!("Main artifact JAR exists: {}", artifact_jar_path.exists()));
                            
                            if artifact_jar_path.exists() {
                                match extract_native_libraries(&artifact_jar_path, &natives_path) {
                                    Ok(_) => {
                                        natives_extracted += 1;
                                        if natives_extracted <= 5 {
                                            emit_log(&app, "info", format!("Extracted {} native libraries so far...", natives_extracted));
                                        }
                                    }
                                    Err(e) => {
                                        emit_log(&app, "error", format!("Failed to extract {}: {}", artifact_jar_path.to_string_lossy(), e));
                                    }
                                }
                            }
                        }
                    }
                    
                    // Also check for separate native classifier JARs (for other libraries)
                    if let Some(downloads) = lib.get("downloads") {
                        if let Some(classifiers) = downloads.get("classifiers") {
                            emit_log(&app, "debug", "Has classifiers".to_string());
                            if let Some(classifiers_obj) = classifiers.as_object() {
                                for (key, value) in classifiers_obj {
                                    emit_log(&app, "debug", format!("  Classifier: {}", key));
                                    if key.contains("natives") {
                                        if let Some(path) = value.get("path").and_then(|p| p.as_str()) {
                                            let classifier_jar_path = libs_dir.join(path);
                                            emit_log(&app, "debug", format!("Classifier JAR path: {}", classifier_jar_path.to_string_lossy()));
                                            emit_log(&app, "debug", format!("Classifier JAR exists: {}", classifier_jar_path.exists()));
                                            
                                            if classifier_jar_path.exists() {
                                                match extract_native_libraries(&classifier_jar_path, &natives_path) {
                                                    Ok(_) => {
                                                        natives_extracted += 1;
                                                        if natives_extracted <= 5 {
                                                            emit_log(&app, "info", format!("Extracted {} native libraries so far...", natives_extracted));
                                                        }
                                                    }
                                                    Err(e) => {
                                                        emit_log(&app, "error", format!("Failed to extract {}: {}", classifier_jar_path.to_string_lossy(), e));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    emit_log(&app, "info", format!("Processed {} libraries, extracted {} native libraries", libraries_with_natives, natives_extracted));

    // Build Arguments
    let mut args = Vec::new();
    
    // macOS requires -XstartOnFirstThread for GLFW
    if cfg!(target_os = "macos") {
        args.push("-XstartOnFirstThread".to_string());
    }
    
    args.push(format!("-Xmx{}m", ram_mb));
    args.push("-Xms512m".to_string());
    
    // Set native library path to the libraries directory
    let natives_path = libs_dir.join("natives");
    args.push(format!("-Djava.library.path={}", natives_path.to_string_lossy()));
    
    args.push("-Dlog4j2.formatMsgNoLookups=true".to_string());
    args.push("-cp".to_string());
    args.push(full_classpath);
    args.push(version_info["mainClass"].as_str().unwrap_or("net.minecraft.client.main.Main").to_string());

    // Game Args
    args.push("--username".to_string());
    args.push(username);
    args.push("--uuid".to_string());
    args.push(uuid);
    args.push("--accessToken".to_string());
    args.push(access_token);
    args.push("--gameDir".to_string());
    args.push(instance_dir.to_string_lossy().to_string());
    args.push("--assetsDir".to_string());
    args.push(app_data.join("assets").to_string_lossy().to_string());
    args.push("--assetIndex".to_string());
    args.push(version_info["assetIndex"]["id"].as_str().unwrap_or("1.20").to_string());
    args.push("--version".to_string());
    args.push(version_id.to_string());
    args.push("--userType".to_string());
    args.push("mojang".to_string());

    let mut child = Command::new(java_path)
        .args(args)
        .current_dir(&instance_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_clone.emit("launch-log", LaunchLog {
                line,
                level: "info".to_string(),
            });
        }
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_clone.emit("launch-log", LaunchLog {
                line,
                level: "error".to_string(),
            });
        }
    });

    std::thread::spawn(move || {
        let status = child.wait().unwrap();
        let _ = app.emit("launch-exit", status.code().unwrap_or(0));
    });

    Ok(())
}

#[command]
pub async fn kill_instance(_id: String) -> Result<(), String> {
    Ok(())
}

fn emit_log(app: &AppHandle, level: &str, message: String) {
    let _ = app.emit("launch-log", LaunchLog {
        line: message,
        level: level.to_string(),
    });
}

fn get_lib_path(name: &str) -> PathBuf {
    // Check if name already includes path components (like org.lwjgl:lwjgl-glfw:3.4.1)
    if name.contains('/') {
        // Name already includes full path, use as-is
        PathBuf::from(name)
    } else {
        // Split by ':' for Maven coordinates (group:artifact:version[:classifier])
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() >= 3 {
            let group = parts[0].replace('.', "/");
            let artifact = parts[1];
            let version = parts[2];
            let filename = if parts.len() >= 4 {
                // Has classifier (e.g., natives-macos-arm64)
                format!("{}-{}-{}.jar", artifact, version, parts[3])
            } else {
                format!("{}-{}.jar", artifact, version)
            };
            PathBuf::from(group).join(artifact).join(version).join(filename)
        } else {
            PathBuf::from(name)
        }
    }
}

fn extract_native_libraries(jar_path: &Path, natives_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(jar_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        if file.name().ends_with(".dylib") || file.name().ends_with(".so") || file.name().ends_with(".dll") {
            let file_path = natives_dir.join(Path::new(file.name()).file_name().unwrap());
            let mut output = fs::File::create(&file_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}
