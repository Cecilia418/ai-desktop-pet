use futures_util::future::{AbortHandle, Abortable};
use reqwest::StatusCode;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use super::cancellation::RequestCancellationRegistry;
use super::config::{DeepSeekProviderConfig, DEEPSEEK_TEST_MAX_TOKENS, DEFAULT_DEEPSEEK_CONFIG};
use super::error::{AiCommandError, AiErrorCode};
use super::{AiChatMessage, AiMessageRole};

#[derive(Clone)]
pub struct DeepSeekClient {
    http: reqwest::Client,
    config: DeepSeekProviderConfig,
}

impl Default for DeepSeekClient {
    fn default() -> Self {
        Self::new()
    }
}

impl DeepSeekClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
            config: DEFAULT_DEEPSEEK_CONFIG,
        }
    }

    pub fn max_tokens(&self) -> u32 {
        self.config.max_tokens
    }

    pub async fn complete(
        &self,
        request_id: &str,
        messages: Vec<AiChatMessage>,
        secret: SecretString,
        max_tokens: u32,
        cancellation: &RequestCancellationRegistry,
    ) -> Result<String, AiCommandError> {
        let (handle, registration) = AbortHandle::new_pair();
        cancellation.register(request_id.to_string(), handle);

        let result = Abortable::new(
            self.perform_request(messages, secret, max_tokens),
            registration,
        )
        .await;
        cancellation.remove(request_id);

        match result {
            Ok(result) => result,
            Err(_) => Err(AiCommandError::cancelled()),
        }
    }

    pub async fn test_connection(
        &self,
        request_id: &str,
        secret: SecretString,
        cancellation: &RequestCancellationRegistry,
    ) -> Result<(), AiCommandError> {
        let messages = vec![
            AiChatMessage {
                role: AiMessageRole::System,
                content: "只用一个简短词语回复，不要解释。".to_string(),
            },
            AiChatMessage {
                role: AiMessageRole::User,
                content: "请回复：好".to_string(),
            },
        ];
        self.complete(
            request_id,
            messages,
            secret,
            DEEPSEEK_TEST_MAX_TOKENS,
            cancellation,
        )
        .await
        .map(|_| ())
    }

    async fn perform_request(
        &self,
        messages: Vec<AiChatMessage>,
        secret: SecretString,
        max_tokens: u32,
    ) -> Result<String, AiCommandError> {
        let url = format!("{}{}", self.config.base_url, self.config.chat_path);
        let body = DeepSeekRequest {
            model: self.config.model,
            messages: &messages,
            thinking: ThinkingConfig {
                r#type: self.config.thinking_type,
            },
            stream: self.config.stream,
            max_tokens,
        };

        let response = self
            .http
            .post(url)
            .bearer_auth(secret.expose_secret())
            .json(&body)
            .timeout(self.config.timeout)
            .send()
            .await
            .map_err(map_request_error)?;
        let status = response.status();
        if !status.is_success() {
            return Err(map_http_status(status));
        }

        let response_body = response
            .text()
            .await
            .map_err(|_| AiCommandError::invalid_response())?;
        parse_response_text(&response_body)
    }
}

#[derive(Debug, Serialize)]
struct DeepSeekRequest<'a> {
    model: &'static str,
    messages: &'a [AiChatMessage],
    thinking: ThinkingConfig,
    stream: bool,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
struct ThinkingConfig {
    #[serde(rename = "type")]
    r#type: &'static str,
}

