import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

/**
 * Centrally route deep links in the Mogu app.
 * Supported patterns:
 * - mogu://dishes/:id or /dishes/:id
 * - mogu://weekly-plan or mogu://weekly-plans/:id
 * - mogu://community/posts/:id or /community/posts/:id
 * - mogu://explore/articles/:id or /explore/articles/:id
 * - mogu://users/:id or /users/:id
 * - mogu://health
 * - mogu://profile
 * - mogu://notifications
 */
export function handleDeepLink(link?: string | null): boolean {
  if (!link) return false;
  if (!navigationRef.isReady()) {
    // If navigation is not yet ready, retry shortly
    setTimeout(() => handleDeepLink(link), 500);
    return true;
  }

  const trimmed = link.trim();

  // Dishes: mogu://dishes/:id or /dishes/:id
  const dishMatch = trimmed.match(/(?:mogu:\/\/|\/)dishes\/([0-9a-fA-F-]+)/i);
  if (dishMatch) {
    navigationRef.navigate('FoodDetail', { dishId: dishMatch[1] });
    return true;
  }

  // Community Posts: mogu://community/posts/:id or /community/posts/:id
  const postMatch = trimmed.match(/(?:mogu:\/\/|\/)community\/posts\/([0-9a-fA-F-]+)/i);
  if (postMatch) {
    navigationRef.navigate('PostDetail', { postId: postMatch[1] });
    return true;
  }

  // Articles: mogu://explore/articles/:id or /explore/articles/:id
  const articleMatch = trimmed.match(/(?:mogu:\/\/|\/)explore\/articles\/([0-9a-fA-F-]+)/i);
  if (articleMatch) {
    navigationRef.navigate('ArticleDetail', { articleId: articleMatch[1] });
    return true;
  }

  // Users / Public Profile: mogu://users/:id or /users/:id
  const userMatch = trimmed.match(/(?:mogu:\/\/|\/)users\/([0-9a-fA-F-]+)/i);
  if (userMatch) {
    navigationRef.navigate('PublicProfile', { userId: userMatch[1] });
    return true;
  }

  // Weekly plan: mogu://weekly-plan, mogu://weekly-plans/:id
  const weeklyMatch = trimmed.match(/(?:mogu:\/\/|\/)weekly-plans?(?:\/([0-9a-fA-F-]+))?/i);
  if (weeklyMatch) {
    const planId = weeklyMatch[1];
    navigationRef.navigate('WeeklyPlan', planId ? { planId } : undefined);
    return true;
  }

  // Profile: mogu://profile
  if (/^(?:mogu:\/\/|\/)profile/i.test(trimmed)) {
    navigationRef.navigate('Main', { screen: 'Profile' });
    return true;
  }

  // Health: mogu://health
  if (/^(?:mogu:\/\/|\/)health/i.test(trimmed)) {
    navigationRef.navigate('Main', { screen: 'Health' });
    return true;
  }

  // Notifications: mogu://notifications
  if (/^(?:mogu:\/\/|\/)notifications?/i.test(trimmed)) {
    navigationRef.navigate('Notification');
    return true;
  }

  // Fallback default
  navigationRef.navigate('Notification');
  return true;
}
