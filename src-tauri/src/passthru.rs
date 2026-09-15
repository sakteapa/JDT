//! SAE J2534-1 & J2534-2 Dynamic DLL Loader & Dispatcher
//! Manages native function pointers to vendor-provided PassThru DLLs
//! (e.g. Zenith Z5, Tactrix OpenPort, Scanmatik, DrewTech Mongoose, etc.)

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use libloading::{Library, Symbol};
#[cfg(target_os = "windows")]
use std::ffi::{c_void, CString};

// ============================================================================
// SAE J2534-1 C-ABI STRUCTS & CONSTANTS
// ============================================================================

/// J2534-1 PASSTHRU_MSG representation matching the 32-bit/64-bit C ABI layout
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RawPassThruMsg {
    pub protocol_id: u32,
    pub rx_status: u32,
    pub tx_flags: u32,
    pub timestamp: u32,
    pub data_size: u32,
    pub extra_data_index: u32,
    pub data: [u8; 4128],
}

impl Default for RawPassThruMsg {
    fn default() -> Self {
        Self {
            protocol_id: 0,
            rx_status: 0,
            tx_flags: 0,
            timestamp: 0,
            data_size: 0,
            extra_data_index: 0,
            data: [0u8; 4128],
        }
    }
}

/// JSON-serializable message exchanged with React Frontend over Tauri IPC
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassThruMsg {
    pub protocol_id: u32,
    pub rx_status: u32,
    pub tx_flags: u32,
    pub timestamp: u32,
    pub data: Vec<u8>,
    pub extra_data_index: Option<u32>,
}

impl From<&PassThruMsg> for RawPassThruMsg {
    fn from(msg: &PassThruMsg) -> Self {
        let mut raw = RawPassThruMsg::default();
        raw.protocol_id = msg.protocol_id;
        raw.rx_status = msg.rx_status;
        raw.tx_flags = msg.tx_flags;
        raw.timestamp = msg.timestamp;
        let size = msg.data.len().min(4128);
        raw.data_size = size as u32;
        raw.extra_data_index = msg.extra_data_index.unwrap_or(0);
        raw.data[..size].copy_from_slice(&msg.data[..size]);
        raw
    }
}

impl From<&RawPassThruMsg> for PassThruMsg {
    fn from(raw: &RawPassThruMsg) -> Self {
        let size = (raw.data_size as usize).min(4128);
        PassThruMsg {
            protocol_id: raw.protocol_id,
            rx_status: raw.rx_status,
            tx_flags: raw.tx_flags,
            timestamp: raw.timestamp,
            data: raw.data[..size].to_vec(),
            extra_data_index: if raw.extra_data_index > 0 {
                Some(raw.extra_data_index)
            } else {
                None
            },
        }
    }
}

// ============================================================================
// C FUNCTION POINTER TYPEDEFS (SAE J2534-1 & J2534-2 STANDARD EXPORTS)
// ============================================================================

