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
import { AuditLogPage } from './features/members/AuditLogPage.tsx'
import { MemberPage } from './features/members/MemberPage.tsx'
import { MembersPage } from './features/members/MembersPage.tsx'
import { TeamSettingsPage } from './features/teams/TeamSettingsPage.tsx'
import { EditNoticePage } from './features/notices/EditNoticePage.tsx'
import { NewNoticePage } from './features/notices/NewNoticePage.tsx'
import { NoticePage } from './features/notices/NoticePage.tsx'
import { NoticeStatusPage } from './features/notices/NoticeStatusPage.tsx'
import { NoticesPage } from './features/notices/NoticesPage.tsx'
import { ScheduledNoticesPage } from './features/notices/ScheduledNoticesPage.tsx'
import { ImportPage } from './features/players/ImportPage.tsx'
import { PlayerPage } from './features/players/PlayerPage.tsx'
import { RosterPage } from './features/players/RosterPage.tsx'
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
      { path: 'teams/:teamId/notices', element: <RequireSignedIn><NoticesPage /></RequireSignedIn> },
      { path: 'teams/:teamId/notices/new', element: <RequireSignedIn><NewNoticePage /></RequireSignedIn> },
      { path: 'teams/:teamId/notices/scheduled', element: <RequireSignedIn><ScheduledNoticesPage /></RequireSignedIn> },
      { path: 'teams/:teamId/notices/:noticeId', element: <RequireSignedIn><NoticePage /></RequireSignedIn> },
      { path: 'teams/:teamId/notices/:noticeId/status', element: <RequireSignedIn><NoticeStatusPage /></RequireSignedIn> },
      { path: 'teams/:teamId/notices/:noticeId/edit', element: <RequireSignedIn><EditNoticePage /></RequireSignedIn> },
      { path: 'teams/:teamId/members', element: <RequireSignedIn><MembersPage /></RequireSignedIn> },
      { path: 'teams/:teamId/members/:membershipId', element: <RequireSignedIn><MemberPage /></RequireSignedIn> },
      { path: 'teams/:teamId/settings', element: <RequireSignedIn><TeamSettingsPage /></RequireSignedIn> },
      { path: 'teams/:teamId/audit-logs', element: <RequireSignedIn><AuditLogPage /></RequireSignedIn> },
      { path: 'teams/:teamId/players', element: <RequireSignedIn><RosterPage /></RequireSignedIn> },
      { path: 'teams/:teamId/players/new', element: <RequireSignedIn><PlayerPage /></RequireSignedIn> },
      { path: 'teams/:teamId/players/import', element: <RequireSignedIn><ImportPage /></RequireSignedIn> },
      { path: 'teams/:teamId/players/:playerId', element: <RequireSignedIn><PlayerPage /></RequireSignedIn> },
      // Opened from an invitation link, logged in or not (AC-002-05)
      { path: 'join', element: <JoinPage /> },
      { path: 'settings', element: <RequireSignedIn><SettingsPage /></RequireSignedIn> },
      { path: 'settings/email/verify', element: <RequireSignedIn><VerifyEmailChangePage /></RequireSignedIn> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

