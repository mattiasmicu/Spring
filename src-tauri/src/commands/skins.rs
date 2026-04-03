use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Cape {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    pub capes: Option<Vec<Cape>>,
    pub skin: Option<Skin>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Skin {
    pub id: String,
    pub state: String,
    pub url: String,
    pub variant: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CapeInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub data_url: Option<String>,
}

#[command]
pub async fn get_capes(access_token: String) -> Result<Vec<CapeInfo>, String> {
    let client = reqwest::Client::new();
    
    // Fetch user's Minecraft profile to get capes
    let response = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch profile: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        eprintln!("Profile API error: {} - {}", status, text);
        return Err(format!("Failed to fetch profile: {}", status));
    }
    
    let profile: MinecraftProfile = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse profile: {}", e))?;
    
    eprintln!("Profile name: {}, ID: {}", profile.name, profile.id);
    
    let mut capes = vec![];
    
    // Add default "No Cape" option
    capes.push(CapeInfo {
        id: "none".to_string(),
        name: "No Cape".to_string(),
        url: "".to_string(),
        data_url: None,
    });
    
    // Parse capes from profile
    if let Some(capes_array) = profile.capes {
        eprintln!("Found {} capes in profile", capes_array.len());
        for cape in capes_array {
            eprintln!("Cape: id={}, state={}, alias={}, url={}", cape.id, cape.state, cape.alias, cape.url);
            
            // Show all capes regardless of state
            let data_url = fetch_cape_image(&client, &cape.url).await.ok();
            
            capes.push(CapeInfo {
                id: cape.id,
                name: cape.alias,
                url: cape.url,
                data_url,
            });
        }
    } else {
        eprintln!("No capes field in profile");
    }
    
    Ok(capes)
}

async fn fetch_cape_image(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch cape image: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch cape image: {}", response.status()));
    }
    
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read cape bytes: {}", e))?;
    
    let base64 = base64::encode(&bytes);
    let data_url = format!("data:image/png;base64,{}", base64);
    
    Ok(data_url)
}

#[command]
pub async fn upload_skin(
    access_token: String,
    skin_data: String,
    skin_type: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    // Decode base64 skin data
    let skin_bytes = base64::decode(&skin_data)
        .map_err(|e| format!("Failed to decode skin data: {}", e))?;
    
    let part = reqwest::multipart::Part::bytes(skin_bytes)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;
    
    let form = reqwest::multipart::Form::new()
        .text("variant", skin_type)
        .part("file", part);
    
    let response = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Failed to upload skin: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to upload skin: {}", error_text));
    }
    
    Ok(())
}

#[command]
pub async fn get_profile(access_token: String) -> Result<MinecraftProfile, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch profile: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("Failed to fetch profile: {}", status));
    }
    
    let profile: MinecraftProfile = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse profile: {}", e))?;
    
    Ok(profile)
}

#[command]
pub async fn equip_cape(
    access_token: String,
    cape_id: Option<String>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    if let Some(id) = cape_id {
        // Equip specific cape
        let url = format!(
            "https://api.minecraftservices.com/minecraft/profile/capes/{}/make-active",
            id
        );
        
        let response = client
            .put(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| format!("Failed to equip cape: {}", e))?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to equip cape: {}", error_text));
        }
    } else {
        // Remove cape (equip none)
        let response = client
            .delete("https://api.minecraftservices.com/minecraft/profile/capes/active")
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| format!("Failed to remove cape: {}", e))?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to remove cape: {}", error_text));
        }
    }
    
    Ok(())
}

#[command]
pub async fn reset_skin(access_token: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let response = client
        .delete("https://api.minecraftservices.com/minecraft/profile/skins/active")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to reset skin: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to reset skin: {}", response.status()));
    }
    
    Ok(())
}
