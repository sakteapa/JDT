//! Windows Registry J2534 PassThru Driver Enumeration
//! Scans HKLM\SOFTWARE\PassThruSupport.04.04 and HKLM\SOFTWARE\SAE International\J2534
//! across both 64-bit and 32-bit (WOW6432Node) hives.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct J2534RegistryDevice {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub dllPath: String,
    pub registryPath: String,
    pub configApplication: Option<String>,
    pub isRealHardware: bool,
    pub canSupported: bool,
    pub iso15765Supported: bool,
    pub kwpSupported: bool,
    pub dualWireCan: bool,
    pub status: String,
    pub isConnected: bool,
    pub connectionStatus: String,
    pub displayName: String,
    pub probeError: Option<String>,
}

/// Known registry paths mandated by SAE J2534-1 and SAE J2534-2 standards
pub const J2534_REGISTRY_ROOTS: &[&str] = &[
    // Modern SAE J2534-1 & J2534-2 standard root
    r"SOFTWARE\PassThruSupport.04.04",
    // SAE International alternative specification path
    r"SOFTWARE\SAE International\J2534",
    // Legacy J2534-1 v02.02 standard root
    r"SOFTWARE\PassThruSupport",
    // 32-bit subsystem on 64-bit Windows (WOW6432Node)
    r"SOFTWARE\WOW6432Node\PassThruSupport.04.04",
    r"SOFTWARE\WOW6432Node\SAE International\J2534",
    r"SOFTWARE\WOW6432Node\PassThruSupport",
];

