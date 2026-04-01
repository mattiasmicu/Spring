use tauri::{command, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use tokio::time::Duration;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use oauth2::{
    AuthUrl, AuthorizationCode, Client as OAuthClient, ClientId, CsrfToken, EndpointNotSet, EndpointSet,
    PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, RefreshToken, Scope, StandardRevocableToken, TokenResponse,
    basic::{
        BasicErrorResponse, BasicRevocationErrorResponse, BasicTokenIntrospectionResponse,
        BasicTokenResponse,
    },
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

// like some auth stuff, i just borrowed abit from panora launcher

const CLIENT_ID: &str = "a729e3e8-23aa-4754-9954-28a822c698a0";
const AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const REDIRECT_URL_BASE: &str = "http://localhost:3160";
const REDIRECT_URL: &str = "http://localhost:3160/auth";
const SERVER_ADDRESS: &str = "127.0.0.1:3160";

const XBOX_AUTHENTICATE_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTHORIZE_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_LOGIN_WITH_XBOX_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

// ── Type Aliases ────────────────────────────────────────────────────────────────

type OAuth2ClientType = OAuthClient<
    BasicErrorResponse,
    BasicTokenResponse,
    BasicTokenIntrospectionResponse,
    StandardRevocableToken,
    BasicRevocationErrorResponse,
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointSet,
>;

// ── Structs ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub uuid: String,
    pub username: String,
    pub token: String,
    pub refresh: String,
    pub skin: Option<String>,
    pub tier: String,
}

struct PendingAuthorization {
    url: Url,
    csrf_token: CsrfToken,
    pkce_verifier: Option<PkceCodeVerifier>,
}

impl std::fmt::Debug for PendingAuthorization {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PendingAuthorization")
            .field("url", &self.url)
            .field("csrf_token", &self.csrf_token)
            .field("pkce_verifier", &self.pkce_verifier.as_ref().map(|_| "<verifier>"))
            .finish()
    }
}

impl Clone for PendingAuthorization {
    fn clone(&self) -> Self {
        Self {
            url: self.url.clone(),
            csrf_token: self.csrf_token.clone(),
            pkce_verifier: None, // PKCE verifier cannot be cloned and is consumed on use
        }
    }
}

