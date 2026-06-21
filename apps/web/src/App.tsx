import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { DevLogPanel } from './components/common/DevLogPanel';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <DevLogPanel />
    </>
  );
}
