/**
 * Builds a lecturer display label for students and other lecturers.
 * When `showNickname` is false, only the legal name is shown (nickname hidden).
 */
export function formatLecturerDisplay(
  nickname: string | null | undefined,
  name: string | null | undefined,
  surname: string | null | undefined,
  showNickname: boolean = true): string {
  const nick = nickname ? String(nickname).trim() : '';
  const legal = [name, surname]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .join(' ')
    .trim();

  if (!showNickname) {
    return legal || nick;
  }

  if (nick && legal && nick.toLowerCase() !== legal.toLowerCase()) {
    return `${nick} (${legal})`;
  }
  if (nick) {
    return nick;
  }
  return legal;
}
