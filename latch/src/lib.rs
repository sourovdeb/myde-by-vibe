//! Latch: a small MCP server that sits on this PC.
//! Cloud chats do not share transcripts. They can only call the tools
//! this process advertises, and only when that caller's switch is on.

pub mod bridge;
pub mod desktop;
pub mod http;
pub mod panel;
pub mod settings;

pub use bridge::{advertised_tools, dispatch, Bridge, FsRunner, MockRunner, Runner};
pub use settings::{diagnose_url, Caller, Cap, ChatCloud, Settings, Verdict};
