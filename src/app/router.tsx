import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ElderAppLayout } from './layouts/ElderAppLayout'
import { FamilyAppLayout } from './layouts/FamilyAppLayout'
import { LandingRedirect, RequireOnboarding, RequireRole } from './RouteGuards'
import { ElderHomePage } from '../pages/elder/ElderHomePage'
import { ElderContactsPage } from '../pages/elder/ElderContactsPage'
import { ElderConversationPage } from '../pages/elder/ElderConversationPage'
import { ElderHelpPage } from '../pages/elder/ElderHelpPage'
import { FamilyTodayPage } from '../pages/family/FamilyTodayPage'
import { FamilyStatusPage } from '../pages/family/FamilyStatusPage'
import { FamilyChatsPage } from '../pages/family/FamilyChatsPage'
import { FamilyConversationPage } from '../pages/family/FamilyConversationPage'
import { FamilyMemoriesPage } from '../pages/family/FamilyMemoriesPage'
import { FamilyCollaborationPage } from '../pages/family/FamilyCollaborationPage'
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
              { path: 'status', element: <FamilyStatusPage /> },
              { path: 'chats', element: <FamilyChatsPage /> },
              { path: 'chats/:conversationId', element: <FamilyConversationPage /> },
              { path: 'memories', element: <FamilyMemoriesPage /> },
              { path: 'collaboration', element: <FamilyCollaborationPage /> },
            ],
          },
        ],
      },
    ],
  },
])
