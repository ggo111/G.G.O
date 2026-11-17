import React from 'react';
import { getAvatarDef } from '../data/avatars.ts';

interface AvatarBadgeProps {
  avatarId?: string | null;
  size?: number;
  className?: string;
}

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  avatarId,
  size = 44,
  className = '',
}) => {
  const def = getAvatarDef(avatarId);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`rounded-full shrink-0 select-none ${className}`}
      aria-label={def.name}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="31" fill={def.bg} stroke={def.accent} strokeWidth="2.5" />

      {/* Ears / Horns / Hats behind head */}
      {def.archetype === 'animal_ears' && (
        <>
          <polygon points="14,26 17,9 29,19" fill={def.primary} />
          <polygon points="17,23 19,13 26,19" fill={def.secondary} />
          <polygon points="50,26 47,9 35,19" fill={def.primary} />
          <polygon points="47,23 45,13 38,19" fill={def.secondary} />
        </>
      )}

      {def.archetype === 'panda' && (
        <>
          <circle cx="17" cy="17" r="7.5" fill={def.secondary} />
          <circle cx="47" cy="17" r="7.5" fill={def.secondary} />
        </>
      )}

      {def.archetype === 'bunny' && (
        <>
          <ellipse cx="23" cy="14" rx="5" ry="12" transform="rotate(-10 23 14)" fill={def.primary} />
          <ellipse cx="23" cy="14" rx="2.5" ry="8" transform="rotate(-10 23 14)" fill={def.secondary} />
          <ellipse cx="41" cy="14" rx="5" ry="12" transform="rotate(10 41 14)" fill={def.primary} />
          <ellipse cx="41" cy="14" rx="2.5" ry="8" transform="rotate(10 41 14)" fill={def.secondary} />
        </>
      )}

      {def.archetype === 'dragon' && (
        <>
          <polygon points="16,24 11,8 25,18" fill={def.accent} />
          <polygon points="48,24 53,8 39,18" fill={def.accent} />
        </>
      )}

      {(def.feature === 'antenna' || def.archetype === 'alien') && (
        <>
          <line x1="32" y1="16" x2="32" y2="7" stroke={def.accent} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="6.5" r="3" fill={def.accent} />
        </>
      )}

      {def.archetype === 'knight' && (
        <path d="M26 14 Q32 4 38 14 Z" fill={def.accent} />
      )}

      {/* Main Head */}
      {def.archetype === 'robot' || def.archetype === 'clockwork' ? (
        <rect x="15" y="16" width="34" height="34" rx="9" fill={def.primary} />
      ) : (
        <circle cx="32" cy="34" r="17.5" fill={def.primary} />
      )}

      {/* Frog eyes bump */}
      {def.archetype === 'frog' && (
        <>
          <circle cx="22" cy="20" r="6" fill={def.primary} />
          <circle cx="42" cy="20" r="6" fill={def.primary} />
        </>
      )}

      {/* Secondary face markings */}
      {def.archetype === 'animal_ears' && (
        <ellipse cx="32" cy="40" rx="11" ry="8.5" fill={def.secondary} />
      )}

      {def.archetype === 'panda' && (
        <>
          <ellipse cx="25" cy="33" rx="5.2" ry="6.2" transform="rotate(-15 25 33)" fill={def.secondary} />
          <ellipse cx="39" cy="33" rx="5.2" ry="6.2" transform="rotate(15 39 33)" fill={def.secondary} />
        </>
      )}

      {def.archetype === 'owl' && (
        <>
          <circle cx="25" cy="33" r="6.5" fill={def.secondary} />
          <circle cx="39" cy="33" r="6.5" fill={def.secondary} />
          <polygon points="32,36 28,42 36,42" fill={def.accent} />
        </>
      )}

      {def.archetype === 'knight' && (
        <>
          <rect x="19" y="29" width="26" height="9" rx="4" fill="#161412" />
          <line x1="25" y1="42" x2="25" y2="47" stroke={def.secondary} strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="42" x2="32" y2="48" stroke={def.secondary} strokeWidth="2" strokeLinecap="round" />
          <line x1="39" y1="42" x2="39" y2="47" stroke={def.secondary} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {def.archetype === 'ninja' && (
        <>
          <rect x="15" y="27" width="34" height="10" rx="4" fill={def.secondary} />
          <rect x="14" y="21" width="36" height="5" rx="2.5" fill={def.accent} />
        </>
      )}

      {def.archetype === 'astronaut' && (
        <>
          <circle cx="32" cy="34" r="19" fill="none" stroke={def.primary} strokeWidth="3.5" />
          <rect x="19" y="25" width="26" height="16" rx="7" fill="#0F172A" stroke={def.secondary} strokeWidth="2" />
        </>
      )}

      {def.archetype === 'clockwork' && (
        <>
          <circle cx="24" cy="24" r="4" fill="none" stroke={def.secondary} strokeWidth="2" />
          <circle cx="40" cy="43" r="3.5" fill="none" stroke={def.accent} strokeWidth="2" />
        </>
      )}

      {def.archetype === 'wizard' && (
        <>
          <polygon points="32,5 14,23 50,23" fill={def.accent} />
          <rect x="12" y="21" width="40" height="4.5" rx="2" fill={def.secondary} />
        </>
      )}

      {def.archetype === 'crown' && (
        <polygon points="18,20 21,9 27,16 32,7 37,16 43,9 46,20" fill={def.accent} />
      )}

      {def.archetype === 'pirate' && (
        <>
          <path d="M13 24 Q32 10 51 24 Z" fill="#18181B" />
          <line x1="19" y1="24" x2="45" y2="24" stroke={def.accent} strokeWidth="2.5" />
        </>
      )}

      {/* Eyes */}
      {def.archetype === 'robot' ? (
        <>
          <rect x="21" y="28" width="7" height="5" rx="2" fill={def.eyeColor} />
          <rect x="36" y="28" width="7" height="5" rx="2" fill={def.eyeColor} />
          <rect x="23" y="40" width="18" height="4" rx="2" fill={def.secondary} />
        </>
      ) : def.archetype === 'knight' ? (
        <>
          <circle cx="26" cy="33.5" r="2.2" fill={def.eyeColor} />
          <circle cx="38" cy="33.5" r="2.2" fill={def.eyeColor} />
        </>
      ) : def.archetype === 'pirate' ? (
        <>
          <circle cx="25" cy="33" r="3" fill={def.eyeColor} />
          <circle cx="39" cy="33" r="4" fill="#18181B" />
          <line x1="20" y1="26" x2="46" y2="34" stroke="#18181B" strokeWidth="2" />
        </>
      ) : def.archetype === 'frog' ? (
        <>
          <circle cx="22" cy="20" r="3.2" fill="#FFFFFF" />
          <circle cx="42" cy="20" r="3.2" fill="#FFFFFF" />
          <circle cx="22" cy="20" r="1.7" fill={def.eyeColor} />
          <circle cx="42" cy="20" r="1.7" fill={def.eyeColor} />
        </>
      ) : (
        <>
          <circle cx="25.5" cy="32.5" r="2.8" fill={def.eyeColor} />
          <circle cx="38.5" cy="32.5" r="2.8" fill={def.eyeColor} />
          <circle cx="26.4" cy="31.5" r="0.9" fill="#FFFFFF" />
          <circle cx="39.4" cy="31.5" r="0.9" fill="#FFFFFF" />
        </>
      )}

      {/* Optional Facial Features */}
      {def.feature === 'glasses' && (
        <>
          <circle cx="25.5" cy="32.5" r="5.5" fill="none" stroke={def.accent} strokeWidth="1.8" />
          <circle cx="38.5" cy="32.5" r="5.5" fill="none" stroke={def.accent} strokeWidth="1.8" />
          <line x1="31" y1="32.5" x2="33" y2="32.5" stroke={def.accent} strokeWidth="1.8" />
        </>
      )}

      {def.feature === 'blush' && (
        <>
          <circle cx="20.5" cy="38.5" r="2.5" fill="#F43F5E" opacity="0.45" />
          <circle cx="43.5" cy="38.5" r="2.5" fill="#F43F5E" opacity="0.45" />
        </>
      )}

      {def.feature === 'scar' && (
        <line x1="36" y1="26" x2="43" y2="37" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      )}

      {def.feature === 'beard' && (
        <path d="M21 41 Q32 54 43 41 Q32 45 21 41 Z" fill={def.secondary} />
      )}

      {/* Smile / Nose for non-masked characters */}
      {def.archetype !== 'robot' &&
        def.archetype !== 'knight' &&
        def.archetype !== 'owl' &&
        def.archetype !== 'ninja' &&
        def.archetype !== 'astronaut' && (
          <path d="M27.5 40.5 Q32 44 36.5 40.5" fill="none" stroke={def.eyeColor} strokeWidth="2" strokeLinecap="round" />
        )}
    </svg>
  );
};
