// Device detection and orientation management
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device, DeviceInfo } from '@capacitor/device';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export type DeviceType = 'phone' | 'foldable-folded' | 'foldable-open' | 'tablet' | 'desktop';
export type OrientationMode = 'portrait' | 'landscape';

export interface DeviceState {
  deviceType: DeviceType;
  orientation: OrientationMode;
  screenWidth: number;
  screenHeight: number;
  isNative: boolean;
  isTouchDevice: boolean;
  requiresLandscape: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

// Breakpoints for device classification
const PHONE_MAX_WIDTH = 480;
const FOLDABLE_FOLDED_MAX = 500;
const FOLDABLE_OPEN_MIN = 600;
const FOLDABLE_OPEN_MAX = 900;
const TABLET_MIN = 768;

function classifyDevice(width: number, height: number): DeviceType {
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  const aspectRatio = maxDimension / minDimension;
  
  // Desktop detection
  if (!('ontouchstart' in window) && width >= 1024) {
    return 'desktop';
  }
  
  // Foldable detection (narrow width in folded state, wider when open)
  // Folded foldables typically have very tall aspect ratios
  if (aspectRatio > 2.1 && minDimension <= FOLDABLE_FOLDED_MAX) {
    return 'foldable-folded';
  }
  
  // Open foldable - squarish aspect ratio with medium size
  if (aspectRatio < 1.5 && minDimension >= FOLDABLE_OPEN_MIN && minDimension <= FOLDABLE_OPEN_MAX) {
    return 'foldable-open';
  }
  
  // Tablet detection
  if (minDimension >= TABLET_MIN) {
    return 'tablet';
  }
  
  // Phone detection
  if (minDimension <= PHONE_MAX_WIDTH || maxDimension <= 900) {
    return 'phone';
  }
  
  // Default to tablet for larger unknown devices
  return 'tablet';
}

function getOrientation(width: number, height: number): OrientationMode {
  return width >= height ? 'landscape' : 'portrait';
}

export function useDeviceInfo(): DeviceState & {
  lockToLandscape: () => Promise<void>;
  unlockOrientation: () => Promise<void>;
  enterFullscreen: () => Promise<void>;
} {
  const [state, setState] = useState<DeviceState>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const deviceType = classifyDevice(width, height);
    
    return {
      deviceType,
      orientation: getOrientation(width, height),
      screenWidth: width,
      screenHeight: height,
      isNative: Capacitor.isNativePlatform(),
      isTouchDevice: 'ontouchstart' in window,
      requiresLandscape: deviceType === 'phone' || deviceType === 'foldable-folded',
      safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 }
    };
  });
  
  // Update on resize/orientation change
  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const deviceType = classifyDevice(width, height);
      
      setState(prev => ({
        ...prev,
        deviceType,
        orientation: getOrientation(width, height),
        screenWidth: width,
        screenHeight: height,
        requiresLandscape: deviceType === 'phone' || deviceType === 'foldable-folded'
      }));
    };
    
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);
    
    // Also listen for visual viewport changes (keyboard, etc)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateDeviceInfo);
    }
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateDeviceInfo);
      }
    };
  }, []);
  
  // Get native device info on mount
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Device.getInfo().then((_info: DeviceInfo) => {
        // Could use info.model to detect specific foldables
      }).catch(console.warn);
    }
    
    // Get safe area insets from CSS env variables
    const computedStyle = getComputedStyle(document.documentElement);
    const getInset = (name: string) => {
      const value = computedStyle.getPropertyValue(`env(safe-area-inset-${name})`);
      return parseInt(value) || 0;
    };
    
    setState(prev => ({
      ...prev,
      safeAreaInsets: {
        top: getInset('top'),
        bottom: getInset('bottom'),
        left: getInset('left'),
        right: getInset('right')
      }
    }));
  }, []);
  
  // Lock to landscape mode
  const lockToLandscape = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (err) {
        console.warn('Failed to lock orientation:', err);
      }
    } else {
      // Web fallback - request fullscreen with landscape orientation
      try {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        
        // Try to lock orientation via Screen Orientation API
        if ('screen' in window && 'orientation' in screen) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {
            // Orientation lock not supported or denied
          }
        }
      } catch (err) {
        console.warn('Failed to enter fullscreen/lock orientation:', err);
      }
    }
  }, []);
  
  // Unlock orientation
  const unlockOrientation = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.unlock();
      } catch (err) {
        console.warn('Failed to unlock orientation:', err);
      }
    } else {
      try {
        if ('screen' in window && 'orientation' in screen) {
          (screen.orientation as any).unlock?.();
        }
      } catch {
        // Ignore
      }
    }
  }, []);
  
  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Failed to enter fullscreen:', err);
    }
  }, []);
  
  return {
    ...state,
    lockToLandscape,
    unlockOrientation,
    enterFullscreen
  };
}
