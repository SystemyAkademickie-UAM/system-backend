import { formatLecturerDisplay } from './lecturer-display.util';

describe('formatLecturerDisplay', () => {
  it('shows nickname with legal name when both differ', () => {
    expect(formatLecturerDisplay('Mentor', 'Jan', 'Kowalski', true)).toBe('Mentor (Jan Kowalski)');
  });

  it('shows only legal name when nickname display is disabled', () => {
    expect(formatLecturerDisplay('Mentor', 'Jan', 'Kowalski', false)).toBe('Jan Kowalski');
  });

  it('falls back to nickname when legal name missing and nickname hidden', () => {
    expect(formatLecturerDisplay('Mentor', '', '', false)).toBe('Mentor');
  });

  it('shows nickname only when legal name matches nickname', () => {
    expect(formatLecturerDisplay('Jan Kowalski', 'Jan', 'Kowalski', true)).toBe('Jan Kowalski');
  });
});
