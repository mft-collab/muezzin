import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../src/components/ui/Modal';

describe('Modal', () => {
  it('exposes dialog semantics and the title as its accessible name', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Ayarlar">
        <p>İçerik</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Ayarlar');
  });

  it('does not render anything when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Ayarlar">
        <p>İçerik</p>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when the labeled close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="Ayarlar">
        <p>İçerik</p>
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="Ayarlar">
        <p>İçerik</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
