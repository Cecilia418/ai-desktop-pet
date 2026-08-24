use futures_util::future::AbortHandle;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
pub struct RequestCancellationRegistry {
    handles: Arc<Mutex<HashMap<String, AbortHandle>>>,
}

impl RequestCancellationRegistry {
    pub fn register(&self, request_id: String, handle: AbortHandle) {
        if let Ok(mut handles) = self.handles.lock() {
            if let Some(previous) = handles.insert(request_id, handle) {
                previous.abort();
            }
        }
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        let handle = self
            .handles
            .lock()
            .ok()
            .and_then(|mut handles| handles.remove(request_id));
        if let Some(handle) = handle {
            handle.abort();
            true
        } else {
            false
        }
    }

    pub fn remove(&self, request_id: &str) {
        if let Ok(mut handles) = self.handles.lock() {
            handles.remove(request_id);
        }
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.handles
            .lock()
            .map(|handles| handles.len())
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::RequestCancellationRegistry;
    use futures_util::future::{AbortHandle, Abortable};

    #[test]
    fn cancelling_a_registered_request_aborts_it_and_removes_the_handle() {
        let registry = RequestCancellationRegistry::default();
        let (handle, registration) = AbortHandle::new_pair();
        let handle_observer = handle.clone();
        registry.register("request-1".to_string(), handle);

        assert_eq!(registry.len(), 1);
        assert!(registry.cancel("request-1"));
        assert_eq!(registry.len(), 0);
        assert!(handle_observer.is_aborted());
        let _ = Abortable::new(async { 1 }, registration);
    }
}
