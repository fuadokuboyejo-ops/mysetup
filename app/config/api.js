// A PHYSICAL device can't reach the dev machine via 'localhost' (that resolves
// to the phone itself), so this must be the PC's LAN IP. Find it on Windows with
// `ipconfig` (IPv4 Address). If your DHCP lease changes this, update it here.
// (iOS Simulator / Android emulator can use 'localhost' / '10.0.2.2' instead.)
const LOCAL_IP = '192.168.68.51';
const PORT = 3001;

export const API_BASE = `http://${LOCAL_IP}:${PORT}`;
export const SCAN_ENDPOINT = `${API_BASE}/api/scan`;
export const REVAMP_ENDPOINT = `${API_BASE}/api/revamp`;
