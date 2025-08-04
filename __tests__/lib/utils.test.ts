import { cn } from '@/lib/utils';

describe('cn', () => {
  it('should merge tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle conditional classes', () => {
    expect(cn('text-red-500', true && 'font-bold', false && 'underline')).toBe('text-red-500 font-bold');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });
});