#[derive(Debug)]
struct FinishedAuthorization {
    pending: PendingAuthorization,
    code: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct MsaTokens {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MSTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
struct XboxAuthRequest {
    Properties: XboxAuthProps,
    RelyingParty: String,
    TokenType: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
struct XboxAuthProps {
    AuthMethod: String,
    SiteName: String,
    RpsTicket: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct XboxAuthResponse {
    Token: String,
    DisplayClaims: DisplayClaims,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct DisplayClaims {
    xui: Vec<Xui>,
}

#[derive(Deserialize, Debug)]
struct Xui {
    uhs: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
struct XSTSRequest {
    Properties: XSTSProps,
    RelyingParty: String,
    TokenType: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
struct XSTSProps {
    SandboxId: String,
    UserTokens: Vec<String>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct XSTSResponse {
    Token: String,
    DisplayClaims: DisplayClaims,
}

#[derive(Debug, Deserialize)]
struct MCLinkResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct MCProfileResponse {
    id: String,
    name: String,
    skins: Vec<MCSkin>,
}

#[derive(Debug, Deserialize)]
struct MCSkin {
    url: String,
}

// Global state for pending auth (to handle the redirect)
use std::sync::OnceLock;
static PENDING_AUTH: OnceLock<Arc<Mutex<Option<PendingAuthorization>>>> = OnceLock::new();

fn get_pending_auth() -> Arc<Mutex<Option<PendingAuthorization>>> {
    PENDING_AUTH.get_or_init(|| Arc::new(Mutex::new(None))).clone()
}

// ── Commands ───────────────────────────────────────────────────────────────────

/// Start Microsoft OAuth2 authorization flow with in-app webview
/// Opens a webview window for auth and captures the redirect
#[command]
pub async fn start_microsoft_auth(app: tauri::AppHandle) -> Result<(), String> {
    let pending = create_authorization();
    let auth_url = pending.url.to_string();
    
    // Store pending auth for later verification
    let pending_store = get_pending_auth();
    let mut guard = pending_store.lock().await;
    *guard = Some(pending);
    drop(guard);
    
    // Create a webview window for authentication
    let auth_window = WebviewWindowBuilder::new(&app, "auth", WebviewUrl::External(auth_url.parse().unwrap()))
        .title("Sign in with Microsoft")
        .inner_size(500.0, 600.0)
        .center()
        .resizable(false)
        .build()
        .map_err(|e| format!("Failed to create auth window: {}", e))?;
    
    // Start local server in background to handle redirect
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match start_redirect_server().await {
            Ok(finished) => {
                // Close the auth window
                let _ = auth_window.close();
                
                // Exchange code for tokens
                match finish_authorization(finished).await {
                    Ok(tokens) => {
                        let _ = app_handle.emit("auth-status", "authenticating");
                        match run_xbox_chain(tokens.access_token, tokens.refresh_token.unwrap_or_default()).await {
                            Ok(profile) => {
                                let _ = app_handle.emit("auth-success", profile);
                            }
                            Err(e) => {
                                let _ = app_handle.emit("auth-error", e);
                            }
                        }
                    }
                    Err(e) => {
                        let _ = app_handle.emit("auth-error", format!("Token exchange failed: {}", e));
                    }
                }
            }
            Err(e) => {
                let _ = auth_window.close();
                let _ = app_handle.emit("auth-error", format!("Auth server error: {}", e));
            }
        }
        
        // Clear pending auth
        let pending_store = get_pending_auth();
        let mut guard = pending_store.lock().await;
        *guard = None;
    });
    
    Ok(())
}

/// Cancel ongoing authentication
#[command]
pub async fn cancel_microsoft_auth() -> Result<(), String> {
    let pending_store = get_pending_auth();
    let mut guard = pending_store.lock().await;
    *guard = None;
    Ok(())
}

#[command]
pub async fn refresh_token(refresh: String) -> Result<UserProfile, String> {
    let client = Client::new();
    
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh.as_str()),
            ("scope", "XboxLive.signin"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let token: MSTokenResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Refresh parse failed: {} — body: {}", e, text))?;
    
    if let Some(err) = token.error {
        return Err(format!("Refresh failed: {}", err));
    }
    
    let access_token = token.access_token.ok_or("No access token")?;
    let refresh_token = token.refresh_token.ok_or("No refresh token")?;
    
    run_xbox_chain(access_token, refresh_token).await
}

#[command]
pub async fn try_official_launcher_auth() -> Result<UserProfile, String> {
    // Try multiple official launcher files
    let paths = get_official_launcher_paths();
    
    eprintln!("[auth] Checking {} launcher paths:", paths.len());
    for (i, path) in paths.iter().enumerate() {
        eprintln!("[auth] Path {}: {} (exists: {})", i, path.display(), path.exists());
    }
    
    for launcher_path in paths {
        if !launcher_path.exists() {
            continue;
        }
        
        eprintln!("[auth] Reading: {}", launcher_path.display());
        
        let content = match fs::read_to_string(&launcher_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[auth] Failed to read: {}", e);
                continue;
            }
        };
        
        // Debug: print first 500 chars
        eprintln!("[auth] Content preview: {}", &content[..content.len().min(500)]);
        
        let launcher_data: serde_json::Value = match serde_json::from_str(&content) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[auth] JSON parse error: {}", e);
                continue;
            }
        };
        
        // Try new format first (accounts object)
        if let Some(accounts) = launcher_data.get("accounts").and_then(|a| a.as_object()) {
            eprintln!("[auth] Found {} accounts", accounts.len());
            for (account_id, account) in accounts {
                eprintln!("[auth] Checking account: {}", account_id);
                eprintln!("[auth] Account JSON: {}", serde_json::to_string_pretty(account).unwrap_or_default());
                
                // Check if account is Microsoft type
                let account_type = account.get("type").and_then(|t| t.as_str()).unwrap_or("");
                eprintln!("[auth] Account type: {}", account_type);
                
                // Get access token - try multiple field names (official launcher uses "accessToken")
                let mc_token = account.get("accessToken")
                    .and_then(|t| t.as_str())
                    .or_else(|| account.get("minecraftToken").and_then(|t| t.as_str()));
                
                if let Some(token) = mc_token {
                    eprintln!("[auth] Found token (len: {})", token.len());
                    
                    // Get username from minecraftProfile if available (newer format)
                    let username = account.get("minecraftProfile")
                        .and_then(|p| p.get("name"))
                        .and_then(|n| n.as_str())
                        .or_else(|| account.get("profile").and_then(|p| p.get("name")).and_then(|n| n.as_str()))
                        .or_else(|| account.get("username").and_then(|u| u.as_str()))
                        .unwrap_or("Player")
                        .to_string();
                    
                    // Get UUID from minecraftProfile if available (newer format)
                    let uuid = account.get("minecraftProfile")
                        .and_then(|p| p.get("id"))
                        .and_then(|i| i.as_str())
                        .or_else(|| account.get("profile").and_then(|p| p.get("id")).and_then(|i| i.as_str()))
                        .or_else(|| account.get("uuid").and_then(|u| u.as_str()))
                        .unwrap_or("")
                        .to_string();
                    
                    eprintln!("[auth] Username: {}, UUID: {}", username, uuid);
                    
                    // If token is empty but we have a refresh token, try to refresh via Microsoft
                    if token.is_empty() {
                        eprintln!("[auth] Token empty, trying Microsoft refresh...");
                        if let Some(refresh_token) = account.get("refreshToken").and_then(|r| r.as_str()) {
                            if !refresh_token.is_empty() {
                                eprintln!("[auth] Found refresh token in JSON, attempting refresh...");
                                match refresh_microsoft_token(refresh_token).await {
                                    Ok((new_access_token, new_refresh_token)) => {
                                        eprintln!("[auth] Token refreshed successfully!");
                                        // Now we need to get Minecraft token via Xbox chain
                                        match run_xbox_chain(new_access_token, new_refresh_token).await {
                                            Ok(profile) => {
                                                eprintln!("[auth] Xbox auth successful!");
                                                return Ok(profile);
                                            }
                                            Err(e) => {
                                                eprintln!("[auth] Xbox auth failed: {}", e);
                                                continue;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("[auth] Token refresh failed: {}", e);
                                        continue;
                                    }
                                }
                            }
                        }
                        eprintln!("[auth] No refresh token in launcher file - official launcher stores it in macOS Keychain");
                        return Err("Official launcher stores tokens in macOS Keychain. Please use 'Sign in with Microsoft' instead.".to_string());
                    }
                    
                    // Try to get refresh token
                    let refresh = account.get("refreshToken")
                        .and_then(|r| r.as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    // Verify the token works
                    eprintln!("[auth] Verifying token with Minecraft API...");
                    let client = Client::new();
                    let profile_check = client
                        .get("https://api.minecraftservices.com/minecraft/profile")
                        .bearer_auth(token)
                        .send()
                        .await;
                    
                    match profile_check {
                        Ok(resp) if resp.status().is_success() => {
                            eprintln!("[auth] Token valid!");
                            return Ok(UserProfile {
                                uuid: if uuid.is_empty() { account_id.clone() } else { uuid },
                                username,
                                token: token.to_string(),
                                refresh,
                                skin: None,
                                tier: "microsoft".to_string(),
                            });
                        }
                        Ok(resp) => {
                            eprintln!("[auth] Token invalid, status: {}", resp.status());
                            continue;
                        }
                        Err(e) => {
                            eprintln!("[auth] Token verification error: {}", e);
                            continue;
                        }
                    }
                } else {
                    eprintln!("[auth] No accessToken found for account");
                }
            }
        } else {
            eprintln!("[auth] No 'accounts' object found in launcher data");
        }
    }
    
    Err("No valid Microsoft account found in official launcher".to_string())
}

fn get_official_launcher_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")] {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            home.join("Library/Application Support/minecraft/launcher_accounts.json"),
            home.join("Library/Application Support/minecraft/launcher_accounts_microsoft_store.json"),
            home.join("Library/Application Support/minecraft/launcher_profiles.json"),
        ]
    }
    #[cfg(target_os = "windows")] {
        let data = dirs::data_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            data.join(".minecraft/launcher_accounts.json"),
            data.join(".minecraft/launcher_accounts_microsoft_store.json"),
            data.join(".minecraft/launcher_profiles.json"),
        ]
    }
    #[cfg(target_os = "linux")] {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            home.join(".minecraft/launcher_accounts.json"),
            home.join(".minecraft/launcher_accounts_microsoft_store.json"),
            home.join(".minecraft/launcher_profiles.json"),
        ]
    }
}

