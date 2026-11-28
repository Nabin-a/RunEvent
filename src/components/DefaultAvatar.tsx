import React from 'react';
import { useThemeId } from '../theme';
import avatarDefault from '../assets/avatar/avatar-default.webp';
import avatarDefaultLine from '../assets/avatar/avatar-default-line.webp';

/* The picture an avatar shows until the person uploads one (26 Nov 2026, user
   request: use the rabbit from output/profile-avatars instead of initials).
   The LINE theme gets the black and green version. Decorative: the name is
   always shown next to the avatar. */
export const DefaultAvatarImg: React.FC = () => {
  const theme = useThemeId();
  return (
    <img
      src={theme === 'line' ? avatarDefaultLine : avatarDefault}
      alt=""
      className="runner-avatar-img runner-avatar-default"
      draggable={false}
    />
  );
};
