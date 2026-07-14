// iOS Simulator shares the Mac's network, so 'localhost' reaches the local
// backend and — unlike a hardcoded LAN IP — survives DHCP address changes.
// Testing on a PHYSICAL device instead? Set this to your Mac's LAN IP
// (find it with: ipconfig getifaddr en0 — currently 10.1.194.248).
const LOCAL_IP = 'localhost';
const PORT = 3001;

export const API_BASE = `http://${LOCAL_IP}:${PORT}`;
export const SCAN_ENDPOINT = `${API_BASE}/api/scan`;
export const REVAMP_ENDPOINT = `${API_BASE}/api/revamp`;
