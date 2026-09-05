import { type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { markWelcomeSeen, WelcomeScreen } from '../screens/welcome/welcome-screen.tsx';

export function WelcomeRoute(): JSX.Element {
  const navigate = useNavigate();

  return (
    <WelcomeScreen
      onGetStarted={() => {
        markWelcomeSeen();
        navigate('/sign-in');
      }}
      onSkip={() => {
        markWelcomeSeen();
        navigate('/');
      }}
    />
  );
}
