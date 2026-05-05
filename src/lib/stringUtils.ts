/**
 * Metindeki kelimelerin ilk harflerini büyük, diğerlerini küçük yapar (Türkçe uyumlu).
 */
export const formatName = (text: string) => {
  if (!text) return '';
  return text.split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    })
    .join(' ');
};
