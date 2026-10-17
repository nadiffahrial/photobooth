/**
 * Device Detector Utility for Snap Studio Photobooth
 * Identifies iOS (iPhone/iPad), Android, and Desktop platforms
 * to tailor camera aspect ratio, UI touch controls, and ultra-wide lens support.
 */

export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isDesktop: true,
      isMobile: false,
      isSafari: false,
      deviceName: 'Desktop',
      deviceType: 'desktop'
    };
  }

  const ua = navigator.userAgent || navigator.vendor || window.opera || '';

  // Comprehensive iOS detection (iPhone, iPod, iPad, and iPadOS desktop-spoofing)
  const isIOS = /iPhone|iPod/.test(ua) || 
    /iPad/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Android detection
  const isAndroid = /Android/i.test(ua);

  // Responsive mobile threshold
  const isMobile = isIOS || isAndroid || (window.innerWidth <= 768);
  const isDesktop = !isIOS && !isAndroid && (window.innerWidth > 768);

  // iOS Safari check
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);

  let deviceName = 'Desktop PC';
  if (isIOS) {
    if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      deviceName = 'Apple iPad';
    } else {
      deviceName = 'Apple iPhone';
    }
  } else if (isAndroid) {
    deviceName = 'Android Device';
  }

  return {
    isIOS,
    isAndroid,
    isDesktop,
    isMobile,
    isSafari,
    deviceName,
    deviceType: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  };
}