#[cfg(target_os = "windows")]
type PassThruOpenFn = unsafe extern "system" fn(*const c_void, *mut u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruCloseFn = unsafe extern "system" fn(u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruConnectFn = unsafe extern "system" fn(u32, u32, u32, u32, *mut u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruDisconnectFn = unsafe extern "system" fn(u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruReadMsgsFn = unsafe extern "system" fn(u32, *mut RawPassThruMsg, *mut u32, u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruWriteMsgsFn = unsafe extern "system" fn(u32, *const RawPassThruMsg, *mut u32, u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruStartPeriodicMsgFn = unsafe extern "system" fn(u32, *const RawPassThruMsg, *mut u32, u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruStopPeriodicMsgFn = unsafe extern "system" fn(u32, u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruStartMsgFilterFn = unsafe extern "system" fn(
    u32,
    u32,
    *const RawPassThruMsg,
    *const RawPassThruMsg,
    *const RawPassThruMsg,
    *mut u32,
) -> i32;
#[cfg(target_os = "windows")]
type PassThruStopMsgFilterFn = unsafe extern "system" fn(u32, u32) -> i32;
#[cfg(target_os = "windows")]
type PassThruIoctlFn = unsafe extern "system" fn(u32, u32, *const c_void, *mut c_void) -> i32;
#[cfg(target_os = "windows")]
type PassThruGetLastErrorFn = unsafe extern "system" fn(*mut u8) -> i32;
#[cfg(target_os = "windows")]
type PassThruReadVersionFn = unsafe extern "system" fn(u32, *mut u8, *mut u8, *mut u8) -> i32;

// ============================================================================
// SESSION STATE & GLOBAL DRIVER BINDINGS
// ============================================================================

pub struct J2534SessionState {
    pub active_device_name: Option<String>,
    pub active_dll_path: Option<String>,
    pub active_device_id: Option<u32>,
    pub active_channel_id: Option<u32>,
    pub active_filter_id: Option<u32>,
    #[cfg(target_os = "windows")]
    pub loaded_library: Option<Library>,
}

impl Default for J2534SessionState {
    fn default() -> Self {
        Self {
            active_device_name: None,
            active_dll_path: None,
            active_device_id: None,
            active_channel_id: None,
            active_filter_id: None,
            #[cfg(target_os = "windows")]
            loaded_library: None,
        }
    }
}

lazy_static::lazy_static! {
    pub static ref GLOBAL_SESSION: Mutex<J2534SessionState> = Mutex::new(J2534SessionState::default());
}

// ============================================================================
// NATIVE J2534 API IMPLEMENTATION
// ============================================================================

/// J2534 PassThruOpen implementation
pub fn pass_thru_open(device_name: &str, dll_path: &str) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        // Unload any previously loaded DLL
        if let Some(old_dev_id) = session.active_device_id.take() {
            if let Some(ref lib) = session.loaded_library {
                unsafe {
                    if let Ok(close_fn) = lib.get::<PassThruCloseFn>(b"PassThruClose\0") {
                        let _ = close_fn(old_dev_id);
                    }
                }
            }
        }
        session.loaded_library = None;

        // Dynamically load the vendor DLL (with passthru32.dll fallback paths)
        let lib = unsafe {
            crate::registry::load_j2534_library(dll_path).map_err(|e| {
                format!(
                    "Failed to load J2534 DLL '{}': {}. Ensure correct 32-bit/64-bit architecture matches driver.",
                    dll_path, e
                )
            })?
        };

        let mut device_id: u32 = 0;
        let ret = unsafe {
            let open_fn = lib.get::<PassThruOpenFn>(b"PassThruOpen\0").map_err(|e| {
                format!("Driver DLL '{}' does not export 'PassThruOpen': {}", dll_path, e)
            })?;

            // Try opening with device name string first
            let res = if let Ok(c_name) = CString::new(device_name) {
                let r = open_fn(c_name.as_ptr() as *const c_void, &mut device_id);
                if r == 0 {
                    r
                } else {
                    // Fallback to NULL pointer per SAE J2534 spec
                    open_fn(std::ptr::null(), &mut device_id)
                }
            } else {
                open_fn(std::ptr::null(), &mut device_id)
            };

            res
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruOpen", ret));
        }

        session.active_device_name = Some(device_name.to_string());
        session.active_dll_path = Some(dll_path.to_string());
        session.active_device_id = Some(device_id);
        session.loaded_library = Some(lib);

        Ok(device_id)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!("[J2534 STUB (Non-Windows)] PassThruOpen: {} via {}", device_name, dll_path);
        session.active_device_name = Some(device_name.to_string());
        session.active_dll_path = Some(dll_path.to_string());
        session.active_device_id = Some(1);
        Ok(1)
    }
}

/// J2534 PassThruClose implementation
pub fn pass_thru_close(device_id: u32) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(ref lib) = session.loaded_library {
            unsafe {
                if let Ok(close_fn) = lib.get::<PassThruCloseFn>(b"PassThruClose\0") {
                    let ret = close_fn(device_id);
                    if ret != 0 {
                        return Err(format_j2534_error("PassThruClose", ret));
                    }
                }
            }
        }
        session.loaded_library = None;
    }

    session.active_device_id = None;
    session.active_channel_id = None;
    session.active_filter_id = None;
    Ok(0)
}

/// J2534 PassThruConnect implementation
pub fn pass_thru_connect(
    device_id: u32,
    protocol_id: u32,
    flags: u32,
    baud_rate: u32,
) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded. Call PassThruOpen first.".to_string())?;

        let mut channel_id: u32 = 0;
        let ret = unsafe {
            let conn_fn = lib.get::<PassThruConnectFn>(b"PassThruConnect\0").map_err(|e| {
                format!("PassThruConnect export not found: {}", e)
            })?;
            conn_fn(device_id, protocol_id, flags, baud_rate, &mut channel_id)
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruConnect", ret));
        }

        session.active_channel_id = Some(channel_id);
        Ok(channel_id)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!(
            "[J2534 STUB] PassThruConnect: DevID={}, Protocol=0x{:X}, Baud={}",
            device_id, protocol_id, baud_rate
        );
        session.active_channel_id = Some(1);
        Ok(1)
    }
}

/// J2534 PassThruDisconnect implementation
pub fn pass_thru_disconnect(channel_id: u32) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(ref lib) = session.loaded_library {
            unsafe {
                if let Ok(disconn_fn) = lib.get::<PassThruDisconnectFn>(b"PassThruDisconnect\0") {
                    let ret = disconn_fn(channel_id);
                    if ret != 0 {
                        return Err(format_j2534_error("PassThruDisconnect", ret));
                    }
                }
            }
        }
    }

    session.active_channel_id = None;
    session.active_filter_id = None;
    Ok(0)
}

