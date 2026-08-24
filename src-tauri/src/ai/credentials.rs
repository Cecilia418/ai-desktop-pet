use secrecy::{ExposeSecret, SecretString};

use super::config::DEEPSEEK_PROVIDER;

const CREDENTIAL_SERVICE: &str = "com.momdaughter.desktop.ai";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CredentialError {
    NotConfigured,
    Unavailable,
    Unsupported,
    InvalidSecret,
}

pub trait SecureCredentialStore: Send + Sync {
    fn save_api_key(&self, provider: &str, secret: &SecretString) -> Result<(), CredentialError>;
    fn has_api_key(&self, provider: &str) -> Result<bool, CredentialError>;
    fn delete_api_key(&self, provider: &str) -> Result<(), CredentialError>;
    fn get_api_key_for_backend_use(&self, provider: &str) -> Result<SecretString, CredentialError>;
}

pub struct WindowsCredentialStore;

impl WindowsCredentialStore {
    pub fn new() -> Self {
        Self
    }

    #[cfg(windows)]
    fn entry(provider: &str) -> Result<keyring::Entry, CredentialError> {
        if provider != DEEPSEEK_PROVIDER {
            return Err(CredentialError::Unsupported);
        }
        keyring::Entry::new(CREDENTIAL_SERVICE, provider).map_err(Self::map_error)
    }

    #[cfg(windows)]
    fn map_error(error: keyring::Error) -> CredentialError {
        match error {
            keyring::Error::NoEntry => CredentialError::NotConfigured,
            keyring::Error::NoDefaultStore
            | keyring::Error::NoStorageAccess(_)
            | keyring::Error::PlatformFailure(_)
            | keyring::Error::NotSupportedByStore(_) => CredentialError::Unavailable,
            _ => CredentialError::Unavailable,
        }
    }
}

impl Default for WindowsCredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
impl SecureCredentialStore for WindowsCredentialStore {
    fn save_api_key(&self, provider: &str, secret: &SecretString) -> Result<(), CredentialError> {
        if secret.expose_secret().is_empty() {
            return Err(CredentialError::InvalidSecret);
        }
        Self::entry(provider)?
            .set_password(secret.expose_secret())
            .map_err(Self::map_error)
    }

    fn has_api_key(&self, provider: &str) -> Result<bool, CredentialError> {
        match Self::entry(provider)?.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(Self::map_error(error)),
        }
    }

    fn delete_api_key(&self, provider: &str) -> Result<(), CredentialError> {
        match Self::entry(provider)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(Self::map_error(error)),
        }
    }

    fn get_api_key_for_backend_use(&self, provider: &str) -> Result<SecretString, CredentialError> {
        Self::entry(provider)?
            .get_password()
            .map(SecretString::from)
            .map_err(Self::map_error)
    }
}

#[cfg(not(windows))]
impl SecureCredentialStore for WindowsCredentialStore {
    fn save_api_key(&self, _provider: &str, _secret: &SecretString) -> Result<(), CredentialError> {
        Err(CredentialError::Unsupported)
    }

    fn has_api_key(&self, _provider: &str) -> Result<bool, CredentialError> {
        Err(CredentialError::Unsupported)
    }

    fn delete_api_key(&self, _provider: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unsupported)
    }

    fn get_api_key_for_backend_use(
        &self,
        _provider: &str,
    ) -> Result<SecretString, CredentialError> {
        Err(CredentialError::Unsupported)
    }
}

pub fn default_store() -> Box<dyn SecureCredentialStore> {
    Box::new(WindowsCredentialStore::new())
}

#[cfg(test)]
mod tests {
    use super::{CredentialError, SecureCredentialStore};
    use secrecy::{ExposeSecret, SecretString};
    use std::sync::Mutex;

    struct MemoryCredentialStore {
        value: Mutex<Option<SecretString>>,
    }

    impl MemoryCredentialStore {
        fn new() -> Self {
            Self {
                value: Mutex::new(None),
            }
        }
    }

    impl SecureCredentialStore for MemoryCredentialStore {
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
    fn mock_store_has_save_read_delete_contract_without_serializing_secret() {
        let store = MemoryCredentialStore::new();
        assert!(!store.has_api_key("deepseek").unwrap());

        let secret = SecretString::from("test-only-secret");
        store.save_api_key("deepseek", &secret).unwrap();
        assert!(store.has_api_key("deepseek").unwrap());
        let loaded = store.get_api_key_for_backend_use("deepseek").unwrap();
        assert_eq!(loaded.expose_secret(), "test-only-secret");

        store.delete_api_key("deepseek").unwrap();
        assert!(matches!(
            store.get_api_key_for_backend_use("deepseek"),
            Err(CredentialError::NotConfigured)
        ));
    }
}
