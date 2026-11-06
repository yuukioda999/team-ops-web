import { Outlet, type RouteObject } from 'react-router'
import { HomeRedirect, RequireSignedIn } from './features/auth/guards.tsx'
import { LoginPage } from './features/auth/LoginPage.tsx'
import { SessionProvider } from './features/auth/SessionProvider.tsx'
import { SettingsPage } from './features/auth/SettingsPage.tsx'
import { VerifyEmailChangePage } from './features/auth/VerifyEmailChangePage.tsx'
import { VerifyLoginPage } from './features/auth/VerifyLoginPage.tsx'
import { WelcomePage } from './features/auth/WelcomePage.tsx'
import { InvitationPage } from './features/invitations/InvitationPage.tsx'
import { JoinPage } from './features/invitations/JoinPage.tsx'
import { JoinRequestsPage } from './features/invitations/JoinRequestsPage.tsx'
import { NewTeamPage } from './features/teams/NewTeamPage.tsx'
import { StartPage } from './features/teams/StartPage.tsx'
import { TeamHomePage } from './features/teams/TeamHomePage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

/** All screens. Exported separately so tests can render any path with a memory router. */
export const routes: RouteObject[] = [
  {
    element: (
      <SessionProvider>
        <Outlet />
      </SessionProvider>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'login/verify', element: <VerifyLoginPage /> },
      { path: 'welcome', element: <RequireSignedIn allowIncomplete><WelcomePage /></RequireSignedIn> },
      { path: 'start', element: <RequireSignedIn><StartPage /></RequireSignedIn> },
      { path: 'teams/new', element: <RequireSignedIn><NewTeamPage /></RequireSignedIn> },
      { path: 'teams/:teamId', element: <RequireSignedIn><TeamHomePage /></RequireSignedIn> },
      { path: 'teams/:teamId/invitation', element: <RequireSignedIn><InvitationPage /></RequireSignedIn> },
      { path: 'teams/:teamId/join-requests', element: <RequireSignedIn><JoinRequestsPage /></RequireSignedIn> },
      // Opened from an invitation link, logged in or not (AC-002-05)
      { path: 'join', element: <JoinPage /> },
      { path: 'settings', element: <RequireSignedIn><SettingsPage /></RequireSignedIn> },
      { path: 'settings/email/verify', element: <RequireSignedIn><VerifyEmailChangePage /></RequireSignedIn> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

