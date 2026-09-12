import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const authState = vi.hoisted(() => ({
  token: null as string | null,
  user: null as null | { id: string; username: string; display_name: string; roles: string[] },
  loading: false,
  initialized: true,
  initialize: vi.fn(async () => undefined),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => (selector ? selector(authState) : authState),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.token = null;
    authState.user = null;
    authState.loading = false;
    authState.initialized = true;
    authState.initialize = vi.fn(async () => undefined);
  });

  it('redirects unauthenticated users to login', async () => {
    render(
      <MemoryRouter initialEntries={['/business/demo/topology']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/business/:businessId/topology" element={<div>secret</div>} />
          </Route>
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated users', async () => {
    authState.token = 'token';
    authState.user = {
      id: 'user-1',
      username: 'admin',
      display_name: 'Admin',
      roles: ['admin'],
    };

    render(
      <MemoryRouter initialEntries={['/business/demo/topology']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/business/:businessId/topology" element={<div>secret</div>} />
          </Route>
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('secret')).toBeInTheDocument();
    });
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });

  it('redirects authenticated users without required role back to home', async () => {
    authState.token = 'token';
    authState.user = {
      id: 'user-1',
      username: 'viewer',
      display_name: 'Viewer',
      roles: ['viewer'],
    };

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/" element={<div>home-page</div>} />
          <Route element={<ProtectedRoute requiredRoles={['admin']} />}>
            <Route path="/admin/users" element={<div>admin-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('home-page')).toBeInTheDocument();
    });
    expect(screen.queryByText('admin-page')).not.toBeInTheDocument();
  });
});