#[command]
pub async fn logout() -> Result<(), String> {
    Ok(())
}

// ── Internal auth chain ────────────────────────────────────────────────────────

async fn run_xbox_chain(
    ms_access_token: String,
    ms_refresh_token: String,
) -> Result<UserProfile, String> {
    let client = Client::new();

    let xbox_auth: XboxAuthResponse = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&XboxAuthRequest {
            Properties: XboxAuthProps {
                AuthMethod: "RPS".to_string(),
                SiteName: "user.auth.xboxlive.com".to_string(),
                RpsTicket: format!("d={}", ms_access_token),
            },
            RelyingParty: "http://auth.xboxlive.com".to_string(),
            TokenType: "JWT".to_string(),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("Xbox auth failed: {}", e))?;

    let xsts: XSTSResponse = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&XSTSRequest {
            Properties: XSTSProps {
                SandboxId: "RETAIL".to_string(),
                UserTokens: vec![xbox_auth.Token],
            },
            RelyingParty: "rp://api.minecraftservices.com/".to_string(),
            TokenType: "JWT".to_string(),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("XSTS failed: {}", e))?;

    let uhs = &xsts.DisplayClaims.xui[0].uhs;

    let mc_text = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts.Token)
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    println!("[auth] mc login → {}", mc_text);
    let mc_token: MCLinkResponse = serde_json::from_str(&mc_text)
        .map_err(|e| format!("MC login failed: {} — body: {}", e, mc_text))?;

    let profile_text = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_token.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    println!("[auth] mc profile → {}", profile_text);
    let profile: MCProfileResponse = serde_json::from_str(&profile_text)
        .map_err(|e| format!("MC profile failed: {} — body: {}", e, profile_text))?;

    Ok(UserProfile {
        uuid: profile.id,
        username: profile.name,
        token: mc_token.access_token,
        refresh: ms_refresh_token,
        skin: profile.skins.first().map(|s| s.url.clone()),
        tier: "microsoft".to_string(),
    })
}

