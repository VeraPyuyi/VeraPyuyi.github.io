import ThemeToggle from '@components/theme/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { SearchTrigger } from './SearchDialog';

/** Search, language and theme controls at the foot of the desktop side rail. */
export default function SideRailControls({ locale }: { locale: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <SearchTrigger />
      <LanguageSwitcher locale={locale} />
      <ThemeToggle />
    </div>
  );
}
