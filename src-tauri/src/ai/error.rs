use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AiErrorCode {
    NotConfigured,
    CredentialStoreUnavailable,
    InvalidRequest,
    Authentication,
    Network,
    Timeout,
    RateLimit,
    InsufficientBalance,
    ProviderError,
    InvalidResponse,
    EmptyResponse,
    Cancelled,
}

#[derive(Clone, Debug, Serialize)]
pub struct AiCommandError {
    pub code: AiErrorCode,
    pub message: String,
}

impl AiCommandError {
    pub fn new(code: AiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn cancelled() -> Self {
        Self::new(AiErrorCode::Cancelled, "请求已取消")
    }

    pub fn invalid_response() -> Self {
        Self::new(AiErrorCode::InvalidResponse, "AI 回复格式异常，请再试一次")
    }
}