/// J2534 PassThruWriteMsgs implementation
pub fn pass_thru_write_msgs(
    channel_id: u32,
    msgs: &[PassThruMsg],
    timeout_ms: u32,
) -> Result<u32, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let raw_msgs: Vec<RawPassThruMsg> = msgs.iter().map(RawPassThruMsg::from).collect();
        let mut num_msgs = raw_msgs.len() as u32;

        let ret = unsafe {
            let write_fn = lib.get::<PassThruWriteMsgsFn>(b"PassThruWriteMsgs\0").map_err(|e| {
                format!("PassThruWriteMsgs export not found: {}", e)
            })?;
            write_fn(channel_id, raw_msgs.as_ptr(), &mut num_msgs, timeout_ms)
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruWriteMsgs", ret));
        }

        Ok(num_msgs)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!(
            "[J2534 STUB] PassThruWriteMsgs: Channel={}, Count={}, Timeout={}ms",
            channel_id,
            msgs.len(),
            timeout_ms
        );
        Ok(msgs.len() as u32)
    }
}

/// J2534 PassThruReadMsgs implementation
pub fn pass_thru_read_msgs(
    channel_id: u32,
    max_msgs: u32,
    timeout_ms: u32,
) -> Result<Vec<PassThruMsg>, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let safe_max = (max_msgs as usize).min(100);
        let mut buffer: Vec<RawPassThruMsg> = vec![RawPassThruMsg::default(); safe_max];
        let mut num_msgs = safe_max as u32;

        let ret = unsafe {
            let read_fn = lib.get::<PassThruReadMsgsFn>(b"PassThruReadMsgs\0").map_err(|e| {
                format!("PassThruReadMsgs export not found: {}", e)
            })?;
            read_fn(channel_id, buffer.as_mut_ptr(), &mut num_msgs, timeout_ms)
        };

        // If buffer is empty or timed out without messages
        if ret == 0x1E /* ERR_BUFFER_EMPTY */ || ret == 0x09 /* ERR_TIMEOUT */ {
            return Ok(vec![]);
        }

        if ret != 0 {
            return Err(format_j2534_error("PassThruReadMsgs", ret));
        }

        let count = (num_msgs as usize).min(safe_max);
        let results: Vec<PassThruMsg> = buffer[..count].iter().map(PassThruMsg::from).collect();
        Ok(results)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!(
            "[J2534 STUB] PassThruReadMsgs: Channel={}, Max={}, Timeout={}ms",
            channel_id, max_msgs, timeout_ms
        );
        Ok(vec![])
    }
}

