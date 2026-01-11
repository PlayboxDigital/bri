
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

export const PiggyBank: React.FC<{ size?: number }> = ({ size = 100 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Patas */}
    <rect x="35" y="72" width="10" height="15" rx="5" fill="#E1AFD1" fillOpacity="0.6" />
    <rect x="55" y="72" width="10" height="15" rx="5" fill="#E1AFD1" fillOpacity="0.6" />
    
    {/* Cuerpo */}
    <circle cx="50" cy="50" r="38" fill="url(#piggyGradient)" />
    <circle cx="50" cy="50" r="38" stroke="#E1AFD1" strokeWidth="0.5" strokeDasharray="4 4" />
    
    {/* Orejas */}
    <path d="M22 30 L15 12 L35 18 Z" fill="#FFE6E6" stroke="#E1AFD1" strokeWidth="1" strokeLinejoin="round" />
    <path d="M78 30 L85 12 L65 18 Z" fill="#FFE6E6" stroke="#E1AFD1" strokeWidth="1" strokeLinejoin="round" />
    
    {/* Ojos - Más minimalistas */}
    <circle cx="40" cy="45" r="2" fill="#475569" />
    <circle cx="60" cy="45" r="2" fill="#475569" />
    
    {/* Mejillas - Muy suaves */}
    <circle cx="32" cy="52" r="6" fill="#E1AFD1" fillOpacity="0.2" />
    <circle cx="68" cy="52" r="6" fill="#E1AFD1" fillOpacity="0.2" />
    
    {/* Hocico */}
    <rect x="42" y="52" width="16" height="12" rx="6" fill="#E1AFD1" fillOpacity="0.7" />
    <circle cx="47" cy="58" r="1.2" fill="white" fillOpacity="0.8" />
    <circle cx="53" cy="58" r="1.2" fill="white" fillOpacity="0.8" />
    
    {/* Ranura con brillo */}
    <rect x="42" y="22" width="16" height="2.5" rx="1" fill="#475569" fillOpacity="0.1" />

    <defs>
      <linearGradient id="piggyGradient" x1="50" y1="12" x2="50" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF5F5" />
        <stop offset="100%" stopColor="#FFE6E6" />
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
