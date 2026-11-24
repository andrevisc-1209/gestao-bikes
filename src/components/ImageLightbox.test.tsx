import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageLightbox from './ImageLightbox';

describe('ImageLightbox', () => {
  it('renders the image with the given src and alt inside a modal dialog', () => {
    render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    const img = screen.getByRole('img', { name: 'Foto' });
    expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar foto'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes the Escape listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://example.com/a.jpg" alt="Foto" onClose={onClose} />);
    fireEvent.click(screen.getByRole('img', { name: 'Foto' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
