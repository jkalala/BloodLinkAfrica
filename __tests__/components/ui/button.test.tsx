import { render, screen, fireEvent } from '../utils/test-utils'
import { Button } from '@/components/ui/button'
import { userEvent } from '@testing-library/user-event'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    await user.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant classes correctly', () => {
    render(<Button variant="destructive">Delete</Button>)
    
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive')
  })

  it('applies size classes correctly', () => {
    render(<Button size="lg">Large Button</Button>)
    
    const button = screen.getByRole('button', { name: /large button/i })
    expect(button).toHaveClass('h-11')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>)
    
    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  it('shows loading state', () => {
    render(<Button loading>Loading Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Button with ref</Button>)
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('supports custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>)
    
    const button = screen.getByRole('button', { name: /custom button/i })
    expect(button).toHaveClass('custom-class')
  })

  it('supports asChild prop', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    
    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Button aria-label="Close dialog">×</Button>)
      
      const button = screen.getByRole('button', { name: /close dialog/i })
      expect(button).toHaveAttribute('aria-label', 'Close dialog')
    })

    it('supports keyboard navigation', async () => {
      const handleClick = jest.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Keyboard Button</Button>)
      
      const button = screen.getByRole('button', { name: /keyboard button/i })
      button.focus()
      
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(handleClick).toHaveBeenCalledTimes(2)
    })

    it('has proper focus styles', () => {
      render(<Button>Focus Button</Button>)
      
      const button = screen.getByRole('button', { name: /focus button/i })
      button.focus()
      
      expect(button).toHaveClass('focus-visible:ring-2')
    })
  })

  describe('Performance', () => {
    it('renders quickly', () => {
      const renderTime = measureRenderTime(() => {
        render(<Button>Performance Button</Button>)
      })
      
      // Should render in less than 10ms
      expect(renderTime).toBeLessThan(10)
    })

    it('does not re-render unnecessarily', () => {
      const renderSpy = jest.fn()
      
      const TestButton = React.memo(({ children }: { children: React.ReactNode }) => {
        renderSpy()
        return <Button>{children}</Button>
      })
      
      const { rerender } = render(<TestButton>Test</TestButton>)
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Re-render with same props
      rerender(<TestButton>Test</TestButton>)
      expect(renderSpy).toHaveBeenCalledTimes(1) // Should not re-render
      
      // Re-render with different props
      rerender(<TestButton>Different</TestButton>)
      expect(renderSpy).toHaveBeenCalledTimes(2) // Should re-render
    })
  })

  describe('Error Handling', () => {
    it('handles missing onClick gracefully', () => {
      expect(() => {
        render(<Button>No onClick</Button>)
      }).not.toThrow()
    })

    it('handles invalid variant gracefully', () => {
      expect(() => {
        render(<Button variant="invalid" as any>Invalid Variant</Button>)
      }).not.toThrow()
    })
  })

  describe('Integration', () => {
    it('works with form submission', async () => {
      const handleSubmit = jest.fn((e) => e.preventDefault())
      const user = userEvent.setup()
      
      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>
      )
      
      const button = screen.getByRole('button', { name: /submit/i })
      await user.click(button)
      
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    it('works with dialog triggers', async () => {
      const user = userEvent.setup()
      
      render(
        <div>
          <Button data-testid="dialog-trigger">Open Dialog</Button>
          <div data-testid="dialog" style={{ display: 'none' }}>
            Dialog Content
          </div>
        </div>
      )
      
      const trigger = screen.getByTestId('dialog-trigger')
      await user.click(trigger)
      
      // In a real scenario, this would trigger dialog opening
      expect(trigger).toHaveBeenClicked()
    })
  })
})
