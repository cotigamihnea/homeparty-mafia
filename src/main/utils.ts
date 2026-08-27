import os from 'os';

export function getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    let backupIp = '127.0.0.1';
    
    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        
        // 1. Completely ignore common virtual adapters
        if (
            lowerName.includes('vmware') || 
            lowerName.includes('virtual') || 
            lowerName.includes('vbox') || 
            lowerName.includes('wsl') ||
            lowerName.includes('vethernet') ||
            lowerName.includes('docker')
        ) {
            continue;
        }

        for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                
                // 2. If it is explicitly Wi-Fi or standard Ethernet, return it immediately!
                if (lowerName.includes('wi-fi') || lowerName.includes('ethernet')) {
                    return iface.address;
                }
                
                // 3. Otherwise, save it as a backup just in case
                if (backupIp === '127.0.0.1') {
                    backupIp = iface.address;
                }
            }
        }
    }
    
    return backupIp; 
}