// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod registry;
mod passthru;

use registry::{enumerate_j2534_registry, J2534RegistryDevice};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    pub device_id: u32,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    pub channel_id: u32,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadResult {
    pub msgs: Vec<passthru::PassThruMsg>,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterResult {
    pub filter_id: u32,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodicResult {
    pub msg_id: u32,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VbatResult {
    pub vbat_volts: f64,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IoctlResult {
    pub voltage_mv: u32,
    pub status: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeDeviceResult {
    pub device_name: String,
    pub dll_path: String,
    pub is_connected: bool,
    pub connection_status: String,
    pub display_name: String,
    pub probe_error: Option<String>,
}

/// Query Windows Registry for all registered SAE J2534-1 / J2534-2 drivers
#[tauri::command]
fn j2534_list_devices() -> Result<Vec<J2534RegistryDevice>, String> {
    let devices = enumerate_j2534_registry();
    Ok(devices)
}

/// Explicit registry scan trigger with log return
#[tauri::command]
fn j2534_scan_registry() -> Result<Vec<J2534RegistryDevice>, String> {
    let devices = enumerate_j2534_registry();
    Ok(devices)
}

/// On-demand hardware probe check for a single J2534 device via PassThruOpen/Close test
#[tauri::command]
fn j2534_probe_device(device_name: String, dll_path: String) -> Result<ProbeDeviceResult, String> {
    let (is_conn, conn_status, probe_err) = registry::probe_device_hardware(&dll_path, &device_name);
    let display_name = if is_conn {
        format!("{} (Connected & Ready)", device_name)
    } else {
        format!("{} (Not Connected / Offline)", device_name)
    };

    Ok(ProbeDeviceResult {
        device_name,
        dll_path,
        is_connected: is_conn,
        connection_status: conn_status,
        display_name,
        probe_error: probe_err,
    })
}

/// J2534 PassThruOpen
#[tauri::command]
fn j2534_open(device_name: String, dll_path: String) -> Result<OpenResult, String> {
    println!("[J2534] PassThruOpen called for {} (DLL: {})", device_name, dll_path);
    let device_id = passthru::pass_thru_open(&device_name, &dll_path)?;
    Ok(OpenResult {
        device_id,
        status: 0,
    })
}

/// J2534 PassThruClose
#[tauri::command]
fn j2534_close(device_id: u32) -> Result<u32, String> {
    println!("[J2534] PassThruClose called for DeviceID: {}", device_id);
    passthru::pass_thru_close(device_id)
}

/// J2534 PassThruConnect
#[tauri::command]
fn j2534_connect(
    device_id: u32,
    protocol_id: u32,
    flags: u32,
    baud_rate: u32,
) -> Result<ConnectResult, String> {
    println!(
        "[J2534] PassThruConnect: DevID: {}, Protocol: 0x{:X}, Flags: 0x{:X}, Baud: {}",
        device_id, protocol_id, flags, baud_rate
    );
    let channel_id = passthru::pass_thru_connect(device_id, protocol_id, flags, baud_rate)?;
    Ok(ConnectResult {
        channel_id,
        status: 0,
    })
}

/// J2534 PassThruDisconnect
#[tauri::command]
fn j2534_disconnect(channel_id: u32) -> Result<u32, String> {
    println!("[J2534] PassThruDisconnect for ChannelID: {}", channel_id);
    passthru::pass_thru_disconnect(channel_id)
}

/// J2534 PassThruWriteMsgs
#[tauri::command]
fn j2534_write_msgs(
    channel_id: u32,
    msgs: Vec<passthru::PassThruMsg>,
    timeout_ms: u32,
) -> Result<u32, String> {
    passthru::pass_thru_write_msgs(channel_id, &msgs, timeout_ms)
}

/// J2534 PassThruReadMsgs
#[tauri::command]
fn j2534_read_msgs(
    channel_id: u32,
    max_msgs: u32,
    timeout_ms: u32,
) -> Result<ReadResult, String> {
    let msgs = passthru::pass_thru_read_msgs(channel_id, max_msgs, timeout_ms)?;
    Ok(ReadResult { msgs, status: 0 })
}

/// J2534 PassThruStartMsgFilter
#[tauri::command]
fn j2534_start_msg_filter(
    channel_id: u32,
    filter_type: u32,
    mask_msg: passthru::PassThruMsg,
    pattern_msg: passthru::PassThruMsg,
    flow_control_msg: Option<passthru::PassThruMsg>,
) -> Result<FilterResult, String> {
    let filter_id = passthru::pass_thru_start_msg_filter(
        channel_id,
        filter_type,
        &mask_msg,
        &pattern_msg,
        flow_control_msg.as_ref(),
    )?;
    Ok(FilterResult {
        filter_id,
        status: 0,
    })
}

/// J2534 PassThruStopMsgFilter
#[tauri::command]
fn j2534_stop_msg_filter(channel_id: u32, filter_id: u32) -> Result<u32, String> {
    passthru::pass_thru_stop_msg_filter(channel_id, filter_id)
}

/// J2534 PassThruStartPeriodicMsg
#[tauri::command]
fn j2534_start_periodic_msg(
    channel_id: u32,
    msg: passthru::PassThruMsg,
    interval_ms: u32,
) -> Result<PeriodicResult, String> {
    let msg_id = passthru::pass_thru_start_periodic_msg(channel_id, &msg, interval_ms)?;
    Ok(PeriodicResult { msg_id, status: 0 })
}

/// J2534 PassThruStopPeriodicMsg
#[tauri::command]
fn j2534_stop_periodic_msg(channel_id: u32, msg_id: u32) -> Result<u32, String> {
    passthru::pass_thru_stop_periodic_msg(channel_id, msg_id)
}

/// J2534 PassThruIoctl: READ_VBAT
#[tauri::command]
fn j2534_read_vbat(channel_id: u32) -> Result<VbatResult, String> {
    let vbat_volts = passthru::pass_thru_read_vbat(channel_id)?;
    Ok(VbatResult {
        vbat_volts,
        status: 0,
    })
}

/// J2534 PassThruIoctl general handler
#[tauri::command]
fn j2534_ioctl(channel_id: u32, ioctl_id: u32) -> Result<IoctlResult, String> {
    let output_val = passthru::pass_thru_ioctl(channel_id, ioctl_id)?;
    Ok(IoctlResult {
        voltage_mv: output_val,
        status: 0,
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            j2534_list_devices,
            j2534_scan_registry,
            j2534_probe_device,
            j2534_open,
            j2534_close,
            j2534_connect,
            j2534_disconnect,
            j2534_write_msgs,
            j2534_read_msgs,
            j2534_start_msg_filter,
            j2534_stop_msg_filter,
            j2534_start_periodic_msg,
            j2534_stop_periodic_msg,
            j2534_read_vbat,
            j2534_ioctl
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
