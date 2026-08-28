// Paper JSX export - reference only, not compiled.
// Section "chat-components" (node 602-0) of the "Chat states" page.
// Regenerate with: bun run paper:jsx
(
    <div style={{ backgroundColor: 'var(--color-bg)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontSynthesis: 'none', height: 'fit-content', MozOsxFontSmoothing: 'grayscale', overflow: 'clip', paddingBottom: '64px', WebkitFontSmoothing: 'antialiased', width: '1440px' }}>
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '12px', paddingInline: '64px', paddingTop: '64px', width: '1440px' }}>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-green)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '11px', letterSpacing: '0.08em', lineHeight: '14px' }}>
          COMPONENTS · CHAT
        </div>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>
          Chat state components — dev spec
        </div>
        <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', lineHeight: '21px', maxWidth: '760px' }}>
          Reusable pieces behind the chat states: tool call rows, the thinking dropdown, file cards, search chips, citations and regeneration pagination. Sizes and tokens annotated below each specimen.
        </div>
      </div>
      <div style={{ boxSizing: 'border-box', display: 'flex', gap: '24px', paddingInline: '64px', paddingTop: '12px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            TOOL CALL ROW · COLLAPSED STATES
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '32px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <circle cx="11" cy="11" r="7" fill="none" stroke="#6E6A62" strokeWidth="1.75" />
                <path d="M20 20l-4.3-4.3" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }}>
                Searched the web
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M5 13l4 4 10-10" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M6 9l6 6 6-6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '32px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="var(--color-green)" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }}>
                Analyzing data…
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                6s
              </div>
            </div>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '32px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke="#A23544" strokeWidth="1.75" />
                <path d="M12 8v4M12 15.5v.5" fill="none" stroke="#A23544" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <div style={{ boxSizing: 'border-box', color: '#A23544', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }}>
                Couldn't read page
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M6 9l6 6 6-6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            row 32px · icon 16 stroke 1.75 · label Inter 14/20 medium text-muted (running: text, error: #A23544) · check 13 · chevron 14 · spinner --color-green
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            THINKING DROPDOWN · COLLAPSED + EXPANDED
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '24px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                Thought for 12 seconds
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M6 9l6 6 6-6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '28px' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '3px' }}>
                  <div style={{ backgroundColor: 'var(--color-green)', borderRadius: '999px', boxSizing: 'border-box', flexShrink: '0', height: '5px', width: '5px' }} />
                  <div style={{ backgroundColor: 'var(--color-green)', borderRadius: '999px', boxSizing: 'border-box', flexShrink: '0', height: '5px', opacity: '0.55', width: '5px' }} />
                  <div style={{ backgroundColor: 'var(--color-green)', borderRadius: '999px', boxSizing: 'border-box', flexShrink: '0', height: '5px', opacity: '0.25', width: '5px' }} />
                </div>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }}>
                  Thinking
                </div>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', lineHeight: '20px' }}>
                  · 12s
                </div>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-green-tint-8)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-green-on-tint)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 500, lineHeight: '14px' }}>
                    High
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M6 15l6-6 6 6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ boxSizing: 'border-box', display: 'flex', gap: '12px' }}>
                <div style={{ alignSelf: 'stretch', backgroundColor: 'var(--color-green-tint-16)', borderRadius: '1px', boxSizing: 'border-box', flexShrink: '0', width: '2px' }} />
                <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '17px' }}>
                      Weighing the common explanation
                    </div>
                    <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '18px', maxWidth: '440px' }}>
                      The user suspects tracking cookies — audits struggle to reproduce it, so don't present it as fact.
                    </div>
                  </div>
                  <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 500, lineHeight: '17px' }}>
                      Finding the real drivers
                    </div>
                    <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '18px', maxWidth: '440px' }}>
                      Fare classes close in real time; cached aggregator results correct on refresh.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            trigger Inter 13.5/18 medium text-muted · dots 5px green (opacity 1/.55/.25, animated) · level pill 20px green-tint-8 · rail 2px green-tint-16 · step title Inter 13 medium, body 12.5/18 muted
          </div>
        </div>
      </div>
      <div style={{ boxSizing: 'border-box', display: 'flex', gap: '24px', paddingInline: '64px', paddingTop: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            GENERATED FILE CARD
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '12px', maxWidth: '420px', paddingBlock: '12px', paddingInline: '14px' }}>
              <div style={{ alignItems: 'center', backgroundColor: 'var(--color-green-tint-8)', borderRadius: '10px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '36px', justifyContent: 'center', width: '36px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill="none" stroke="var(--color-green)" strokeWidth="1.75" strokeLinejoin="round" />
                  <path d="M14 3v5h5" fill="none" stroke="var(--color-green)" strokeWidth="1.75" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: '1', gap: '1px' }}>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                  kyoto-itinerary.md
                </div>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  Markdown · 4.2 KB · just now
                </div>
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', paddingInline: '12px' }}>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', fontWeight: 500, lineHeight: '16px' }}>
                  Open
                </div>
              </div>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            card radius 12 · icon tile 36px green-tint-8 radius 10 · name Inter 13.5 medium · meta Inter 12 muted · Open pill 28px border · max-width 420
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            SEARCH CHIPS · CITATIONS · SOURCE PILLS
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '28px', paddingInline: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="11" cy="11" r="7" fill="none" stroke="#6E6A62" strokeWidth="1.75" />
                  <path d="M20 20l-4.3-4.3" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  kyoto foliage peak november 2026
                </div>
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '6px', height: '28px', paddingInline: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="11" cy="11" r="7" fill="none" stroke="#6E6A62" strokeWidth="1.75" />
                  <path d="M20 20l-4.3-4.3" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  tokyo gardens autumn color dates
                </div>
              </div>
            </div>
            <div style={{ alignItems: 'baseline', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '520px' }}>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px' }}>
                Peak color reaches central Kyoto in late November
              </div>
              <div style={{ alignItems: 'center', backgroundColor: 'var(--color-green-tint-8)', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '18px', justifyContent: 'center', width: '18px' }}>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-green-on-tint)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '10.5px', fontWeight: 600, lineHeight: '13px' }}>
                  1
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Source Serif 4", system-ui, sans-serif', fontSize: '16px', lineHeight: '26px' }}>
                — about a week after Tokyo's gardens turn.
              </div>
            </div>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '7px', height: '30px', paddingInline: '12px' }}>
                <div style={{ alignItems: 'center', backgroundColor: 'var(--color-green-tint-16)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '16px', justifyContent: 'center', width: '16px' }}>
                  <div style={{ boxSizing: 'border-box', color: 'var(--color-green-on-tint)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '9px', fontWeight: 600, lineHeight: '11px' }}>
                    J
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  japan-guide.com
                </div>
              </div>
              <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '30px', paddingInline: '12px' }}>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  +2 more
                </div>
              </div>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            query chip 28px border · citation 18px sq radius 6 green-tint-8, Inter 10.5 semibold green-on-tint · source pill 30px, favicon 16 · all pills radius 999
          </div>
        </div>
      </div>
      <div style={{ boxSizing: 'border-box', display: 'flex', gap: '24px', paddingInline: '64px', paddingTop: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            REGENERATION PAGINATION · MESSAGE ACTION BAR
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '14px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M15 6l-6 6 6 6" fill="none" stroke="#B4AFA5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', fontWeight: 500, lineHeight: '16px' }}>
                  2 / 3
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M9 6l6 6-6 6" fill="none" stroke="#3E3B36" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ backgroundColor: 'var(--color-border)', boxSizing: 'border-box', flexShrink: '0', height: '16px', width: '1px' }} />
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M20 11a8 8 0 1 0-2.34 6.34M20 5v6h-6" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  Regenerate
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="#6E6A62" strokeWidth="1.75" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12.5px', lineHeight: '16px' }}>
                  Copy
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M7 11v9M7 11l4-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.3l-1 5.7a2 2 0 0 1-2 1.7H7" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M17 13V4M17 13l-4 7a2 2 0 0 1-2-2v-4H5.8a2 2 0 0 1-2-2.3l1-5.7a2 2 0 0 1 2-1.7H17" fill="none" stroke="#6E6A62" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            arrows 14 — inactive #B4AFA5, active text · counter Inter 12.5 medium · divider 1×16 border · actions icon 14 + Inter 12.5 muted · gap 14
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)', borderRadius: '16px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexShrink: '0', gap: '14px', padding: '24px', width: '644px' }}>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', lineHeight: '14px' }}>
            AGENT PROGRESS STEP · DONE / RUNNING / PENDING
          </div>
          <div style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', paddingBlock: '18px', paddingInline: '20px' }}>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
              <div style={{ alignItems: 'center', backgroundColor: 'var(--color-green-tint-16)', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '18px', justifyContent: 'center', width: '18px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M5 13l4 4 10-10" fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', lineHeight: '18px' }}>
                Compared 12 flight options (ANA, JAL, Zipair)
              </div>
            </div>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="var(--color-green)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', fontWeight: 500, lineHeight: '18px' }}>
                Drafting the day-by-day itinerary…
              </div>
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                1m 12s
              </div>
            </div>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
              <div style={{ borderColor: 'var(--color-border)', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1.5px', boxSizing: 'border-box', flexShrink: '0', height: '18px', width: '18px' }} />
              <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13.5px', lineHeight: '18px' }}>
                Estimate the total budget
              </div>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", system-ui, sans-serif', fontSize: '10px', lineHeight: '16px' }}>
            status disc 18px — done: green-tint-16 + check 10, running: green spinner stroke 2, pending: 1.5px border ring · label Inter 13.5 (running medium) · elapsed mono 11
          </div>
        </div>
      </div>
    </div>
  )