/// J2534 PassThruStartMsgFilter implementation
pub fn pass_thru_start_msg_filter(
    channel_id: u32,
    filter_type: u32,
    mask_msg: &PassThruMsg,
    pattern_msg: &PassThruMsg,
    flow_control_msg: Option<&PassThruMsg>,
) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let raw_mask = RawPassThruMsg::from(mask_msg);
        let raw_pattern = RawPassThruMsg::from(pattern_msg);
        let raw_fc = flow_control_msg.map(RawPassThruMsg::from);

        let mut filter_id: u32 = 0;
        let ret = unsafe {
            let filter_fn = lib.get::<PassThruStartMsgFilterFn>(b"PassThruStartMsgFilter\0").map_err(|e| {
                format!("PassThruStartMsgFilter export not found: {}", e)
            })?;

            let fc_ptr = match raw_fc {
                Some(ref fc) => fc as *const RawPassThruMsg,
                None => std::ptr::null(),
            };

            filter_fn(
                channel_id,
                filter_type,
                &raw_mask,
                &raw_pattern,
                fc_ptr,
                &mut filter_id,
            )
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruStartMsgFilter", ret));
        }

        session.active_filter_id = Some(filter_id);
        Ok(filter_id)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!(
            "[J2534 STUB] PassThruStartMsgFilter: Channel={}, FilterType={}",
            channel_id, filter_type
        );
        session.active_filter_id = Some(1);
        Ok(1)
    }
}

/// J2534 PassThruStopMsgFilter implementation
pub fn pass_thru_stop_msg_filter(channel_id: u32, filter_id: u32) -> Result<u32, String> {
    let mut session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(ref lib) = session.loaded_library {
            unsafe {
                if let Ok(stop_fn) = lib.get::<PassThruStopMsgFilterFn>(b"PassThruStopMsgFilter\0") {
                    let ret = stop_fn(channel_id, filter_id);
                    if ret != 0 {
                        return Err(format_j2534_error("PassThruStopMsgFilter", ret));
                    }
                }
            }
        }
    }

    session.active_filter_id = None;
    Ok(0)
}

/// J2534 PassThruStartPeriodicMsg implementation
pub fn pass_thru_start_periodic_msg(
    channel_id: u32,
    msg: &PassThruMsg,
    interval_ms: u32,
) -> Result<u32, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let raw_msg = RawPassThruMsg::from(msg);
        let mut msg_id: u32 = 0;

        let ret = unsafe {
            let start_fn = lib.get::<PassThruStartPeriodicMsgFn>(b"PassThruStartPeriodicMsg\0").map_err(|e| {
                format!("PassThruStartPeriodicMsg export not found: {}", e)
            })?;
            start_fn(channel_id, &raw_msg, &mut msg_id, interval_ms)
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruStartPeriodicMsg", ret));
        }

        Ok(msg_id)
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!(
            "[J2534 STUB] PassThruStartPeriodicMsg: Channel={}, Interval={}ms",
            channel_id, interval_ms
        );
        Ok(1)
    }
}

/// J2534 PassThruStopPeriodicMsg implementation
pub fn pass_thru_stop_periodic_msg(channel_id: u32, msg_id: u32) -> Result<u32, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(ref lib) = session.loaded_library {
            unsafe {
                if let Ok(stop_fn) = lib.get::<PassThruStopPeriodicMsgFn>(b"PassThruStopPeriodicMsg\0") {
                    let ret = stop_fn(channel_id, msg_id);
                    if ret != 0 {
                        return Err(format_j2534_error("PassThruStopPeriodicMsg", ret));
                    }
                }
            }
        }
    }

    Ok(0)
}

/// J2534 PassThruIoctl general handler
pub fn pass_thru_ioctl(channel_id: u32, ioctl_id: u32) -> Result<u32, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let mut output_val: u32 = 0;
        let ret = unsafe {
            let ioctl_fn = lib.get::<PassThruIoctlFn>(b"PassThruIoctl\0").map_err(|e| {
                format!("PassThruIoctl export not found: {}", e)
            })?;
            ioctl_fn(
                channel_id,
                ioctl_id,
                std::ptr::null(),
                &mut output_val as *mut u32 as *mut c_void,
            )
        };

        if ret != 0 {
            return Err(format_j2534_error(&format!("PassThruIoctl(0x{:X})", ioctl_id), ret));
        }

        Ok(output_val)
    }

    #[cfg(not(target_os = "windows"))]
    {
        if ioctl_id == 0x07 {
            Ok(12600)
        } else {
            Ok(0)
        }
    }
}

