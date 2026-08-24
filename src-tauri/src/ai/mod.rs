mod cancellation;
mod config;
mod credentials;
mod deepseek;
mod error;

use config::DEEPSEEK_PROVIDER;
use credentials::{default_store, CredentialError, SecureCredentialStore};
use deepseek::DeepSeekClient;
use error::{AiCommandError, AiErrorCode};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    DeepSeek,
}

impl AiProvider {
    fn as_str(&self) -> &'static str {
        match self {
            Self::DeepSeek => DEEPSEEK_PROVIDER,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AiConfigurationState {
    Configured,
    NotConfigured,
    Unavailable,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigurationSnapshot {
    pub provider: AiProvider,
    pub configured: bool,
    pub storage_available: bool,
    pub state: AiConfigurationState,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRequest {
    pub provider: AiProvider,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveApiKeyRequest {
    pub provider: AiProvider,
    pub api_key: SecretString,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiMessageRole {
    System,
    User,
    Assistant,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessage {
    pub role: AiMessageRole,
    pub content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub request_id: String,
    pub messages: Vec<AiChatMessage>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub text: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestIdRequest {
    pub request_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelRequestResponse {
    pub cancelled: bool,
}

pub struct AiBackend {
    credentials: Arc<Mutex<Box<dyn SecureCredentialStore>>>,
    client: DeepSeekClient,
    cancellation: cancellation::RequestCancellationRegistry,
}

impl Default for AiBackend {
    fn default() -> Self {
        Self {
            credentials: Arc::new(Mutex::new(default_store())),
            client: DeepSeekClient::new(),
            cancellation: cancellation::RequestCancellationRegistry::default(),
        }
    }
}

impl AiBackend {
    #[cfg(test)]
    fn with_store(store: Box<dyn SecureCredentialStore>) -> Self {
        Self {
            credentials: Arc::new(Mutex::new(store)),
            client: DeepSeekClient::new(),
            cancellation: cancellation::RequestCancellationRegistry::default(),
        }
    }

    fn configuration_status(&self) -> AiConfigurationSnapshot {
        let provider = AiProvider::DeepSeek;
        let result = self
            .credentials
            .lock()
            .map_err(|_| CredentialError::Unavailable)
            .and_then(|store| store.has_api_key(provider.as_str()));

        match result {
            Ok(true) => AiConfigurationSnapshot {
                provider,
                configured: true,
                storage_available: true,
                state: AiConfigurationState::Configured,
            },
            Ok(false) => AiConfigurationSnapshot {
                provider,
                configured: false,
                storage_available: true,
                state: AiConfigurationState::NotConfigured,
            },
            Err(_) => AiConfigurationSnapshot {
                provider,
                configured: false,
                storage_available: false,
                state: AiConfigurationState::Unavailable,
            },
        }
    }

    fn save_api_key(&self, request: SaveApiKeyRequest) -> Result<(), AiCommandError> {
        if request.api_key.expose_secret().trim().is_empty() {
            return Err(AiCommandError::new(
                AiErrorCode::InvalidRequest,
                "API Key 不能为空",
            ));
        }
        let provider = request.provider.as_str();
        let secret = request.api_key;
        let store = self
            .credentials
            .lock()
            .map_err(|_| AiCommandError::credential_store_unavailable())?;
        store
            .save_api_key(provider, &secret)
            .map_err(AiCommandError::from)
    }

    fn delete_api_key(&self, provider: AiProvider) -> Result<(), AiCommandError> {
        let store = self
            .credentials
            .lock()
            .map_err(|_| AiCommandError::credential_store_unavailable())?;
        store
            .delete_api_key(provider.as_str())
            .map_err(AiCommandError::from)
    }

    fn get_api_key(&self, provider: &AiProvider) -> Result<SecretString, AiCommandError> {
        let store = self
            .credentials
            .lock()
            .map_err(|_| AiCommandError::credential_store_unavailable())?;
        store
            .get_api_key_for_backend_use(provider.as_str())
            .map_err(AiCommandError::from)
    }
}

impl AiCommandError {
    fn credential_store_unavailable() -> Self {
        Self::new(
            AiErrorCode::CredentialStoreUnavailable,
            "系统安全存储暂时不可用",
        )
    }
}

impl From<CredentialError> for AiCommandError {
    fn from(error: CredentialError) -> Self {
        match error {
            CredentialError::NotConfigured => {
                Self::new(AiErrorCode::NotConfigured, "还没有配置 AI 服务哦～")
            }
            CredentialError::InvalidSecret => {
                Self::new(AiErrorCode::InvalidRequest, "API Key 不能为空")
            }
            CredentialError::Unavailable | CredentialError::Unsupported => {
                Self::credential_store_unavailable()
            }
        }
    }
}

#[tauri::command]
pub fn ai_get_configuration_status(state: State<'_, AiBackend>) -> AiConfigurationSnapshot {
    state.configuration_status()
}

#[tauri::command]
pub fn ai_save_api_key(
    request: SaveApiKeyRequest,
    state: State<'_, AiBackend>,
) -> Result<(), AiCommandError> {
    state.save_api_key(request)
}

#[tauri::command]
pub fn ai_delete_api_key(
    request: ProviderRequest,
    state: State<'_, AiBackend>,
) -> Result<(), AiCommandError> {
    state.delete_api_key(request.provider)
}

#[tauri::command]
pub async fn ai_test_connection(
    request: RequestIdRequest,
    state: State<'_, AiBackend>,
) -> Result<(), AiCommandError> {
    if request.request_id.trim().is_empty() {
        return Err(AiCommandError::new(
            AiErrorCode::InvalidRequest,
            "无效的请求标识",
        ));
    }
    let secret = state.get_api_key(&AiProvider::DeepSeek)?;
    state
        .client
        .test_connection(&request.request_id, secret, &state.cancellation)
        .await
}

#[tauri::command]
pub async fn ai_chat_completion(
    request: AiChatRequest,
    state: State<'_, AiBackend>,
) -> Result<AiChatResponse, AiCommandError> {
    if request.request_id.trim().is_empty() || request.messages.is_empty() {
        return Err(AiCommandError::new(
            AiErrorCode::InvalidRequest,
            "无效的聊天请求",
        ));
    }
    let secret = state.get_api_key(&AiProvider::DeepSeek)?;
    let text = state
        .client
        .complete(
            &request.request_id,
            request.messages,
            secret,
            state.client.max_tokens(),
            &state.cancellation,
        )
        .await?;
    Ok(AiChatResponse { text })
}

#[tauri::command]
pub fn ai_cancel_request(
    request: RequestIdRequest,
    state: State<'_, AiBackend>,
) -> CancelRequestResponse {
    CancelRequestResponse {
        cancelled: state.cancellation.cancel(&request.request_id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use secrecy::{ExposeSecret, SecretString};

    struct MemoryStore {
        value: Mutex<Option<SecretString>>,
    }

    impl MemoryStore {
        fn new() -> Self {
            Self {
                value: Mutex::new(None),
            }
        }
    }

    impl SecureCredentialStore for MemoryStore {
        fn save_api_key(
            &self,
            _provider: &str,
            secret: &SecretString,
        ) -> Result<(), CredentialError> {
            *self.value.lock().unwrap() = Some(SecretString::from(secret.expose_secret()));
            Ok(())
        }

        fn has_api_key(&self, _provider: &str) -> Result<bool, CredentialError> {
            Ok(self.value.lock().unwrap().is_some())
        }

        fn delete_api_key(&self, _provider: &str) -> Result<(), CredentialError> {
            *self.value.lock().unwrap() = None;
            Ok(())
        }

        fn get_api_key_for_backend_use(
            &self,
            _provider: &str,
        ) -> Result<SecretString, CredentialError> {
            self.value
                .lock()
                .unwrap()
                .as_ref()
                .map(|secret| SecretString::from(secret.expose_secret()))
                .ok_or(CredentialError::NotConfigured)
        }
    }

    #[test]
    fn configuration_status_does_not_expose_a_secret() {
        let backend = AiBackend::with_store(Box::new(MemoryStore::new()));
        let status = backend.configuration_status();
        assert!(!status.configured);
        assert!(status.storage_available);
        assert!(matches!(status.state, AiConfigurationState::NotConfigured));
    }
}
