import { Gender } from '../types';

export const getGenderLabel = (gender?: Gender, withIcon = false) => {
  if (gender === Gender.MALE) return withIcon ? 'זכר 🚹' : 'זכר';
  if (gender === Gender.FEMALE) return withIcon ? 'נקבה 🚺' : 'נקבה';
  return 'לא הוגדר';
};
