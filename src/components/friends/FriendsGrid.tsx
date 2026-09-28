import { ErrorBoundary, ErrorFallback } from '@components/common';
import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { friendsData } from '@constants/friends-config';
import { defaultLocale, t } from '@/i18n';
import FriendCard from './FriendCard';

interface FriendsGridProps {
  locale?: string;
}

export default function FriendsGrid({ locale = defaultLocale }: FriendsGridProps) {
  return (
    <LazyMotionProvider>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="w-full">
          {/* Grid Container */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {friendsData.map((friend, index) => (
              <FriendCard key={friend.url} friend={friend} index={index} />
            ))}
          </div>

          {/* Empty State */}
          {friendsData.length === 0 && (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-pink-200 border-dashed bg-pink-50/40 px-6 py-8 text-center dark:border-pink-400/20 dark:bg-pink-500/5">
              <h2 className="mb-2 font-bold text-gray-700 text-xl dark:text-gray-300">{t(locale, 'friends.emptyTitle')}</h2>
              <p className="text-gray-500 text-sm leading-6 dark:text-gray-400">{t(locale, 'friends.emptyDescription')}</p>
              <a
                className="mt-4 font-semibold text-pink-600 text-sm hover:underline dark:text-pink-300"
                href="#friend-application"
              >
                {t(locale, 'friends.applyTitle')}
              </a>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </LazyMotionProvider>
  );
}
