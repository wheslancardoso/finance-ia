import type { Meta, StoryObj } from '@storybook/react';
import GlassCard from '../components/GlassCard';

const meta: Meta<typeof GlassCard> = {
  title: 'Components/GlassCard',
  component: GlassCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2">Card de Vidro</h3>
        <p className="text-white/60">Este é o efeito de glassmorphism padrão do sistema.</p>
      </div>
    ),
  },
};

export const CustomPadding: Story = {
  args: {
    className: 'p-12 border-violet-500/20',
    children: (
      <div className="text-center">
        <span className="text-violet-400 font-bold uppercase tracking-widest text-xs">Destaque</span>
        <h3 className="text-2xl font-black text-white mt-2">Borda Customizada</h3>
      </div>
    ),
  },
};