// Helper function to refresh Microsoft token
async fn refresh_microsoft_token(refresh_token: &str) -> Result<(String, String), String> {
    let client = Client::new();
    
    let resp = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", "XboxLive.signin"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let token: MSTokenResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Refresh parse failed: {} — body: {}", e, text))?;
    
    if let Some(err) = token.error {
        return Err(format!("Refresh failed: {}", err));
    }
    
    let access_token = token.access_token.ok_or("No access token")?;
    let new_refresh_token = token.refresh_token.ok_or("No refresh token")?;
    
    Ok((access_token, new_refresh_token))
}

// ── Internal Functions ────────────────────────────────────────────────────────

fn create_authorization() -> PendingAuthorization {
    let oauth_client = create_oauth_client();
    
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    
    let (url, csrf_token) = oauth_client
        .authorize_url(CsrfToken::new_random)
        .add_extra_param("prompt", "select_account")
        .add_scope(Scope::new("XboxLive.signin".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();
    
    PendingAuthorization {
        url,
        csrf_token,
        pkce_verifier: Some(pkce_verifier),
    }
}

fn create_oauth_client() -> OAuth2ClientType {
    OAuthClient::new(
        ClientId::new(CLIENT_ID.to_string())
    )
    .set_auth_type(oauth2::AuthType::RequestBody)
    .set_auth_uri(AuthUrl::new(AUTH_URL.to_string()).unwrap())
    .set_token_uri(oauth2::TokenUrl::new(TOKEN_URL.to_string()).unwrap())
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URL.to_string()).unwrap())
}

async fn finish_authorization(finished: FinishedAuthorization) -> Result<MsaTokens, String> {
    let oauth_client = create_oauth_client();
    let http_client = Client::new();
    
    let token_response = oauth_client
        .exchange_code(AuthorizationCode::new(finished.code))
        .set_pkce_verifier(finished.pending.pkce_verifier.ok_or("Missing PKCE verifier")?)
        .request_async(&http_client)
        .await
        .map_err(|e| format!("Token exchange failed: {:?}", e))?;
    
    let expires_in = token_response.expires_in().unwrap_or(Duration::from_secs(3600));
    let expires_at = Utc::now() + expires_in;
    
    Ok(MsaTokens {
        access_token: token_response.access_token().secret().as_str().into(),
        refresh_token: token_response.refresh_token().map(|t| t.secret().as_str().into()),
        expires_at,
    })
}