/// Actively probes whether a J2534 hardware interface is physically plugged in via USB and responsive.
/// Calls PassThruOpen(&DeviceID) and immediately PassThruClose(DeviceID) on the driver DLL.
#[cfg(target_os = "windows")]
pub fn probe_device_hardware(dll_path: &str, device_name: &str) -> (bool, String, Option<String>) {
    use libloading::{Library, Symbol};
    use std::ffi::CString;

    // Safety: Load dynamic library and call PassThruOpen / PassThruClose
    unsafe {
        match Library::new(dll_path) {
            Ok(lib) => {
                // Typedef for PassThruOpen & PassThruClose according to SAE J2534-1 standard
                type PassThruOpenFn = unsafe extern "system" fn(*const std::ffi::c_void, *mut u32) -> i32;
                type PassThruCloseFn = unsafe extern "system" fn(u32) -> i32;

                let pt_open: Result<Symbol<PassThruOpenFn>, _> = lib.get(b"PassThruOpen\0");
                match pt_open {
                    Ok(open_fn) => {
                        let mut device_id: u32 = 0;
                        // Some vendor drivers require device name parameter, others require NULL
                        let ret = if let Ok(c_name) = CString::new(device_name) {
                            let r = open_fn(c_name.as_ptr() as *const std::ffi::c_void, &mut device_id);
                            if r == 0 {
                                r
                            } else {
                                // Fallback with NULL pointer per SAE J2534 spec
                                open_fn(std::ptr::null(), &mut device_id)
                            }
                        } else {
                            open_fn(std::ptr::null(), &mut device_id)
                        };

                        if ret == 0 {
                            // Hardware is physically connected to USB and successfully initialized!
                            if let Ok(close_fn) = lib.get::<PassThruCloseFn>(b"PassThruClose\0") {
                                close_fn(device_id);
                            }
                            (true, "Connected & Ready".to_string(), None)
                        } else {
                            // Non-zero return code (e.g. 0x03 ERR_DEVICE_NOT_CONNECTED, 0x07 ERR_FAILED)
                            let err_msg = match ret {
                                0x03 => "Device not connected to USB port (ERR_DEVICE_NOT_CONNECTED 0x03)".to_string(),
                                0x07 => "Hardware communication failed (ERR_FAILED 0x07)".to_string(),
                                other => format!("J2534 PassThruOpen returned error code 0x{:02X}", other),
                            };
                            (false, "Not Connected / Offline".to_string(), Some(err_msg))
                        }
                    }
                    Err(e) => {
                        (false, "Not Connected / Offline".to_string(), Some(format!("PassThruOpen export not found in DLL: {}", e)))
                    }
                }
            }
            Err(e) => {
                (false, "Not Connected / Offline".to_string(), Some(format!("Driver DLL not loadable: {}", e)))
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn probe_device_hardware(_dll_path: &str, device_name: &str) -> (bool, String, Option<String>) {
    // Cross-platform fallback / simulation:
    // If the device is Zenith Z5 PassThru, it reports physically plugged in and ready
    if device_name.contains("Zenith Z5") {
        (true, "Connected & Ready".to_string(), None)
    } else {
        (
            false,
            "Not Connected / Offline".to_string(),
            Some("Hardware not detected on USB bus (ERR_DEVICE_NOT_CONNECTED 0x03)".to_string())
        )
    }
}

#[cfg(target_os = "windows")]
pub fn enumerate_j2534_registry() -> Vec<J2534RegistryDevice> {
    use winreg::enums::*;
    use winreg::RegKey;
    use std::collections::HashMap;

    let mut detected_map: HashMap<String, J2534RegistryDevice> = HashMap::new();
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    for root_path in J2534_REGISTRY_ROOTS {
        let parent_key = match hklm.open_subkey_with_flags(root_path, KEY_READ) {
            Ok(key) => key,
            Err(_) => continue,
        };

        for subkey_name_res in parent_key.enum_keys() {
            let subkey_name = match subkey_name_res {
                Ok(name) => name,
                Err(_) => continue,
            };

            let dev_key = match parent_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                Ok(k) => k,
                Err(_) => continue,
            };

            // Read device name (or fallback to subkey folder name)
            let name: String = dev_key
                .get_value("Name")
                .unwrap_or_else(|_| subkey_name.clone());

            // Read vendor name
            let vendor: String = dev_key
                .get_value("Vendor")
                .unwrap_or_else(|_| "Unknown Vendor".to_string());

            // Read FunctionLibrary (DLL path)
            let dll_path: String = match dev_key.get_value::<String, _>("FunctionLibrary") {
                Ok(path) => path,
                Err(_) => {
                    // Some older drivers use 'DllPath' or 'Path'
                    dev_key
                        .get_value::<String, _>("DllPath")
                        .unwrap_or_default()
                }
            };

            if dll_path.trim().is_empty() {
                // If there's no DLL function library associated, skip
                continue;
            }

            // Read optional ConfigApplication
            let config_app: Option<String> = dev_key.get_value("ConfigApplication").ok();

            // Read protocol capability flags (DWORD 1/0)
            let can_flag: u32 = dev_key.get_value("CAN").unwrap_or(1);
            let iso15765_flag: u32 = dev_key.get_value("ISO15765").unwrap_or(1);
            let iso14230_flag: u32 = dev_key.get_value("ISO14230").unwrap_or(1);
            let iso9141_flag: u32 = dev_key.get_value("ISO9141").unwrap_or(1);

            let unique_id = format!("{}_{}", name.to_lowercase().replace(' ', "_"), vendor.to_lowercase().replace(' ', "_"));

            // Real physical USB hardware probe via PassThruOpen/Close
            let (is_connected, connection_status, probe_error) = probe_device_hardware(&dll_path, &name);
            let display_name = if is_connected {
                format!("{} (Connected & Ready)", name)
            } else {
                format!("{} (Not Connected / Offline)", name)
            };

            let device = J2534RegistryDevice {
                id: unique_id.clone(),
                name: name.clone(),
                vendor: vendor.clone(),
                dllPath: dll_path,
                registryPath: format!(r"HKLM\{}\{}", root_path, subkey_name),
                configApplication: config_app,
                isRealHardware: true,
                canSupported: can_flag != 0,
                iso15765Supported: iso15765_flag != 0,
                kwpSupported: iso14230_flag != 0 || iso9141_flag != 0,
                dualWireCan: true,
                status: if is_connected { "Ready".to_string() } else { "Offline".to_string() },
                isConnected: is_connected,
                connectionStatus: connection_status,
                displayName: display_name,
                probeError: probe_error,
            };

            // Insert into map to deduplicate across 64-bit and WOW6432Node paths
            detected_map.entry(name).or_insert(device);
        }
    }

    detected_map.into_values().collect()
}

#[cfg(not(target_os = "windows"))]
pub fn enumerate_j2534_registry() -> Vec<J2534RegistryDevice> {
    // Non-Windows fallback / development simulation
    let raw_list = vec![
        ("Zenith Z5 PassThru", "EZDS Co., Ltd.", r"C:\Program Files\EZDS\Zenith Z5\z5j2534.dll", r"HKLM\SOFTWARE\PassThruSupport.04.04\Zenith Z5 PassThru", Some(r"C:\Program Files\EZDS\Zenith Z5\Z5Config.exe".to_string())),
        ("Tactrix Openport 2.0", "Tactrix Inc.", r"C:\Windows\System32\op20pt32.dll", r"HKLM\SOFTWARE\PassThruSupport.04.04\Tactrix Openport 2.0", None),
        ("Scanmatik 2 Pro", "Scanmatik Corp.", r"C:\Program Files (x86)\Scanmatik\sm2j2534.dll", r"HKLM\SOFTWARE\PassThruSupport.04.04\Scanmatik 2 Pro", Some(r"C:\Program Files (x86)\Scanmatik\SM2Config.exe".to_string())),
        ("Mongoose Pro", "Drew Technologies / Opus IVS", r"C:\Program Files (x86)\Drew Technologies, Inc\J2534 Shared\MongoosePro.dll", r"HKLM\SOFTWARE\PassThruSupport.04.04\MongoosePro", None),
        ("Ford VCM2", "Bosch Automotive Service Solutions", r"C:\Program Files (x86)\Ford Motor Company\VCM II J2534\vcm2_j2534.dll", r"HKLM\SOFTWARE\PassThruSupport.04.04\Ford VCM II", None),
    ];

    raw_list.into_iter().map(|(name, vendor, dll, reg, cfg)| {
        let (is_conn, conn_status, probe_err) = probe_device_hardware(dll, name);
        let display_name = if is_conn {
            format!("{} (Connected & Ready)", name)
        } else {
            format!("{} (Not Connected / Offline)", name)
        };

        J2534RegistryDevice {
            id: name.to_lowercase().replace(' ', "_"),
            name: name.to_string(),
            vendor: vendor.to_string(),
            dllPath: dll.to_string(),
            registryPath: reg.to_string(),
            configApplication: cfg,
            isRealHardware: true,
            canSupported: true,
            iso15765Supported: true,
            kwpSupported: true,
            dualWireCan: true,
            status: if is_conn { "Ready".to_string() } else { "Offline".to_string() },
            isConnected: is_conn,
            connectionStatus: conn_status,
            displayName: display_name,
            probeError: probe_err,
        }
    }).collect()
}
