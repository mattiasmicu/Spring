pub mod commands;

use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => Ok(Some(update.version)),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            check_update,
            commands::auth::start_microsoft_auth,
            commands::auth::cancel_microsoft_auth,
            commands::auth::refresh_token,
            commands::auth::logout,
            commands::auth::try_official_launcher_auth,
            commands::java::download_java,
            commands::java::detect_java_version,
            commands::java::get_platform_info,
            commands::java::get_os,
            commands::java::get_arch,
            commands::instances::list_instances,
            commands::instances::create_instance,
            commands::instances::delete_instance,
            commands::instances::duplicate_instance,
            commands::instances::update_instance,
            commands::instances::upload_instance_icon,
            commands::instances::import_instance_from_launcher,
            commands::instances::import_instance_browse,
            commands::instances::browse_modpacks,
            commands::instances::install_modpack_file,
            commands::instances_extra::get_instance_settings,
            commands::instances_extra::save_instance_settings,
            commands::download::fetch_version_manifest,
            commands::download::download_version,
            commands::download::get_java_version_requirement,
            commands::launch::launch_instance,
            commands::launch::kill_instance,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::files::list_instance_files,
            commands::files::open_in_finder,
            commands::files::create_folder,
            commands::files::delete_file,
            commands::files::read_file_content,
            commands::files::install_mod,
            commands::files::uninstall_mod,
            commands::files::list_installed_mods,
            commands::files::toggle_mod,
            commands::loaders::get_loader_versions,
            commands::loaders::install_loader,
            commands::skins::get_capes,
            commands::skins::get_profile,
            commands::skins::equip_cape,
            commands::skins::upload_skin,
            commands::skins::reset_skin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}