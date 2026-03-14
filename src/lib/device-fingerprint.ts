// 设备指纹生成工具
// 用于识别用户设备，实现付费状态绑定

interface FingerprintData {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  timezone: string;
  touchSupport: boolean;
}

// 收集设备信息
function collectDeviceInfo(): FingerprintData {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  };
}

// 简单哈希函数
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 转为无符号整数并转换为16进制
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// 生成设备指纹
export async function generateDeviceFingerprint(): Promise<string> {
  const info = collectDeviceInfo();
  
  // 将设备信息转换为字符串
  const dataString = JSON.stringify(info, Object.keys(info).sort());
  
  // 使用SHA-256生成更安全的指纹（如果支持）
  if (window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 32); // 取前32位
    } catch {
      // 如果SHA-256失败，使用简单哈希
    }
  }
  
  // 回退到简单哈希
  return simpleHash(dataString);
}

// 获取或创建设备指纹（存储在localStorage）
export function getDeviceFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    const stored = localStorage.getItem('device_fingerprint');
    if (stored) {
      resolve(stored);
      return;
    }
    
    generateDeviceFingerprint().then((fingerprint) => {
      localStorage.setItem('device_fingerprint', fingerprint);
      resolve(fingerprint);
    });
  });
}

// 清除设备指纹（用于测试或重置）
export function clearDeviceFingerprint(): void {
  localStorage.removeItem('device_fingerprint');
}
