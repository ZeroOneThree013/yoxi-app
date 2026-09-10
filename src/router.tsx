import { createHashRouter, Navigate } from 'react-router-dom';
import App from './App';
import Onboarding1 from './screens/Onboarding1';
import Onboarding2 from './screens/Onboarding2';
import Quiz from './screens/Quiz';
import Home from './screens/Home';
import Tasks from './screens/Tasks';
import TaskDaily from './screens/TaskDaily';
import TaskBadges from './screens/TaskBadges';
import Places from './screens/Places';
import QuickRide from './screens/QuickRide';
import Upload1 from './screens/Upload1';
import Upload2 from './screens/Upload2';
import TaskSelect from './screens/TaskSelect';
import RouteScreen from './screens/RouteScreen';
import Confirm from './screens/Confirm';

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'onboarding/1', element: <Onboarding1 /> },
      { path: 'onboarding/2', element: <Onboarding2 /> },
      { path: 'onboarding/quiz', element: <Quiz /> },
      { path: 'quiz', element: <Quiz /> },
      { path: 'home', element: <Home /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'tasks/daily', element: <TaskDaily /> },
      { path: 'tasks/badges', element: <TaskBadges /> },
      { path: 'places', element: <Places /> },
      { path: 'places/upload', element: <Upload1 /> },
      { path: 'places/upload/extract', element: <Upload2 /> },
      { path: 'quick-ride', element: <QuickRide /> },
      { path: 'plan', element: <TaskSelect /> },
      { path: 'route', element: <RouteScreen /> },
      { path: 'confirm', element: <Confirm /> },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);
