import { useEffect } from 'react';

// React Scan integration for development monitoring
export const useReactScan = () => {
  useEffect(() => {
    // Only enable in development mode
    if (process.env.NODE_ENV === 'development') {
      // Initialize React Scan for performance monitoring
      import('react-scan').then((ReactScan: any) => {
        // Check for different possible export structures
        const scanModule = ReactScan.default || ReactScan;
        
        if (scanModule?.start) {
          scanModule.start({
            // Configuration options for React Scan
            enabled: true,
            log: true,
            renderCountThreshold: 5, // Warn when components render more than 5 times
            trackProps: true,
            trackState: true,
            trackContext: true,
          });
          
          console.log('🔍 React Scan initialized for performance monitoring');
        } else if (typeof scanModule === 'function') {
          // If scanModule is a function, call it directly
          scanModule({
            enabled: true,
            log: true,
            renderCountThreshold: 5,
            trackProps: true,
            trackState: true,
            trackContext: true,
          });
          
          console.log('🔍 React Scan initialized for performance monitoring');
        }
      }).catch((error) => {
        console.warn('React Scan could not be loaded:', error);
      });
    }

    return () => {
      // Cleanup if needed
      if (process.env.NODE_ENV === 'development') {
        import('react-scan').then((ReactScan: any) => {
          const scanModule = ReactScan.default || ReactScan;
          if (scanModule?.stop) {
            scanModule.stop();
          }
        }).catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);
};

export default useReactScan;