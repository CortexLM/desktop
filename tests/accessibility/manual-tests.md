# Manual Accessibility Testing Checklist

## Screen Reader Testing

### VoiceOver (macOS)
- [ ] Enable VoiceOver: Cmd+F5
- [ ] Navigate through all main sections
- [ ] Verify all interactive elements are announced
- [ ] Check that button purposes are clear
- [ ] Verify form labels are read correctly
- [ ] Test chat interface messaging flow
- [ ] Verify code blocks are accessible

### NVDA (Windows)
- [ ] Install and start NVDA
- [ ] Navigate through all main sections
- [ ] Verify all interactive elements are announced
- [ ] Check that headings structure makes sense
- [ ] Test forms and input fields
- [ ] Verify modal dialogs are accessible

### Expected Behaviors
- All buttons should announce their purpose
- Links should announce they are links
- Images should have descriptive alt text
- Form fields should have associated labels
- Error messages should be announced
- Loading states should be communicated
- Keyboard focus should be announced

## Keyboard Navigation Testing

### Tab Navigation
- [ ] Tab through entire application
- [ ] Verify logical tab order
- [ ] All interactive elements are reachable
- [ ] No keyboard traps exist
- [ ] Skip navigation links work (if present)
- [ ] Tab order follows visual order

### Arrow Key Navigation
- [ ] Arrow keys work in menus
- [ ] Arrow keys work in select dropdowns
- [ ] Arrow keys work in radio groups
- [ ] Arrow keys work in tab panels

### Keyboard Shortcuts
- [ ] Enter activates buttons
- [ ] Space activates buttons and checkboxes
- [ ] Escape closes dialogs and modals
- [ ] Escape cancels operations where appropriate
- [ ] All custom shortcuts are documented
- [ ] Shortcuts don't conflict with screen readers

### Focus Management
- [ ] Focus moves to opened dialogs
- [ ] Focus returns after dialog closes
- [ ] Focus visible at all times
- [ ] Focus indicator has 3:1 contrast ratio
- [ ] Focus doesn't get lost on page updates

## Color and Contrast

### Text Contrast (WCAG AA: 4.5:1 for normal, 3:1 for large)
- [ ] Body text against background
- [ ] Button text against button background
- [ ] Link text against background
- [ ] Placeholder text (should be 4.5:1)
- [ ] Disabled text (should still meet contrast)
- [ ] Error messages
- [ ] Success messages

### UI Component Contrast (WCAG AA: 3:1)
- [ ] Button borders
- [ ] Input field borders
- [ ] Focus indicators
- [ ] Icons (non-decorative)
- [ ] Graphical objects

### Color Dependence
- [ ] No information conveyed by color alone
- [ ] Error states use icons or text
- [ ] Success states use icons or text
- [ ] Links are underlined or have other indicators
- [ ] Charts/graphs have patterns or labels

## Forms and Inputs

### Labels
- [ ] All inputs have visible labels
- [ ] Labels are programmatically associated (for/id)
- [ ] Placeholder text doesn't replace labels
- [ ] Required fields are marked
- [ ] Field purposes are clear

### Error Handling
- [ ] Errors are announced by screen readers
- [ ] Error messages are specific and helpful
- [ ] Errors are associated with fields (aria-describedby)
- [ ] Users can navigate to and fix errors
- [ ] Inline validation doesn't interrupt

### Autocomplete
- [ ] Autocomplete suggestions are keyboard accessible
- [ ] Selected suggestion is announced
- [ ] User can dismiss suggestions
- [ ] ARIA attributes are correct (aria-autocomplete, aria-expanded)

## Semantic HTML

### Document Structure
- [ ] Page has single h1
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Landmarks are used (<nav>, <main>, <aside>)
- [ ] Sections are properly labeled
- [ ] Lists are marked up as lists

### Interactive Elements
- [ ] Buttons use <button> or role="button"
- [ ] Links use <a> with href
- [ ] Forms use <form> element
- [ ] Tables use proper table markup
- [ ] No div/span buttons without proper roles

## ARIA Usage

### ARIA Labels
- [ ] aria-label used for icon-only buttons
- [ ] aria-labelledby used for complex labels
- [ ] aria-describedby used for additional context
- [ ] aria-live regions for dynamic content
- [ ] aria-current for current page/item

### ARIA States
- [ ] aria-expanded for expandable elements
- [ ] aria-pressed for toggle buttons
- [ ] aria-selected for selected items
- [ ] aria-disabled for disabled elements
- [ ] aria-hidden for decorative elements

### ARIA Roles
- [ ] Roles match actual functionality
- [ ] Required ARIA attributes present
- [ ] No invalid ARIA usage
- [ ] Native HTML preferred over ARIA

## Dynamic Content

### Loading States
- [ ] Loading indicators are announced
- [ ] Users know content is loading
- [ ] Focus management during loading
- [ ] Skeleton screens have proper labels

### Error States
- [ ] Errors are announced
- [ ] Focus moves to error (if appropriate)
- [ ] Error dismissal is accessible
- [ ] Users can retry actions

### Success States
- [ ] Success messages are announced
- [ ] Confirmation dialogs are accessible
- [ ] Users can proceed or dismiss

## Images and Media

### Images
- [ ] All images have alt text
- [ ] Decorative images have alt=""
- [ ] Complex images have long descriptions
- [ ] SVG icons have proper roles and labels
- [ ] Icon buttons have text alternatives

### Code Blocks
- [ ] Code blocks are properly labeled
- [ ] Language is indicated
- [ ] Copy buttons are accessible
- [ ] Syntax highlighting doesn't rely on color alone

## Testing Tools Checklist

### Automated Tools
- [x] axe DevTools (browser extension)
- [x] Lighthouse accessibility audit
- [x] WAVE browser extension
- [ ] Pa11y or axe-core CLI
- [ ] Color contrast checker

### Manual Testing
- [ ] Keyboard-only navigation
- [ ] VoiceOver/NVDA testing
- [ ] Zoom to 200% (text reflow)
- [ ] High contrast mode
- [ ] Reduced motion preferences

## Test Results Location
- Automated test results: `tests/accessibility/results/`
- Manual test notes: `ACCESSIBILITY_AUDIT.md`
- Screenshots: `tests/accessibility/screenshots/`
