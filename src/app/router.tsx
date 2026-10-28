import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ElderAppLayout } from './layouts/ElderAppLayout'
import { FamilyAppLayout } from './layouts/FamilyAppLayout'
import { LandingRedirect, RequireOnboarding, RequireRole } from './RouteGuards'
import { ElderHomePage } from '../pages/elder/ElderHomePage'
import { ElderContactsPage } from '../pages/elder/ElderContactsPage'
import { ElderConversationPage } from '../pages/elder/ElderConversationPage'
import { ElderHelpPage } from '../pages/elder/ElderHelpPage'
import { ElderHeartsPage } from '../pages/elder/ElderHeartsPage'
import { FamilyTodayPage } from '../pages/family/FamilyTodayPage'
import { FamilyEmotionDayPage, FamilyTodayEmotionPage, FamilyWeeklyEmotionPage } from '../pages/family/FamilyEmotionDetailPages'
import { FamilyStatusPage } from '../pages/family/FamilyStatusPage'
import { FamilyChatsPage } from '../pages/family/FamilyChatsPage'
import { FamilyConversationPage } from '../pages/family/FamilyConversationPage'
import { FamilyHeartsPage } from '../pages/family/FamilyHeartsPage'
import { FamilyMemoriesPage } from '../pages/family/FamilyMemoriesPage'
import { FamilyCollaborationPage } from '../pages/family/FamilyCollaborationPage'
import { FamilyImportantEventsPage } from '../pages/family/FamilyImportantEventsPage'
import { OnboardingPage } from '../pages/onboarding/OnboardingPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingRedirect />,
  },
  {
    path: '/welcome',
    element: <OnboardingPage />,
  },
  {
    element: <RequireOnboarding />,
    children: [
      {
        element: <RequireRole allowed={['elder']} />,
        children: [
          {
            path: '/elder',
            element: <ElderAppLayout />,
            children: [
              { index: true, element: <Navigate to="/elder/home" replace /> },
              { path: 'home', element: <ElderHomePage /> },
              { path: 'inbox', element: <ElderContactsPage /> },
              { path: 'contacts', element: <Navigate to="/elder/inbox" replace /> },
              { path: 'conversations/:conversationId', element: <ElderConversationPage /> },
              { path: 'hearts', element: <ElderHeartsPage /> },
              { path: 'memories', element: <Navigate to="/elder/home" replace /> },
              { path: 'help', element: <ElderHelpPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole allowed={['family', 'caregiver']} />,
        children: [
          {
            path: '/family',
            element: <FamilyAppLayout />,
            children: [
              { index: true, element: <Navigate to="/family/today" replace /> },
              { path: 'today', element: <FamilyTodayPage /> },
              { path: 'today/alerts', element: <FamilyTodayEmotionPage /> },
              { path: 'today/week', element: <FamilyWeeklyEmotionPage /> },
              { path: 'today/day/:dayKey', element: <FamilyEmotionDayPage /> },
              { path: 'status', element: <FamilyStatusPage /> },
              { path: 'chats', element: <FamilyChatsPage /> },
              { path: 'chats/:conversationId', element: <FamilyConversationPage /> },
              { path: 'hearts', element: <FamilyHeartsPage /> },
              { path: 'memories', element: <FamilyMemoriesPage /> },
              { path: 'collaboration', element: <FamilyCollaborationPage /> },
              { path: 'collaboration/events', element: <FamilyImportantEventsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
