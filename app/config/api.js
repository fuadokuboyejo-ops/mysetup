// How the app reaches the local backend depends on where it runs:
//   Android emulator : '10.0.2.2'      (special alias to the host machine)
//   iOS Simulator    : 'localhost'
//   PHYSICAL device  : the PC's LAN IP (e.g. '192.168.68.51' — find via ipconfig);
//                      the device must be on the same Wi-Fi.
// Currently set for the Android emulator.
const LOCAL_IP = '10.0.2.2';
const PORT = 3001;

export const API_BASE = `http://${LOCAL_IP}:${PORT}`;
export const SCAN_ENDPOINT = `${API_BASE}/api/scan`;
export const REVAMP_ENDPOINT = `${API_BASE}/api/revamp`;
