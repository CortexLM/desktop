import type { JSX } from 'solid-js';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { SettingGroup, SettingRow, Toggle } from '../settings/controls.tsx';

export function ResearchScreen(props: {
  signedIn: boolean;
  error?: string;
  onSignIn: () => void;
}): JSX.Element {
  if (props.error) {
    return <HonestState kind="error" title="Research failed" body={props.error} />;
  }
  if (!props.signedIn) {
    return (
      <>
        <PageHeader title="Research" subtitle="Cited answers from live sources." />
        <PageBody width="list">
          <HonestState
            kind="signed-out"
            title="Research needs a Cortex account"
            body="Live sources run on Cortex, not in this tab. Sign in to queue a brief."
            actionLabel="Sign in"
            onAction={props.onSignIn}
          />
        </PageBody>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Research" subtitle="Cited answers from live sources." />
      <PageBody width="list">
        <HonestState
          kind="empty"
          title="Nothing is queued"
          body="Start a research brief from Chat. Finished briefs land here with their citations."
        />
      </PageBody>
    </>
  );
}

export function ChatSettingsScreen(props: {
  streamReplies: boolean;
  onStreamReplies: (value: boolean) => void;
  notifyMentions: boolean;
  onNotifyMentions: (value: boolean) => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Settings" subtitle="Defaults for Chat on this device." />
      <PageBody width="settings">
        <SettingGroup label="Replies">
          <SettingRow
            title="Stream replies"
            description="Show tokens as they arrive."
            control={
              <Toggle
                checked={props.streamReplies}
                onChange={props.onStreamReplies}
                label="Stream replies"
              />
            }
          />
        </SettingGroup>
        <SettingGroup label="Notifications">
          <SettingRow
            title="Mentions"
            description="Banner when someone mentions you."
            control={
              <Toggle
                checked={props.notifyMentions}
                onChange={props.onNotifyMentions}
                label="Notify on mentions"
              />
            }
          />
        </SettingGroup>
      </PageBody>
    </>
  );
}