async fn start_redirect_server() -> Result<FinishedAuthorization, String> {
    println!("[auth] Starting redirect server on {}", SERVER_ADDRESS);
    
    let listener = TcpListener::bind(SERVER_ADDRESS)
        .await
        .map_err(|e| format!("Failed to bind server: {}", e))?;
    
    println!("[auth] Server listening on {}", SERVER_ADDRESS);
    
    let mut buf = vec![0u8; 1024];
    
    loop {
        println!("[auth] Waiting for connection...");
        let (mut stream, addr) = listener.accept()
            .await
            .map_err(|e| format!("Failed to accept connection: {}", e))?;
        
        println!("[auth] Got connection from {:?}", addr);
        
        let mut read = 0;
        loop {
            let n = stream.read(&mut buf[read..])
                .await
                .map_err(|e| format!("Read error: {}", e))?;
            
            if n == 0 {
                println!("[auth] Connection closed");
                break;
            }
            
            read += n;
            
            if read == buf.len() {
                buf.resize(buf.len() * 2, 0);
                continue;
            }
            
            // Try to parse HTTP request
            let mut headers = [httparse::EMPTY_HEADER; 32];
            let mut req = httparse::Request::new(&mut headers);
            let parsed = req.parse(&buf[..read])
                .map_err(|e| format!("HTTP parse error: {:?}", e))?;
            
            if parsed.is_partial() {
                continue;
            }
            
            println!("[auth] Received HTTP request");
            
            if req.method != Some("GET") || req.path.is_none() {
                let response = b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                let _ = stream.write_all(response).await;
                break;
            }
            
            let path = req.path.unwrap();
            let full_url = format!("{}{}", REDIRECT_URL_BASE, path);
            let url = Url::parse(&full_url)
                .map_err(|e| format!("URL parse error: {}", e))?;
            
            if url.path() != "/auth" {
                let response = b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                let _ = stream.write_all(response).await;
                break;
            }
            
            // Parse query parameters
            let mut error = None;
            let mut error_description = None;
            let mut code = None;
            let mut state = None;
            
            for (key, value) in url.query_pairs() {
                match &*key {
                    "error" => error = Some(value.to_string()),
                    "error_description" => error_description = Some(value.to_string()),
                    "code" => code = Some(value.to_string()),
                    "state" => state = Some(value.to_string()),
                    _ => {}
                }
            }
            
            // Handle errors from Microsoft
            if let Some(err) = error {
                let full_error = if let Some(desc) = error_description {
                    format!("{}: {}", err, desc)
                } else {
                    err
                };
                
                let body = format!(
                    r#"<!DOCTYPE html>
<html><body>
<h1>Authentication Error</h1>
<p>{}</p>
<p>You can close this window.</p>
</body></html>"#,
                    full_error
                );
                let response = format!(
                    "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes()).await;
                return Err(format!("Auth error: {}", full_error));
            }
            
            // Verify CSRF token
            let pending_store = get_pending_auth();
            let guard = pending_store.lock().await;
            
            if let Some(ref pending) = *guard {
                if let Some(ref received_state) = state {
                    if received_state != pending.csrf_token.secret() {
                        let body = r#"<!DOCTYPE html>
<html><body>
<h1>CSRF Error</h1>
<p>Security token mismatch. Please try again.</p>
</body></html>"#;
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                        return Err("CSRF token mismatch".to_string());
                    }
                }
                
                // Check for code
                if let Some(auth_code) = code {
                    // Success!
                    let body = r#"<!DOCTYPE html>
<html><body>
<h1>Authentication Successful</h1>
<p>You can close this window and return to the launcher.</p>
<script>setTimeout(() => window.close(), 3000);</script>
</body></html>"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                    
                    let finished = FinishedAuthorization {
                        pending: pending.clone(),
                        code: auth_code,
                    };
                    
                    return Ok(finished);
                } else {
                    let body = r#"<!DOCTYPE html>
<html><body>
<h1>Error</h1>
<p>Missing authorization code.</p>
</body></html>"#;
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                    return Err("Missing authorization code".to_string());
                }
            } else {
                let body = r#"<!DOCTYPE html>
<html><body>
<h1>Error</h1>
<p>No pending authentication found.</p>
</body></html>"#;
                let response = format!(
                    "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes()).await;
                return Err("No pending authentication".to_string());
            }
        }
    }
}