#[derive(Debug, Deserialize)]
struct DeepSeekResponse {
    #[serde(default)]
    choices: Vec<DeepSeekChoice>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekChoice {
    message: Option<DeepSeekMessage>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekMessage {
    content: Option<String>,
}

fn parse_response_text(body: &str) -> Result<String, AiCommandError> {
    let response: DeepSeekResponse =
        serde_json::from_str(body).map_err(|_| AiCommandError::invalid_response())?;
    let choice = response
        .choices
        .first()
        .ok_or_else(AiCommandError::invalid_response)?;
    let message = choice
        .message
        .as_ref()
        .ok_or_else(AiCommandError::invalid_response)?;
    let text = message.content.as_deref().unwrap_or_default().trim();
    if text.is_empty() {
        return Err(AiCommandError::new(
            AiErrorCode::EmptyResponse,
            "没有收到有效回复，请再试一次",
        ));
    }
    Ok(text.to_string())
}

fn map_request_error(error: reqwest::Error) -> AiCommandError {
    if error.is_timeout() {
        return AiCommandError::new(AiErrorCode::Timeout, "回复等太久了，再试一次吧");
    }
    if error.is_connect() || error.is_request() {
        return AiCommandError::new(AiErrorCode::Network, "现在网络连不上");
    }
    AiCommandError::new(AiErrorCode::ProviderError, "AI 服务暂时不可用")
}

fn map_http_status(status: StatusCode) -> AiCommandError {
    match status {
        StatusCode::UNAUTHORIZED => {
            AiCommandError::new(AiErrorCode::Authentication, "API Key 好像不对")
        }
        StatusCode::TOO_MANY_REQUESTS => {
            AiCommandError::new(AiErrorCode::RateLimit, "请求太频繁了，稍后再试")
        }
        StatusCode::PAYMENT_REQUIRED => AiCommandError::new(
            AiErrorCode::InsufficientBalance,
            "DeepSeek API 余额不足，请充值后再试",
        ),
        StatusCode::BAD_REQUEST
        | StatusCode::UNPROCESSABLE_ENTITY
        | StatusCode::INTERNAL_SERVER_ERROR
        | StatusCode::SERVICE_UNAVAILABLE => {
            AiCommandError::new(AiErrorCode::ProviderError, "AI 服务暂时不可用")
        }
        _ => AiCommandError::new(AiErrorCode::ProviderError, "AI 服务暂时不可用"),
    }
}

#[cfg(test)]
mod tests {
    use super::{map_http_status, parse_response_text, DeepSeekRequest, ThinkingConfig};
    use crate::ai::{AiChatMessage, AiMessageRole};
    use reqwest::StatusCode;
    use serde_json::json;

    #[test]
    fn request_contract_contains_the_approved_explicit_fields() {
        let messages = vec![AiChatMessage {
            role: AiMessageRole::User,
            content: "你好".to_string(),
        }];
        let request = DeepSeekRequest {
            model: "deepseek-v4-flash",
            messages: &messages,
            thinking: ThinkingConfig { r#type: "disabled" },
            stream: false,
            max_tokens: 512,
        };
        let value = serde_json::to_value(request).unwrap();
        assert_eq!(value["model"], json!("deepseek-v4-flash"));
        assert_eq!(value["thinking"]["type"], json!("disabled"));
        assert_eq!(value["stream"], json!(false));
        assert_eq!(value["messages"][0]["content"], json!("你好"));
    }

    #[test]
    fn response_parser_accepts_text_and_rejects_empty_or_invalid_shapes() {
        assert_eq!(
            parse_response_text(r#"{"choices":[{"message":{"content":" 好呀！ "}}]}"#).unwrap(),
            "好呀！"
        );
        assert!(parse_response_text(r#"{"choices":[]}"#).is_err());
        assert!(parse_response_text(r#"{"choices":[{"message":{"content":"  "}}]}"#).is_err());
        assert!(parse_response_text("not-json").is_err());
    }

    #[test]
    fn official_http_errors_map_to_typed_categories() {
        assert!(matches!(
            map_http_status(StatusCode::PAYMENT_REQUIRED).code,
            crate::ai::error::AiErrorCode::InsufficientBalance
        ));
        assert!(matches!(
            map_http_status(StatusCode::UNAUTHORIZED).code,
            crate::ai::error::AiErrorCode::Authentication
        ));
        assert!(matches!(
            map_http_status(StatusCode::SERVICE_UNAVAILABLE).code,
            crate::ai::error::AiErrorCode::ProviderError
        ));
    }
}
