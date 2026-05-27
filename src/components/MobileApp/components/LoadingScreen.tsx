import l3l3 from '../../game/images/l3l3.png';
import { useEffect } from 'react';

export function LoadingScreen() {
  useEffect(() => {
    // Add CSS animations to document head
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      // Cleanup on unmount
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#111111',
        fontFamily: "'Pixel', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <div 
        style={{ 
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          
          
        }}
      >
        <div className="relative flex justify-center">
          <img
            src={l3l3}
            alt="L3L3 Logo"
            style={{ imageRendering: 'pixelated', width: '250px' }}
          />
        </div>
        
        <div 
          className="text-xl uppercase tracking-wider text-center"
          style={{ 

            color: 'white',
            fontFamily: "'Pixel', sans-serif",
            fontSize: '24px',
            marginTop: '32px',
          }}
          data-testid="text-loading"

        >
          LOADING DATA...
        </div>
        

        
        {/* Pulsing dots for additional loading indication */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-sm"
              style={{
                marginTop: '12px',
                backgroundColor: '#7462B3',
                animation: `pulse 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
