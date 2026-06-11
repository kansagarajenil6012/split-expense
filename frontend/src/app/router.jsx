import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './guards';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import GroupLayout from '../layouts/GroupLayout';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import GroupsPage from '../pages/groups/GroupsPage';
import GroupDetailsPage from '../pages/groups/GroupDetailsPage';
import ExpensesPage from '../pages/expenses/ExpensesPage';
import AddExpensePage from '../pages/expenses/AddExpensePage';
import EditExpensePage from '../pages/expenses/EditExpensePage';
import ExpenseDetailPage from '../pages/expenses/ExpenseDetailPage';
import SettlementPage from '../pages/settlement/SettlementPage';
import ReportsPage from '../pages/reports/ReportsPage';
import ActivityTimelinePage from '../pages/activity/ActivityTimelinePage';
import NotificationsPage from '../pages/notifications/NotificationsPage';
import ProfilePage from '../pages/profile/ProfilePage';
import AcceptInvitePage from '../pages/groups/AcceptInvitePage';
import BudgetPage from '../pages/budget/BudgetPage';
import RecurringExpensesPage from '../pages/recurring/RecurringExpensesPage';
import EventsPage from '../pages/groups/EventsPage';
import CorporatePage from '../pages/groups/CorporatePage';
import ClubPage from '../pages/groups/ClubPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/join/:token" element={<AcceptInvitePage />} />
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/groups/:groupId" element={<GroupLayout />}>
            <Route index element={<GroupDetailsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/new" element={<AddExpensePage />} />
            <Route path="expenses/:expenseId" element={<ExpenseDetailPage />} />
            <Route path="expenses/:expenseId/edit" element={<EditExpensePage />} />
            <Route path="settlement" element={<SettlementPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="activity" element={<ActivityTimelinePage />} />
            <Route path="budgets" element={<BudgetPage />} />
            <Route path="recurring" element={<RecurringExpensesPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="corporate" element={<CorporatePage />} />
            <Route path="club" element={<ClubPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
