// Paper JSX export - reference only, not compiled.
// Section "chat-errors" (node 5ZN-0) of the "Chat states" page.
// Regenerate with: bun run paper:jsx
(
    <div style={{ backgroundColor: '#FFFFFF', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontSynthesis: 'none', gap: '28px', height: 'fit-content', MozOsxFontSmoothing: 'grayscale', overflow: 'clip', padding: '40px', WebkitFontSmoothing: 'antialiased', width: '1440px' }}>
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', width: '1008px' }}>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', lineHeight: '16px' }}>
          CHAT STATES · 07
        </div>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>
          Errors & edge states
        </div>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: '18px', maxWidth: '860px' }}>
          The unhappy paths, kept calm: a network failure with Retry, the plan limit with an upgrade CTA, a user-stopped response with Continue, and a regenerated answer with ‹ 2/3 › pagination. Red stays muted; green is reserved for the one decisive action.
        </div>
      </div>
      <div style={{ boxSizing: 'border-box', display: 'flex', gap: '32px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '11px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            LIGHT
          </div>
          <div style={{ backgroundColor: '#FAF8F4', borderColor: '#E5E1D8', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px', width: '664px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                NETWORK ERROR
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#A2354409', borderColor: '#A2354426', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '12px', paddingBlock: '12px', paddingInline: '14px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#A23544" strokeWidth="1.75" />
                  <path d="M12 8v4M12 15.5v.5" fill="#000000" stroke="#A23544" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: '1', gap: '1px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                    Connection lost — your message wasn't sent.
                  </div>
                  <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '17px' }}>
                    Check your network and try again. Your draft is saved.
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E1D8', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '6px', height: '30px', paddingInline: '14px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M20 11a8 8 0 1 0-2.34 6.34M20 5v6h-6" fill="none" stroke="#1F1D1A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Retry
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                PLAN LIMIT REACHED
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E1D8', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '12px', paddingBlock: '14px', paddingInline: '16px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E8EAE6', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '34px', justifyContent: 'center', width: '34px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#1F4945" strokeWidth="1.75" />
                    <path d="M12 7v5l3 3" fill="none" stroke="#1F4945" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: '1', gap: '1px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                    You've reached today's limit for Cortex 2 Reason
                  </div>
                  <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '17px' }}>
                    Free plan · resets in 3h 12m. Cortex 2 Auto stays available.
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#1F4945', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '32px', paddingInline: '16px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#FFFFFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Upgrade to Pro
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                STOPPED BY USER
              </div>
              <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px', maxWidth: '600px' }}>
                Here's a first draft of your cover letter — I've opened with the gallery internship because it maps directly to the curator role, then —
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#2418000D', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '26px', paddingInline: '10px' }}>
                  <div style={{ backgroundColor: '#6E6A62', borderRadius: '2px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 500, lineHeight: '15px' }}>
                    Stopped
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E1D8', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '30px', paddingInline: '14px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M6 4l14 8-14 8z" fill="#1F1D1A" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Continue
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                REGENERATED · VERSION PAGINATION
              </div>
              <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px', maxWidth: '600px' }}>
                Lead with the number. Opening your email with "we cut onboarding time by 40%" earns the reader's next thirty seconds — save the feature list for paragraph two, and close with a single clear ask.
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '14px' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M15 6l-6 6 6 6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: '#1F1D1A', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', fontWeight: 500, lineHeight: '16px' }}>
                    2 / 3
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M9 6l6 6-6 6" fill="none" stroke="#1F1D1A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ backgroundColor: '#E5E1D8', boxSizing: 'border-box', flexShrink: '0', height: '16px', width: '1px' }} />
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M20 11a8 8 0 1 0-2.34 6.34M20 5v6h-6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                    Regenerate
                  </div>
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="#6E6A62" strokeWidth="1.75" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                    Copy
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontStyle: 'italic', lineHeight: '16px' }}>
                  Draft 2 kept · drafts 1 and 3 available
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ boxSizing: 'border-box', color: '#6E6A62', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '11px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            DARK
          </div>
          <div style={{ backgroundColor: '#211F1C', borderColor: '#3A362F', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px', width: '664px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                NETWORK ERROR
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#C4707B12', borderColor: '#C4707B30', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '12px', paddingBlock: '12px', paddingInline: '14px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#C4707B" strokeWidth="1.75" />
                  <path d="M12 8v4M12 15.5v.5" fill="none" stroke="#C4707B" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: '1', gap: '1px' }}>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                    Connection lost — your message wasn't sent.
                  </div>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '17px' }}>
                    Check your network and try again. Your draft is saved.
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-surface)', borderColor: 'var(--color-dark-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '6px', height: '30px', paddingInline: '14px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M20 11a8 8 0 1 0-2.34 6.34M20 5v6h-6" fill="none" stroke="#EDEAE3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Retry
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                PLAN LIMIT REACHED
              </div>
              <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-surface)', borderColor: 'var(--color-dark-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '12px', paddingBlock: '14px', paddingInline: '16px' }}>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-green-tint-16)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '34px', justifyContent: 'center', width: '34px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#47A79E" strokeWidth="1.75" />
                    <path d="M12 7v5l3 3" fill="none" stroke="#47A79E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: '1', gap: '1px' }}>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                    You've reached today's limit for Cortex 2 Reason
                  </div>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '17px' }}>
                    Free plan · resets in 3h 12m. Cortex 2 Auto stays available.
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-green)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '32px', paddingInline: '16px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#211F1C', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Upgrade to Pro
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                STOPPED BY USER
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px', maxWidth: '600px' }}>
                Here's a first draft of your cover letter — I've opened with the gallery internship because it maps directly to the curator role, then —
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-hover)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '26px', paddingInline: '10px' }}>
                  <div style={{ backgroundColor: 'var(--color-dark-text-muted)', borderRadius: '2px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 500, lineHeight: '15px' }}>
                    Stopped
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-dark-surface)', borderColor: 'var(--color-dark-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '30px', paddingInline: '14px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M6 4l14 8-14 8z" fill="#EDEAE3" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '16px' }}>
                    Continue
                  </div>
                </div>
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
                REGENERATED · VERSION PAGINATION
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px', maxWidth: '600px' }}>
                Lead with the number. Opening your email with "we cut onboarding time by 40%" earns the reader's next thirty seconds — save the feature list for paragraph two, and close with a single clear ask.
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '14px' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M15 6l-6 6 6 6" fill="none" stroke="#9B968C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', fontWeight: 500, lineHeight: '16px' }}>
                    2 / 3
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M9 6l6 6-6 6" fill="none" stroke="#EDEAE3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ backgroundColor: 'var(--color-dark-border)', boxSizing: 'border-box', flexShrink: '0', height: '16px', width: '1px' }} />
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M20 11a8 8 0 1 0-2.34 6.34M20 5v6h-6" fill="none" stroke="#9B968C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                    Regenerate
                  </div>
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="#9B968C" strokeWidth="1.75" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="#9B968C" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                    Copy
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-dark-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontStyle: 'italic', lineHeight: '16px' }}>
                  Draft 2 kept · drafts 1 and 3 available
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
