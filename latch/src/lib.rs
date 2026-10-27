//! Latch: a small MCP server that sits on this PC.
//! Cloud chats do not share transcripts with local CLIs.
//! They can only call the tools this process advertises.

pub mod bridge;
pub mod http;
pub mod settings;

pub use bridge::{advertised_tools, dispatch, Bridge, FsRunner, MockRunner, Runner};
pub use settings::{diagnose_url, ChatCloud, Settings, Verdict};
