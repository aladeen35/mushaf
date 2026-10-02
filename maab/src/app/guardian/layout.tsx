import { AppShell } from '@/components/shell/AppShell';

export default function GuardianLayout({ children }: LayoutProps<'/guardian'>) {
  return <AppShell role="guardian">{children}</AppShell>;
}
