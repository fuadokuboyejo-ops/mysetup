// Change this to your machine's local IP when running the backend
// Find it with: ifconfig | grep "inet " (Mac) or ipconfig (Windows)
const LOCAL_IP = '192.168.68.50';
const PORT = 3001;

export const API_BASE = `http://${LOCAL_IP}:${PORT}`;
export const SCAN_ENDPOINT = `${API_BASE}/api/scan`;
