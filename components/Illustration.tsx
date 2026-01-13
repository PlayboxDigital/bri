
import React from 'react';

export const HappyWallet: React.FC<{ size?: number }> = ({ size = 100 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="70" height="45" rx="12" stroke="#64748b" strokeWidth="1.5" fill="#f8fafc" />
    <path d="M60 30V25C60 21.6863 62.6863 19 66 19H79C82.3137 19 85 21.6863 85 25V30" stroke="#64748b" strokeWidth="1.5" />
    <circle cx="35" cy="50" r="2.5" fill="#64748b" />
    <circle cx="55" cy="50" r="2.5" fill="#64748b" />
    <path d="M42 60C42 60 44 62 46 62C48 62 50 60 50 60" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="75" cy="52.5" r="4" fill="#64748b" fillOpacity="0.2" />
  </svg>
);

export const PiggyBank: React.FC<{ size?: number; opacity?: number }> = ({ size = 100, opacity = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
    {/* Patas */}
    <rect x="33" y="75" width="12" height="18" rx="6" fill="#F472B6" fillOpacity="0.4" />
    <rect x="55" y="75" width="12" height="18" rx="6" fill="#F472B6" fillOpacity="0.4" />
    
    {/* Cuerpo */}
    <ellipse cx="50" cy="52" rx="42" ry="38" fill="url(#piggyGradient)" />
    <ellipse cx="50" cy="52" rx="42" ry="38" stroke="#F472B6" strokeWidth="0.5" strokeDasharray="3 3" />
    
    {/* Orejas */}
    <path d="M25 32 L15 10 L40 20 Z" fill="#FFE4E6" stroke="#FDA4AF" strokeWidth="1" strokeLinejoin="round" />
    <path d="M75 32 L85 10 L60 20 Z" fill="#FFE4E6" stroke="#FDA4AF" strokeWidth="1" strokeLinejoin="round" />
    
    {/* Ojos */}
    <circle cx="38" cy="48" r="2.5" fill="#1E293B" />
    <circle cx="62" cy="48" r="2.5" fill="#1E293B" />
    <circle cx="39" cy="47" r="0.8" fill="white" />
    <circle cx="63" cy="47" r="0.8" fill="white" />
    
    {/* Hocico */}
    <rect x="42" y="55" width="16" height="14" rx="7" fill="#F472B6" fillOpacity="0.6" />
    <circle cx="47" cy="62" r="1.5" fill="white" fillOpacity="0.9" />
    <circle cx="53" cy="62" r="1.5" fill="white" fillOpacity="0.9" />
    
    {/* Brillo en el cuerpo */}
    <path d="M25 40 Q30 30 50 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />

    <defs>
      <linearGradient id="piggyGradient" x1="50" y1="14" x2="50" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF1F2" />
        <stop offset="100%" stopColor="#FFE4E6" />
      </linearGradient>
    </defs>
  </svg>
);

export const FloatingCoin: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="18" fill="#D97706" fontWeight="bold">$</text>
  </svg>
);

export const Sparkles: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" fill="#A78BFA" fillOpacity="0.4" />
    <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="#F472B6" fillOpacity="0.3" />
  </svg>
);
