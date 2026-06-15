import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { Dashboard } from '@/pages/Dashboard';
import { Wardrobe } from '@/pages/Wardrobe';
import { WardrobeAdd } from '@/pages/WardrobeAdd';
import { Outfits } from '@/pages/Outfits';
import { OutfitEditor } from '@/pages/OutfitEditor';
import { OutfitFitting } from '@/pages/OutfitFitting';
import { Avatars } from '@/pages/Avatars';
import { Recommendations } from '@/pages/Recommendations';
import { Settings } from '@/pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/auth',
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/wardrobe', element: <Wardrobe /> },
      { path: '/wardrobe/add', element: <WardrobeAdd /> },
      { path: '/outfits', element: <Outfits /> },
      { path: '/outfits/new', element: <OutfitEditor /> },
      { path: '/outfits/:id/fitting', element: <OutfitFitting /> },
      { path: '/avatars', element: <Avatars /> },
      { path: '/recommendations', element: <Recommendations /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);
