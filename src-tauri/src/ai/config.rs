use std::time::Duration;

pub const DEEPSEEK_PROVIDER: &str = "deepseek";
pub const DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com";
pub const DEEPSEEK_CHAT_PATH: &str = "/chat/completions";
pub const DEEPSEEK_MODEL: &str = "deepseek-v4-flash";
pub const DEEPSEEK_THINKING_TYPE: &str = "disabled";
pub const DEEPSEEK_STREAM: bool = false;
pub const DEEPSEEK_TIMEOUT: Duration = Duration::from_secs(45);
pub const DEEPSEEK_MAX_TOKENS: u32 = 512;
pub const DEEPSEEK_TEST_MAX_TOKENS: u32 = 8;

#[derive(Clone, Copy, Debug)]
pub struct DeepSeekProviderConfig {
    pub base_url: &'static str,
    pub chat_path: &'static str,
    pub model: &'static str,
    pub thinking_type: &'static str,
    pub stream: bool,
    pub timeout: Duration,
    pub max_tokens: u32,
}

pub const DEFAULT_DEEPSEEK_CONFIG: DeepSeekProviderConfig = DeepSeekProviderConfig {
    base_url: DEEPSEEK_BASE_URL,
    chat_path: DEEPSEEK_CHAT_PATH,
    model: DEEPSEEK_MODEL,
    thinking_type: DEEPSEEK_THINKING_TYPE,
    stream: DEEPSEEK_STREAM,
    timeout: DEEPSEEK_TIMEOUT,
    max_tokens: DEEPSEEK_MAX_TOKENS,
};