/// J2534 PassThruIoctl: READ_VBAT (IoctlID = 0x07)
pub fn pass_thru_read_vbat(channel_id: u32) -> Result<f64, String> {
    let session = GLOBAL_SESSION.lock().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let lib = session
            .loaded_library
            .as_ref()
            .ok_or_else(|| "No active J2534 library loaded".to_string())?;

        let mut vbat_millivolts: u32 = 0;
        let ret = unsafe {
            let ioctl_fn = lib.get::<PassThruIoctlFn>(b"PassThruIoctl\0").map_err(|e| {
                format!("PassThruIoctl export not found: {}", e)
            })?;
            // IOCTL 0x07 = READ_VBAT. Output parameter receives millivolts (e.g. 12600 for 12.6V)
            ioctl_fn(
                channel_id,
                0x07,
                std::ptr::null(),
                &mut vbat_millivolts as *mut u32 as *mut c_void,
            )
        };

        if ret != 0 {
            return Err(format_j2534_error("PassThruIoctl(READ_VBAT)", ret));
        }

        Ok((vbat_millivolts as f64) / 1000.0)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(12.6)
    }
}

/// Formats SAE J2534 standard error codes into human-readable strings
pub fn format_j2534_error(function_name: &str, error_code: i32) -> String {
    let description = match error_code {
        0x00 => "STATUS_SUCCESS (0x00)",
        0x01 => "ERR_NOT_SUPPORTED (0x01): Function not supported by this driver",
        0x02 => "ERR_INVALID_CHANNEL_ID (0x02): Channel ID is invalid or closed",
        0x03 => "ERR_INVALID_PROTOCOL_ID (0x03): Protocol ID not supported",
        0x04 => "ERR_NULL_PARAMETER (0x04): NULL parameter provided",
        0x05 => "ERR_INVALID_IOCTL_VALUE (0x05): Invalid IOCTL value",
        0x06 => "ERR_INVALID_FLAGS (0x06): Invalid flags specified",
        0x07 => "ERR_FAILED (0x07): Undefined fatal driver error",
        0x08 => "ERR_DEVICE_NOT_CONNECTED (0x08): J2534 hardware interface unplugged or offline",
        0x09 => "ERR_TIMEOUT (0x09): No response from ECU within specified timeout period",
        0x0A => "ERR_INVALID_MSG (0x0A): Message structure contains invalid data or length",
        0x0B => "ERR_INVALID_TIME_INTERVAL (0x0B): Invalid time interval",
        0x0C => "ERR_EXCEEDED_LIMIT (0x0C): Maximum number of channels or filters exceeded",
        0x0D => "ERR_INVALID_MSG_ID (0x0D): Invalid periodic message ID",
        0x0E => "ERR_DEVICE_IN_USE (0x0E): Device already opened by another diagnostic software",
        0x0F => "ERR_INVALID_IOCTL_ID (0x0F): Invalid IOCTL ID",
        0x10 => "ERR_BUFFER_EMPTY (0x10): No messages available in receive buffer",
        0x11 => "ERR_BUFFER_FULL (0x11): Transmit or receive buffer full",
        0x12 => "ERR_BUFFER_OVERFLOW (0x12): Buffer overflow occurred, messages dropped",
        0x13 => "ERR_PIN_INVALID (0x13): Invalid programming pin",
        0x14 => "ERR_CHANNEL_IN_USE (0x14): Channel already in use",
        0x15 => "ERR_MSG_PROTOCOL_ID (0x15): Message protocol mismatch",
        0x16 => "ERR_INVALID_FILTER_ID (0x16): Invalid message filter ID",
        0x17 => "ERR_NO_FLOW_CONTROL (0x17): ISO 15765 flow control frame not received",
        0x18 => "ERR_NOT_UNIQUE (0x18): Filter parameters conflict with existing filter",
        0x19 => "ERR_INVALID_BAUDRATE (0x19): Baud rate not supported by hardware interface",
        0x1A => "ERR_INVALID_DEVICE_ID (0x1A): Device ID is invalid or closed",
        other => return format!("{} failed with unknown J2534 error code 0x{:02X}", function_name, other),
    };

    format!("{} failed: {}", function_name, description)
}
